import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { ThemeProvider } from 'styled-components';
import {
  MediaElementPlayout,
  type MediaElementTrackOptions,
} from '@waveform-playlist/media-element-playout';
import { type WaveformDataObject } from '@waveform-playlist/core';
import {
  type WaveformPlaylistTheme,
  defaultTheme,
} from '@waveform-playlist/ui-components';
import type { AnnotationData } from '@waveform-playlist/core';
import { extractPeaksFromWaveformData } from './waveformDataLoader';
import type { PeakData } from '@waveform-playlist/webaudio-peaks';
import type { ClipPeaks, TrackClipPeaks } from './WaveformPlaylistContext';

// Configuration for a single media element track
export interface MediaElementTrackConfig {
  /** Audio source URL or Blob URL */
  source: string;
  /** Pre-computed waveform data (required for visualization) */
  waveformData: WaveformDataObject;
  /** Track name for display */
  name?: string;
}

// Context values for animation (high-frequency updates)
export interface MediaElementAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
}

// Context values for playlist state
export interface MediaElementStateContextValue {
  continuousPlay: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  playbackRate: number;
  isAutomaticScroll: boolean;
}

// Context values for controls
export interface MediaElementControlsContextValue {
  play: (startTime?: number) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Context values for playlist data
export interface MediaElementDataContextValue {
  duration: number;
  peaksDataArray: TrackClipPeaks[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  samplesPerPixel: number;
  playoutRef: React.RefObject<MediaElementPlayout | null>;
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  progressBarWidth: number;
}

// Create contexts
const MediaElementAnimationContext =
  createContext<MediaElementAnimationContextValue | null>(null);
const MediaElementStateContext =
  createContext<MediaElementStateContextValue | null>(null);
const MediaElementControlsContext =
  createContext<MediaElementControlsContextValue | null>(null);
const MediaElementDataContext =
  createContext<MediaElementDataContextValue | null>(null);

export interface MediaElementPlaylistProviderProps {
  /** Single track configuration with source URL and waveform data */
  track: MediaElementTrackConfig;
  /** Initial samples per pixel (zoom level) */
  samplesPerPixel?: number;
  /** Height of each waveform track */
  waveHeight?: number;
  /** Show timescale */
  timescale?: boolean;
  /** Initial playback rate (0.5 to 2.0) */
  playbackRate?: number;
  /** Enable automatic scroll to keep playhead centered */
  automaticScroll?: boolean;
  /** Theme configuration */
  theme?: Partial<WaveformPlaylistTheme>;
  /** Track controls configuration */
  controls?: { show: boolean; width: number };
  /** Annotations */
  annotationList?: {
    annotations?: any[];
    isContinuousPlay?: boolean;
  };
  /** Width of waveform bars */
  barWidth?: number;
  /** Gap between waveform bars */
  barGap?: number;
  /** Width of progress bars */
  progressBarWidth?: number;
  /** Callback when annotations are changed (drag, edit, etc.) */
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Callback when audio is ready */
  onReady?: () => void;
  children: ReactNode;
}

/**
 * MediaElementPlaylistProvider
 *
 * A simplified playlist provider for single-track playback using HTMLAudioElement.
 * Key features:
 * - Pitch-preserving playback rate (0.5x - 2.0x)
 * - Pre-computed peaks visualization (no AudioBuffer needed)
 * - Simpler API than full WaveformPlaylistProvider
 *
 * Use this for:
 * - Language learning apps (speed control)
 * - Podcast players
 * - Single-track audio viewers
 *
 * For multi-track editing, use WaveformPlaylistProvider instead.
 */
export const MediaElementPlaylistProvider: React.FC<
  MediaElementPlaylistProviderProps
> = ({
  track,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  waveHeight = 100,
  timescale = false,
  playbackRate: initialPlaybackRate = 1,
  automaticScroll = false,
  theme: userTheme,
  controls = { show: false, width: 0 },
  annotationList,
  barWidth = 1,
  barGap = 0,
  progressBarWidth: progressBarWidthProp,
  onAnnotationsChange,
  onReady,
  children,
}) => {
  const progressBarWidth = progressBarWidthProp ?? barWidth + barGap;

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaksDataArray, setPeaksDataArray] = useState<TrackClipPeaks[]>([]);
  const [playbackRate, setPlaybackRateState] = useState(initialPlaybackRate);
  // Annotations are derived from prop (single source of truth in parent)
  // In v6, annotations must be pre-parsed (numeric start/end). Use parseAeneas() from @waveform-playlist/annotations before passing.
  const annotations = useMemo(() => {
    if (!annotationList?.annotations) return [];
    if (process.env.NODE_ENV !== 'production' && annotationList.annotations.length > 0) {
      const first = annotationList.annotations[0] as Record<string, unknown>;
      if (typeof first.start !== 'number' || typeof first.end !== 'number') {
        console.error(
          '[waveform-playlist] Annotations must have numeric start/end values. ' +
          'In v6, use parseAeneas() from @waveform-playlist/annotations before passing annotations. ' +
          'Received start type: ' + typeof first.start
        );
        return [];
      }
    }
    return annotationList.annotations as AnnotationData[];
  }, [annotationList?.annotations]);

