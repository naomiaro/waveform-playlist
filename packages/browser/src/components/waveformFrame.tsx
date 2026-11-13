/**
 * What the two roots of the view share (#685): `WaveformRoot` (multitrack) and
 * `MediaElementWaveformRoot`. Internal: not exported from the package.
 *
 * A hook and not a component, so that it adds no component to either tree: a
 * root calls `useWaveformParts` on its children, works out what only its
 * provider knows (how long the timeline is, which rows there are and how tall),
 * and hands that to `useWaveformFrame`, which returns the scrolling frame with
 * the parts in their places.
 *
 * The frame reads shared hooks only (the view settings, the zoom, the playback
 * controls), so it runs under either provider.
 */
import React, {
  createElement,
  Fragment,
  useCallback,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Playlist,
  PlaylistInfoContext,
  useTheme,
  waveformColorToCss,
  type PlaylistInfo,
  type WaveformPlaylistTheme,
} from '@waveform-playlist/ui-components';
import {
  usePlaybackControls,
  usePlaylistView,
  usePlaylistZoom,
} from '../contexts/playlistContexts';
import {
  useSelectionDrag,
  AutomaticScrollFlag,
  SelectionPreviewContext,
  type UseSelectionDragOptions,
} from '../hooks/useSelectionDrag';
import {
  WaveformExtentContext,
  RootSeesRecordingPreviewContext,
  WaveformPartPlaceContext,
  WaveformRowsContext,
  type WaveformExtentValue,
  type WaveformRowsValue,
} from './waveformLayoutContext';
import { sortWaveformParts, WaveformTimescale } from './waveformParts';

/**
 * The parts of the timescale strip, each under a key made of its kind and
 * its number among that kind, so that one coming or going
 * (`{flag && <WaveformTimescale />}`) does not remount the others. The part
 * elements themselves are passed on untouched.
 */
function keyedByKind(parts: ReactNode[]): ReactElement[] {
  const seen = { timescale: 0, loop: 0 };
  return parts.map((part) => {
    const kind =
      React.isValidElement(part) && part.type === WaveformTimescale ? 'timescale' : 'loop';
    return createElement(Fragment, { key: `${kind}-${seen[kind]++}` }, part);
  });
}
import type { TracksMarkers } from './TrackRows';
import type { ResolvedViewOptions } from './WaveformViewOptions';

export interface WaveformPartsByPlace {
  /** The parts of the timescale strip in one element, or null when there is none. */
  timescale: ReactElement | null;
  /** The parts of the controls column, or undefined when there is none. */
  controls: ReactNode[] | undefined;
  /** Everything drawn in the scrolling tracks area, in order. */
  content: ReactElement;
  /** The per-clip parts the tracks part was given (all off without one). */
  tracksOptions: TracksMarkers;
  /** Width of the controls column the controls part asks for; 0 without one. */
  controlsWidth: number;
  /** Height of the timescale strip the timescale part asks for; 0 without a strip. */
  timescaleHeight: number;
}

/**
 * The root's children by place. The part elements are passed on as they were
 * given, never cloned: that is what lets React skip every part when the root
 * renders alone (same element, nothing to do). The memo only saves sorting
 * them again.
 */
export function useWaveformParts(children: ReactNode): WaveformPartsByPlace {
  return useMemo(() => {
    const sorted = sortWaveformParts(children);
    return {
      // One element per place. The tracks-area and controls parts are its
      // positional children (they carry no keys); the strip's parts are keyed
      // by kind (`keyedByKind`).
      timescale:
        sorted.timescale.length > 0 ? (
          <WaveformPartPlaceContext value="timescale">
            {keyedByKind(sorted.timescale)}
          </WaveformPartPlaceContext>
        ) : null,
      controls:
        sorted.controls.length > 0
          ? [
              <WaveformPartPlaceContext key="controls" value="controls">
                {createElement(Fragment, null, ...sorted.controls)}
              </WaveformPartPlaceContext>,
            ]
          : undefined,
      content: createElement(Fragment, null, ...sorted.content),
      tracksOptions: sorted.tracksOptions,
      controlsWidth: sorted.controlsWidth,
      timescaleHeight: sorted.timescaleHeight,
    };
  }, [children]);
}

