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
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  StyledTimeScale,
  type AnnotationData,
} from '@waveform-playlist/ui-components';
import { TonePlayout } from '@waveform-playlist/playout';
import { Track } from '@waveform-playlist/core';
import * as Tone from 'tone';
import { generatePeaks } from './peaksUtil';
import type { PeakData, Peaks } from '@waveform-playlist/webaudio-peaks';

// Annotation actions for the UI
const annotationActions = [
  {
    class: 'bi.bi-dash',
    title: 'Reduce annotation end by 0.010s',
    action: (annotation: AnnotationData, i: number, annotations: AnnotationData[], opts: any) => {
      const delta = 0.010;
      annotation.end -= delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start -= delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi.bi-plus',
    title: 'Increase annotation end by 0.010s',
    action: (annotation: AnnotationData, i: number, annotations: AnnotationData[], opts: any) => {
      const delta = 0.010;
      annotation.end += delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start += delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi.bi-scissors',
    title: 'Split annotation in half',
    action: (annotation: AnnotationData, i: number, annotations: AnnotationData[]) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: 'annotation_' + Date.now(),
        start: annotation.end - halfDuration,
        end: annotation.end,
        begin: (annotation.end - halfDuration).toString(),
        lines: ['----'],
        language: 'en',
      });

      annotation.end = annotation.start + halfDuration;
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    class: 'bi.bi-trash',
    title: 'Delete annotation',
    action: (annotation: AnnotationData, i: number, annotations: AnnotationData[]) => {
      annotations.splice(i, 1);
    }
  }
];

// Load annotation data
declare const notes: any[];

// Theme for waveform colors
const theme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

interface AnnotationsAppProps {
  audioSrc: string;
  annotations: any[];
}