  // Ref for animation loop (avoids restarting loop on annotation change)
  const annotationsRef = useRef<AnnotationData[]>(annotations);
  annotationsRef.current = annotations;

  const [activeAnnotationId, setActiveAnnotationIdState] = useState<
    string | null
  >(null);
  const [continuousPlay, setContinuousPlayState] = useState(
    annotationList?.isContinuousPlay ?? false
  );
  const [samplesPerPixel] = useState(initialSamplesPerPixel);
  const [isAutomaticScroll, setIsAutomaticScroll] = useState(automaticScroll);

  // Refs
  const playoutRef = useRef<MediaElementPlayout | null>(null);
  const currentTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const continuousPlayRef = useRef<boolean>(continuousPlay);
  const activeAnnotationIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAutomaticScrollRef = useRef<boolean>(automaticScroll);
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);

  // Sync refs
  useEffect(() => {
    continuousPlayRef.current = continuousPlay;
  }, [continuousPlay]);

  useEffect(() => {
    isAutomaticScrollRef.current = isAutomaticScroll;
  }, [isAutomaticScroll]);

  // Custom setter for activeAnnotationId
  const setActiveAnnotationId = useCallback((value: string | null) => {
    activeAnnotationIdRef.current = value;
    setActiveAnnotationIdState(value);
  }, []);

  const setContinuousPlay = useCallback((value: boolean) => {
    continuousPlayRef.current = value;
    setContinuousPlayState(value);
  }, []);

  // Memoize setScrollContainer callback
  const setScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  // Get sample rate from waveform data
  const sampleRate = track.waveformData.sample_rate;

