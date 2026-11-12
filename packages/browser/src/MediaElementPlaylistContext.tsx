import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { ThemeProvider } from 'styled-components';
import type { MediaElementPlayout, FadeConfig } from '@waveform-playlist/media-element-playout';
import { resolveMediaElementPlayout } from './playout/resolveMediaElementPlayout';
import { type WaveformDataObject } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from './hooks/useAnnotationDragHandlers';
import { extractPeaksFromWaveformData } from './waveformDataLoader';
import type WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import type { ClipPeaks, TrackClipPeaks } from './WaveformPlaylistContext';
import { useAnimationFrameLoop } from './hooks/useAnimationFrameLoop';
import { followAnnotations } from './providerInternals/followAnnotations';
import { useAnnotationState } from './providerInternals/useAnnotationState';
import { useFrameCallbacks } from './providerInternals/useFrameCallbacks';
import { centrePlayhead, useScrollFollow } from './providerInternals/useScrollFollow';
import { useRequiredContext } from './providerInternals/useRequiredContext';
import { useViewDefaults } from './providerInternals/useViewDefaults';
import {
  MediaElementInternalsContext,
  MediaElementSelectionContext,
  type MediaElementInternalsValue,
  type MediaElementSelectionValue,
} from './providerInternals/mediaElementInternalContexts';

// Configuration for a single media element track
export interface MediaElementTrackConfig {
  /** Audio source URL or Blob URL */
  source: string;
  /** Pre-computed waveform data (required for visualization) */
  waveformData: WaveformDataObject;
  /** Track name for display */
  name?: string;
  /** Fade in configuration (requires audioContext on provider) */
  fadeIn?: FadeConfig;
  /** Fade out configuration (requires audioContext on provider) */
  fadeOut?: FadeConfig;
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
  /**
   * Where an annotation edge drag shows its moves while it is in progress.
   * The built-in annotation boxes publish to it; read it in a custom
   * annotation renderer with `useAnnotationsWithPreview`. Stable identity.
   */
  annotationPreview: AnnotationPreviewHandle;
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
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). */
  roundedBars: boolean;
  progressBarWidth: number;
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}

