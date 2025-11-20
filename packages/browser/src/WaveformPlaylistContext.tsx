import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { TonePlayout } from '@waveform-playlist/playout';
import { type Track } from '@waveform-playlist/core';
import * as Tone from 'tone';
import { generatePeaks } from './peaksUtil';
import type { PeakData } from '@waveform-playlist/webaudio-peaks';
import { type AnnotationData } from '@waveform-playlist/ui-components';
import { useTimeFormat, useZoomControls, useMasterVolume } from './hooks';

// Types
export interface WaveformTrack {
  src: string;
  name?: string;
}

export interface TrackState {
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

export interface WaveformPlaylistContextValue {
  // State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: PeakData[];
  trackStates: TrackState[];
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  isAutomaticScroll: boolean;

  // Playback controls
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setCurrentTime: (time: number) => void;

  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;

  // Selection
  setSelection: (start: number, end: number) => void;

  // Time format
  timeFormat: string;
  setTimeFormat: (format: string) => void;
  formatTime: (seconds: number) => string;

  // Zoom
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;

  // Master volume
  masterVolume: number;
  setMasterVolume: (volume: number) => void;

  // Automatic scroll
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;

  // Refs
  playoutRef: React.RefObject<TonePlayout | null>;
  currentTimeRef: React.RefObject<number>;

  // Playlist info
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  minimumPlaylistHeight: number;
  controls: { show: boolean; width: number };
}

const WaveformPlaylistContext = createContext<WaveformPlaylistContextValue | null>(null);

export interface WaveformPlaylistProviderProps {
  tracks: WaveformTrack[];
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
  controls?: {
    show: boolean;
    width: number;
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
  children: ReactNode;
}

export const WaveformPlaylistProvider: React.FC<WaveformPlaylistProviderProps> = ({
  tracks,
  timescale = true,
  mono = true,
  waveHeight = 80,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  theme: userTheme,
  controls = { show: false, width: 0 },
  annotationList,
  onReady,
  onAnnotationUpdate,
  children,
}) => {
  // State
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBuffers, setAudioBuffers] = useState<AudioBuffer[]>([]);
  const [peaksDataArray, setPeaksDataArray] = useState<PeakData[]>([]);
  const [trackStates, setTrackStates] = useState<TrackState[]>([]);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isAutomaticScroll, setIsAutomaticScroll] = useState(false);