const AnnotationsApp: React.FC<AnnotationsAppProps> = ({
  audioSrc,
  annotations: initialAnnotations,
}) => {
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaksData, setPeaksData] = useState<PeakData | null>(null);
  const [isContinuousPlay, setIsContinuousPlay] = useState(false);
  const [linkEndpoints, setLinkEndpoints] = useState(true);

  const playoutRef = useRef<TonePlayout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingTimedSegmentRef = useRef(false);
  const currentTimeRef = useRef<number>(0);

  // Load audio and initialize
  useEffect(() => {
    console.log('Load audio effect triggered');
    const loadAudio = async () => {
      try {
        console.log('Fetching audio from:', audioSrc);
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = Tone.getContext().rawContext as AudioContext;
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Audio decoded, duration:', buffer.duration);

        setAudioBuffer(buffer);
        setDuration(buffer.duration);

        // Generate peaks using the proper utility
        const samplesPerPixel = 1024;
        const isMono = true; // Mono display
        const bits = 16;
        const peaks = generatePeaks(buffer, samplesPerPixel, isMono, bits);
        setPeaksData(peaks);
        console.log('Peaks generated:', peaks.data.length, 'channels, bits:', peaks.bits, 'length:', peaks.length);

        // Initialize playout (don't call init() yet - needs user gesture)
        console.log('Creating TonePlayout...');
        const playout = new TonePlayout();
        console.log('TonePlayout created');

        // Create and add track
        const track: Track = {
          id: 'track-0',
          name: 'Audio Track',
          gain: 1,
          muted: false,
          soloed: false,
          stereoPan: 0,
          startTime: 0,
        };

        playout.addTrack({
          buffer,
          track,
        });
        console.log('Track added to playout');

        playoutRef.current = playout;
        console.log('Playout ref set:', playoutRef.current);
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
  }, [audioSrc]);

  // Parse annotations
  useEffect(() => {
    const parsed = initialAnnotations.map(note => {
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
  }, [initialAnnotations]);

  // Animation loop to update current time and active annotation
  const startAnimationLoop = () => {
    const updateTime = () => {
      if (playoutRef.current) {
        const time = playoutRef.current.getCurrentTime();
        currentTimeRef.current = time; // Update ref
        setCurrentTime(time); // Update state for rendering

        // Update active annotation during continuous play
        if (!isPlayingTimedSegmentRef.current && isContinuousPlay) {
          const currentAnnotation = annotations.find(
            (ann) => time >= ann.start && time < ann.end
          );
          if (currentAnnotation && currentAnnotation.id !== activeAnnotationId) {
            setActiveAnnotationId(currentAnnotation.id);
            setShouldScrollToActive(true);
          }
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

    // Set up callback for when playback completes (if playing with duration)
    if (playDuration !== undefined) {
      isPlayingTimedSegmentRef.current = true;
      playoutRef.current.setOnPlaybackComplete(() => {
        isPlayingTimedSegmentRef.current = false;
        handlePause(false); // Pause but keep active annotation
      });
    } else {
      isPlayingTimedSegmentRef.current = false;
    }

    // Play with offset and duration
    playoutRef.current.play(Tone.now(), startTime, playDuration);
    setIsPlaying(true);
    startAnimationLoop();
  };

  const handlePause = (clearActiveAnnotation: boolean = true) => {
    if (!playoutRef.current) return;

    playoutRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();

    if (clearActiveAnnotation) {
      setActiveAnnotationId(null);
      setShouldScrollToActive(false);
    } else {
      // Keep annotation highlighted but don't scroll on next render
      setShouldScrollToActive(false);
    }
  };

  const handleAnnotationClick = async (annotation: AnnotationData) => {
    setActiveAnnotationId(annotation.id);
    setShouldScrollToActive(true); // Enable scrolling for this annotation
    const playDuration = !isContinuousPlay ? annotation.end - annotation.start : undefined;
    await handlePlay(annotation.start, playDuration);
  };

  // Mouse handlers for click-to-seek on waveform
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const samplesPerPixel = 1024;
    const sampleRate = audioBuffer?.sampleRate || 44100;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    console.log('Waveform clicked at pixel:', x, 'time:', clickTime);

    // Update time
    currentTimeRef.current = clickTime;
    setCurrentTime(clickTime);

    // If playing, restart from new position
    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      playoutRef.current.play(Tone.now(), clickTime);
    }
  };

  // Set up checkbox event listeners
  useEffect(() => {
    const continuousPlayCheckbox = document.querySelector('.continuous-play') as HTMLInputElement;
    const linkEndpointsCheckbox = document.querySelector('.link-endpoints') as HTMLInputElement;

    const handleContinuousPlayChange = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      console.log('Continuous play changed:', checked);
      setIsContinuousPlay(checked);
    };

    const handleLinkEndpointsChange = (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      console.log('Link endpoints changed:', checked);
      setLinkEndpoints(checked);
    };

    // Set initial checkbox states
    if (continuousPlayCheckbox) {
      continuousPlayCheckbox.checked = isContinuousPlay;
      continuousPlayCheckbox.addEventListener('change', handleContinuousPlayChange);
    }

    if (linkEndpointsCheckbox) {
      linkEndpointsCheckbox.checked = linkEndpoints;
      linkEndpointsCheckbox.addEventListener('change', handleLinkEndpointsChange);
    }

    return () => {
      continuousPlayCheckbox?.removeEventListener('change', handleContinuousPlayChange);
      linkEndpointsCheckbox?.removeEventListener('change', handleLinkEndpointsChange);
    };
  }, []); // Only run once on mount

  // Set up button event listeners
  useEffect(() => {
    if (!audioBuffer) return;

    const playButton = document.querySelector('.btn-play');
    const pauseButton = document.querySelector('.btn-pause');
    const stopButton = document.querySelector('.btn-stop');

    console.log('Setting up button listeners', { playButton, pauseButton, stopButton });

    const handlePlayClick = async () => {
      console.log('Play button clicked', 'currentTimeRef:', currentTimeRef.current);
      if (!playoutRef.current) {
        console.log('No playout ref');
        return;
      }

      try {
        await playoutRef.current.init();
        // Stop any previous playback before starting new one
        playoutRef.current.stop();
        // Use the currentTimeRef which is always up to date
        console.log('Playing from:', currentTimeRef.current);
        playoutRef.current.play(Tone.now(), currentTimeRef.current);
        setIsPlaying(true);
        startAnimationLoop();
      } catch (error) {
        console.error('Play error:', error);
      }
    };

    const handlePauseClick = () => {
      console.log('Pause button clicked');
      if (!playoutRef.current) return;

      // Capture the current time before pausing
      const pauseTime = playoutRef.current.getCurrentTime();
      console.log('Pausing at:', pauseTime);

      playoutRef.current.pause();
      setIsPlaying(false);
      stopAnimationLoop();

      // Update both ref and state with the exact pause time
      currentTimeRef.current = pauseTime;
      setCurrentTime(pauseTime);
    };

    const handleStopClick = () => {
      console.log('Stop button clicked');
      if (!playoutRef.current) return;

      playoutRef.current.stop();
      setIsPlaying(false);
      stopAnimationLoop();

      // Reset both ref and state to 0
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setActiveAnnotationId(null);
      setShouldScrollToActive(false);
    };

    playButton?.addEventListener('click', handlePlayClick);
    pauseButton?.addEventListener('click', handlePauseClick);
    stopButton?.addEventListener('click', handleStopClick);

    return () => {
      playButton?.removeEventListener('click', handlePlayClick);
      pauseButton?.removeEventListener('click', handlePauseClick);
      stopButton?.removeEventListener('click', handleStopClick);
    };
  }, [audioBuffer]);

  // Calculate widths
  const samplesPerPixel = 1024;
  const sampleRate = audioBuffer?.sampleRate || 44100;
  const waveHeight = 80;
  const timeScaleHeight = 30;
  const tracksFullWidth = audioBuffer ? Math.floor((duration * sampleRate) / samplesPerPixel) : 0;

  // Waveform display component
  const WaveformDisplay = () => {
    if (!peaksData) return null;

    const width = peaksData.length;
    console.log('WaveformDisplay rendering - peaks:', peaksData.data.length, 'channels, width:', width, 'bits:', peaksData.bits);

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

  return (
    <DevicePixelRatioProvider>
      <ThemeProvider theme={theme}>
        <PlaylistInfoContext.Provider value={{
          samplesPerPixel,
          sampleRate,
          zoomLevels: [1024],
          waveHeight,
          timeScaleHeight,
          duration,
          controls: {
            show: false,
            width: 0,
          },
        }}>
        <div ref={containerRef} style={{ width: '100%' }}>
          {/* Waveform and tracks */}
          {audioBuffer && peaksData ? (
            <Playlist
              theme={theme}
              backgroundColor={theme.waveOutlineColor}
              scrollContainerWidth={tracksFullWidth}
              timescaleWidth={tracksFullWidth}
              tracksWidth={tracksFullWidth}
              controlsWidth={0}
              onTracksMouseDown={handleMouseDown}
              timescale={
                <StyledTimeScale
                  duration={duration * 1000}
                  marker={10000}
                  bigStep={5000}
                  secondStep={1000}
                />
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
                {/* Annotation boxes - inside Playlist to scroll with tracks */}
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
                        />
                      );
                    })}
                  </AnnotationBoxesWrapper>
                )}
                {/* Show playhead whenever audio is loaded */}
                <Playhead
                  position={(currentTime * sampleRate) / samplesPerPixel}
                  color="#f00"
                />
              </>
            </Playlist>
          ) : (
            <div>Loading waveform...</div>
          )}

          {/* Annotation text panel */}
          {annotations.length > 0 && (
            <AnnotationText
              annotations={annotations}
              activeAnnotationId={activeAnnotationId || undefined}
              shouldScrollToActive={shouldScrollToActive}
              editable={true}
              controls={annotationActions}
              annotationListConfig={{ isContinuousPlay, linkEndpoints }}
              onAnnotationUpdate={(updated) => setAnnotations(updated)}
            />
          )}
        </div>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    </DevicePixelRatioProvider>
  );
};

// Initialize the app
export function initAnnotationsApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <AnnotationsApp
      audioSrc="media/audio/sonnet.mp3"
      annotations={notes}
    />
  );
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnnotationsApp);
} else {
  initAnnotationsApp();
}
