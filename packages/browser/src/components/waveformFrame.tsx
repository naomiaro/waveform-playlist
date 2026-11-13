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
  WaveformRowsContext,
  type WaveformExtentValue,
  type WaveformRowsValue,
} from './waveformLayoutContext';
import { sortWaveformParts } from './waveformParts';
import type { TracksMarkers } from './TrackRows';

export interface WaveformPartsByPlace {
  /** The parts of the timescale strip in one element, or null when there is none. */
  timescale: ReactElement | null;
  /** The parts of the controls column, or undefined when there is none. */
  controls: ReactNode[] | undefined;
  /** Everything drawn in the scrolling tracks area, in order. */
  content: ReactElement;
  /** The per-clip parts the tracks part was given (all off without one). */
  tracksOptions: TracksMarkers;
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
      // One element per place, with the parts as its positional children
      // (they carry no keys).
      timescale:
        sorted.timescale.length > 0 ? createElement(Fragment, null, ...sorted.timescale) : null,
      controls:
        sorted.controls.length > 0
          ? [createElement(Fragment, { key: 'controls' }, ...sorted.controls)]
          : undefined,
      content: createElement(Fragment, null, ...sorted.content),
      tracksOptions: sorted.tracksOptions,
    };
  }, [children]);
}

export interface WaveformFrameOptions {
  className: string | undefined;
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
  const { sampleRate, waveHeight, timeScaleHeight, controls, barWidth, barGap, roundedBars } =
    usePlaylistView();
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

  // Memoized so that consumers of the context (every channel, the timescale)
  // are not re-rendered by a render of the root that changed none of it.
  const playlistInfo = useMemo(
    () => ({
      samplesPerPixel,
      sampleRate,
      zoomLevels: [samplesPerPixel],
      waveHeight,
      timeScaleHeight,
      controls,
      barWidth,
      barGap,
      roundedBars,
    }),
    [
      samplesPerPixel,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      controls,
      barWidth,
      barGap,
      roundedBars,
    ]
  );

  const extent = useMemo<WaveformExtentValue>(
    () => ({ displayDuration, tracksFullWidth }),
    [displayDuration, tracksFullWidth]
  );

  return (
    <>
      <AutomaticScrollFlag flagRef={automaticScrollRef} />
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <WaveformExtentContext.Provider value={extent}>
          <WaveformRowsContext.Provider value={rows}>
            <SelectionPreviewContext.Provider value={selectionPreview}>
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
                timescale={timeScaleHeight > 0 && parts.timescale ? parts.timescale : undefined}
              >
                {parts.content}
              </Playlist>
            </SelectionPreviewContext.Provider>
          </WaveformRowsContext.Provider>
        </WaveformExtentContext.Provider>
      </PlaylistInfoContext.Provider>
    </>
  );
}
