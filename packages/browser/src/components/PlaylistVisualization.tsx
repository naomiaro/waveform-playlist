import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
  Selection,
  TimescaleLoopRegion,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  SmartScale,
  CloseButton,
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
  TrackMenu,
  useTheme,
  waveformColorToCss,
  type RenderPlayheadFunction,
  SpectrogramLabels,
  CLIP_HEADER_HEIGHT,
  ReorderRail,
} from '@waveform-playlist/ui-components';
import { SortableTrackControls } from './SortableTrackControls';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import {
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
  type ClipPeaks,
  type TrackState,
} from '../WaveformPlaylistContext';
import { applyTrackOrderPreview, computeTrackLayout } from '../utils/trackOrderPreview';
import { useTrailingActive } from '../hooks/useTrailingActive';
import { resolveRecordingOffsetSamples, type Peaks } from '@waveform-playlist/core';
import { AnimatedPlayhead } from './AnimatedPlayhead';
import { ChannelWithProgress } from './ChannelWithProgress';
import type { SpectrogramConfig } from '@waveform-playlist/core';
import type { AnnotationAction } from '@waveform-playlist/core';
import type { ClipTrack, RenderMode } from '@waveform-playlist/core';
import type { AnnotationData, GetAnnotationBoxLabelFn } from '../types/annotations';
import {
  SpectrogramIntegrationContext,
  type SpectrogramIntegration,
} from '../SpectrogramIntegrationContext';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

/** Drop-shadow for the floating (fully opaque) drag-source controls row. */
const DRAG_SOURCE_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.35)';

interface PositionedRowProps {
  readonly $top: number;
  readonly $animate: boolean;
}

/**
 * Shared relative container for absolutely-positioned track rows. Explicit
 * height because absolute children don't size their parent.
 */
const TracksLayout = styled.div.attrs<{ $height: number }>((props) => ({
  style: { height: `${props.$height}px` },
}))<{ $height: number }>`
  position: relative;
`;

/**
 * Positions one waveform track row from the shared layout map. Transform
 * (not top) so position changes composite; transition only while a track
 * drag is active (+trailing window) so unrelated layout changes stay
 * instant.
 */
const TrackRowPositioner = styled.div.attrs<PositionedRowProps>((props) => ({
  style: { transform: `translateY(${props.$top}px)` },
}))<PositionedRowProps>`
  position: absolute;
  left: 0;
  right: 0;
  ${(props) => props.$animate && 'transition: transform 150ms ease;'}
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

interface ControlSlotProps {
  readonly $height: number;
  readonly $top: number;
  readonly $animate: boolean;
  readonly $isSelected?: boolean;
}

/**
 * Height-synced container for each track's controls in the ControlsColumn.
 * Uses the same height formula as Track: waveHeight * numChannels + clipHeaderHeight.
 */
const ControlSlot = styled.div.attrs<ControlSlotProps>((props) => ({
  style: {
    height: `${props.$height}px`,
    transform: `translateY(${props.$top}px)`,
  },
}))<ControlSlotProps>`
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;
  ${(props) => props.$animate && 'transition: transform 150ms ease, background 0.15s ease-in-out;'}
  @media (prefers-reduced-motion: reduce) {
    transition: background 0.15s ease-in-out;
  }
  ${(props) => props.$isSelected && `background: ${props.theme.selectedTrackControlsBackground};`}