  // Refs
  const playoutRef = useRef<TonePlayout | null>(null);
  const playStartPositionRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0); // Tone.now() when playback started
  const audioStartPositionRef = useRef<number>(0); // Audio position when playback started
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAutomaticScrollRef = useRef<boolean>(false);

  // Custom hooks
  const { timeFormat, setTimeFormat, formatTime } = useTimeFormat();
  const zoom = useZoomControls({ initialSamplesPerPixel });
  const samplesPerPixel = zoom.samplesPerPixel;
  const { masterVolume, setMasterVolume } = useMasterVolume({ playoutRef, initialVolume: 100 });

  // Keep ref in sync with state for automatic scroll
  useEffect(() => {
    isAutomaticScrollRef.current = isAutomaticScroll;
  }, [isAutomaticScroll]);

  // Load audio and initialize
  useEffect(() => {
    if (tracks.length === 0) return;

    const loadAudio = async () => {
      try {
        const audioContext = Tone.getContext().rawContext as AudioContext;

        const loadPromises = tracks.map(async (track, index) => {
          const response = await fetch(track.src);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await audioContext.decodeAudioData(arrayBuffer);

          const bits = 16;
          const peaks = generatePeaks(buffer, samplesPerPixel, mono, bits);

          return { buffer, peaks, track, index };
        });

        const loadedTracks = await Promise.all(loadPromises);

        const buffers = loadedTracks.map(t => t.buffer);
        const peaks = loadedTracks.map(t => t.peaks);
        const maxDuration = Math.max(...buffers.map(b => b.duration));

        setAudioBuffers(buffers);
        setPeaksDataArray(peaks);
        setDuration(maxDuration);

        setTrackStates(tracks.map(() => ({
          muted: false,
          soloed: false,
          volume: 1.0,
          pan: 0,
        })));

        const playout = new TonePlayout();

        loadedTracks.forEach(({ buffer, track }, index) => {
          const trackObj: Track = {
            id: `track-${index}`,
            name: track.name || `Audio Track ${index + 1}`,
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
        });

        playoutRef.current = playout;
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

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    const updateTime = () => {
      // Calculate current position based on Tone.now() timing
      const elapsed = Tone.now() - playbackStartTimeRef.current;
      const time = audioStartPositionRef.current + elapsed;
      currentTimeRef.current = time;
      setCurrentTime(time);

      // Handle automatic scroll - continuously center the playhead
      if (isAutomaticScrollRef.current && scrollContainerRef.current && audioBuffers.length > 0) {
        const container = scrollContainerRef.current;
        const sr = audioBuffers[0].sampleRate;
        const pixelPosition = (time * sr) / samplesPerPixel;
        const containerWidth = container.clientWidth;

        // Calculate visual position of playhead (includes controls offset)
        const controlWidth = controls.show ? controls.width : 0;
        const visualPosition = pixelPosition + controlWidth;

        // Continuously scroll to keep playhead centered
        const targetScrollLeft = Math.max(0, visualPosition - containerWidth / 2);
        container.scrollLeft = targetScrollLeft;
      }

      if (time >= duration) {
        stop();
        return;
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [duration, audioBuffers, samplesPerPixel]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Playback controls
  const play = useCallback(async (startTime?: number, playDuration?: number) => {
    if (!playoutRef.current || audioBuffers.length === 0) return;

    await playoutRef.current.init();

    const actualStartTime = startTime ?? currentTimeRef.current;
    playStartPositionRef.current = actualStartTime;

    // Stop any existing playback and animation loop before starting
    playoutRef.current.stop();
    stopAnimationLoop();

    // Record timing for accurate position tracking
    const now = Tone.now();
    playbackStartTimeRef.current = now;
    audioStartPositionRef.current = actualStartTime;

    if (playDuration !== undefined) {
      playoutRef.current.setOnPlaybackComplete(() => {
        pause();
      });
    }

    playoutRef.current.play(now, actualStartTime, playDuration);
    setIsPlaying(true);
    startAnimationLoop();
  }, [audioBuffers.length, startAnimationLoop, stopAnimationLoop]);

  const pause = useCallback(() => {
    if (!playoutRef.current) return;

    // Calculate exact pause position using Tone.now() timing
    const elapsed = Tone.now() - playbackStartTimeRef.current;
    const pauseTime = audioStartPositionRef.current + elapsed;

    playoutRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();

    // Update to the calculated pause position
    currentTimeRef.current = pauseTime;
    setCurrentTime(pauseTime);
  }, [stopAnimationLoop]);

  const stop = useCallback(() => {
    if (!playoutRef.current) return;

    playoutRef.current.stop();
    setIsPlaying(false);
    stopAnimationLoop();

    currentTimeRef.current = playStartPositionRef.current;
    setCurrentTime(playStartPositionRef.current);
    setActiveAnnotationId(null);
  }, [stopAnimationLoop]);

  // Track controls
  const setTrackMute = useCallback((trackIndex: number, muted: boolean) => {
    const newStates = [...trackStates];
    newStates[trackIndex] = { ...newStates[trackIndex], muted };
    setTrackStates(newStates);

    if (playoutRef.current) {
      const trackId = `track-${trackIndex}`;
      playoutRef.current.setMute(trackId, muted);
    }
  }, [trackStates]);

  const setTrackSolo = useCallback((trackIndex: number, soloed: boolean) => {
    const newStates = [...trackStates];
    newStates[trackIndex] = { ...newStates[trackIndex], soloed };
    setTrackStates(newStates);

    if (playoutRef.current) {
      const trackId = `track-${trackIndex}`;
      playoutRef.current.setSolo(trackId, soloed);
    }
  }, [trackStates]);

  const setTrackVolume = useCallback((trackIndex: number, volume: number) => {
    const newStates = [...trackStates];
    newStates[trackIndex] = { ...newStates[trackIndex], volume };
    setTrackStates(newStates);

    if (playoutRef.current) {
      const trackId = `track-${trackIndex}`;
      const track = playoutRef.current.getTrack(trackId);
      if (track) {
        track.setVolume(volume);
      }
    }
  }, [trackStates]);

  const setTrackPan = useCallback((trackIndex: number, pan: number) => {
    const newStates = [...trackStates];
    newStates[trackIndex] = { ...newStates[trackIndex], pan };
    setTrackStates(newStates);

    if (playoutRef.current) {
      const trackId = `track-${trackIndex}`;
      const track = playoutRef.current.getTrack(trackId);
      if (track) {
        track.setPan(pan);
      }
    }
  }, [trackStates]);

  // Selection
  const setSelection = useCallback((start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
    currentTimeRef.current = start;
    setCurrentTime(start);

    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      playoutRef.current.play(Tone.now(), start);
    }
  }, [isPlaying]);

  // Memoize setScrollContainer callback
  const setScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  const sampleRate = audioBuffers[0]?.sampleRate || 44100;
  const timeScaleHeight = timescale ? 30 : 0;
  const minimumPlaylistHeight = (tracks.length * waveHeight) + timeScaleHeight;

  const value: WaveformPlaylistContextValue = {
    // State
    isPlaying,
    currentTime,
    duration,
    audioBuffers,
    peaksDataArray,
    trackStates,
    annotations,
    activeAnnotationId,
    selectionStart,
    selectionEnd,
    isAutomaticScroll,

    // Playback controls
    play,
    pause,
    stop,
    setCurrentTime: (time: number) => {
      currentTimeRef.current = time;
      setCurrentTime(time);
    },

    // Track controls
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    setTrackPan,

    // Selection
    setSelection,

    // Time format
    timeFormat,
    setTimeFormat,
    formatTime,

    // Zoom
    samplesPerPixel,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    canZoomIn: zoom.canZoomIn,
    canZoomOut: zoom.canZoomOut,

    // Master volume
    masterVolume,
    setMasterVolume,

    // Automatic scroll
    setAutomaticScroll: (enabled: boolean) => {
      setIsAutomaticScroll(enabled);
    },
    setScrollContainer,

    // Refs
    playoutRef,
    currentTimeRef,

    // Playlist info
    sampleRate,
    waveHeight,
    timeScaleHeight,
    minimumPlaylistHeight,
    controls,
  };

  return (
    <WaveformPlaylistContext.Provider value={value}>
      {children}
    </WaveformPlaylistContext.Provider>
  );
};

export const useWaveformPlaylist = () => {
  const context = useContext(WaveformPlaylistContext);
  if (!context) {
    throw new Error('useWaveformPlaylist must be used within WaveformPlaylistProvider');
  }
  return context;
};
