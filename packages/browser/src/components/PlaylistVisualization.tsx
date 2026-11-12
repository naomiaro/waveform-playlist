import React, {
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
  SmartScale,
  useTheme,
  waveformColorToCss,
  type RenderPlayheadFunction,
  CLIP_HEADER_HEIGHT,
} from '@waveform-playlist/ui-components';
import {
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
} from '../WaveformPlaylistContext';
import {
  applyTrackOrderPreview,
  computeTrackLayout,
  trackIdAtOffset,
} from '../utils/trackOrderPreview';
import { useTrailingActive } from '../hooks/useTrailingActive';
import { useWindowDrag, clampedOffsetX } from '../hooks/useWindowDrag';
import { useRecordingLayout } from '../hooks/useRecordingLayout';
import type { AnnotationAction, RenderMode, SpectrogramConfig } from '@waveform-playlist/core';
import type { GetAnnotationBoxLabelFn } from '../types/annotations';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';
import { trackRenderMode } from '../utils/trackRenderMode';
import { TrackRows, type SpectrogramTrackHelpers } from './TrackRows';
import { TrackControlsColumn } from './TrackControlsColumn';
import {
  AnnotationBoxesOverlay,
  LoopRegionOverlay,
  PlayheadOverlay,
  SelectionOverlay,
} from './VisualizationOverlays';
import { getTrackChannelCount, type VisualizationRecordingState } from './visualizationLayout';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

// Passed to the spectrogram settings modal when no config exists at any level.
// A module constant, so the prop keeps its identity across renders.
const EMPTY_SPECTROGRAM_CONFIG: SpectrogramConfig = {};

export interface PlaylistVisualizationProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
  annotationControls?: AnnotationAction[];
  /**
   * Custom function to generate the label shown on annotation boxes in the waveform.
   * Receives the annotation data and its index, returns a string label.
   * Default: annotation.id
   */
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  className?: string;
  showClipHeaders?: boolean;
  /** Draw each clip's waveform scaled by its gain. Default: false. */
  gainScaledWaveforms?: boolean;
  /** Enable dragging and trimming of clips. Not needed under
   *  `ClipInteractionProvider`, which turns this on by itself. */
  interactiveClips?: boolean;
  showFades?: boolean;
  /**
   * Widen the clip trim handles for touch. Not needed under
   * `<ClipInteractionProvider touchOptimized>`, which turns this on by itself;
   * set it when you use your own DragDropProvider with
   * `useDragSensors({ touchOptimized: true })`.
   */
  touchOptimized?: boolean;
  /** Callback when a track's close button is clicked. Only renders close button when provided. */
  onRemoveTrack?: (trackIndex: number) => void;
  // Live recording state for real-time waveform preview
  recordingState?: VisualizationRecordingState;
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider
   *  (the ambient DragDropProvider); the buttons work regardless. Default: false. */
  trackReordering?: boolean;
}

/**
 * Standalone playlist visualization component (WebAudio version).
 *
 * Renders the waveform tracks, timescale, annotations boxes, selection,
 * playhead, loop regions, and track controls — everything that lives
 * inside <Playlist> plus wrapping providers.
 *
 * Does NOT render AnnotationText (the annotation list below the waveform).
 * Pair with PlaylistAnnotationList for a full annotation editing UI.
 *
 * This component is the shell: sizes, the shared vertical layout, the pointer
 * handlers of the selection drag, and the context for the primitives. It reads
 * selection state (for those handlers), so it re-renders on every pointer move
 * of a selection drag. What it renders is therefore split (#693):
 *  - `TrackRows` and `TrackControlsColumn` are memoized and get no selection,
 *    cursor or annotation state, so they skip those renders;
 *  - the overlays in VisualizationOverlays.tsx read that state themselves.
 * Everything handed to the two memoized parts must keep its identity across a
 * render that did not change it — memoize it here, or the boundary is void.
 */
