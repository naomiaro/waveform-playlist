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
  isContinuousPlay?: boolean;
  linkEndpoints?: boolean;
}

const AnnotationsApp: React.FC<AnnotationsAppProps> = ({
  audioSrc,
  annotations: initialAnnotations,
  isContinuousPlay = false,
  linkEndpoints = true,
}) => {
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [shouldScrollToActive, setShouldScrollToActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaksData, setPeaksData] = useState<PeakData | null>(null);

  const playoutRef = useRef<TonePlayout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingTimedSegmentRef = useRef(false);

  // Load audio and initialize
  useEffect(() => {
    const loadAudio = async () => {
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = Tone.getContext().rawContext as AudioContext;
      const buffer = await audioContext.decodeAudioData(arrayBuffer);

      setAudioBuffer(buffer);
      setDuration(buffer.duration);

      // Generate peaks using the proper utility
      const samplesPerPixel = 1024;
      const isMono = false; // Keep stereo channels
      const bits = 16;
      const peaks = generatePeaks(buffer, samplesPerPixel, isMono, bits);
      setPeaksData(peaks);
      console.log('Peaks generated:', peaks.data.length, 'channels, bits:', peaks.bits, 'length:', peaks.length);

      // Initialize playout
      const playout = new TonePlayout();
      await playout.init();

      // Create and add track
      const track = new Track();
      track.id = 'track-0';
      track.name = 'Audio Track';
      track.gain = 1;
      track.muted = false;
      track.soloed = false;
      track.stereoPan = 0;
      track.startTime = 0;

      playout.addTrack({
        buffer,
        track,
      });

      playoutRef.current = playout;
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
        setCurrentTime(time);

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
                {isPlaying && (
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

          {/* Annotation boxes */}
          {annotations.length > 0 && audioBuffer && (
            <AnnotationBoxesWrapper height={30} width={tracksFullWidth}>
              {annotations.map((annotation) => {
                const sampleRate = audioBuffer.sampleRate;
                const samplesPerPixel = 1024;
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
      isContinuousPlay={false}
      linkEndpoints={true}
    />
  );
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnnotationsApp);
} else {
  initAnnotationsApp();
}
