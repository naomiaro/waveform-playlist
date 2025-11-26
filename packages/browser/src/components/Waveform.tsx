import React, { useRef, useState, ReactNode, useCallback } from 'react';
import {
  Playlist,
  Track as TrackComponent,
  Clip,
  SmartChannel,
  Playhead,
  Selection,
  PlaylistInfoContext,
  TrackControlsContext,
  DevicePixelRatioProvider,
  StyledTimeScale,
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
  useTheme,
  type RenderPlayheadFunction,
} from '@waveform-playlist/ui-components';
import {
  AnnotationBoxesWrapper,
  AnnotationBox,
  AnnotationText,
} from '@waveform-playlist/annotations';
import type { AnnotationAction, AnnotationActionOptions } from '@waveform-playlist/annotations';
import { usePlaybackAnimation, usePlaylistState, usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';

// Default duration in seconds for empty tracks (used for recording workflow)
const DEFAULT_EMPTY_TRACK_DURATION = 60;

export interface WaveformProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTimestamp?: (timeMs: number, pixelPosition: number) => ReactNode;
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
  annotationControls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  annotationTextHeight?: number; // Height in pixels for the annotation text list
  className?: string;
  showClipHeaders?: boolean; // Show headers on clips for visual organization
  interactiveClips?: boolean; // Enable dragging/trimming interactions on clips (requires @dnd-kit setup)
  // Live recording state for real-time waveform preview
  recordingState?: {
    isRecording: boolean;
    trackId: string; // Which track is being recorded into
    startSample: number; // Where recording started
    durationSamples: number; // Current recording length
    peaks: Int8Array | Int16Array; // Live peaks data
  };
}

/**
 * Waveform visualization component that uses the playlist context
 */