export interface WaveformFrameOptions {
  className: string | undefined;
  /** From `useResolvedViewOptions()`; published here, memoized on its values, for everything drawn. */
  viewOptions: ResolvedViewOptions;
  parts: WaveformPartsByPlace;
  /** Length of the drawn timeline in seconds. */
  displayDuration: number;
  /** Memoized by the root: the tracks part and the controls part follow it. */
  rows: WaveformRowsValue;
  playlistState: 'ready' | 'loading';
  /** Width of the controls column in pixels; 0 draws none. */
  controlsWidth: number;
  /** Also told the scroll container (the frame registers it with the provider itself). Must be stable. */
  onScrollContainer?: (element: HTMLDivElement | null) => void;
  /** See `useSelectionDrag`. */
  onPress?: UseSelectionDragOptions['onPress'];
  onClickWhileStopped: UseSelectionDragOptions['onClickWhileStopped'];
}

/**
 * The scrolling frame with the parts in their places, the two layout values
 * and the selection drag. Returns two sibling elements in a fragment; the root
 * wraps them in its `DevicePixelRatioProvider`.
 *
 * It makes the calling root render on its own state (a drag in progress) and
 * on play and stop (the drag reads `isPlaying`), on a zoom and on a change of
 * the view settings or the theme. None of that renders a part by itself: both
 * layout values are memoized, and the part elements are the root's children.
 */
export function useWaveformFrame({
  className,
  viewOptions,
  parts,
  displayDuration,
  rows,
  playlistState,
  controlsWidth,
  onScrollContainer,
  onPress,
  onClickWhileStopped,
}: WaveformFrameOptions): ReactElement {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { setScrollContainer } = usePlaybackControls();
  const { sampleRate } = usePlaylistView();
  const { waveHeight, barWidth, barGap, roundedBars, progressBarWidth } = viewOptions;
  // The strip exists when a part is drawn in it: rendering the timescale (or
  // the loop region) is the one switch, and the timescale part says how tall.
  const timeScaleHeight = parts.timescaleHeight;
  const { samplesPerPixel } = usePlaylistZoom();

  const handleScrollContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      onScrollContainer?.(element);
      setScrollContainer(element);
    },
    [onScrollContainer, setScrollContainer]
  );

  const tracksFullWidth = Math.floor((displayDuration * sampleRate) / samplesPerPixel);

  const {
    isSelecting,
    handleMouseDown,
    preview: selectionPreview,
    automaticScrollRef,
  } = useSelectionDrag({ samplesPerPixel, sampleRate, onPress, onClickWhileStopped });

  // The one publication of what a view draws with (#689): the options of
  // `<WaveformViewOptions>`, resolved by the root, with the zoom, the sample
  // rate and the strip height. Memoized so that its readers (every channel,
  // the timescale, the playhead) are not re-rendered by a render of the root
  // that changed none of it.
  const playlistInfo = useMemo<PlaylistInfo>(
    () => ({
      samplesPerPixel,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
    }),
    [
      samplesPerPixel,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      barWidth,
      barGap,
      roundedBars,
      progressBarWidth,
    ]
  );

  const extent = useMemo<WaveformExtentValue>(
    () => ({ displayDuration, tracksFullWidth }),
    [displayDuration, tracksFullWidth]
  );

  return (
    <>
      <AutomaticScrollFlag flagRef={automaticScrollRef} />
      <PlaylistInfoContext value={playlistInfo}>
        <WaveformExtentContext value={extent}>
          <WaveformRowsContext value={rows}>
            <RootSeesRecordingPreviewContext
              value={parts.tracksOptions.recordingState !== undefined}
            >
              <SelectionPreviewContext value={selectionPreview}>
                <Playlist
                  className={className}
                  theme={theme}
                  backgroundColor={
                    theme.playlistBackgroundColor || waveformColorToCss(theme.waveOutlineColor)
                  }
                  timescaleBackgroundColor={theme.timescaleBackgroundColor}
                  timescaleWidth={tracksFullWidth}
                  tracksWidth={tracksFullWidth}
                  controlsWidth={controlsWidth}
                  onTracksMouseDown={handleMouseDown}
                  scrollContainerRef={handleScrollContainerRef}
                  isSelecting={isSelecting}
                  data-playlist-state={playlistState}
                  trackControlsSlots={parts.controls}
                  timescaleGapHeight={timeScaleHeight > 0 ? timeScaleHeight + 1 : 0}
                  timescale={parts.timescale ?? undefined}
                >
                  {parts.content}
                </Playlist>
              </SelectionPreviewContext>
            </RootSeesRecordingPreviewContext>
          </WaveformRowsContext>
        </WaveformExtentContext>
      </PlaylistInfoContext>
    </>
  );
}
