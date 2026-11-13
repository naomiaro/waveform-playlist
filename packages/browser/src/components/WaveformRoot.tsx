import React, {
  createElement,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Playlist,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  useTheme,
  waveformColorToCss,
  CLIP_HEADER_HEIGHT,
} from '@waveform-playlist/ui-components';
import {
  usePlaylistView,
  usePlaylistZoom,
  usePlaylistTimeline,
  useTrackReorderPreview,
  useIsPlaying,
  usePlaybackControls,
  useEditorControls,
} from '../contexts/playlistContexts';
import {
  applyTrackOrderPreview,
  computeTrackLayout,
  trackIdAtOffset,
} from '../utils/trackOrderPreview';
import { useTrailingActive } from '../hooks/useTrailingActive';
import { useWindowDrag, clampedOffsetX } from '../hooks/useWindowDrag';
import { useRecordingLayout } from '../hooks/useRecordingLayout';
import type { RenderMode, SpectrogramConfig } from '@waveform-playlist/core';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { trackRenderMode } from '../utils/trackRenderMode';
import type { SpectrogramTrackHelpers } from './TrackRows';
import { getTrackChannelCount } from './visualizationLayout';
import {
  WaveformExtentContext,
  WaveformRowsContext,
  type WaveformExtentValue,
  type WaveformRowsValue,
} from './waveformLayoutContext';
import { sortWaveformParts } from './waveformParts';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

// Passed to the spectrogram settings modal when no config exists at any level.
// A module constant, so the prop keeps its identity across renders.
const EMPTY_SPECTROGRAM_CONFIG: SpectrogramConfig = {};

export interface WaveformRootProps {
  className?: string;
  /** The parts (see waveformParts.tsx), and anything else to draw over the tracks. */
  children?: ReactNode;
}

/**
 * The root of the multitrack view (#685). Internal for now.
 *
 * It owns what the parts share and nothing they draw: the scrolling frame
 * (`Playlist`), the size of the timeline, the vertical layout of the rows
 * (one layout for the tracks and the controls column, so they cannot
 * disagree), the pointer handlers of the selection drag, the context for the
 * drawing primitives and the spectrogram settings modal.
 *
 * It renders on its own "a drag is in progress" state, on play and stop (its
 * drag handlers read `isPlaying`), and on every change of the timeline, the
 * zoom and the view settings. None of that renders a part by itself: the
 * parts are `children`, whose elements are the same as on the previous render
 * unless the component that composed them rendered too, and each part follows
 * the two layout values below and the provider contexts it reads. Keep it so:
 * both values are memoized, and everything in them must keep its identity
 * across a render that did not change it.
 */