// Create contexts
const MediaElementAnimationContext = createContext<MediaElementAnimationContextValue | null>(null);
const MediaElementStateContext = createContext<MediaElementStateContextValue | null>(null);
const MediaElementControlsContext = createContext<MediaElementControlsContextValue | null>(null);
const MediaElementDataContext = createContext<MediaElementDataContextValue | null>(null);

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
  /** Whether to preserve pitch when changing playback rate (default: true).
   *  Set to false when using an external pitch processor like SoundTouch. */
  preservesPitch?: boolean;
  /** Enable automatic scroll to keep playhead centered */
  automaticScroll?: boolean;
  /** Theme configuration */
  theme?: Partial<WaveformPlaylistTheme>;
  /** Track controls configuration */
  controls?: { show: boolean; width: number };
  /** Annotations */
  annotationList?: {
    annotations?: AnnotationData[];
    isContinuousPlay?: boolean;
  };
  /** Width of waveform bars */
  barWidth?: number;
  /** Gap between waveform bars */
  barGap?: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). Default: false */
  roundedBars?: boolean;
  /** Width of progress bars */
  progressBarWidth?: number;
  /** Callback when annotations are changed (drag, edit, etc.) */
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /**
   * AudioContext for Web Audio routing (fades, effects).
   * When provided, audio routes through Web Audio nodes:
   *   HTMLAudioElement → MediaElementSourceNode → fadeGain → volumeGain → destination
   *
   * Without this, playback uses HTMLAudioElement directly (no fades or effects).
   * Each provider instance should use its own AudioContext or share one —
   * createMediaElementSource() is called once per audio element.
   */
  audioContext?: AudioContext;
  /** Callback when audio is ready */
  onReady?: () => void;
  /** Called when playout initialization fails (e.g. a missing optional peer,
   *  a throwing `createPlayout`, or an `addTrack` error). The provider already
   *  logs the error; use this to surface it in your UI. */
  onError?: (err: Error) => void;
  /** Factory for a custom MediaElement playout. When omitted, the bundled engine
   *  (@waveform-playlist/media-element-playout) is dynamically imported. */
  createPlayout?: () => MediaElementPlayout;
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
export const MediaElementPlaylistProvider: React.FC<MediaElementPlaylistProviderProps> = ({
  track,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  waveHeight = 100,
  timescale = false,
  playbackRate: initialPlaybackRate = 1,
  preservesPitch = true,
  automaticScroll = false,
  theme: userThemeProp,
  controls: controlsProp,
  annotationList,
  barWidth = 1,
  barGap = 0,
  roundedBars = false,
  progressBarWidth: progressBarWidthProp,
  audioContext,
  onAnnotationsChange,
  onReady,
  onError,
  createPlayout,
  children,
}) => {
  const { controls, mergedTheme, progressBarWidth, timeScaleHeight } = useViewDefaults({
    controls: controlsProp,
    theme: userThemeProp,
    barWidth,
    barGap,
    progressBarWidth: progressBarWidthProp,
    timescale,
  });

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // `seekTo` clamps against this, so it keeps its identity when the duration
  // arrives and the controls value does not change with it (#767). Written
  // during render, so a child's layout effect of the same commit reads the
  // new value.
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const [peaksDataArray, setPeaksDataArray] = useState<TrackClipPeaks[]>([]);
  const [playbackRate, setPlaybackRateState] = useState(initialPlaybackRate);
  // Annotations are derived from the prop (single source of truth in the
  // parent). Shared with the WebAudio provider (#769).
  const {
    annotations,
    annotationsRef,
    annotationLookup,
    setAnnotations,
    annotationPreview,
    activeAnnotationId,
    activeAnnotationIdRef,
    setActiveAnnotationId,
    continuousPlay,
    continuousPlayRef,
    setContinuousPlay,
  } = useAnnotationState({
    annotationList,
    onAnnotationsChange,
    providerName: 'MediaElementPlaylistProvider',
  });
  const {
    scrollContainerRef,
    setScrollContainer,
    isAutomaticScroll,
    isAutomaticScrollRef,
    setAutomaticScroll,
  } = useScrollFollow(automaticScroll);
  // The playhead and the progress overlay register here; the one loop below
  // draws them. Not in a public context yet (see mediaElementInternalContexts).
  const { registerFrameCallback, unregisterFrameCallback, runFrameCallbacks } = useFrameCallbacks();

  // The time selection, as the drag in MediaElementPlaylist leaves it. Stored
  // only: nothing seeks to it and playback does not use it.
  const [selection, setSelectionState] = useState<MediaElementSelectionValue>({
    selectionStart: 0,
    selectionEnd: 0,
  });
  const setSelection = useCallback((start: number, end: number) => {
    setSelectionState((previous) =>
      previous.selectionStart === start && previous.selectionEnd === end
        ? previous
        : { selectionStart: start, selectionEnd: end }
    );
  }, []);

  const [samplesPerPixel] = useState(initialSamplesPerPixel);

  // Refs
  const playoutRef = useRef<MediaElementPlayout | null>(null);
  const currentTimeRef = useRef<number>(0);
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);
  const { startAnimationFrameLoop, stopAnimationFrameLoop } = useAnimationFrameLoop();

  // Get sample rate from waveform data
  const sampleRate = track.waveformData.sample_rate;

  // The audio of the latest render, for the cleanup below to tell "new audio"
  // from "the same audio in a new player" (a new name, fades, the pitch
  // setting, a callback's identity). Written during render, like durationRef.
  const latestAudioRef = useRef({ source: track.source, waveformData: track.waveformData });
  latestAudioRef.current = { source: track.source, waveformData: track.waveformData };

  // Initialize playout and load track
  useEffect(() => {
    let cancelled = false;
    let createdPlayout: MediaElementPlayout | null = null;
    // The audio this run's player is for.
    const source = track.source;
    const waveformData = track.waveformData;

    (async () => {
      try {
        const playout = await resolveMediaElementPlayout({
          createPlayout,
          playbackRate: initialPlaybackRate,
          preservesPitch,
        });
        if (cancelled) {
          playout.dispose();
          return;
        }
        createdPlayout = playout;

        playout.addTrack({
          source: track.source,
          peaks: track.waveformData,
          name: track.name,
          audioContext,
          fadeIn: track.fadeIn,
          fadeOut: track.fadeOut,
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
          stopAnimationFrameLoop();
          setIsPlaying(false);
          setActiveAnnotationId(null);
          currentTimeRef.current = 0;
          setCurrentTime(0);
        });

        playoutRef.current = playout;
        setDuration(track.waveformData.duration);
        onReady?.();
      } catch (err) {
        console.warn('[waveform-playlist] MediaElement playout init failed: ' + String(err));
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      stopAnimationFrameLoop();
      // The player that was playing is about to be disposed: playback has
      // stopped, whatever replaces it. Left true, the UI showed "playing"
      // with no audio and no loop, and the playhead and progress overlay
      // (drawn at rest only while not playing) stopped following seeks.
      setIsPlaying(false);
      const latest = latestAudioRef.current;
      if (latest.source !== source || latest.waveformData !== waveformData) {
        // New audio: the old position and the old active annotation mean
        // nothing in it. Done here, in the cleanup, and not when the next
        // player is set up: React runs every cleanup of a commit before any
        // effect, so an effect of a child that restores a saved position for
        // the new audio (`seekTo`, `setActiveAnnotationId`) runs after this
        // and is kept.
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setActiveAnnotationId(null);
      } else {
        // The same audio (or an unmount): keep the listener's place, and
        // bring the state up to it. During playback only the ref advances.
        setCurrentTime(currentTimeRef.current);
      }
      if (createdPlayout) {
        createdPlayout.dispose();
      }
      playoutRef.current = null;
    };
  }, [
    track.source,
    track.waveformData,
    track.name,
    track.fadeIn,
    track.fadeOut,
    audioContext,
    initialPlaybackRate,
    preservesPitch,
    onReady,
    onError,
    stopAnimationFrameLoop,
    setActiveAnnotationId,
    createPlayout,
  ]);

  // Generate peaks from waveform data
  useEffect(() => {
    try {
      const extractedPeaks = extractPeaksFromWaveformData(
        track.waveformData as WaveformData,
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
    } catch (err) {
      console.warn('[waveform-playlist] Failed to extract peaks from waveform data:', err);
    }
  }, [track.waveformData, track.name, samplesPerPixel, sampleRate]);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    const updateTime = () => {
      const time = playoutRef.current?.getCurrentTime() ?? 0;
      currentTimeRef.current = time;

      // The media element reports the audible position: one time for logic
      // and for drawing.
      runFrameCallbacks({
        time,
        visualTime: time,
        sampleRate,
        samplesPerPixel: samplesPerPixelRef.current,
      });

      const activeAnnotationEnded = followAnnotations({
        annotations: annotationsRef.current,
        lookup: annotationLookup,
        time,
        activeId: activeAnnotationIdRef.current,
        followOnly: continuousPlayRef.current,
        holdHighlight: false,
        setActiveAnnotationId,
      });
      if (activeAnnotationEnded) {
        // Continuous play off: stop at the end of the active annotation.
        playoutRef.current?.stop();
        setIsPlaying(false);
        return;
      }

      if (isAutomaticScrollRef.current && scrollContainerRef.current) {
        centrePlayhead(scrollContainerRef.current, time, sampleRate, samplesPerPixelRef.current);
      }

      startAnimationFrameLoop(updateTime);
    };

    startAnimationFrameLoop(updateTime);
  }, [
    setActiveAnnotationId,
    sampleRate,
    startAnimationFrameLoop,
    annotationLookup,
    annotationsRef,
    activeAnnotationIdRef,
    continuousPlayRef,
    isAutomaticScrollRef,
    scrollContainerRef,
    runFrameCallbacks,
  ]);

  const stopAnimationLoop = stopAnimationFrameLoop;

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

  const seekTo = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, durationRef.current));
    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);

    if (playoutRef.current) {
      playoutRef.current.seekTo(clampedTime);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRateState(clampedRate);
    if (playoutRef.current) {
      playoutRef.current.setPlaybackRate(clampedRate);
    }
  }, []);

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

  const controlsValue: MediaElementControlsContextValue = useMemo(
    () => ({
      play,
      pause,
      stop,
      seekTo,
      setPlaybackRate,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
    }),
    [
      play,
      pause,
      stop,
      seekTo,
      setPlaybackRate,
      setContinuousPlay,
      setAnnotations,
      annotationPreview,
      setActiveAnnotationId,
      setAutomaticScroll,
      setScrollContainer,
      scrollContainerRef,
    ]
  );

  // Internal (not exported from the package): see mediaElementInternalContexts.
  const internalsValue: MediaElementInternalsValue = useMemo(
    () => ({
      registerFrameCallback,
      unregisterFrameCallback,
      visualTimeRef: currentTimeRef,
      setSelection,
    }),
    [registerFrameCallback, unregisterFrameCallback, setSelection]
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
      roundedBars,
      progressBarWidth,
      fadeIn: track.fadeIn,
      fadeOut: track.fadeOut,
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
      roundedBars,
      progressBarWidth,
      track.fadeIn,
      track.fadeOut,
    ]
  );

  return (
    <ThemeProvider theme={mergedTheme}>
      <MediaElementAnimationContext.Provider value={animationValue}>
        <MediaElementStateContext.Provider value={stateValue}>
          <MediaElementControlsContext.Provider value={controlsValue}>
            <MediaElementDataContext.Provider value={dataValue}>
              <MediaElementInternalsContext.Provider value={internalsValue}>
                <MediaElementSelectionContext.Provider value={selection}>
                  {children}
                </MediaElementSelectionContext.Provider>
              </MediaElementInternalsContext.Provider>
            </MediaElementDataContext.Provider>
          </MediaElementControlsContext.Provider>
        </MediaElementStateContext.Provider>
      </MediaElementAnimationContext.Provider>
    </ThemeProvider>
  );
};

// Hooks
const PROVIDER = 'MediaElementPlaylistProvider';

export const useMediaElementAnimation = () =>
  useRequiredContext(MediaElementAnimationContext, 'useMediaElementAnimation', PROVIDER);

export const useMediaElementState = () =>
  useRequiredContext(MediaElementStateContext, 'useMediaElementState', PROVIDER);

export const useMediaElementControls = () =>
  useRequiredContext(MediaElementControlsContext, 'useMediaElementControls', PROVIDER);

export const useMediaElementData = () =>
  useRequiredContext(MediaElementDataContext, 'useMediaElementData', PROVIDER);
