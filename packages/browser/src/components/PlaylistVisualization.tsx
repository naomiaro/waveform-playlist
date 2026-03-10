import React, { useContext, useRef, useState, useMemo, type ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { getGlobalContext } from '@waveform-playlist/playout';
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
} from '@waveform-playlist/ui-components';
import { AnnotationIntegrationContext } from '../AnnotationIntegrationContext';
import {
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
  type ClipPeaks,
} from '../WaveformPlaylistContext';
import type { Peaks } from '@waveform-playlist/core';
import { AnimatedPlayhead } from './AnimatedPlayhead';
import { ChannelWithProgress } from './ChannelWithProgress';
import type { SpectrogramConfig } from '@waveform-playlist/core';
import type { AnnotationAction } from '@waveform-playlist/core';
import type { AnnotationData, GetAnnotationBoxLabelFn } from '../types/annotations';
import { SpectrogramIntegrationContext } from '../SpectrogramIntegrationContext';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

interface ControlSlotProps {
  readonly $height: number;
  readonly $isSelected?: boolean;
}

/**
 * Height-synced container for each track's controls in the ControlsColumn.
 * Uses the same height formula as Track: waveHeight * numChannels + clipHeaderHeight.
 */
const ControlSlot = styled.div.attrs<ControlSlotProps>((props) => ({
  style: { height: `${props.$height}px` },
}))<ControlSlotProps>`
  overflow: hidden;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;
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
  };
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
    playbackStartTimeRef,
    audioStartPositionRef,
    getPlaybackTime,
  } = usePlaybackAnimation();

  return renderPlayhead({
    position: ((currentTimeRef.current ?? 0) * sampleRate) / samplesPerPixel,
    color,
    isPlaying,
    currentTimeRef,
    playbackStartTimeRef,
    audioStartPositionRef,
    samplesPerPixel,
    sampleRate,
    controlsOffset: 0,
    getAudioContextTime: () => getGlobalContext().rawContext.currentTime,
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
}) => {
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  const { isPlaying } = usePlaybackAnimation();
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
    isReady,
    mono,
  } = usePlaylistData();

  // Optional spectrogram integration (only available when SpectrogramProvider is present)
  const spectrogram = useContext(SpectrogramIntegrationContext);

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

  // Worker canvas API for SpectrogramChannel (stable reference)
  const workerCanvasApi = useMemo(() => {
    if (!spectrogram?.spectrogramWorkerApi) return undefined;
    return {
      registerCanvas: spectrogram.spectrogramWorkerApi.registerCanvas.bind(
        spectrogram.spectrogramWorkerApi
      ),
      unregisterCanvas: spectrogram.spectrogramWorkerApi.unregisterCanvas.bind(
        spectrogram.spectrogramWorkerApi
      ),
    };
  }, [spectrogram?.spectrogramWorkerApi]);

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

  // When indefinitePlayback is enabled, ensure the timeline fills the visible scroll container
  if (indefinitePlayback) {
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
    ? peaksDataArray.map((trackClipPeaks, trackIndex) => {
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

        const maxChannels = getTrackChannelCount(trackClipPeaks, recordingState, track.id, mono);

        // Height must match Track component: waveHeight * numChannels + clipHeaderHeight
        const slotHeight = waveHeight * maxChannels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0);

        const trackControlContent = renderTrackControls ? (
          renderTrackControls(trackIndex)
        ) : (
          <Controls onClick={() => selectTrack(trackIndex)}>
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
                        onRenderModeChange: (mode) =>
                          spectrogram.setTrackRenderMode(track.id, mode),
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
          </Controls>
        );

        return (
          <ControlSlot
            key={track.id}
            $height={slotHeight}
            $isSelected={track.id === selectedTrackId}
          >
            {trackControlContent}
          </ControlSlot>
        );
      })
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
                <TrackComponent
                  key={track.id}
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
                              spectrogramWorkerApi={workerCanvasApi}
                              spectrogramClipId={clip.clipId}
                              spectrogramOnCanvasesReady={
                                spectrogram
                                  ? (canvasIds, canvasWidths) => {
                                      spectrogram.registerSpectrogramCanvases(
                                        clip.clipId,
                                        channelIndex,
                                        canvasIds,
                                        canvasWidths
                                      );
                                    }
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
                    recordingState.peaks[0]?.length > 0 && (
                      <Clip
                        key={`${track.id}-recording`}
                        clipId="recording-preview"
                        trackIndex={trackIndex}
                        clipIndex={trackClipPeaks.length}
                        trackName="Recording..."
                        startSample={recordingState.startSample}
                        durationSamples={recordingState.durationSamples}
                        samplesPerPixel={samplesPerPixel}
                        showHeader={showClipHeaders}
                        disableHeaderDrag={true}
                        isSelected={track.id === selectedTrackId}
                        trackId={track.id}
                      >
                        {(mono ? recordingState.peaks.slice(0, 1) : recordingState.peaks).map(
                          (channelPeaks, chIdx) => (
                            <ChannelWithProgress
                              key={`${track.id}-recording-${chIdx}`}
                              index={chIdx}
                              data={channelPeaks}
                              bits={recordingState.bits}
                              length={Math.floor(channelPeaks.length / 2)}
                              isSelected={track.id === selectedTrackId}
                              clipStartSample={recordingState.startSample}
                              clipDurationSamples={recordingState.durationSamples}
                            />
                          )
                        )}
                      </Clip>
                    )}
                </TrackComponent>
              );
            })}
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
