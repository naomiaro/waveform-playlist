import React, { useRef, useState, ReactNode, useCallback } from 'react';
import { ThemeProvider } from 'styled-components';
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
  secondsToPixels,
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
  defaultTheme,
  type WaveformPlaylistTheme,
} from '@waveform-playlist/ui-components';
import {
  AnnotationBoxesWrapper,
  AnnotationBox,
  AnnotationText,
  useAnnotationControls,
} from '@waveform-playlist/annotations';
import { usePlaybackAnimation, usePlaylistState, usePlaylistControls, usePlaylistData } from '../WaveformPlaylistContext';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';

export interface WaveformProps {
  theme?: Partial<WaveformPlaylistTheme>;
  timescale?: boolean;
  renderTrackControls?: (trackIndex: number) => ReactNode;
  renderTimestamp?: (timeMs: number, pixelPosition: number) => ReactNode;
  annotationControls?: any[];
  annotationListConfig?: any;
  className?: string;
  showClipHeaders?: boolean; // Show draggable headers on clips for multi-clip editing (requires @dnd-kit)
}

/**
 * Waveform visualization component that uses the playlist context
 */
export const Waveform: React.FC<WaveformProps> = ({
  theme: userTheme,
  timescale = true,
  renderTrackControls,
  renderTimestamp,
  annotationControls,
  annotationListConfig,
  className,
  showClipHeaders = false,
}) => {
  // Split context usage for performance
  const { isPlaying, currentTime, currentTimeRef } = usePlaybackAnimation();
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
  } = usePlaylistData();

  // Use annotation controls hook for boundary update logic
  const { updateAnnotationBoundaries } = useAnnotationControls({
    initialContinuousPlay: continuousPlay,
    initialLinkEndpoints: linkEndpoints,
  });

  const [isSelecting, setIsSelecting] = useState(false);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{
    id: string;
    edge: 'start' | 'end';
    originalStart: number;
    originalEnd: number;
    startX: number;
  } | null>(null);

  // Local ref for scroll container to use in drag handlers
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Callback to set both local ref and context ref
  const handleScrollContainerRef = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
    setScrollContainer(element);
  }, [setScrollContainer]);

  const theme = { ...defaultTheme, ...userTheme };

  // Calculate dimensions
  const tracksFullWidth = audioBuffers.length > 0
    ? Math.floor((duration * sampleRate) / samplesPerPixel)
    : 0;

  // Calculate padding for timescale text overflow based on duration
  // Estimate character width at 0.75rem (~8px/char) for timestamps like "1:00:00" (7 chars)
  // Longer durations need more padding for wider timestamp text
  const estimatedMaxTimestampChars = duration >= 3600 ? 8 : duration >= 600 ? 6 : 5;
  const timescalePadding = estimatedMaxTimestampChars * 8 + 10; // chars * px/char + buffer

  // Annotation handlers
  const handleAnnotationClick = async (annotation: any) => {
    console.log('Annotation clicked:', annotation.id);
    setActiveAnnotationId(annotation.id);
    const playDuration = !continuousPlay ? annotation.end - annotation.start : undefined;
    await play(annotation.start, playDuration);
  };

  const handleAnnotationDragStart = (annotationId: string, edge: 'start' | 'end', e: React.DragEvent) => {
    const annotation = annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    setDraggingAnnotation({
      id: annotationId,
      edge,
      originalStart: annotation.start,
      originalEnd: annotation.end,
      startX: e.clientX,
    });
  };

  const handleAnnotationDrag = (e: React.DragEvent) => {
    if (!draggingAnnotation || e.clientX === 0) return; // clientX is 0 on dragend

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Calculate absolute position accounting for scroll
    const rect = scrollContainer.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const newTime = (x * samplesPerPixel) / sampleRate;

    const annotationIndex = annotations.findIndex(a => a.id === draggingAnnotation.id);

    if (annotationIndex !== -1) {
      const updatedAnnotations = updateAnnotationBoundaries({
        annotationIndex,
        newTime,
        isDraggingStart: draggingAnnotation.edge === 'start',
        annotations,
        duration,
      });

      setAnnotations(updatedAnnotations);
    }
  };

  const handleAnnotationDragEnd = () => {
    setDraggingAnnotation(null);
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

    // Account for timescale height if present
    const timescaleOffset = timescale ? timeScaleHeight : 0;
    const trackY = y - timescaleOffset;

    // Calculate track index based on cumulative heights
    let cumulativeHeight = 0;
    let clickedTrackIndex = -1;

    for (let i = 0; i < peaksDataArray.length; i++) {
      const trackClipPeaks = peaksDataArray[i];
      if (trackClipPeaks.length === 0) continue;

      // Calculate track height
      const maxChannels = Math.max(...trackClipPeaks.map(clip => clip.peaks.data.length));
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

  if (audioBuffers.length === 0 || peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  return (
    <DevicePixelRatioProvider>
      <ThemeProvider theme={theme}>
        <PlaylistInfoContext.Provider
          value={{
            samplesPerPixel,
            sampleRate,
            zoomLevels: [samplesPerPixel],
            waveHeight,
            timeScaleHeight,
            duration,
            controls,
          }}
        >
          <Playlist
            theme={theme}
            backgroundColor={theme.waveOutlineColor}
            timescaleBackgroundColor={theme.timescaleBackgroundColor}
            scrollContainerWidth={tracksFullWidth + (controls.show ? controls.width : 0) + timescalePadding}
            timescaleWidth={tracksFullWidth}
            tracksWidth={tracksFullWidth}
            controlsWidth={controls.show ? controls.width : 0}
            onTracksMouseDown={handleMouseDown}
            onTracksMouseMove={handleMouseMove}
            onTracksMouseUp={handleMouseUp}
            scrollContainerRef={handleScrollContainerRef}
            timescale={
              timescale ? (
                <StyledTimeScale
                  duration={duration * 1000}
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

                // Render all clips for this track
                if (trackClipPeaks.length === 0) {
                  return null; // Skip tracks with no clips
                }

                // Determine max number of channels across all clips
                const maxChannels = Math.max(
                  ...trackClipPeaks.map(clip => clip.peaks.data.length)
                );

                return (
                  <TrackControlsContext.Provider key={trackIndex} value={trackControls}>
                    <TrackComponent
                      numChannels={maxChannels}
                      backgroundColor={theme.waveOutlineColor}
                      offset={0}
                      width={tracksFullWidth}
                      hasClipHeaders={showClipHeaders}
                      trackId={tracks[trackIndex].id}
                      isSelected={tracks[trackIndex].id === selectedTrackId}
                    >
                      {trackClipPeaks.map((clip, clipIndex) => {
                        const peaksData = clip.peaks;
                        const width = peaksData.length;

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
                            isSelected={tracks[trackIndex].id === selectedTrackId}
                            trackId={tracks[trackIndex].id}
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
                                progress={0}
                                isSelected={tracks[trackIndex].id === selectedTrackId}
                              />
                            ))}
                          </Clip>
                        );
                      })}
                    </TrackComponent>
                  </TrackControlsContext.Provider>
                );
              })}
              {annotations.length > 0 && (
                <AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                  {annotations.map((annotation) => {
                    const startPosition = (annotation.start * sampleRate) / samplesPerPixel;
                    const endPosition = (annotation.end * sampleRate) / samplesPerPixel;
                    return (
                      <AnnotationBox
                        key={annotation.id}
                        startPosition={startPosition}
                        endPosition={endPosition}
                        label={annotation.id}
                        color="#ff9800"
                        isActive={annotation.id === activeAnnotationId}
                        onClick={() => handleAnnotationClick(annotation)}
                        onDragStart={(edge, e) => handleAnnotationDragStart(annotation.id, edge, e)}
                        onDrag={handleAnnotationDrag}
                        onDragEnd={handleAnnotationDragEnd}
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
                <Playhead
                  position={
                    (currentTime * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  color={theme.playheadColor}
                />
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
              onAnnotationUpdate={(updatedAnnotations) => {
                setAnnotations(updatedAnnotations);
              }}
            />
          )}
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    </DevicePixelRatioProvider>
  );
};