export const WaveformRoot: React.FC<WaveformRootProps> = ({ className, children }) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  const { isPlaying } = useIsPlaying();
  const { setSelection, play, setScrollContainer } = usePlaybackControls();
  const { setSelectedTrackId, setCurrentTime, setRecordingActive } = useEditorControls();
  const {
    sampleRate,
    waveHeight,
    timeScaleHeight,
    controls,
    barWidth,
    barGap,
    roundedBars,
    mono,
    indefinitePlayback,
    fillViewport,
  } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const { peaksDataArray, tracks, duration, isReady } = usePlaylistTimeline();
  const { trackDragPreview } = useTrackReorderPreview();

  // Optional spectrogram integration (only available when SpectrogramProvider is present)
  const spectrogram = useContext(SpectrogramIntegrationContext);

  // The parts by place, and what the tracks part was given. Memoized on
  // `children`: a render of this component alone must hand React the very
  // same elements, or every part renders with it.
  const parts = useMemo(() => {
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
  const { showClipHeaders, recordingState } = parts.tracksOptions;

  // Sync the recording session (and its armed track) to the provider so the
  // armed track's existing content is transiently muted for the take —
  // punch-in replaces whatever it overlaps (#579/#589). The cleanup releases
  // the session on recording end AND on unmount, restoring the track's
  // previous mute state. Consumers that start playback in the same handler
  // as the recording should also call setRecordingActive eagerly so the
  // doomed material never blips before this effect commits.
  const recordingActive = !!recordingState?.isRecording;
  const armedTrackId = recordingState?.trackId ?? null;
  useEffect(() => {
    if (!recordingActive) return undefined;
    setRecordingActive(true, armedTrackId);
    return () => setRecordingActive(false);
  }, [recordingActive, armedTrackId, setRecordingActive]);

  // Per-track spectrogram rendering helpers (memoized) — only computed when spectrogram is available
  const spectrogramHelpersById = useMemo(() => {
    const helpers = new Map<string, SpectrogramTrackHelpers>();
    if (!spectrogram) return helpers;
    tracks.forEach((track) => {
      const mode = trackRenderMode(
        track,
        spectrogram.trackSpectrogramOverrides.get(track.id)?.renderMode
      );
      if (mode === 'waveform') return;
      const overrides = spectrogram.trackSpectrogramOverrides.get(track.id);
      const cm =
        overrides?.colorMap ??
        track.spectrogramColorMap ??
        spectrogram.spectrogramColorMap ??
        'viridis';
      const cfg = overrides?.config ?? track.spectrogramConfig ?? spectrogram.spectrogramConfig;
      helpers.set(track.id, {
        colorLUT: spectrogram.getColorMap(cm),
        frequencyScaleFn: spectrogram.getFrequencyScale(cfg?.frequencyScale ?? 'mel'),
        config: cfg,
      });
    });
    return helpers;
  }, [tracks, spectrogram]);

  // Render mode per track (see trackRenderMode): an audio track takes a
  // spectrogram override, else its own mode, else a waveform. A MIDI track is
  // drawn as a piano roll from its kind and has no render mode.
  const renderModeById = useMemo(() => {
    const modes = new Map<string, RenderMode>();
    tracks.forEach((track) => {
      modes.set(
        track.id,
        trackRenderMode(track, spectrogram?.trackSpectrogramOverrides.get(track.id)?.renderMode)
      );
    });
    return modes;
  }, [tracks, spectrogram]);

  // The recording, reduced to what the layout depends on: numbers that change
  // rarely, read through selectors. `recordingState` itself is usually a new
  // object literal on every render of the consumer.
  const recordingProgress = recordingState?.isRecording ? recordingState.progress : undefined;
  const recordingLayout = useRecordingLayout(
    recordingProgress,
    recordingState?.startSample ?? 0,
    sampleRate
  );
  const recordingTrackId = recordingState?.isRecording ? recordingState.trackId : null;
  const recordingChannelCount = recordingProgress ? (mono ? 1 : recordingLayout.channelCount) : 0;

  // State for spectrogram settings modal
  const [settingsModalTrackId, setSettingsModalTrackId] = useState<string | null>(null);
  const closeSettingsModal = useCallback(() => setSettingsModalTrackId(null), []);

  const [isSelecting, setIsSelecting] = useState(false);
  const mouseDownTimeRef = useRef<number>(0);
  // The element the drag began on (the click overlay), for pointer positions
  // while the pointer is somewhere else.
  const dragElementRef = useRef<HTMLDivElement | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [scrollContainerElement, setScrollContainerElement] = useState<HTMLDivElement | null>(null);

  const handleScrollContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollContainerRef.current = element;
      setScrollContainerElement(element);
      setScrollContainer(element);
    },
    [setScrollContainer]
  );

  // Fill the visible scroll container when requested — indefinitePlayback
  // implies it (endless playback needs an endless-looking timeline);
  // fillViewport requests the layout alone.
  const fillsContainer = indefinitePlayback || fillViewport;

  // The container's width is state, measured in a layout effect (so the first
  // paint already fills it) and kept current by a ResizeObserver. Reading
  // clientWidth in the render body instead forced layout on every render while
  // recording, was 0 on the first render and never followed a container resize.
  const [scrollContainerWidth, setScrollContainerWidth] = useState(0);
  useLayoutEffect(() => {
    if (!fillsContainer || !scrollContainerElement) return;
    const measure = () => setScrollContainerWidth(scrollContainerElement.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(scrollContainerElement);
    return () => observer.disconnect();
  }, [fillsContainer, scrollContainerElement]);

  // Calculate dimensions. `duration` is derived from `tracks` in the provider,
  // so it is already current in this render.
  let displayDuration = duration > 0 ? duration : DEFAULT_EMPTY_TRACK_DURATION;

  if (fillsContainer) {
    const minContainerDuration = (scrollContainerWidth * samplesPerPixel) / sampleRate;
    displayDuration = Math.max(displayDuration, minContainerDuration);
  }

  if (recordingProgress) {
    // Grows in steps, not with every frame of the take (#695).
    displayDuration = Math.max(displayDuration, recordingLayout.displayEndSeconds);
  }

  const tracksFullWidth = Math.floor((displayDuration * sampleRate) / samplesPerPixel);

  // Reads `tracks` through a ref so its identity survives `tracks` changes: it
  // is a prop of every memoized clip and control panel.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const selectTrack = useCallback(
    (trackIndex: number) => {
      const track = tracksRef.current[trackIndex];
      if (track) {
        setSelectedTrackId(track.id);
      }
    },
    [setSelectedTrackId]
  );

  // Shared vertical layout for BOTH columns (waveform rows + control slots).
  // Heights use the existing slot formula; order applies the live drag
  // preview so both columns slide together. Worked out here, once, so the two
  // columns can never disagree.
  const trackHeightById = useMemo(() => {
    const m = new Map<string, number>();
    peaksDataArray.forEach((trackClipPeaks, trackIndex) => {
      const track = tracks[trackIndex];
      if (!track) return;
      const maxChannels = getTrackChannelCount(
        trackClipPeaks,
        track.id === recordingTrackId ? recordingChannelCount : 0
      );
      m.set(track.id, waveHeight * maxChannels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0));
    });
    return m;
  }, [
    peaksDataArray,
    tracks,
    recordingTrackId,
    recordingChannelCount,
    waveHeight,
    showClipHeaders,
  ]);

  const displayOrderIds = useMemo(
    () => applyTrackOrderPreview(tracks, trackDragPreview).map((t) => t.id),
    [tracks, trackDragPreview]
  );

  const trackLayout = useMemo(
    () => computeTrackLayout(displayOrderIds, trackHeightById),
    [displayOrderIds, trackHeightById]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Primary button only: a right-click opens the context menu and its
    // release may never be delivered.
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    // The row under the pointer, from the layout the rows are positioned with.
    const clickedTrackId = trackIdAtOffset(
      displayOrderIds,
      trackLayout,
      trackHeightById,
      e.clientY - rect.top
    );
    if (clickedTrackId !== null) {
      setSelectedTrackId(clickedTrackId);
    }

    mouseDownTimeRef.current = clickTime;
    dragElementRef.current = e.currentTarget;
    setIsSelecting(true);
    setCurrentTime(clickTime);
    setSelection(clickTime, clickTime);
  };

  // The drag is followed on the window, not on the overlay: the pointer may
  // leave the tracks (a fast drag past either end, or drifting above or below
  // them) and the button may be released anywhere. Positions outside the
  // overlay clamp to its ends.
  const dragTimeAt = (clientX: number): number | null => {
    const element = dragElementRef.current;
    const x = element ? clampedOffsetX(element, clientX) : null;
    return x === null ? null : (x * samplesPerPixel) / sampleRate;
  };

  const handleDragMove = (e: MouseEvent) => {
    if (isPlaying) return;
    const moveTime = dragTimeAt(e.clientX);
    if (moveTime === null) return;

    // The anchor is where the drag began. It comes from a ref, not from the
    // selection state: this component does not subscribe to the selection
    // (#733), and `selectionStart` stops being the anchor as soon as the
    // pointer passes to the left of it.
    const anchor = mouseDownTimeRef.current;
    setSelection(Math.min(anchor, moveTime), Math.max(anchor, moveTime));
  };

  const handleDragEnd = (e: MouseEvent | null) => {
    setIsSelecting(false);

    // The window lost focus mid-drag: there is no release position. Keep the
    // selection as the last move left it.
    if (e === null) return;

    // During playback, use the time captured at mouseDown — auto-scroll shifts the
    // overlay between mouseDown and mouseUp, so recomputing from getBoundingClientRect()
    // would produce a wrong (shifted) position.
    if (isPlaying) {
      const clickTime = Math.max(0, mouseDownTimeRef.current);
      setCurrentTime(clickTime);
      setSelection(clickTime, clickTime);
      play(clickTime);
      return;
    }

    const endTime = dragTimeAt(e.clientX);
    if (endTime === null) return;

    const anchor = mouseDownTimeRef.current;
    const start = Math.min(anchor, endTime);
    const end = Math.max(anchor, endTime);

    if (Math.abs(end - start) < 0.1) {
      setCurrentTime(start);
    } else {
      setSelection(start, end);
    }
  };

  useWindowDrag(isSelecting, handleDragMove, handleDragEnd);

  const animateTrackLayout = useTrailingActive(trackDragPreview !== null, 200);

  // Memoized so that consumers of the context (every channel, the timescale)
  // are not re-rendered by a render of this component that changed none of it.
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

  const rows = useMemo<WaveformRowsValue>(
    () => ({
      showClipHeaders,
      trackHeightById,
      trackLayout,
      animateTrackLayout,
      renderModeById,
      spectrogramHelpersById,
      selectTrack,
      setSettingsModalTrackId,
      recordingChannelCount,
    }),
    [
      showClipHeaders,
      trackHeightById,
      trackLayout,
      animateTrackLayout,
      renderModeById,
      spectrogramHelpersById,
      selectTrack,
      recordingChannelCount,
    ]
  );

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <WaveformExtentContext.Provider value={extent}>
          <WaveformRowsContext.Provider value={rows}>
            <Playlist
              className={className}
              theme={theme}
              backgroundColor={
                theme.playlistBackgroundColor || waveformColorToCss(theme.waveOutlineColor)
              }
              timescaleBackgroundColor={theme.timescaleBackgroundColor}
              timescaleWidth={tracksFullWidth}
              tracksWidth={tracksFullWidth}
              controlsWidth={controls.show ? controls.width : 0}
              onTracksMouseDown={handleMouseDown}
              scrollContainerRef={handleScrollContainerRef}
              isSelecting={isSelecting}
              data-playlist-state={isReady ? 'ready' : 'loading'}
              trackControlsSlots={parts.controls}
              timescaleGapHeight={timeScaleHeight > 0 ? timeScaleHeight + 1 : 0}
              timescale={timeScaleHeight > 0 && parts.timescale ? parts.timescale : undefined}
            >
              {parts.content}
            </Playlist>
          </WaveformRowsContext.Provider>
        </WaveformExtentContext.Provider>
      </PlaylistInfoContext.Provider>
      {spectrogram?.SettingsModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <spectrogram.SettingsModal
            open={settingsModalTrackId !== null}
            onClose={closeSettingsModal}
            config={
              settingsModalTrackId !== null
                ? (spectrogram.trackSpectrogramOverrides.get(settingsModalTrackId)?.config ??
                  tracks.find((t) => t.id === settingsModalTrackId)?.spectrogramConfig ??
                  spectrogram.spectrogramConfig ??
                  EMPTY_SPECTROGRAM_CONFIG)
                : EMPTY_SPECTROGRAM_CONFIG
            }
            colorMap={
              settingsModalTrackId !== null
                ? (spectrogram.trackSpectrogramOverrides.get(settingsModalTrackId)?.colorMap ??
                  tracks.find((t) => t.id === settingsModalTrackId)?.spectrogramColorMap ??
                  spectrogram.spectrogramColorMap ??
                  'viridis')
                : 'viridis'
            }
            onApply={(newConfig, newColorMap) => {
              if (settingsModalTrackId !== null) {
                spectrogram.setTrackSpectrogramConfig(settingsModalTrackId, newConfig, newColorMap);
              }
            }}
          />,
          document.body
        )}
    </DevicePixelRatioProvider>
  );
};