export const PlaylistVisualization: React.FC<PlaylistVisualizationProps> = ({
  renderTrackControls,
  renderTick,
  renderPlayhead,
  annotationControls: _annotationControls,
  getAnnotationBoxLabel,
  className,
  showClipHeaders = false,
  gainScaledWaveforms = false,
  interactiveClips = false,
  showFades = false,
  touchOptimized = false,
  onRemoveTrack,
  recordingState,
  trackReordering = false,
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  const { isPlaying } = usePlaybackAnimation();
  const { selectedTrackId, indefinitePlayback, fillViewport } = usePlaylistState();
  const {
    setSelection,
    play,
    setScrollContainer,
    setSelectedTrackId,
    setCurrentTime,
    setRecordingActive,
  } = usePlaylistControls();
  const {
    peaksDataArray,
    trackStates,
    tracks,
    duration,
    samplesPerPixel,
    sampleRate,
    waveHeight,
    timeScaleHeight,
    controls,
    barWidth,
    barGap,
    roundedBars,
    isReady,
    trackReorderEpoch,
    mono,
    trackDragPreview,
  } = usePlaylistData();

  // Optional spectrogram integration (only available when SpectrogramProvider is present)
  const spectrogram = useContext(SpectrogramIntegrationContext);

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
  const perTrackSpectrogramHelpers = useMemo(() => {
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
  // preview so both columns slide together. Hoisted from the per-slot
  // computation so the two columns can never disagree.
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

  // Controls for the ControlsColumn (outside the scroll area). The array is
  // memoized because `Playlist` receives it as a prop.
  const trackControlsSlots = useMemo(
    () =>
      controls.show
        ? [
            <TrackControlsColumn
              key="control-slots-layout"
              tracks={tracks}
              trackStates={trackStates}
              renderModeById={renderModeById}
              trackLayout={trackLayout}
              trackHeightById={trackHeightById}
              animateTrackLayout={animateTrackLayout}
              selectedTrackId={selectedTrackId}
              trackReorderEpoch={trackReorderEpoch}
              trackReordering={trackReordering}
              renderTrackControls={renderTrackControls}
              onRemoveTrack={onRemoveTrack}
              selectTrack={selectTrack}
              spectrogram={spectrogram}
              setSettingsModalTrackId={setSettingsModalTrackId}
            />,
          ]
        : undefined,
    [
      controls.show,
      tracks,
      trackStates,
      renderModeById,
      trackLayout,
      trackHeightById,
      animateTrackLayout,
      selectedTrackId,
      trackReorderEpoch,
      trackReordering,
      renderTrackControls,
      onRemoveTrack,
      selectTrack,
      spectrogram,
    ]
  );

  // Memoized so that consumers of the context (every channel, the timescale)
  // are not re-rendered by a render of this component that changed none of it.
  const playlistInfo = useMemo(
    () => ({
      samplesPerPixel,
      sampleRate,
      zoomLevels: [samplesPerPixel],
      waveHeight,
      timeScaleHeight,
      duration: displayDuration * 1000,
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
      displayDuration,
      controls,
      barWidth,
      barGap,
      roundedBars,
    ]
  );

  const timescale = useMemo(
    () =>
      timeScaleHeight > 0 ? (
        <>
          <SmartScale renderTick={renderTick} />
          <LoopRegionOverlay maxPosition={tracksFullWidth} />
        </>
      ) : undefined,
    [timeScaleHeight, renderTick, tracksFullWidth]
  );

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider value={playlistInfo}>
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
          trackControlsSlots={trackControlsSlots}
          timescaleGapHeight={timeScaleHeight > 0 ? timeScaleHeight + 1 : 0}
          timescale={timescale}
        >
          <>
            <TrackRows
              tracks={tracks}
              peaksDataArray={peaksDataArray}
              renderModeById={renderModeById}
              spectrogramHelpersById={perTrackSpectrogramHelpers}
              trackLayout={trackLayout}
              animateTrackLayout={animateTrackLayout}
              width={tracksFullWidth}
              selectedTrackId={selectedTrackId}
              dragSourceTrackId={trackDragPreview?.trackId ?? null}
              waveHeight={waveHeight}
              mono={mono}
              recordingState={recordingState}
              recordingChannelCount={recordingChannelCount}
              samplesPerPixel={samplesPerPixel}
              sampleRate={sampleRate}
              showClipHeaders={showClipHeaders}
              gainScaledWaveforms={gainScaledWaveforms}
              interactiveClips={interactiveClips}
              showFades={showFades}
              touchOptimized={touchOptimized}
              selectTrack={selectTrack}
              registerSpectrogramCanvas={spectrogram?.registerSpectrogramCanvas}
              unregisterSpectrogramCanvas={spectrogram?.unregisterSpectrogramCanvas}
            />
            <AnnotationBoxesOverlay
              width={tracksFullWidth}
              getAnnotationBoxLabel={getAnnotationBoxLabel}
            />
            <SelectionOverlay />
            <PlayheadOverlay renderPlayhead={renderPlayhead} />
          </>
        </Playlist>
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