  // Initialize playout and load track
  useEffect(() => {
    const playout = new MediaElementPlayout({
      playbackRate: initialPlaybackRate,
    });

    playout.addTrack({
      source: track.source,
      peaks: track.waveformData,
      name: track.name,
    });

    // Set up time update callback
    const mediaTrack = playout.getTrack(playout['track']?.id ?? '');
    if (mediaTrack) {
      mediaTrack.setOnTimeUpdateCallback((time) => {
        currentTimeRef.current = time;
      });
    }

    // Set up playback complete callback
    playout.setOnPlaybackComplete(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsPlaying(false);
      setActiveAnnotationId(null);
      currentTimeRef.current = 0;
      setCurrentTime(0);
    });

    playoutRef.current = playout;
    setDuration(track.waveformData.duration);
    onReady?.();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      playout.dispose();
    };
  }, [track.source, track.waveformData, track.name, initialPlaybackRate, onReady]);

  // Generate peaks from waveform data
  useEffect(() => {
    const extractedPeaks = extractPeaksFromWaveformData(
      track.waveformData as any,
      samplesPerPixel,
      0, // channel index
      0, // offset
      Math.ceil(track.waveformData.duration * sampleRate) // duration in samples
    );

    const clipPeaks: ClipPeaks = {
      clipId: 'media-element-clip',
      trackName: track.name ?? 'Track',
      peaks: {
        length: extractedPeaks.length,
        data: [extractedPeaks.data],
        bits: extractedPeaks.bits,
      } as PeakData,
      startSample: 0,
      durationSamples: Math.ceil(track.waveformData.duration * sampleRate),
    };

    setPeaksDataArray([[clipPeaks]]);
  }, [track.waveformData, track.name, samplesPerPixel, sampleRate]);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const updateTime = () => {
      const time = playoutRef.current?.getCurrentTime() ?? 0;
      currentTimeRef.current = time;
      setCurrentTime(time);


      // Handle annotation playback
      const currentAnnotations = annotationsRef.current;
      if (currentAnnotations.length > 0) {
        const currentAnnotation = currentAnnotations.find(
          (ann) => time >= ann.start && time < ann.end
        );

        if (continuousPlayRef.current) {
          if (
            currentAnnotation &&
            currentAnnotation.id !== activeAnnotationIdRef.current
          ) {
            setActiveAnnotationId(currentAnnotation.id);
          } else if (!currentAnnotation && activeAnnotationIdRef.current !== null) {
            // Clear the active annotation when we're past it, but don't stop playback
            // Let playback continue until the audio element fires its 'ended' event
            setActiveAnnotationId(null);
          }
        } else {
          if (activeAnnotationIdRef.current) {
            const activeAnnotation = currentAnnotations.find(
              (ann) => ann.id === activeAnnotationIdRef.current
            );
            if (activeAnnotation && time >= activeAnnotation.end) {

              playoutRef.current?.stop();
              setIsPlaying(false);
              return;
            }
          } else if (currentAnnotation) {
            setActiveAnnotationId(currentAnnotation.id);
          }
        }
      }

      // Handle automatic scroll - continuously center the playhead
      if (isAutomaticScrollRef.current && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const pixelPosition = (time * sampleRate) / samplesPerPixelRef.current;
        const containerWidth = container.clientWidth;

        // Calculate visual position of playhead (includes controls offset)
        const controlWidth = controls.show ? controls.width : 0;
        const visualPosition = pixelPosition + controlWidth;

        // Continuously scroll to keep playhead centered
        const targetScrollLeft = Math.max(0, visualPosition - containerWidth / 2);
        container.scrollLeft = targetScrollLeft;
      }

      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [setActiveAnnotationId, sampleRate, controls]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Playback controls
  const play = useCallback(
    (startTime?: number) => {
      if (!playoutRef.current) return;

      const actualStartTime = startTime ?? currentTimeRef.current;
      playoutRef.current.play(undefined, actualStartTime);
      setIsPlaying(true);
      startAnimationLoop();
    },
    [startAnimationLoop]
  );

  const pause = useCallback(() => {
    if (!playoutRef.current) return;

    playoutRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();
    setCurrentTime(playoutRef.current.getCurrentTime());
  }, [stopAnimationLoop]);

  const stop = useCallback(() => {
    if (!playoutRef.current) return;

    playoutRef.current.stop();
    setIsPlaying(false);
    stopAnimationLoop();
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setActiveAnnotationId(null);
  }, [stopAnimationLoop, setActiveAnnotationId]);

  const seekTo = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(time, duration));
      currentTimeRef.current = clampedTime;
      setCurrentTime(clampedTime);

      if (playoutRef.current) {
        playoutRef.current.seekTo(clampedTime);
      }
    },
    [duration]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRateState(clampedRate);
    if (playoutRef.current) {
      playoutRef.current.setPlaybackRate(clampedRate);
    }
  }, []);

  const timeScaleHeight = timescale ? 30 : 0;

  // Context values
  const animationValue: MediaElementAnimationContextValue = useMemo(
    () => ({
      isPlaying,
      currentTime,
      currentTimeRef,
    }),
    [isPlaying, currentTime]
  );

  const stateValue: MediaElementStateContextValue = useMemo(
    () => ({
      continuousPlay,
      annotations,
      activeAnnotationId,
      playbackRate,
      isAutomaticScroll,
    }),
    [continuousPlay, annotations, activeAnnotationId, playbackRate, isAutomaticScroll]
  );

  // Stable callback ref for onAnnotationsChange to avoid re-creating controls context
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  onAnnotationsChangeRef.current = onAnnotationsChange;

  const setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>> = useCallback(
    (action) => {
      const updated = typeof action === 'function'
        ? action(annotationsRef.current)
        : action;
      if (!onAnnotationsChangeRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'waveform-playlist: setAnnotations was called but no onAnnotationsChange callback is provided. ' +
            'Annotation edits will not persist. Pass onAnnotationsChange to MediaElementPlaylistProvider to handle annotation updates.'
          );
        }
        return;
      }
      onAnnotationsChangeRef.current(updated);
    },
    []
  );

  const controlsValue: MediaElementControlsContextValue = useMemo(
    () => ({
      play,
      pause,
      stop,
      seekTo,
      setPlaybackRate,
      setContinuousPlay,
      setAnnotations,
      setActiveAnnotationId,
      setAutomaticScroll: (enabled: boolean) => {
        setIsAutomaticScroll(enabled);
      },
      setScrollContainer,
      scrollContainerRef,
    }),
    [play, pause, stop, seekTo, setPlaybackRate, setContinuousPlay, setAnnotations, setActiveAnnotationId, setScrollContainer]
  );

  const dataValue: MediaElementDataContextValue = useMemo(
    () => ({
      duration,
      peaksDataArray,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      samplesPerPixel,
      playoutRef,
      controls,
      barWidth,
      barGap,
      progressBarWidth,
    }),
    [
      duration,
      peaksDataArray,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      samplesPerPixel,
      controls,
      barWidth,
      barGap,
      progressBarWidth,
    ]
  );

  const mergedTheme = { ...defaultTheme, ...userTheme };

  return (
    <ThemeProvider theme={mergedTheme}>
      <MediaElementAnimationContext.Provider value={animationValue}>
        <MediaElementStateContext.Provider value={stateValue}>
          <MediaElementControlsContext.Provider value={controlsValue}>
            <MediaElementDataContext.Provider value={dataValue}>
              {children}
            </MediaElementDataContext.Provider>
          </MediaElementControlsContext.Provider>
        </MediaElementStateContext.Provider>
      </MediaElementAnimationContext.Provider>
    </ThemeProvider>
  );
};

// Hooks
export const useMediaElementAnimation = () => {
  const context = useContext(MediaElementAnimationContext);
  if (!context) {
    throw new Error(
      'useMediaElementAnimation must be used within MediaElementPlaylistProvider'
    );
  }
  return context;
};

export const useMediaElementState = () => {
  const context = useContext(MediaElementStateContext);
  if (!context) {
    throw new Error(
      'useMediaElementState must be used within MediaElementPlaylistProvider'
    );
  }
  return context;
};

export const useMediaElementControls = () => {
  const context = useContext(MediaElementControlsContext);
  if (!context) {
    throw new Error(
      'useMediaElementControls must be used within MediaElementPlaylistProvider'
    );
  }
  return context;
};

export const useMediaElementData = () => {
  const context = useContext(MediaElementDataContext);
  if (!context) {
    throw new Error(
      'useMediaElementData must be used within MediaElementPlaylistProvider'
    );
  }
  return context;
};