`;

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
  interactiveClips?: boolean;
  showFades?: boolean;
  /**
   * Enable mobile-optimized touch interactions.
   * When true, increases touch target sizes for clip boundaries.
   * Use with useDragSensors({ touchOptimized: true }) for best results.
   */
  touchOptimized?: boolean;
  /** Callback when a track's close button is clicked. Only renders close button when provided. */
  onRemoveTrack?: (trackIndex: number) => void;
  // Live recording state for real-time waveform preview
  recordingState?: {
    isRecording: boolean;
    trackId: string;
    startSample: number;
    durationSamples: number;
    peaks: (Int8Array | Int16Array)[];
    bits: 8 | 16;
    /**
     * Latency offset (seconds) to skip in the live preview. Absolute replacement
     * for the auto-computed outputLatency + lookAhead value. Pass the same value
     * given to useIntegratedRecording so preview and finalized clip match.
     */
    latencyOffset?: number;
  };
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider
   *  (the ambient DragDropProvider); the buttons work regardless. Default: false. */
  trackReordering?: boolean;
}

/**
 * Wrapper that isolates the custom playhead's hooks from PlaylistVisualization.
 * Calling renderPlayhead() directly would merge its hooks into the parent,
 * causing "Rendered more hooks" errors if renderPlayhead is conditionally provided.
 */
const CustomPlayhead: React.FC<{
  renderPlayhead: RenderPlayheadFunction;
  color: string;
  samplesPerPixel: number;
  sampleRate: number;
}> = ({ renderPlayhead, color, samplesPerPixel, sampleRate }) => {
  const {
    isPlaying,
    currentTimeRef,
    visualTimeRef,
    playbackStartTimeRef,
    audioStartPositionRef,
    getPlaybackTime,
    getAudioContextTime,
  } = usePlaybackAnimation();

  // Use visualTimeRef so the initial position matches the audible output
  // (the playhead's rAF loop also reads visualTimeRef for in-sync animation).
  const visualTime = visualTimeRef.current ?? currentTimeRef.current ?? 0;

  return renderPlayhead({
    position: (visualTime * sampleRate) / samplesPerPixel,
    color,
    isPlaying,
    currentTimeRef,
    visualTimeRef,
    playbackStartTimeRef,
    audioStartPositionRef,
    samplesPerPixel,
    sampleRate,
    controlsOffset: 0,
    getAudioContextTime,
    getPlaybackTime,
  }) as React.ReactElement;
};

/** Compute the maximum channel count for a track, considering both clip peaks and live recording. */
function getTrackChannelCount(
  trackClipPeaks: ClipPeaks[],
  recordingState: PlaylistVisualizationProps['recordingState'],
  trackId: string | undefined,
  mono: boolean
): number {
  const clipChannels =
    trackClipPeaks.length > 0
      ? Math.max(1, ...trackClipPeaks.map((clip) => clip.peaks.data.length))
      : 1;
  const recordingChannels =
    recordingState?.isRecording && recordingState.trackId === trackId
      ? mono
        ? 1
        : recordingState.peaks.length
      : 0;
  return Math.max(clipChannels, recordingChannels);
}

interface DefaultTrackControlsProps {
  trackIndex: number;
  track: ClipTrack;
  trackState: TrackState;
  effectiveRenderMode: RenderMode;
  selectTrack: (trackIndex: number) => void;
  onRemoveTrack?: (trackIndex: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;
  spectrogram: SpectrogramIntegration | null;
  setSettingsModalTrackId: (id: string | null) => void;
  trackReordering: boolean;
  reorderTrack: (trackId: string, toIndex: number) => void;
  trackCount: number;
  /** Attach to the drag grip element (the `handleRef` from SortableTrackControls). */
  gripRef?: (element: Element | null) => void;
}

/**
 * Default track control panel: name/close header, mute/solo, volume/pan sliders,
 * plus an optional drag grip and move up/down buttons when `trackReordering` is
 * enabled. Extracted into its own component (used both directly and wrapped in
 * SortableTrackControls) so the trackReordering branch doesn't change the hook
 * count of the shared JSX.
 */
function DefaultTrackControls({
  trackIndex,
  track,
  trackState,
  effectiveRenderMode,
  selectTrack,
  onRemoveTrack,
  setTrackMute,
  setTrackSolo,
  setTrackVolume,
  setTrackPan,
  spectrogram,
  setSettingsModalTrackId,
  trackReordering,
  reorderTrack,
  trackCount,
  gripRef,
}: DefaultTrackControlsProps) {
  return (
    <Controls
      onClick={() => selectTrack(trackIndex)}
      style={
        trackReordering ? { position: 'relative', paddingLeft: 18, paddingRight: 18 } : undefined
      }
    >
      <Header style={{ justifyContent: 'center', position: 'relative' }}>
        {onRemoveTrack && (
          <CloseButton
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTrack(trackIndex);
            }}
          />
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 24px',
            display: 'block',
          }}
        >
          {trackState.name || `Track ${trackIndex + 1}`}
        </span>
        {spectrogram?.renderMenuItems && (
          <span style={{ position: 'absolute', right: 0, top: 0 }}>
            <TrackMenu
              items={(onClose) =>
                spectrogram.renderMenuItems!({
                  renderMode: effectiveRenderMode,
                  onRenderModeChange: (mode) => spectrogram.setTrackRenderMode(track.id, mode),
                  onOpenSettings: () => setSettingsModalTrackId(track.id),
                  onClose,
                })
              }
            />
          </span>
        )}
      </Header>
      <ButtonGroup>
        <Button
          $variant={trackState.muted ? 'danger' : 'outline'}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
        >
          Mute
        </Button>
        <Button
          $variant={trackState.soloed ? 'info' : 'outline'}
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
        >
          Solo
        </Button>
      </ButtonGroup>
      <SliderWrapper>
        <VolumeDownIcon />
        <Slider
          min="0"
          max="1"
          step="0.01"
          value={trackState.volume}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
        />
        <VolumeUpIcon />
      </SliderWrapper>
      <SliderWrapper>
        <span>L</span>
        <Slider
          min="-1"
          max="1"
          step="0.01"
          value={trackState.pan}
          onChange={(e) => setTrackPan(trackIndex, parseFloat(e.target.value))}
        />
        <span>R</span>
      </SliderWrapper>
      {trackReordering && (
        <ReorderRail
          style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)' }}
          gripRef={gripRef as React.Ref<HTMLButtonElement>}
          onGripClick={(e) => e.stopPropagation()}
          upDisabled={trackIndex === 0}
          downDisabled={trackIndex === trackCount - 1}
          onMoveUp={(e) => {
            e.stopPropagation();
            reorderTrack(track.id, trackIndex - 1);
          }}
          onMoveDown={(e) => {
            e.stopPropagation();
            reorderTrack(track.id, trackIndex + 1);
          }}
        />
      )}
    </Controls>
  );
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
 */
export const PlaylistVisualization: React.FC<PlaylistVisualizationProps> = ({
  renderTrackControls,
  renderTick,
  renderPlayhead,
  annotationControls: _annotationControls,
  getAnnotationBoxLabel,
  className,
  showClipHeaders = false,
  interactiveClips = false,
  showFades = false,
  touchOptimized = false,
  onRemoveTrack,
  recordingState,
  trackReordering = false,
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  const { isPlaying, getLookAhead, getOutputLatency } = usePlaybackAnimation();
  const {
    selectionStart,
    selectionEnd,
    annotations,
    activeAnnotationId,
    annotationsEditable,
    linkEndpoints: _linkEndpoints,
    continuousPlay,
    selectedTrackId,
    loopStart,
    loopEnd,
    isLoopEnabled,
    indefinitePlayback,
    fillViewport,
  } = usePlaylistState();
  const annotationIntegration = useContext(AnnotationIntegrationContext);
  const {
    setAnnotations: _setAnnotations,
    setActiveAnnotationId,
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    setTrackPan,
    setSelection,
    play,
    setScrollContainer,
    setSelectedTrackId,
    setCurrentTime,
    setLoopRegion,
    setRecordingActive,
    reorderTrack,
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
    if (!spectrogram)
      return new Map<
        string,
        {
          colorLUT: Uint8Array;
          frequencyScaleFn: (f: number, minF: number, maxF: number) => number;
          config: SpectrogramConfig | undefined;
        }
      >();
    const helpers = new Map<
      string,
      {
        colorLUT: Uint8Array;
        frequencyScaleFn: (f: number, minF: number, maxF: number) => number;
        config: SpectrogramConfig | undefined;
      }
    >();
    tracks.forEach((track) => {
      const mode =
        spectrogram.trackSpectrogramOverrides.get(track.id)?.renderMode ??
        track.renderMode ??
        'waveform';
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

  // State for spectrogram settings modal
  const [settingsModalTrackId, setSettingsModalTrackId] = useState<string | null>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const mouseDownTimeRef = useRef<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScrollContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollContainerRef.current = element;
      setScrollContainer(element);
    },
    [setScrollContainer]
  );

  // Calculate dimensions — derive duration directly from tracks prop to prevent width
  // shift. The `duration` state is set in an effect and lags tracks by at least one render.
  const tracksMaxDuration = tracks.reduce((max, track) => {
    return track.clips.reduce((clipMax, clip) => {
      const end = (clip.startSample + clip.durationSamples) / clip.sampleRate;
      return Math.max(clipMax, end);
    }, max);
  }, 0);
  let displayDuration =
    tracksMaxDuration > 0
      ? tracksMaxDuration
      : duration > 0
        ? duration
        : DEFAULT_EMPTY_TRACK_DURATION;

  // Fill the visible scroll container when requested — indefinitePlayback
  // implies it (endless playback needs an endless-looking timeline);
  // fillViewport requests the layout alone.
  if (indefinitePlayback || fillViewport) {
    const containerWidth = scrollContainerRef.current?.clientWidth ?? 0;
    const minContainerDuration = (containerWidth * samplesPerPixel) / sampleRate;
    displayDuration = Math.max(displayDuration, minContainerDuration);
  }

  if (recordingState?.isRecording) {
    const recordingEndSample = recordingState.startSample + recordingState.durationSamples;
    const recordingEndTime = recordingEndSample / sampleRate;
    displayDuration = Math.max(displayDuration, recordingEndTime + 10);
  }

  const tracksFullWidth = Math.floor((displayDuration * sampleRate) / samplesPerPixel);

  const handleAnnotationClick = async (annotation: AnnotationData) => {
    setActiveAnnotationId(annotation.id);
    const playDuration = !continuousPlay ? annotation.end - annotation.start : undefined;
    try {
      await play(annotation.start, playDuration);
    } catch (err) {
      console.error(
        'waveform-playlist: Failed to start playback for annotation',
        annotation.id,
        err
      );
    }
  };

  const selectTrack = useCallback(
    (trackIndex: number) => {
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const track = tracks[trackIndex];
        setSelectedTrackId(track.id);
      }
    },
    [tracks, setSelectedTrackId]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    const y = e.clientY - rect.top;
    const trackY = y;

    let cumulativeHeight = 0;
    let clickedTrackIndex = -1;

    for (let i = 0; i < peaksDataArray.length; i++) {
      const trackClipPeaks = peaksDataArray[i];
      const rawCh = getTrackChannelCount(trackClipPeaks, recordingState, tracks[i]?.id, mono);
      const trackMode =
        spectrogram?.trackSpectrogramOverrides.get(tracks[i]?.id)?.renderMode ??
        tracks[i]?.renderMode ??
        'waveform';
      const effectiveCh = trackMode === 'both' ? rawCh * 2 : rawCh;
      const trackHeight = effectiveCh * waveHeight + (showClipHeaders ? 22 : 0);

      if (trackY >= cumulativeHeight && trackY < cumulativeHeight + trackHeight) {
        clickedTrackIndex = i;
        break;
      }
      cumulativeHeight += trackHeight;
    }

    if (clickedTrackIndex !== -1) {
      selectTrack(clickedTrackIndex);
    }

    mouseDownTimeRef.current = clickTime;
    setIsSelecting(true);
    setCurrentTime(clickTime);
    setSelection(clickTime, clickTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || isPlaying) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const moveTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, moveTime);
    const end = Math.max(selectionStart, moveTime);
    setSelection(start, end);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    setIsSelecting(false);

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

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const endTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    if (Math.abs(end - start) < 0.1) {
      setCurrentTime(start);
    } else {
      setSelection(start, end);
    }
  };

  // Shared vertical layout for BOTH columns (waveform rows + control slots).
  // Heights use the existing slot formula; order applies the live drag
  // preview so both columns slide together. Hoisted from the per-slot
  // computation so the two columns can never disagree. Must run before the
  // loading-state early return below (rules-of-hooks: no conditional hooks).
  const trackHeightById = useMemo(() => {
    const m = new Map<string, number>();
    peaksDataArray.forEach((trackClipPeaks, trackIndex) => {
      const track = tracks[trackIndex];
      if (!track) return;
      const maxChannels = getTrackChannelCount(trackClipPeaks, recordingState, track.id, mono);
      m.set(track.id, waveHeight * maxChannels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0));
    });
    return m;
  }, [peaksDataArray, tracks, recordingState, mono, waveHeight, showClipHeaders]);

  const displayOrderIds = useMemo(
    () => applyTrackOrderPreview(tracks, trackDragPreview).map((t) => t.id),
    [tracks, trackDragPreview]
  );

  const trackLayout = useMemo(
    () => computeTrackLayout(displayOrderIds, trackHeightById),
    [displayOrderIds, trackHeightById]
  );

  const animateTrackLayout = useTrailingActive(trackDragPreview !== null, 200);

  // Only show loading if we have tracks WITH clips but peaks haven't been computed yet.
  // Don't check audioBuffers — it's set in an effect and can be stale for one or more
  // renders after tracks change, causing the playlist to unmount and remount (layout shift).
  // Placeholder tracks (clips: []) bypass this check intentionally.
  const hasClips = tracks.some((track) => track.clips.length > 0);
  if (hasClips && peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  // Build track controls slots for the ControlsColumn (outside scroll area)
  const trackControlsSlots = controls.show
    ? [
        <TracksLayout key="control-slots-layout" $height={trackLayout.totalHeight}>
          {peaksDataArray.map((trackClipPeaks, trackIndex) => {
            const track = tracks[trackIndex];
            if (!track) return null;

            const trackState = trackStates[trackIndex] || {
              name: `Track ${trackIndex + 1}`,
              muted: false,
              soloed: false,
              volume: 1.0,
              pan: 0,
            };

            const hasMidiNotes = track.clips.some((c) => c.midiNotes && c.midiNotes.length > 0);
            const effectiveRenderMode =
              spectrogram?.trackSpectrogramOverrides.get(track.id)?.renderMode ??
              track.renderMode ??
              (hasMidiNotes ? 'piano-roll' : 'waveform');

            const slotHeight = trackHeightById.get(track.id) ?? 0;

            const defaultControlProps: Omit<DefaultTrackControlsProps, 'gripRef'> = {
              trackIndex,
              track,
              trackState,
              effectiveRenderMode,
              selectTrack,
              onRemoveTrack,
              setTrackMute,
              setTrackSolo,
              setTrackVolume,
              setTrackPan,
              spectrogram,
              setSettingsModalTrackId,
              trackReordering,
              reorderTrack,
              trackCount: peaksDataArray.length,
            };

            const trackControlContent = renderTrackControls ? (
              renderTrackControls(trackIndex)
            ) : trackReordering ? (
              <SortableTrackControls trackId={track.id} index={trackIndex}>
                {({ ref, handleRef, isDragSource }) => (
                  <div
                    ref={ref as React.Ref<HTMLDivElement>}
                    style={{
                      height: '100%',
                      boxShadow: isDragSource ? DRAG_SOURCE_SHADOW : undefined,
                      // Opaque background for the floating (top-layer, popover-based)
                      // drag-source row — without it the row underneath shows through.
                      // onDragStart selects the dragged track, so its slot always shows
                      // the selected-track background while lifted.
                      background: isDragSource ? theme.selectedTrackControlsBackground : undefined,
                    }}
                  >
                    <DefaultTrackControls {...defaultControlProps} gripRef={handleRef} />
                  </div>
                )}
              </SortableTrackControls>
            ) : (
              <DefaultTrackControls {...defaultControlProps} />
            );

            return (
              // key includes trackReorderEpoch: forces a remount after every
              // track-reorder drag, discarding @dnd-kit sortable-plugin DOM
              // corruption (see bumpTrackReorderEpoch's doc comment in
              // WaveformPlaylistContext). Stays at `-0` — a no-op suffix — for
              // consumers that never enable trackReordering.
              <ControlSlot
                key={`${track.id}-${trackReorderEpoch}`}
                $height={slotHeight}
                $top={trackLayout.topById.get(track.id) ?? 0}
                $animate={animateTrackLayout}
                $isSelected={track.id === selectedTrackId}
              >
                {trackControlContent}
              </ControlSlot>
            );
          })}
        </TracksLayout>,
      ]
    : undefined;

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider
        value={{
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
        }}
      >
        <Playlist
          theme={theme}
          backgroundColor={
            theme.playlistBackgroundColor || waveformColorToCss(theme.waveOutlineColor)
          }
          timescaleBackgroundColor={theme.timescaleBackgroundColor}
          timescaleWidth={tracksFullWidth}
          tracksWidth={tracksFullWidth}
          controlsWidth={controls.show ? controls.width : 0}
          onTracksMouseDown={handleMouseDown}
          onTracksMouseMove={handleMouseMove}
          onTracksMouseUp={handleMouseUp}
          scrollContainerRef={handleScrollContainerRef}
          isSelecting={isSelecting}
          data-playlist-state={isReady ? 'ready' : 'loading'}
          trackControlsSlots={trackControlsSlots}
          timescaleGapHeight={timeScaleHeight > 0 ? timeScaleHeight + 1 : 0}
          timescale={
            timeScaleHeight > 0 ? (
              <>
                <SmartScale renderTick={renderTick} />
                {isLoopEnabled && (
                  <TimescaleLoopRegion
                    startPosition={(Math.min(loopStart, loopEnd) * sampleRate) / samplesPerPixel}
                    endPosition={(Math.max(loopStart, loopEnd) * sampleRate) / samplesPerPixel}
                    markerColor={theme.loopMarkerColor}
                    regionColor={theme.loopRegionColor}
                    minPosition={0}
                    maxPosition={tracksFullWidth}
                    onLoopRegionChange={(startPixels, endPixels) => {
                      const startSeconds = (startPixels * samplesPerPixel) / sampleRate;
                      const endSeconds = (endPixels * samplesPerPixel) / sampleRate;
                      setLoopRegion(startSeconds, endSeconds);
                    }}
                  />
                )}
              </>
            ) : undefined
          }
        >
          <>
            <TracksLayout $height={trackLayout.totalHeight}>
              {peaksDataArray.map((trackClipPeaks, trackIndex) => {
                const track = tracks[trackIndex];
                if (!track) return null;

                const hasMidiNotes = track.clips.some((c) => c.midiNotes && c.midiNotes.length > 0);
                const effectiveRenderMode =
                  spectrogram?.trackSpectrogramOverrides.get(track.id)?.renderMode ??
                  track.renderMode ??
                  (hasMidiNotes ? 'piano-roll' : 'waveform');

                const maxChannels = getTrackChannelCount(
                  trackClipPeaks,
                  recordingState,
                  track.id,
                  mono
                );

                return (
                  <TrackRowPositioner
                    key={track.id}
                    $top={trackLayout.topById.get(track.id) ?? 0}
                    $animate={animateTrackLayout}
                    data-track-row=""
                    data-track-id={track.id}
                    data-track-drag-source={
                      trackDragPreview?.trackId === track.id ? 'true' : undefined
                    }
                  >
                    <TrackComponent
                      numChannels={maxChannels}
                      backgroundColor={
                        effectiveRenderMode === 'piano-roll'
                          ? theme.pianoRollBackgroundColor || '#1a1a2e'
                          : waveformColorToCss(theme.waveOutlineColor)
                      }
                      offset={0}
                      width={tracksFullWidth}
                      hasClipHeaders={showClipHeaders}
                      trackId={track.id}
                      isSelected={track.id === selectedTrackId}
                    >
                      {effectiveRenderMode !== 'waveform' &&
                        (() => {
                          const helpers = perTrackSpectrogramHelpers.get(track.id);
                          const trackCfg = helpers?.config;
                          if (!trackCfg?.labels || !helpers) return null;
                          return (
                            <SpectrogramLabels
                              waveHeight={waveHeight}
                              numChannels={maxChannels}
                              frequencyScaleFn={helpers.frequencyScaleFn}
                              minFrequency={trackCfg.minFrequency ?? 0}
                              maxFrequency={trackCfg.maxFrequency ?? sampleRate / 2}
                              labelsColor={trackCfg.labelsColor}
                              labelsBackground={trackCfg.labelsBackground}
                              renderMode={effectiveRenderMode as 'spectrogram' | 'both'}
                              hasClipHeaders={showClipHeaders}
                            />
                          );
                        })()}
                      {trackClipPeaks.map((clip, clipIndex) => {
                        const peaksData = clip.peaks;
                        const width = peaksData.length;

                        return (
                          <Clip
                            key={clip.clipId}
                            clipId={clip.clipId}
                            trackIndex={trackIndex}
                            clipIndex={clipIndex}
                            trackName={clip.trackName}
                            startSample={clip.startSample}
                            durationSamples={clip.durationSamples}
                            samplesPerPixel={samplesPerPixel}
                            showHeader={showClipHeaders}
                            disableHeaderDrag={!interactiveClips}
                            isSelected={track.id === selectedTrackId}
                            trackId={track.id}
                            fadeIn={clip.fadeIn}
                            fadeOut={clip.fadeOut}
                            sampleRate={sampleRate}
                            showFades={showFades}
                            touchOptimized={touchOptimized}
                            onMouseDown={(e) => {
                              const target = e.target as HTMLElement;
                              const isDraggable = target.closest(
                                '[role="button"][aria-roledescription="draggable"]'
                              );
                              if (isDraggable) {
                                return;
                              }
                              selectTrack(trackIndex);
                            }}
                          >
                            {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => {
                              return (
                                <ChannelWithProgress
                                  key={`${clip.clipId}-${channelIndex}`}
                                  index={channelIndex}
                                  data={channelPeaks}
                                  bits={peaksData.bits}
                                  length={width}
                                  isSelected={track.id === selectedTrackId}
                                  clipStartSample={clip.startSample}
                                  clipDurationSamples={clip.durationSamples}
                                  renderMode={clip.midiNotes ? 'piano-roll' : effectiveRenderMode}
                                  midiNotes={clip.midiNotes}
                                  clipSampleRate={clip.sampleRate}
                                  clipOffsetSeconds={
                                    clip.offsetSamples != null
                                      ? clip.offsetSamples / (clip.sampleRate || sampleRate)
                                      : 0
                                  }
                                  samplesPerPixel={samplesPerPixel}
                                  spectrogramClipId={clip.clipId}
                                  spectrogramOnCanvasRegister={
                                    spectrogram ? spectrogram.registerSpectrogramCanvas : undefined
                                  }
                                  spectrogramOnCanvasUnregister={
                                    spectrogram
                                      ? spectrogram.unregisterSpectrogramCanvas
                                      : undefined
                                  }
                                />
                              );
                            })}
                          </Clip>
                        );
                      })}
                      {recordingState?.isRecording &&
                        recordingState.trackId === track.id &&
                        recordingState.peaks[0]?.length > 0 &&
                        (() => {
                          // Strip leading-silence peaks so the visible preview matches
                          // audible content. Recorder runs at real time, but the user's
                          // first reaction lands ~outputLatency+lookAhead seconds into
                          // the buffer (they hadn't heard the backing track yet). Without
                          // this, the playhead — which now uses audible time — would
                          // appear behind the right edge of the recorded waveform.
                          // Mirrors useIntegratedRecording's finalization compensation
                          // (shared `resolveRecordingOffsetSamples`) and dawcore's preview-skip
                          // pattern. `getLookAhead()` reads from the same engine the
                          // playhead's animation loop uses — keeps the two in lockstep.
                          const latencyOffsetSamples = resolveRecordingOffsetSamples({
                            overrideSeconds: recordingState.latencyOffset,
                            outputLatency: getOutputLatency(),
                            lookAhead: getLookAhead(),
                            sampleRate,
                          });
                          const latencyPixels = Math.floor(latencyOffsetSamples / samplesPerPixel);
                          const skipPeakElements = latencyPixels * 2; // each pixel is a min/max pair
                          const previewDuration = Math.max(
                            0,
                            recordingState.durationSamples - latencyOffsetSamples
                          );
                          const previewChannels = (
                            mono ? recordingState.peaks.slice(0, 1) : recordingState.peaks
                          ).map((channelPeaks) =>
                            skipPeakElements > 0 && skipPeakElements < channelPeaks.length
                              ? channelPeaks.subarray(skipPeakElements)
                              : channelPeaks
                          );
                          return (
                            <Clip
                              key={`${track.id}-recording`}
                              clipId="recording-preview"
                              trackIndex={trackIndex}
                              clipIndex={trackClipPeaks.length}
                              trackName="Recording..."
                              startSample={recordingState.startSample}
                              durationSamples={previewDuration}
                              samplesPerPixel={samplesPerPixel}
                              showHeader={showClipHeaders}
                              disableHeaderDrag={true}
                              isSelected={track.id === selectedTrackId}
                              trackId={track.id}
                            >
                              {previewChannels.map((channelPeaks, chIdx) => (
                                <ChannelWithProgress
                                  key={`${track.id}-recording-${chIdx}`}
                                  index={chIdx}
                                  data={channelPeaks}
                                  bits={recordingState.bits}
                                  length={Math.floor(channelPeaks.length / 2)}
                                  isSelected={track.id === selectedTrackId}
                                  clipStartSample={recordingState.startSample}
                                  clipDurationSamples={previewDuration}
                                />
                              ))}
                            </Clip>
                          );
                        })()}
                    </TrackComponent>
                  </TrackRowPositioner>
                );
              })}
            </TracksLayout>
            {annotations.length > 0 && annotationIntegration && (
              <annotationIntegration.AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                {annotations.map((annotation, index) => {
                  const startPosition = (annotation.start * sampleRate) / samplesPerPixel;
                  const endPosition = (annotation.end * sampleRate) / samplesPerPixel;
                  const label = getAnnotationBoxLabel
                    ? getAnnotationBoxLabel(annotation, index)
                    : annotation.id;
                  return (
                    <annotationIntegration.AnnotationBox
                      key={annotation.id}
                      annotationId={annotation.id}
                      annotationIndex={index}
                      startPosition={startPosition}
                      endPosition={endPosition}
                      label={label}
                      color="#ff9800"
                      isActive={annotation.id === activeAnnotationId}
                      onClick={() => handleAnnotationClick(annotation)}
                      editable={annotationsEditable}
                    />
                  );
                })}
              </annotationIntegration.AnnotationBoxesWrapper>
            )}
            {selectionStart !== selectionEnd && (
              <Selection
                startPosition={
                  (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel
                }
                endPosition={
                  (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel
                }
                color={theme.selectionColor}
              />
            )}
            {(isPlaying || selectionStart === selectionEnd) &&
              (renderPlayhead ? (
                <CustomPlayhead
                  renderPlayhead={renderPlayhead}
                  color={theme.playheadColor}
                  samplesPerPixel={samplesPerPixel}
                  sampleRate={sampleRate}
                />
              ) : (
                <AnimatedPlayhead color={theme.playheadColor} />
              ))}
          </>
        </Playlist>
      </PlaylistInfoContext.Provider>
      {spectrogram?.SettingsModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <spectrogram.SettingsModal
            open={settingsModalTrackId !== null}
            onClose={() => setSettingsModalTrackId(null)}
            config={
              settingsModalTrackId !== null
                ? (spectrogram.trackSpectrogramOverrides.get(settingsModalTrackId)?.config ??
                  tracks.find((t) => t.id === settingsModalTrackId)?.spectrogramConfig ??
                  spectrogram.spectrogramConfig ??
                  {})
                : {}
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