export const Waveform: React.FC<WaveformProps> = ({
  renderTrackControls,
  renderTimestamp,
  renderPlayhead,
  annotationControls,
  annotationListConfig: _annotationListConfig,
  annotationTextHeight,
  className,
  showClipHeaders = false,
  interactiveClips = false,
  recordingState,
}) => {
  // Get theme from context (typed as WaveformPlaylistTheme)
  const theme = useTheme() as import('@waveform-playlist/ui-components').WaveformPlaylistTheme;

  // Split context usage for performance
  const { isPlaying, currentTime } = usePlaybackAnimation();
  const {
    selectionStart,
    selectionEnd,
    annotations,
    activeAnnotationId,
    annotationsEditable,
    linkEndpoints,
    continuousPlay,
    selectedTrackId,
  } = usePlaylistState();
  const {
    setAnnotations,
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
  } = usePlaylistControls();
  const {
    audioBuffers,
    peaksDataArray,
    trackStates,
    tracks,
    duration,
    samplesPerPixel,
    sampleRate,
    waveHeight,
    timeScaleHeight,
    controls,
    playoutRef,
    barWidth,
    barGap,
  } = usePlaylistData();

  const [isSelecting, setIsSelecting] = useState(false);

  // Local ref for scroll container to use in drag handlers
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Callback to set both local ref and context ref
  const handleScrollContainerRef = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
    setScrollContainer(element);
  }, [setScrollContainer]);

  // Calculate dimensions
  // If there are no clips, provide a reasonable default width for recording
  let displayDuration = audioBuffers.length > 0 ? duration : DEFAULT_EMPTY_TRACK_DURATION;

  // Extend duration during recording if needed
  if (recordingState?.isRecording) {
    const recordingEndSample = recordingState.startSample + recordingState.durationSamples;
    const recordingEndTime = recordingEndSample / sampleRate;
    displayDuration = Math.max(displayDuration, recordingEndTime + 10); // Add 10s buffer
  }

  const tracksFullWidth = Math.floor((displayDuration * sampleRate) / samplesPerPixel);

  // Calculate padding for timescale text overflow based on duration
  // Estimate character width at 0.75rem (~8px/char) for timestamps like "1:00:00" (7 chars)
  // Longer durations need more padding for wider timestamp text
  const estimatedMaxTimestampChars = displayDuration >= 3600 ? 8 : displayDuration >= 600 ? 6 : 5;
  const timescalePadding = estimatedMaxTimestampChars * 8 + 10; // chars * px/char + buffer

  // Annotation click handler
  const handleAnnotationClick = async (annotation: any) => {
    console.log('Annotation clicked:', annotation.id);
    setActiveAnnotationId(annotation.id);
    const playDuration = !continuousPlay ? annotation.end - annotation.start : undefined;
    await play(annotation.start, playDuration);
  };

  // Shared function for track selection
  const selectTrack = useCallback((trackIndex: number, source: string = 'unknown') => {
    if (trackIndex >= 0 && trackIndex < tracks.length) {
      const track = tracks[trackIndex];
      console.log(`[Track Selection] ${source}: track "${track.name}" (ID: ${track.id})`);
      setSelectedTrackId(track.id);
    }
  }, [tracks, setSelectedTrackId]);

  // Mouse handlers for selection and click-to-seek
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    // Calculate which track was clicked based on Y position
    // The click overlay covers all tracks, so we need to calculate from Y position
    const y = e.clientY - rect.top;

    // Account for timescale height if present (timeScaleHeight is 0 when disabled)
    const trackY = y - timeScaleHeight;

    // Calculate track index based on cumulative heights
    let cumulativeHeight = 0;
    let clickedTrackIndex = -1;

    for (let i = 0; i < peaksDataArray.length; i++) {
      const trackClipPeaks = peaksDataArray[i];

      // Calculate track height (1 channel for empty tracks, max channels for tracks with clips)
      const maxChannels = trackClipPeaks.length > 0
        ? Math.max(...trackClipPeaks.map(clip => clip.peaks.data.length))
        : 1;
      const trackHeight = maxChannels * waveHeight + (showClipHeaders ? 22 : 0); // CLIP_HEADER_HEIGHT = 22

      if (trackY >= cumulativeHeight && trackY < cumulativeHeight + trackHeight) {
        clickedTrackIndex = i;
        break;
      }

      cumulativeHeight += trackHeight;
    }

    // Select the clicked track
    if (clickedTrackIndex !== -1) {
      selectTrack(clickedTrackIndex, `Clicked at Y=${trackY}px`);
    }

    setIsSelecting(true);
    setCurrentTime(clickTime);
    setSelection(clickTime, clickTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const moveTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, moveTime);
    const end = Math.max(selectionStart, moveTime);
    setSelection(start, end);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    setIsSelecting(false);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const endTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    // If it's just a click (not a drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      setCurrentTime(start);

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        play(start);
      } else if (playoutRef.current) {
        playoutRef.current.stop();
      }
    } else {
      // It was a drag - finalize the selection
      setSelection(start, end);
    }
  };

  // Only show loading if we have tracks WITH clips but haven't loaded their data yet
  // If tracks are empty or all tracks have no clips, render the empty playlist
  const hasClips = tracks.some(track => track.clips.length > 0);
  if (hasClips && (audioBuffers.length === 0 || peaksDataArray.length === 0)) {
    return <div className={className}>Loading waveform...</div>;
  }

  return (
    <DevicePixelRatioProvider>
      <PlaylistInfoContext.Provider
        value={{
          samplesPerPixel,
          sampleRate,
          zoomLevels: [samplesPerPixel],
          waveHeight,
          timeScaleHeight,
          duration: displayDuration,
          controls,
          barWidth,
          barGap,
        }}
      >
          <Playlist
            theme={theme}
            backgroundColor={theme.waveOutlineColor}
            timescaleBackgroundColor={theme.timescaleBackgroundColor}
            scrollContainerWidth={tracksFullWidth + (controls.show ? controls.width : 0) + (timeScaleHeight > 0 ? timescalePadding : 0)}
            timescaleWidth={tracksFullWidth}
            tracksWidth={tracksFullWidth}
            controlsWidth={controls.show ? controls.width : 0}
            onTracksMouseDown={handleMouseDown}
            onTracksMouseMove={handleMouseMove}
            onTracksMouseUp={handleMouseUp}
            scrollContainerRef={handleScrollContainerRef}
            timescale={
              timeScaleHeight > 0 ? (
                <StyledTimeScale
                  duration={displayDuration * 1000}
                  marker={10000}
                  bigStep={5000}
                  secondStep={1000}
                  renderTimestamp={renderTimestamp}
                />
              ) : undefined
            }
          >
            <>
              {peaksDataArray.map((trackClipPeaks, trackIndex) => {
                // Skip if track doesn't exist (can happen during track deletion transition)
                const track = tracks[trackIndex];
                if (!track) return null;

                const trackState = trackStates[trackIndex] || {
                  name: `Track ${trackIndex + 1}`,
                  muted: false,
                  soloed: false,
                  volume: 1.0,
                  pan: 0,
                };

                // Default track controls if not custom renderer provided
                const trackControls = renderTrackControls ? (
                  renderTrackControls(trackIndex)
                ) : (
                  <Controls onClick={() => selectTrack(trackIndex, 'Clicked controls')}>
                    <Header style={{ justifyContent: 'center' }}>
                      {trackState.name || `Track ${trackIndex + 1}`}
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
                        onChange={(e) =>
                          setTrackVolume(trackIndex, parseFloat(e.target.value))
                        }
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
                        onChange={(e) =>
                          setTrackPan(trackIndex, parseFloat(e.target.value))
                        }
                      />
                      <span>R</span>
                    </SliderWrapper>
                  </Controls>
                );

                // Determine max number of channels across all clips
                // Default to 1 channel (mono) for empty tracks
                const maxChannels = trackClipPeaks.length > 0
                  ? Math.max(...trackClipPeaks.map(clip => clip.peaks.data.length))
                  : 1;

                return (
                  <TrackControlsContext.Provider key={track.id} value={trackControls}>
                    <TrackComponent
                      numChannels={maxChannels}
                      backgroundColor={theme.waveOutlineColor}
                      offset={0}
                      width={tracksFullWidth}
                      hasClipHeaders={showClipHeaders}
                      trackId={track.id}
                      isSelected={track.id === selectedTrackId}
                    >
                      {trackClipPeaks.map((clip, clipIndex) => {
                        const peaksData = clip.peaks;
                        const width = peaksData.length;

                        // Calculate progress in pixels for this clip
                        // Progress shows how far through the clip the playhead is
                        const currentSample = currentTime * sampleRate;
                        const clipEndSample = clip.startSample + clip.durationSamples;
                        let clipProgress = 0;
                        if (currentSample >= clip.startSample && currentSample < clipEndSample) {
                          // Playhead is within this clip
                          const sampleIntoClip = currentSample - clip.startSample;
                          clipProgress = sampleIntoClip / samplesPerPixel;
                        } else if (currentSample >= clipEndSample) {
                          // Playhead is past this clip - show full progress
                          clipProgress = width;
                        }
                        // else: playhead is before clip, progress = 0

                        return (
                          <Clip
                            key={`${trackIndex}-${clipIndex}`}
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
                            onMouseDown={(e) => {
                              // Only select track if clicking on the waveform, not on draggable elements
                              const target = e.target as HTMLElement;
                              // Check if click is on a draggable element (header or boundary)
                              // @dnd-kit sets role="button" and aria-roledescription="draggable" on drag handles
                              const isDraggable = target.closest('[role="button"][aria-roledescription="draggable"]');
                              if (isDraggable) {
                                // Don't select track - let drag event handler take over
                                return;
                              }
                              selectTrack(trackIndex, 'Clicked clip');
                            }}
                          >
                            {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => (
                              <SmartChannel
                                key={`${trackIndex}-${clipIndex}-${channelIndex}`}
                                index={channelIndex}
                                data={channelPeaks}
                                bits={peaksData.bits}
                                length={width}
                                progress={clipProgress}
                                isSelected={track.id === selectedTrackId}
                              />
                            ))}
                          </Clip>
                        );
                      })}
                      {/* Render live recording preview if this track is being recorded */}
                      {recordingState?.isRecording &&
                       recordingState.trackId === track.id &&
                       recordingState.peaks.length > 0 && (
                        <Clip
                          key={`${trackIndex}-recording`}
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
                          <SmartChannel
                            key={`${trackIndex}-recording-0`}
                            index={0}
                            data={recordingState.peaks}
                            bits={16}
                            length={Math.floor(recordingState.peaks.length / 2)}
                            progress={0}
                            isSelected={track.id === selectedTrackId}
                          />
                        </Clip>
                      )}
                    </TrackComponent>
                  </TrackControlsContext.Provider>
                );
              })}
              {annotations.length > 0 && (
                <AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                  {annotations.map((annotation, index) => {
                    const startPosition = (annotation.start * sampleRate) / samplesPerPixel;
                    const endPosition = (annotation.end * sampleRate) / samplesPerPixel;
                    return (
                      <AnnotationBox
                        key={annotation.id}
                        annotationId={annotation.id}
                        annotationIndex={index}
                        startPosition={startPosition}
                        endPosition={endPosition}
                        label={annotation.id}
                        color="#ff9800"
                        isActive={annotation.id === activeAnnotationId}
                        onClick={() => handleAnnotationClick(annotation)}
                        editable={annotationsEditable}
                      />
                    );
                  })}
                </AnnotationBoxesWrapper>
              )}
              {selectionStart !== selectionEnd && (
                <Selection
                  startPosition={
                    (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  endPosition={
                    (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  color={theme.selectionColor}
                />
              )}
              {(isPlaying || selectionStart === selectionEnd) && (
                renderPlayhead ? (
                  renderPlayhead({
                    position: (currentTime * sampleRate) / samplesPerPixel +
                      (controls.show ? controls.width : 0),
                    color: theme.playheadColor,
                  })
                ) : (
                  <Playhead
                    position={
                      (currentTime * sampleRate) / samplesPerPixel +
                      (controls.show ? controls.width : 0)
                    }
                    color={theme.playheadColor}
                  />
                )
              )}
            </>
          </Playlist>
          {annotations.length > 0 && (
            <AnnotationText
              annotations={annotations}
              activeAnnotationId={activeAnnotationId ?? undefined}
              shouldScrollToActive={true}
              editable={annotationsEditable}
              controls={annotationsEditable ? annotationControls : undefined}
              annotationListConfig={{ linkEndpoints, continuousPlay }}
              height={annotationTextHeight}
              onAnnotationUpdate={(updatedAnnotations) => {
                setAnnotations(updatedAnnotations);
              }}
            />
          )}
        </PlaylistInfoContext.Provider>
    </DevicePixelRatioProvider>
  );
};
