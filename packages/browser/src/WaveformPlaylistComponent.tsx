import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import {
  AnnotationBox,
  AnnotationBoxesWrapper,
  AnnotationText,
  Playlist,
  Track as TrackComponent,
  SmartChannel,
  Playhead,
  Selection,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  StyledTimeScale,
  secondsToPixels,
  type AnnotationData,
} from '@waveform-playlist/ui-components';
import { TonePlayout } from '@waveform-playlist/playout';
import { type Track } from '@waveform-playlist/core';
import * as Tone from 'tone';
import { generatePeaks } from './peaksUtil';
import type { PeakData, Peaks } from '@waveform-playlist/webaudio-peaks';
import { SelectionTimeInputsManager } from './SelectionTimeInputsManager';

// Default theme
const defaultTheme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

export interface WaveformPlaylistProps {
  tracks: Array<{
    src: string;
    name?: string;
  }>;
  timescale?: boolean;
  mono?: boolean;
  waveHeight?: number;
  samplesPerPixel?: number;
  theme?: {
    waveOutlineColor?: string;
    waveFillColor?: string;
    waveProgressColor?: string;
    timeColor?: string;
  };
  annotationList?: {
    annotations?: any[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: any[];
  };
  onReady?: () => void;
  onAnnotationUpdate?: (annotations: AnnotationData[]) => void;
}

export const WaveformPlaylistComponent: React.FC<WaveformPlaylistProps> = ({
  tracks,
  timescale = true,
  mono = true,
  waveHeight = 80,
  samplesPerPixel = 1024,
  theme: userTheme,
  annotationList,
  onReady,
  onAnnotationUpdate,
}) => {
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaksData, setPeaksData] = useState<PeakData | null>(null);
  const [isContinuousPlay, setIsContinuousPlay] = useState(annotationList?.isContinuousPlay ?? false);
  const [linkEndpoints, setLinkEndpoints] = useState(annotationList?.linkEndpoints ?? true);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isAutomaticScroll, setIsAutomaticScroll] = useState(false);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{
    id: string;
    edge: 'start' | 'end';
    originalStart: number;
    originalEnd: number;
    startX: number;
  } | null>(null);

  const playoutRef = useRef<TonePlayout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingTimedSegmentRef = useRef(false);
  const currentTimeRef = useRef<number>(0);
  const isSelectingRef = useRef(false);
  const isAutomaticScrollRef = useRef(false);
  const isPlayingRef = useRef(false);
  const selectionInputsManagerRef = useRef<SelectionTimeInputsManager | null>(null);

  const theme = { ...defaultTheme, ...userTheme };

  // Load audio and initialize
  useEffect(() => {
    if (tracks.length === 0) return;

    const loadAudio = async () => {
      try {
        const track = tracks[0]; // Load first track for now
        console.log('Fetching audio from:', track.src);
        const response = await fetch(track.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = Tone.getContext().rawContext as AudioContext;
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Audio decoded, duration:', buffer.duration);

        setAudioBuffer(buffer);
        setDuration(buffer.duration);

        // Generate peaks
        const bits = 16;
        const peaks = generatePeaks(buffer, samplesPerPixel, mono, bits);
        setPeaksData(peaks);
        console.log('Peaks generated:', peaks.data.length, 'channels, bits:', peaks.bits, 'length:', peaks.length);

        // Initialize playout (don't call init() yet - needs user gesture)
        console.log('Creating TonePlayout...');
        const playout = new TonePlayout();
        console.log('TonePlayout created');

        // Create and add track
        const trackObj: Track = {
          id: 'track-0',
          name: track.name || 'Audio Track',
          gain: 1,
          muted: false,
          soloed: false,
          stereoPan: 0,
          startTime: 0,
        };

        playout.addTrack({
          buffer,
          track: trackObj,
        });
        console.log('Track added to playout');

        playoutRef.current = playout;
        console.log('Playout ref set:', playoutRef.current);

        onReady?.();
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    loadAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (playoutRef.current) {
        playoutRef.current.dispose();
      }
    };
  }, [tracks, samplesPerPixel, mono, onReady]);

  // Parse annotations
  useEffect(() => {
    if (!annotationList?.annotations) return;

    const parsed = annotationList.annotations.map(note => {
      const start = note.begin !== undefined ? parseFloat(note.begin) : note.start;
      const end = note.end !== undefined ?
        (typeof note.end === 'string' ? parseFloat(note.end) : note.end) : note.end;

      return {
        id: note.id,
        start: start,
        end: end,
        lines: note.lines,
        language: note.language,
      };
    });
    setAnnotations(parsed);
  }, [annotationList?.annotations]);

  // Automatic scroll to keep playhead in view
  const scrollToCurrentTime = () => {
    if (!scrollContainerRef.current || !audioBuffer) {
      console.log('scrollToCurrentTime: missing ref or buffer', {
        hasRef: !!scrollContainerRef.current,
        hasBuffer: !!audioBuffer
      });
      return;
    }

    // Convert current time to pixels
    const currentPixel = secondsToPixels(currentTimeRef.current, samplesPerPixel, sampleRate);

    const viewportWidth = scrollContainerRef.current.clientWidth;
    const currentScrollLeft = scrollContainerRef.current.scrollLeft;
    const currentScrollRight = currentScrollLeft + viewportWidth;

    // Define playhead position in viewport (20% from left edge)
    const playheadOffset = viewportWidth * 0.2;

    // Check if playhead is outside the visible area
    const isOutsideLeft = currentPixel < currentScrollLeft;
    const isOutsideRight = currentPixel > currentScrollRight;

    console.log('scrollToCurrentTime:', {
      currentPixel,
      viewportWidth,
      currentScrollLeft,
      currentScrollRight,
      isOutsideLeft,
      isOutsideRight
    });

    if (isOutsideLeft || isOutsideRight) {
      const newScrollLeft = Math.max(0, currentPixel - playheadOffset);
      console.log('Scrolling to:', newScrollLeft);
      scrollContainerRef.current.scrollLeft = newScrollLeft;
    }
  };

  // Animation loop
  const startAnimationLoop = () => {
    const updateTime = () => {
      if (playoutRef.current) {
        const time = playoutRef.current.getCurrentTime();
        currentTimeRef.current = time;
        setCurrentTime(time);

        // Check if playback has reached the end
        if (time >= duration) {
          handleStop();
          return;
        }

        // Update active annotation based on playback time
        if (!isPlayingTimedSegmentRef.current || isContinuousPlay) {
          const currentAnnotation = annotations.find(
            (ann) => time >= ann.start && time < ann.end
          );
          if (currentAnnotation && currentAnnotation.id !== activeAnnotationId) {
            setActiveAnnotationId(currentAnnotation.id);
            setShouldScrollToActive(true);
          }
        }

        // Handle automatic scroll
        if (isAutomaticScrollRef.current) {
          console.log('Calling scrollToCurrentTime, isAutomaticScroll:', isAutomaticScrollRef.current);
          scrollToCurrentTime();
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    animationFrameRef.current = requestAnimationFrame(updateTime);
  };

  const stopAnimationLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Play/pause handlers
  const handlePlay = async (startTime?: number, playDuration?: number) => {
    if (!playoutRef.current || !audioBuffer) return;

    await playoutRef.current.init();

    if (playDuration !== undefined) {
      isPlayingTimedSegmentRef.current = true;
      playoutRef.current.setOnPlaybackComplete(() => {
        isPlayingTimedSegmentRef.current = false;
        handlePause(false);
      });
    } else {
      isPlayingTimedSegmentRef.current = false;
    }

    playoutRef.current.play(Tone.now(), startTime, playDuration);
    setIsPlaying(true);
    startAnimationLoop();
  };

  const handlePause = (clearActiveAnnotation: boolean = true) => {
    if (!playoutRef.current) return;

    const pauseTime = playoutRef.current.getCurrentTime();
    playoutRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();

    currentTimeRef.current = pauseTime;
    setCurrentTime(pauseTime);

    if (clearActiveAnnotation) {
      setActiveAnnotationId(null);
      setShouldScrollToActive(false);
    } else {
      setShouldScrollToActive(false);
    }
  };

  const handleStop = () => {
    if (!playoutRef.current) return;

    playoutRef.current.stop();
    setIsPlaying(false);
    stopAnimationLoop();

    currentTimeRef.current = 0;
    setCurrentTime(0);
    setActiveAnnotationId(null);
    setShouldScrollToActive(false);
  };

  const handleAnnotationClick = async (annotation: AnnotationData) => {
    console.log('WaveformPlaylist: Annotation clicked, starting playback');
    setActiveAnnotationId(annotation.id);
    setShouldScrollToActive(true);
    const playDuration = !isContinuousPlay ? annotation.end - annotation.start : undefined;
    await handlePlay(annotation.start, playDuration);
  };

  // Mouse handlers for selection and click-to-seek
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x * samplesPerPixel) / (audioBuffer?.sampleRate || 44100);

    isSelectingRef.current = true;
    // Update currentTime immediately so playhead appears at click position
    currentTimeRef.current = clickTime;
    setCurrentTime(clickTime);
    // Clear any existing selection
    setSelectionStart(clickTime);
    setSelectionEnd(clickTime);
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

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const newTime = (x * samplesPerPixel) / sampleRate;

    const updatedAnnotations = [...annotations];
    const annotationIndex = updatedAnnotations.findIndex(a => a.id === draggingAnnotation.id);

    if (annotationIndex !== -1) {
      const annotation = updatedAnnotations[annotationIndex];
      const LINK_THRESHOLD = 0.01; // Consider edges "linked" if within 10ms

      if (draggingAnnotation.edge === 'start') {
        // Dragging start edge
        const constrainedStart = Math.max(0, Math.min(newTime, annotation.end - 0.1));
        const delta = constrainedStart - annotation.start;

        updatedAnnotations[annotationIndex] = {
          ...annotation,
          start: constrainedStart,
        };

        if (linkEndpoints && annotationIndex > 0) {
          // Link Endpoints: if previous annotation's end is touching this start, move it together
          const prevAnnotation = updatedAnnotations[annotationIndex - 1];
          if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
            updatedAnnotations[annotationIndex - 1] = {
              ...prevAnnotation,
              end: Math.max(prevAnnotation.start + 0.1, prevAnnotation.end + delta),
            };
          }
        } else if (!linkEndpoints && annotationIndex > 0 && constrainedStart < updatedAnnotations[annotationIndex - 1].end) {
          // Collision detection: push previous annotation's end back
          updatedAnnotations[annotationIndex - 1] = {
            ...updatedAnnotations[annotationIndex - 1],
            end: constrainedStart,
          };
        }
      } else {
        // Dragging end edge
        const constrainedEnd = Math.max(annotation.start + 0.1, Math.min(newTime, duration));
        const delta = constrainedEnd - annotation.end;

        updatedAnnotations[annotationIndex] = {
          ...annotation,
          end: constrainedEnd,
        };

        if (linkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
          // Link Endpoints: if next annotation's start is touching this end, move it together
          const nextAnnotation = updatedAnnotations[annotationIndex + 1];
          if (Math.abs(nextAnnotation.start - annotation.end) < LINK_THRESHOLD) {
            const newStart = nextAnnotation.start + delta;
            updatedAnnotations[annotationIndex + 1] = {
              ...nextAnnotation,
              start: Math.min(nextAnnotation.end - 0.1, newStart),
            };

            // Cascade linked endpoints
            let currentIndex = annotationIndex + 1;
            while (currentIndex < updatedAnnotations.length - 1) {
              const current = updatedAnnotations[currentIndex];
              const next = updatedAnnotations[currentIndex + 1];

              if (Math.abs(next.start - current.end) < LINK_THRESHOLD) {
                const nextDelta = current.end - annotations[currentIndex].end;
                updatedAnnotations[currentIndex + 1] = {
                  ...next,
                  start: Math.min(next.end - 0.1, next.start + nextDelta),
                };
                currentIndex++;
              } else {
                break; // No more linked endpoints
              }
            }
          }
        } else if (!linkEndpoints && annotationIndex < updatedAnnotations.length - 1 && constrainedEnd > updatedAnnotations[annotationIndex + 1].start) {
          // Collision detection: push next annotation's start forward
          const nextAnnotation = updatedAnnotations[annotationIndex + 1];

          updatedAnnotations[annotationIndex + 1] = {
            ...nextAnnotation,
            start: constrainedEnd,
          };

          // Cascade collisions
          let currentIndex = annotationIndex + 1;
          while (currentIndex < updatedAnnotations.length - 1) {
            const current = updatedAnnotations[currentIndex];
            const next = updatedAnnotations[currentIndex + 1];

            if (current.end > next.start) {
              updatedAnnotations[currentIndex + 1] = {
                ...next,
                start: current.end,
              };
              currentIndex++;
            } else {
              break;
            }
          }
        }
      }

      setAnnotations(updatedAnnotations);
    }
  };

  const handleAnnotationDragEnd = () => {
    setDraggingAnnotation(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle selection dragging
    if (!isSelectingRef.current) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const moveTime = (x * samplesPerPixel) / (audioBuffer?.sampleRate || 44100);

    // Update selection during drag
    const start = Math.min(selectionStart, moveTime);
    const end = Math.max(selectionStart, moveTime);
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Finish selection dragging
    if (!isSelectingRef.current) return;

    isSelectingRef.current = false;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const endTime = (x * samplesPerPixel) / (audioBuffer?.sampleRate || 44100);

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    // If it's just a click (not a drag), seek to that position but keep existing selection
    if (Math.abs(end - start) < 0.1) {
      console.log('WaveformPlaylist: Click detected, seeking to position');
      currentTimeRef.current = start;
      setCurrentTime(start);
      // Don't clear the selection - keep it as is

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        playoutRef.current.play(Tone.now(), start);
      } else if (playoutRef.current) {
        playoutRef.current.stop();
      }
    } else {
      // It was a drag - finalize the selection and set currentTime to selection start
      console.log('WaveformPlaylist: Selection created', { start, end });
      setSelectionStart(start);
      setSelectionEnd(end);
      currentTimeRef.current = start;
      setCurrentTime(start);
    }
  };

  // Expose play/pause/stop/rewind/ff methods for external buttons
  useEffect(() => {
    if (!audioBuffer) return;

    const playButton = document.querySelector('.btn-play');
    const pauseButton = document.querySelector('.btn-pause');
    const stopButton = document.querySelector('.btn-stop');
    const rewindButton = document.querySelector('.btn-rewind');
    const fastForwardButton = document.querySelector('.btn-fast-forward');

    const handlePlayClick = async () => {
      if (!playoutRef.current) return;

      try {
        await playoutRef.current.init();
        playoutRef.current.stop();

        // Check if there's a selection
        if (selectionStart !== selectionEnd && selectionEnd > selectionStart) {
          // Play only the selected region
          const duration = selectionEnd - selectionStart;
          playoutRef.current.setOnPlaybackComplete(() => {
            handlePause(false);
          });
          playoutRef.current.play(Tone.now(), selectionStart, duration);
        } else {
          // Play from current position to the end
          playoutRef.current.play(Tone.now(), currentTimeRef.current);
        }

        setIsPlaying(true);
        startAnimationLoop();
      } catch (error) {
        console.error('Play error:', error);
      }
    };

    const handlePauseClick = () => {
      if (!playoutRef.current) return;

      const pauseTime = playoutRef.current.getCurrentTime();
      playoutRef.current.pause();
      setIsPlaying(false);
      stopAnimationLoop();

      currentTimeRef.current = pauseTime;
      setCurrentTime(pauseTime);
    };

    const handleStopClick = () => {
      handleStop();
    };

    const handleRewindClick = () => {
      const skipAmount = 5; // seconds
      const newTime = Math.max(0, currentTimeRef.current - skipAmount);
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        playoutRef.current.play(Tone.now(), newTime);
      }
    };

    const handleFastForwardClick = () => {
      const skipAmount = 5; // seconds
      const newTime = Math.min(duration, currentTimeRef.current + skipAmount);
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        playoutRef.current.play(Tone.now(), newTime);
      }
    };

    playButton?.addEventListener('click', handlePlayClick);
    pauseButton?.addEventListener('click', handlePauseClick);
    stopButton?.addEventListener('click', handleStopClick);
    rewindButton?.addEventListener('click', handleRewindClick);
    fastForwardButton?.addEventListener('click', handleFastForwardClick);

    return () => {
      playButton?.removeEventListener('click', handlePlayClick);
      pauseButton?.removeEventListener('click', handlePauseClick);
      stopButton?.removeEventListener('click', handleStopClick);
      rewindButton?.removeEventListener('click', handleRewindClick);
      fastForwardButton?.removeEventListener('click', handleFastForwardClick);
    };
  }, [audioBuffer, duration, isPlaying, selectionStart, selectionEnd]);

  // Keep isPlayingRef in sync with isPlaying state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Checkbox listeners for continuous play, link endpoints, and automatic scroll
  useEffect(() => {
    const continuousPlayCheckbox = document.querySelector('.continuous-play') as HTMLInputElement;
    const linkEndpointsCheckbox = document.querySelector('.link-endpoints') as HTMLInputElement;
    const automaticScrollCheckbox = document.querySelector('.automatic-scroll') as HTMLInputElement;

    const handleContinuousPlayChange = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setIsContinuousPlay(checked);

      // If turning off continuous play while playing, stop playback
      if (!checked && isPlayingRef.current && playoutRef.current) {
        playoutRef.current.stop();
        setIsPlaying(false);
        stopAnimationLoop();
      }
    };

    const handleLinkEndpointsChange = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setLinkEndpoints(checked);
    };

    const handleAutomaticScrollChange = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      console.log('Automatic scroll checkbox changed:', checked);
      isAutomaticScrollRef.current = checked;
      setIsAutomaticScroll(checked);
    };

    if (continuousPlayCheckbox) {
      continuousPlayCheckbox.checked = isContinuousPlay;
      continuousPlayCheckbox.addEventListener('change', handleContinuousPlayChange);
    }

    if (linkEndpointsCheckbox) {
      linkEndpointsCheckbox.checked = linkEndpoints;
      linkEndpointsCheckbox.addEventListener('change', handleLinkEndpointsChange);
    }

    if (automaticScrollCheckbox) {
      automaticScrollCheckbox.checked = isAutomaticScroll;
      automaticScrollCheckbox.addEventListener('change', handleAutomaticScrollChange);
    }

    return () => {
      continuousPlayCheckbox?.removeEventListener('change', handleContinuousPlayChange);
      linkEndpointsCheckbox?.removeEventListener('change', handleLinkEndpointsChange);
      automaticScrollCheckbox?.removeEventListener('change', handleAutomaticScrollChange);
    };
  }, []);

  // Initialize selection time inputs manager
  useEffect(() => {
    // Find the form that contains the time inputs
    const timeFormatForm = Array.from(document.querySelectorAll('form.form-inline')).find(
      form => form.querySelector('.time-format')
    );

    if (!timeFormatForm) {
      console.warn('SelectionTimeInputs: time format form not found');
      return;
    }

    // Create the manager with the actual form element
    selectionInputsManagerRef.current = new SelectionTimeInputsManager({
      container: timeFormatForm as HTMLElement,
      onSelectionChange: (start, end) => {
        setSelectionStart(start);
        setSelectionEnd(end);
        currentTimeRef.current = start;
        setCurrentTime(start);

        // If playing, seek to the new position
        if (isPlaying && playoutRef.current) {
          playoutRef.current.stop();
          playoutRef.current.play(Tone.now(), start);
        }
      },
    });

    return () => {
      selectionInputsManagerRef.current?.dispose();
      selectionInputsManagerRef.current = null;
    };
  }, []);

  // Update selection inputs when selection changes
  useEffect(() => {
    console.log('WaveformPlaylist: Selection changed', { selectionStart, selectionEnd, hasManager: !!selectionInputsManagerRef.current });
    if (selectionInputsManagerRef.current) {
      selectionInputsManagerRef.current.updateSelection(selectionStart, selectionEnd);
    }
  }, [selectionStart, selectionEnd]);

  // Calculate dimensions
  const sampleRate = audioBuffer?.sampleRate || 44100;
  const timeScaleHeight = timescale ? 30 : 0;
  const tracksFullWidth = audioBuffer ? Math.floor((duration * sampleRate) / samplesPerPixel) : 0;

  // Waveform display
  const WaveformDisplay = () => {
    if (!peaksData) return null;

    const width = peaksData.length;

    return (
      <>
        {peaksData.data.map((channelPeaks: Peaks, index: number) => (
          <SmartChannel
            key={index}
            index={index}
            data={channelPeaks}
            bits={peaksData.bits}
            length={width}
            progress={0}
          />
        ))}
      </>
    );
  };

  const handleAnnotationUpdate = (updated: AnnotationData[]) => {
    setAnnotations(updated);
    onAnnotationUpdate?.(updated);
  };

  return (
    <DevicePixelRatioProvider>
      <ThemeProvider theme={theme}>
        <PlaylistInfoContext.Provider value={{
          samplesPerPixel,
          sampleRate,
          zoomLevels: [samplesPerPixel],
          waveHeight,
          timeScaleHeight,
          duration,
          controls: {
            show: false,
            width: 0,
          },
        }}>
          <div ref={containerRef} style={{ width: '100%' }}>
            {audioBuffer && peaksData ? (
              <Playlist
                theme={theme}
                backgroundColor={theme.waveOutlineColor}
                scrollContainerWidth={tracksFullWidth}
                timescaleWidth={tracksFullWidth}
                tracksWidth={tracksFullWidth}
                controlsWidth={0}
                onTracksMouseDown={handleMouseDown}
                onTracksMouseMove={handleMouseMove}
                onTracksMouseUp={handleMouseUp}
                scrollContainerRef={(el) => {
                  if (el) {
                    scrollContainerRef.current = el;
                  }
                }}
                timescale={
                  timescale ? (
                    <StyledTimeScale
                      duration={duration * 1000}
                      marker={10000}
                      bigStep={5000}
                      secondStep={1000}
                    />
                  ) : undefined
                }
              >
                <>
                  <TrackComponent
                    numChannels={peaksData.data.length}
                    backgroundColor={theme.waveOutlineColor}
                    offset={0}
                    width={tracksFullWidth}
                  >
                    <WaveformDisplay />
                  </TrackComponent>
                  {annotations.length > 0 && (
                    <AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
                      {annotations.map((annotation) => {
                        const startPx = (annotation.start * sampleRate) / samplesPerPixel;
                        const endPx = (annotation.end * sampleRate) / samplesPerPixel;

                        return (
                          <AnnotationBox
                            key={annotation.id}
                            startPosition={startPx}
                            endPosition={endPx}
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
                      startPosition={(Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
                      endPosition={(Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel}
                      color="rgba(0, 255, 0, 0.3)"
                    />
                  )}
                  {(isPlaying || (selectionStart === selectionEnd && !activeAnnotationId)) && (
                    <Playhead
                      position={(currentTime * sampleRate) / samplesPerPixel}
                      color="#f00"
                    />
                  )}
                </>
              </Playlist>
            ) : (
              <div>Loading waveform...</div>
            )}

            {annotations.length > 0 && annotationList?.editable && (
              <AnnotationText
                annotations={annotations}
                activeAnnotationId={activeAnnotationId || undefined}
                shouldScrollToActive={shouldScrollToActive}
                editable={annotationList.editable}
                controls={annotationList.controls}
                annotationListConfig={{ isContinuousPlay, linkEndpoints }}
                onAnnotationUpdate={handleAnnotationUpdate}
              />
            )}
          </div>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    </DevicePixelRatioProvider>
  );
};

// Helper to mount the component
export function mountWaveformPlaylist(
  container: HTMLElement,
  props: WaveformPlaylistProps
) {
  const root = createRoot(container);
  root.render(<WaveformPlaylistComponent {...props} />);
  return root;
}
