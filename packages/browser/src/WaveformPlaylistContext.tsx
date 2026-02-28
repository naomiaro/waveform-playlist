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
  createToneAdapter,
  type EffectsFunction,
  type TrackEffectsFunction,
} from '@waveform-playlist/playout';
import { PlaylistEngine, type EngineState } from '@waveform-playlist/engine';
import { type ClipTrack, type Fade, type AnnotationAction } from '@waveform-playlist/core';
import {
  type TimeFormat,
  type WaveformPlaylistTheme,
  defaultTheme,
} from '@waveform-playlist/ui-components';
import { getContext } from 'tone';
import { extractPeaksFromWaveformDataFull } from './waveformDataLoader';
import type WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import {
  useTimeFormat,
  useZoomControls,
  useMasterVolume,
  useAnimationFrameLoop,
  useWaveformDataCache,
} from './hooks';

// Types
export interface ClipPeaks {
  clipId: string;
  trackName: string;
  peaks: PeakData;
  startSample: number;
  durationSamples: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
}

export type TrackClipPeaks = ClipPeaks[];

// Legacy WaveformTrack type - kept for reference but deprecated
// @deprecated Use ClipTrack from @waveform-playlist/core instead
export interface WaveformTrack {
  src: string | AudioBuffer;
  name?: string;
  effects?: TrackEffectsFunction;
}

export interface TrackState {
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

// Split contexts for performance optimization
// Animation context contains playback state and timing refs — no per-frame state updates

export interface PlaybackAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
  // Refs for direct time calculation in animated components (avoids timing drift)
  playbackStartTimeRef: React.RefObject<number>; // context.currentTime when playback started
  audioStartPositionRef: React.RefObject<number>; // Audio position when playback started
}

export interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  isLoopEnabled: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null; // ID of currently selected track for editing operations
  // Loop region (separate from selection) - Audacity-style loop points
  loopStart: number;
  loopEnd: number;
}

export interface PlaylistControlsContextValue {
  // Playback controls
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;

  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;

  // Selection
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;

  // Time format
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;

  // Master volume
  setMasterVolume: (volume: number) => void;

  // Automatic scroll
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  // Annotation controls
  setContinuousPlay: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
}

export interface PlaylistDataContextValue {
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: TrackClipPeaks[]; // Array of tracks, each containing array of clip peaks
  trackStates: TrackState[];
  tracks: ClipTrack[]; // Original tracks array with IDs
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  minimumPlaylistHeight: number;
  controls: { show: boolean; width: number };
  playoutRef: React.RefObject<PlaylistEngine | null>;
  samplesPerPixel: number;
  timeFormat: TimeFormat;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  barWidth: number;
  barGap: number;
  /** Width in pixels of progress bars. Defaults to barWidth + barGap (fills gaps). */
  progressBarWidth: number;
  /** Whether the playlist has finished loading all tracks */
  isReady: boolean;
  /** Whether tracks are rendered in mono mode */
  mono: boolean;
}

// Create the 4 separate contexts
const PlaybackAnimationContext = createContext<PlaybackAnimationContextValue | null>(null);
const PlaylistStateContext = createContext<PlaylistStateContextValue | null>(null);
const PlaylistControlsContext = createContext<PlaylistControlsContextValue | null>(null);
const PlaylistDataContext = createContext<PlaylistDataContextValue | null>(null);

export interface WaveformPlaylistProviderProps {
  tracks: ClipTrack[]; // Updated to use clip-based model
  timescale?: boolean;
  mono?: boolean;
  waveHeight?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[]; // Array of zoom levels in samples per pixel (lower = more zoomed in)
  automaticScroll?: boolean;
  theme?: Partial<WaveformPlaylistTheme>;
  controls?: {
    show: boolean;
    width: number;
  };
  annotationList?: {
    annotations?: AnnotationData[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: AnnotationAction[];
  };
  effects?: EffectsFunction;
  onReady?: () => void;
  /** @deprecated Use onAnnotationsChange instead */
  onAnnotationUpdate?: (annotations: AnnotationData[]) => void;
  /** Callback when annotations are changed (drag, edit, etc.) */
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
  /** Width in pixels of progress bars. Default: barWidth + barGap (fills gaps). */
  progressBarWidth?: number;
  children: ReactNode;
}

export const WaveformPlaylistProvider: React.FC<WaveformPlaylistProviderProps> = ({
  tracks,
  timescale = false,
  mono = false,
  waveHeight = 80,
  samplesPerPixel: initialSamplesPerPixel = 1024,
  zoomLevels,
  automaticScroll = false,
  theme: userTheme,
  controls = { show: false, width: 0 },
  annotationList,
  effects,
  onReady,
  onAnnotationUpdate: _onAnnotationUpdate,
  onAnnotationsChange,
  barWidth = 1,
  barGap = 0,
  progressBarWidth: progressBarWidthProp,
  children,
}) => {
  // Default progressBarWidth to barWidth + barGap (fills gaps)
  const progressBarWidth = progressBarWidthProp ?? barWidth + barGap;
  // Annotations are derived from prop (single source of truth in parent)
  // In v6, annotations must be pre-parsed (numeric start/end). Use parseAeneas() from @waveform-playlist/annotations before passing.
  const annotations = useMemo(() => {
    if (!annotationList?.annotations) return [];
    if (process.env.NODE_ENV !== 'production' && annotationList.annotations.length > 0) {
      const first = annotationList.annotations[0] as unknown as Record<string, unknown>;
      if (typeof first.start !== 'number' || typeof first.end !== 'number') {
        console.error(
          '[waveform-playlist] Annotations must have numeric start/end values. ' +
            'In v6, use parseAeneas() from @waveform-playlist/annotations before passing annotations. ' +
            'Received start type: ' +
            typeof first.start
        );
        return [];
      }
    }
    return annotationList.annotations;
  }, [annotationList?.annotations]);

  // Ref for animation loop (avoids restarting loop on annotation change)
  const annotationsRef = useRef<AnnotationData[]>(annotations);
  annotationsRef.current = annotations;

  // State
  const [activeAnnotationId, setActiveAnnotationIdState] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioBuffers, setAudioBuffers] = useState<AudioBuffer[]>([]);
  const [peaksDataArray, setPeaksDataArray] = useState<TrackClipPeaks[]>([]); // Updated for clip-based peaks
  const [trackStates, setTrackStates] = useState<TrackState[]>([]);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isAutomaticScroll, setIsAutomaticScroll] = useState(automaticScroll);
  const [continuousPlay, setContinuousPlayState] = useState(
    annotationList?.isContinuousPlay ?? false
  );
  const [linkEndpoints, setLinkEndpoints] = useState(annotationList?.linkEndpoints ?? false);
  const [annotationsEditable, setAnnotationsEditable] = useState(annotationList?.editable ?? false);
  const [isLoopEnabled, setIsLoopEnabledState] = useState(false);
  const [loopStart, setLoopStartState] = useState(0);
  const [loopEnd, setLoopEndState] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Refs
  // Engine owns selection, loop, and selectedTrackId state.
  // React subscribes to engine statechange and mirrors into useState/refs.
  // masterVolume still uses dual-write (useMasterVolume hook manages React state).
  // Playback timing (currentTime, isPlaying) remains in React for animation loop.
  const engineRef = useRef<PlaylistEngine | null>(null);
  const playStartPositionRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const tracksRef = useRef<ClipTrack[]>(tracks);
  const trackStatesRef = useRef<TrackState[]>(trackStates);
  const playbackStartTimeRef = useRef<number>(0); // context.currentTime when playback started
  const audioStartPositionRef = useRef<number>(0); // Audio position when playback started
  const playbackEndTimeRef = useRef<number | null>(null); // Audio position where playback should stop (for selections)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAutomaticScrollRef = useRef<boolean>(false);
  const continuousPlayRef = useRef<boolean>(annotationList?.isContinuousPlay ?? false);
  const activeAnnotationIdRef = useRef<string | null>(null);
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);
  const isLoopEnabledRef = useRef<boolean>(false);
  const selectionStartRef = useRef<number>(0);
  const selectionEndRef = useRef<number>(0);
  const loopStartRef = useRef<number>(0);
  const loopEndRef = useRef<number>(0);
  const selectedTrackIdRef = useRef<string | null>(null);

  // Custom hooks
  const { timeFormat, setTimeFormat, formatTime } = useTimeFormat();
  const zoom = useZoomControls({ initialSamplesPerPixel, zoomLevels });
  const samplesPerPixel = zoom.samplesPerPixel;
  const { masterVolume, setMasterVolume } = useMasterVolume({
    engineRef,
    initialVolume: 1.0,
  });
  const { animationFrameRef, startAnimationFrameLoop, stopAnimationFrameLoop } =
    useAnimationFrameLoop();

  // Worker-based WaveformData cache for fast zoom resampling
  const baseScale = useMemo(
    () => Math.min(...(zoomLevels ?? [256, 512, 1024, 2048, 4096, 8192])),
    [zoomLevels]
  );
  const { cache: waveformDataCache } = useWaveformDataCache(tracks, baseScale);

  // Custom setter for continuousPlay that updates BOTH state and ref synchronously
  // This ensures the ref is updated immediately, before the animation loop can read it
  const setContinuousPlay = useCallback((value: boolean) => {
    continuousPlayRef.current = value; // Update ref synchronously
    setContinuousPlayState(value); // Update state (triggers re-render)
  }, []);

  // Custom setter for activeAnnotationId that updates BOTH state and ref synchronously
  const setActiveAnnotationId = useCallback((value: string | null) => {
    activeAnnotationIdRef.current = value; // Update ref synchronously
    setActiveAnnotationIdState(value); // Update state (triggers re-render)
  }, []);

  // Delegates to engine — statechange subscription updates state + refs
  const setLoopEnabled = useCallback((value: boolean) => {
    engineRef.current?.setLoopEnabled(value);
  }, []);

  // Delegates to engine — statechange subscription updates state + refs
  const setLoopRegion = useCallback((start: number, end: number) => {
    engineRef.current?.setLoopRegion(start, end);
  }, []);

  const setLoopRegionFromSelection = useCallback(() => {
    const start = selectionStartRef.current;
    const end = selectionEndRef.current;
    if (start !== end && end > start) {
      setLoopRegion(start, end);
    }
  }, [setLoopRegion]);

  const clearLoopRegion = useCallback(() => {
    setLoopRegion(0, 0);
  }, [setLoopRegion]);

  // Keep refs in sync with state
  useEffect(() => {
    isAutomaticScrollRef.current = isAutomaticScroll;
  }, [isAutomaticScroll]);

  useEffect(() => {
    trackStatesRef.current = trackStates;
  }, [trackStates]);

  tracksRef.current = tracks;

  // Adjust scroll position proportionally when zoom changes
  useEffect(() => {
    if (!scrollContainerRef.current || !audioBuffers.length) return;

    const container = scrollContainerRef.current;
    const oldSamplesPerPixel = samplesPerPixelRef.current;
    const newSamplesPerPixel = samplesPerPixel;

    if (oldSamplesPerPixel === newSamplesPerPixel) return;

    // Calculate the current center time in the viewport
    const controlWidth = controls.show ? controls.width : 0;
    const containerWidth = container.clientWidth;
    const currentScrollLeft = container.scrollLeft;
    const centerPixel = currentScrollLeft + containerWidth / 2 - controlWidth;
    const sr = audioBuffers[0].sampleRate;
    const centerTime = (centerPixel * oldSamplesPerPixel) / sr;

    // Calculate new scroll position to keep the same center time
    const newCenterPixel = (centerTime * sr) / newSamplesPerPixel;
    const newScrollLeft = Math.max(0, newCenterPixel + controlWidth - containerWidth / 2);

    container.scrollLeft = newScrollLeft;
    samplesPerPixelRef.current = newSamplesPerPixel;
  }, [samplesPerPixel, audioBuffers, controls]);

  // Track pending playback resume after tracks change
  const pendingResumeRef = useRef<{ position: number } | null>(null);

  // Load audio from clips (only when tracks change)
  useEffect(() => {
    // Reset ready state when tracks change
    setIsReady(false);

    if (tracks.length === 0) {
      // Clear state when all tracks are removed
      setAudioBuffers([]);
      setDuration(0);
      setTrackStates([]);
      setPeaksDataArray([]);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      return;
    }

    // Capture playback state before rebuilding playout
    const wasPlaying = isPlaying;
    const resumePosition = currentTimeRef.current;

    // Stop current playback and animation before disposing
    if (engineRef.current && wasPlaying) {
      engineRef.current.stop();
      stopAnimationFrameLoop();
      // Mark that we need to resume playback after playout is rebuilt
      pendingResumeRef.current = { position: resumePosition };
    }

    const loadAudio = async () => {
      try {
        // Extract all audio buffers from clips (only those that have audioBuffer)
        // For now, collect the first clip's buffer from each track
        const buffers: AudioBuffer[] = [];

        tracks.forEach((track) => {
          if (track.clips.length > 0 && track.clips[0].audioBuffer) {
            // Use first clip's buffer for now (full multi-clip support comes in next phase)
            buffers.push(track.clips[0].audioBuffer);
          }
        });

        // Calculate total timeline duration from all clips across all tracks
        // Use clip.sampleRate which is always defined (works for peaks-only clips too)
        let maxDuration = 0;
        tracks.forEach((track) => {
          track.clips.forEach((clip) => {
            const sampleRate = clip.sampleRate;
            const clipEndSample = clip.startSample + clip.durationSamples;
            const clipEnd = clipEndSample / sampleRate;
            maxDuration = Math.max(maxDuration, clipEnd);
          });
        });

        setAudioBuffers(buffers);
        setDuration(maxDuration);

        // Initialize or update track states, preserving existing UI state (mute/solo/volume/pan)
        // Only initialize from ClipTrack props when trackStates is empty or track count changes
        setTrackStates((prevStates) => {
          if (prevStates.length === tracks.length) {
            // Same number of tracks - preserve existing UI state, just update names
            return prevStates.map((state, i) => ({
              ...state,
              name: tracks[i].name,
            }));
          }
          // Track count changed - reinitialize from ClipTrack properties
          return tracks.map((track) => ({
            name: track.name,
            muted: track.muted,
            soloed: track.soloed,
            volume: track.volume,
            pan: track.pan,
          }));
        });

        // Dispose old engine before creating new one
        if (engineRef.current) {
          engineRef.current.dispose();
        }

        // Create engine with Tone.js adapter
        const adapter = createToneAdapter({ effects });
        const engine = new PlaylistEngine({ adapter });

        // Seed engine with current UI state so a fresh engine doesn't
        // reset selection/loop to zeros on the first statechange emission.
        engine.setSelection(selectionStartRef.current, selectionEndRef.current);
        engine.setLoopRegion(loopStartRef.current, loopEndRef.current);
        if (isLoopEnabledRef.current) engine.setLoopEnabled(true);

        // Merge current UI state into tracks before passing to engine
        const currentTrackStates = trackStatesRef.current;
        const tracksWithState = tracks.map((track, index) => {
          const trackState = currentTrackStates[index];
          return {
            ...track,
            volume: trackState?.volume ?? track.volume,
            muted: trackState?.muted ?? track.muted,
            soloed: trackState?.soloed ?? track.soloed,
            pan: trackState?.pan ?? track.pan,
          };
        });

        engine.setTracks(tracksWithState);
        engineRef.current = engine;

        // Subscribe to engine statechange — engine is the source of truth
        // for selection, loop, and selectedTrackId. Ref assignments are
        // synchronous (available to the animation loop immediately);
        // setState calls are batched by React and applied asynchronously.
        // Guards skip setState when the field didn't actually change,
        // avoiding unnecessary re-renders during unrelated engine events
        // (e.g., clip drags, zoom, play/pause).
        engine.on('statechange', (state: EngineState) => {
          if (state.selectionStart !== selectionStartRef.current) {
            selectionStartRef.current = state.selectionStart;
            setSelectionStart(state.selectionStart);
          }
          if (state.selectionEnd !== selectionEndRef.current) {
            selectionEndRef.current = state.selectionEnd;
            setSelectionEnd(state.selectionEnd);
          }
          if (state.selectedTrackId !== selectedTrackIdRef.current) {
            selectedTrackIdRef.current = state.selectedTrackId;
            setSelectedTrackId(state.selectedTrackId);
          }
          if (state.isLoopEnabled !== isLoopEnabledRef.current) {
            isLoopEnabledRef.current = state.isLoopEnabled;
            setIsLoopEnabledState(state.isLoopEnabled);
          }
          if (state.loopStart !== loopStartRef.current) {
            loopStartRef.current = state.loopStart;
            setLoopStartState(state.loopStart);
          }
          if (state.loopEnd !== loopEndRef.current) {
            loopEndRef.current = state.loopEnd;
            setLoopEndState(state.loopEnd);
          }
        });

        setIsReady(true);

        // Dispatch custom event for external listeners
        const event = new CustomEvent('waveform-playlist:ready', {
          detail: {
            trackCount: tracks.length,
            duration: maxDuration,
          },
        });
        window.dispatchEvent(event);

        onReady?.();
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    loadAudio();

    return () => {
      stopAnimationFrameLoop();
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, [tracks, onReady, isPlaying, effects, stopAnimationFrameLoop]);

  // Regenerate peaks when zoom, mono, or waveformDataCache changes (without reloading audio)
  // Peak sources in priority order:
  //   A) clip.waveformData — external pre-computed peaks (e.g. from BBC audiowaveform)
  //   B) waveformDataCache — worker-generated WaveformData (fast resample on zoom)
  //   C) empty peaks — clip is still loading or has no audio data
  useEffect(() => {
    if (tracks.length === 0) return;

    const allTrackPeaks: TrackClipPeaks[] = tracks.map((track) => {
      const clipPeaks: ClipPeaks[] = track.clips.map((clip) => {
        let peaks: PeakData | undefined;

        // Path A: External pre-computed waveform data (e.g. from audiowaveform .dat file)
        if (clip.waveformData) {
          try {
            peaks = extractPeaksFromWaveformDataFull(
              clip.waveformData as WaveformData,
              samplesPerPixel,
              mono,
              clip.offsetSamples,
              clip.durationSamples
            );
          } catch (err) {
            console.warn('[waveform-playlist] Failed to extract peaks from waveformData:', err);
          }
        }

        // Path B: Worker-generated WaveformData cache (fast resample on zoom)
        if (!peaks) {
          const cached = waveformDataCache.get(clip.id);
          if (cached) {
            try {
              peaks = extractPeaksFromWaveformDataFull(
                cached,
                samplesPerPixel,
                mono,
                clip.offsetSamples,
                clip.durationSamples
              );
            } catch (err) {
              console.warn('[waveform-playlist] Failed to extract peaks from cache:', err);
            }
          }
        }

        // Path C: No peaks data available yet — render empty while worker processes.
        // Use correct channel count from audioBuffer to prevent track height shift
        // when peaks arrive (mono mode collapses to 1 channel).
        if (!peaks) {
          if (!clip.audioBuffer && !clip.waveformData) {
            console.warn(
              `[waveform-playlist] Clip "${clip.id}" has no audio data or waveform data`
            );
          }
          const numChannels = mono ? 1 : (clip.audioBuffer?.numberOfChannels ?? 1);
          peaks = {
            length: 0,
            data: Array.from({ length: numChannels }, () => new Int16Array(0)),
            bits: 16,
          };
        }

        return {
          clipId: clip.id,
          trackName: track.name,
          peaks,
          startSample: clip.startSample,
          durationSamples: clip.durationSamples,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
        };
      });

      return clipPeaks;
    });

    setPeaksDataArray(allTrackPeaks);
  }, [tracks, samplesPerPixel, mono, waveformDataCache]);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    const updateTime = () => {
      // Calculate current position based on context.currentTime timing
      const elapsed = getContext().currentTime - playbackStartTimeRef.current;
      const time = audioStartPositionRef.current + elapsed;
      currentTimeRef.current = time;

      // Handle annotation playback based on continuous play mode
      const currentAnnotations = annotationsRef.current;
      if (currentAnnotations.length > 0) {
        const currentAnnotation = currentAnnotations.find(
          (ann) => time >= ann.start && time < ann.end
        );

        if (continuousPlayRef.current) {
          // Continuous play ON: update active annotation, let audio play to the end
          if (currentAnnotation && currentAnnotation.id !== activeAnnotationIdRef.current) {
            setActiveAnnotationId(currentAnnotation.id);
          } else if (!currentAnnotation && activeAnnotationIdRef.current !== null) {
            // Clear the active annotation when we're past it, but don't stop playback
            // Let playback continue until the audio actually ends (handled by duration check)
            setActiveAnnotationId(null);
          }
        } else {
          // Continuous play OFF: stop at end of current annotation
          if (activeAnnotationIdRef.current) {
            const activeAnnotation = currentAnnotations.find(
              (ann) => ann.id === activeAnnotationIdRef.current
            );
            if (activeAnnotation && time >= activeAnnotation.end) {
              // Stop playback at end of current annotation
              if (engineRef.current) {
                engineRef.current.stop();
              }
              setIsPlaying(false);
              currentTimeRef.current = playStartPositionRef.current;
              setCurrentTime(playStartPositionRef.current);
              return;
            }
          } else {
            // If no active annotation ID is set, use the current annotation
            if (currentAnnotation) {
              setActiveAnnotationId(currentAnnotation.id);
            }
          }
        }
      }

      // Handle automatic scroll - continuously center the playhead
      if (isAutomaticScrollRef.current && scrollContainerRef.current && audioBuffers.length > 0) {
        const container = scrollContainerRef.current;
        const sr = audioBuffers[0].sampleRate;
        const pixelPosition = (time * sr) / samplesPerPixelRef.current;
        const containerWidth = container.clientWidth;

        // Calculate visual position of playhead (includes controls offset)
        const controlWidth = controls.show ? controls.width : 0;
        const visualPosition = pixelPosition + controlWidth;

        // Continuously scroll to keep playhead centered
        const targetScrollLeft = Math.max(0, visualPosition - containerWidth / 2);
        container.scrollLeft = targetScrollLeft;
      }

      // Check if we've reached the playback end time (for selection playback)
      if (playbackEndTimeRef.current !== null && time >= playbackEndTimeRef.current) {
        // Stop playback at selection end (selection playback is separate from looping)
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        currentTimeRef.current = playbackEndTimeRef.current;
        setCurrentTime(playbackEndTimeRef.current);
        playbackEndTimeRef.current = null; // Clear the end time
        return;
      }

      // Audacity-style loop region: loop when cursor enters and reaches end of loop region
      const hasValidLoopRegion =
        loopStartRef.current !== loopEndRef.current && loopEndRef.current > loopStartRef.current;

      if (isLoopEnabledRef.current && hasValidLoopRegion) {
        // Check if we've reached or passed the loop end point
        if (time >= loopEndRef.current) {
          // Loop: restart from loop start
          engineRef.current?.stop();

          const context = getContext();
          const timeNow = context.currentTime;
          playbackStartTimeRef.current = timeNow;
          audioStartPositionRef.current = loopStartRef.current;
          currentTimeRef.current = loopStartRef.current;

          // Restart playback from loop start (no duration limit - will loop again when reaching loop end)
          // Fire-and-forget: adapter.init() is already resolved after first play, so this is synchronous in practice
          engineRef.current?.play(loopStartRef.current);

          // Continue animation loop
          startAnimationFrameLoop(updateTime);
          return;
        }
      }

      if (time >= duration) {
        // Stop playback - inline to avoid circular dependency
        if (engineRef.current) {
          engineRef.current.stop();
        }
        setIsPlaying(false);
        currentTimeRef.current = playStartPositionRef.current;
        setCurrentTime(playStartPositionRef.current);
        setActiveAnnotationId(null);
        return;
      }
      startAnimationFrameLoop(updateTime);
    };
    startAnimationFrameLoop(updateTime);
  }, [
    duration,
    audioBuffers,
    controls.show,
    controls.width,
    setActiveAnnotationId,
    startAnimationFrameLoop,
  ]);

  const stopAnimationLoop = stopAnimationFrameLoop;

  // Restart animation loop and reschedule playout when continuousPlay changes during playback
  // This ensures the loop always has the current continuousPlay value
  // and removes duration limits when switching to continuous play
  useEffect(() => {
    const reschedulePlayback = async () => {
      if (isPlaying && animationFrameRef.current && engineRef.current) {
        // When toggling continuous play ON, reschedule playout without duration limit
        // so audio continues past the current annotation boundary
        if (continuousPlay) {
          const currentPos = currentTimeRef.current;

          // Stop current playout (which may have duration limit + pause callback)
          engineRef.current.stop();
          stopAnimationLoop();

          const context = getContext();
          const timeNow = context.currentTime;
          playbackStartTimeRef.current = timeNow;
          audioStartPositionRef.current = currentPos;

          // Play without duration - will play to end of track
          await engineRef.current.play(currentPos);
          startAnimationLoop();
        } else {
          // Just restart animation loop for continuous play OFF
          stopAnimationLoop();
          startAnimationLoop();
        }
      }
    };

    reschedulePlayback();
  }, [continuousPlay, isPlaying, startAnimationLoop, stopAnimationLoop, animationFrameRef]);

  // Resume playback after tracks change (e.g., after splitting a clip during playback)
  useEffect(() => {
    const resumePlayback = async () => {
      if (pendingResumeRef.current && engineRef.current) {
        const { position } = pendingResumeRef.current;
        pendingResumeRef.current = null;

        const context = getContext();
        const timeNow = context.currentTime;
        playbackStartTimeRef.current = timeNow;
        audioStartPositionRef.current = position;

        await engineRef.current.play(position);
        setIsPlaying(true);
        startAnimationLoop();
      }
    };

    resumePlayback();
  }, [tracks, startAnimationLoop]);

  // Playback controls
  const play = useCallback(
    async (startTime?: number, playDuration?: number) => {
      if (!engineRef.current || audioBuffers.length === 0) return;

      const actualStartTime = startTime ?? currentTimeRef.current;
      playStartPositionRef.current = actualStartTime;

      // Update currentTimeRef to match the actual start position
      // This ensures the animation loop starts from the correct position
      currentTimeRef.current = actualStartTime;

      // Stop any existing playback and animation loop before starting
      engineRef.current.stop();
      stopAnimationLoop();

      // Record timing for accurate position tracking using Tone.js context
      const context = getContext();
      // Tone.js context wraps Web Audio - need to use .currentTime from wrapped context
      const startTimeNow = context.currentTime;
      playbackStartTimeRef.current = startTimeNow;
      audioStartPositionRef.current = actualStartTime;

      // Set playback end time if playing with duration (e.g., selection playback)
      playbackEndTimeRef.current =
        playDuration !== undefined ? actualStartTime + playDuration : null;

      // Don't set up playback complete callback for annotations
      // The animation loop handles stopping at annotation boundaries
      // This avoids callback timing issues when switching between annotations

      const endTime = playDuration !== undefined ? actualStartTime + playDuration : undefined;
      await engineRef.current.play(actualStartTime, endTime);
      setIsPlaying(true);
      startAnimationLoop();
    },
    [audioBuffers.length, startAnimationLoop, stopAnimationLoop]
  );

  const pause = useCallback(() => {
    if (!engineRef.current) return;

    // Calculate exact pause position using context.currentTime timing
    const elapsed = getContext().currentTime - playbackStartTimeRef.current;
    const pauseTime = audioStartPositionRef.current + elapsed;

    engineRef.current.pause();
    setIsPlaying(false);
    stopAnimationLoop();

    // Update to the calculated pause position
    currentTimeRef.current = pauseTime;
    setCurrentTime(pauseTime);
  }, [stopAnimationLoop]);

  const stop = useCallback(() => {
    if (!engineRef.current) return;

    engineRef.current.stop();
    setIsPlaying(false);
    stopAnimationLoop();

    currentTimeRef.current = playStartPositionRef.current;
    setCurrentTime(playStartPositionRef.current);
    setActiveAnnotationId(null);
  }, [stopAnimationLoop, setActiveAnnotationId]);

  // Seek to a specific time - works whether playing or stopped
  const seekTo = useCallback(
    (time: number) => {
      // Clamp time to valid range
      const clampedTime = Math.max(0, Math.min(time, duration));

      // Update the current time state
      currentTimeRef.current = clampedTime;
      setCurrentTime(clampedTime);

      // If currently playing, stop and restart at the new position
      if (isPlaying && engineRef.current) {
        engineRef.current.stop();
        stopAnimationLoop();
        // Use play() which handles all the timing setup
        play(clampedTime);
      }
    },
    [duration, isPlaying, play, stopAnimationLoop]
  );

  // Track controls
  const setTrackMute = useCallback(
    (trackIndex: number, muted: boolean) => {
      const trackId = tracksRef.current[trackIndex]?.id;
      if (!trackId) return;

      const newStates = [...trackStates];
      newStates[trackIndex] = { ...newStates[trackIndex], muted };
      setTrackStates(newStates);

      if (engineRef.current) {
        engineRef.current.setTrackMute(trackId, muted);
      }
    },
    [trackStates]
  );

  const setTrackSolo = useCallback(
    (trackIndex: number, soloed: boolean) => {
      const trackId = tracksRef.current[trackIndex]?.id;
      if (!trackId) return;

      const newStates = [...trackStates];
      newStates[trackIndex] = { ...newStates[trackIndex], soloed };
      setTrackStates(newStates);

      if (engineRef.current) {
        engineRef.current.setTrackSolo(trackId, soloed);
      }
    },
    [trackStates]
  );

  const setTrackVolume = useCallback(
    (trackIndex: number, volume: number) => {
      const trackId = tracksRef.current[trackIndex]?.id;
      if (!trackId) return;

      const newStates = [...trackStates];
      newStates[trackIndex] = { ...newStates[trackIndex], volume };
      setTrackStates(newStates);

      if (engineRef.current) {
        engineRef.current.setTrackVolume(trackId, volume);
      }
    },
    [trackStates]
  );

  const setTrackPan = useCallback(
    (trackIndex: number, pan: number) => {
      const trackId = tracksRef.current[trackIndex]?.id;
      if (!trackId) return;

      const newStates = [...trackStates];
      newStates[trackIndex] = { ...newStates[trackIndex], pan };
      setTrackStates(newStates);

      if (engineRef.current) {
        engineRef.current.setTrackPan(trackId, pan);
      }
    },
    [trackStates]
  );

  // Selection — delegates to engine; statechange subscription updates React state + refs.
  // Also updates currentTime to selection start (playback concern stays in React).
  const setSelection = useCallback(
    async (start: number, end: number) => {
      engineRef.current?.setSelection(start, end);
      currentTimeRef.current = start;
      setCurrentTime(start);

      if (isPlaying && engineRef.current) {
        engineRef.current.stop();
        await engineRef.current.play(start);
      }
    },
    [isPlaying]
  );

  // Delegates to engine — statechange subscription updates React state
  const setSelectedTrackIdControl = useCallback((trackId: string | null) => {
    engineRef.current?.selectTrack(trackId);
  }, []);

  // Memoize setScrollContainer callback
  const setScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  // Stable callback ref for onAnnotationsChange to avoid re-creating controls context
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  onAnnotationsChangeRef.current = onAnnotationsChange;

  const setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>> = useCallback(
    (action) => {
      const updated = typeof action === 'function' ? action(annotationsRef.current) : action;
      if (!onAnnotationsChangeRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'waveform-playlist: setAnnotations was called but no onAnnotationsChange callback is provided. ' +
              'Annotation edits will not persist. Pass onAnnotationsChange to WaveformPlaylistProvider to handle annotation updates.'
          );
        }
        return;
      }
      onAnnotationsChangeRef.current(updated);
    },
    []
  );

  const sampleRate = audioBuffers[0]?.sampleRate || 44100;
  const timeScaleHeight = timescale ? 30 : 0;
  const minimumPlaylistHeight = tracks.length * waveHeight + timeScaleHeight;

  // Split context values for performance optimization
  // Animation context only re-renders consumers on discrete events
  // (play/pause/stop/seek), never during the animation loop itself

  const animationValue: PlaybackAnimationContextValue = useMemo(
    () => ({
      isPlaying,
      currentTime,
      currentTimeRef,
      playbackStartTimeRef,
      audioStartPositionRef,
    }),
    [isPlaying, currentTime, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]
  );

  const stateValue: PlaylistStateContextValue = useMemo(
    () => ({
      continuousPlay,
      linkEndpoints,
      annotationsEditable,
      isAutomaticScroll,
      isLoopEnabled,
      annotations,
      activeAnnotationId,
      selectionStart,
      selectionEnd,
      selectedTrackId,
      loopStart,
      loopEnd,
    }),
    [
      continuousPlay,
      linkEndpoints,
      annotationsEditable,
      isAutomaticScroll,
      isLoopEnabled,
      annotations,
      activeAnnotationId,
      selectionStart,
      selectionEnd,
      selectedTrackId,
      loopStart,
      loopEnd,
    ]
  );

  const setCurrentTimeControl = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      setCurrentTime(time);
    },
    [currentTimeRef]
  );

  const setAutomaticScrollControl = useCallback((enabled: boolean) => {
    setIsAutomaticScroll(enabled);
  }, []);

  const controlsValue: PlaylistControlsContextValue = useMemo(
    () => ({
      // Playback controls
      play,
      pause,
      stop,
      seekTo,
      setCurrentTime: setCurrentTimeControl,

      // Track controls
      setTrackMute,
      setTrackSolo,
      setTrackVolume,
      setTrackPan,

      // Selection
      setSelection,
      setSelectedTrackId: setSelectedTrackIdControl,

      // Time format
      setTimeFormat,
      formatTime,

      // Zoom
      zoomIn: zoom.zoomIn,
      zoomOut: zoom.zoomOut,

      // Master volume
      setMasterVolume,

      // Automatic scroll
      setAutomaticScroll: setAutomaticScrollControl,
      setScrollContainer,
      scrollContainerRef,

      // Annotation controls
      setContinuousPlay,
      setLinkEndpoints,
      setAnnotationsEditable,
      setAnnotations,
      setActiveAnnotationId,

      // Loop controls
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,
    }),
    [
      play,
      pause,
      stop,
      seekTo,
      setCurrentTimeControl,
      setTrackMute,
      setTrackSolo,
      setTrackVolume,
      setTrackPan,
      setSelection,
      setSelectedTrackIdControl,
      setTimeFormat,
      formatTime,
      zoom.zoomIn,
      zoom.zoomOut,
      setMasterVolume,
      setAutomaticScrollControl,
      setScrollContainer,
      scrollContainerRef,
      setContinuousPlay,
      setLinkEndpoints,
      setAnnotationsEditable,
      setAnnotations,
      setActiveAnnotationId,
      setLoopEnabled,
      setLoopRegion,
      setLoopRegionFromSelection,
      clearLoopRegion,
    ]
  );

  const dataValue: PlaylistDataContextValue = useMemo(
    () => ({
      duration,
      audioBuffers,
      peaksDataArray,
      trackStates,
      tracks,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      minimumPlaylistHeight,
      controls,
      playoutRef: engineRef,
      samplesPerPixel,
      timeFormat,
      masterVolume,
      canZoomIn: zoom.canZoomIn,
      canZoomOut: zoom.canZoomOut,
      barWidth,
      barGap,
      progressBarWidth,
      isReady,
      mono,
    }),
    [
      duration,
      audioBuffers,
      peaksDataArray,
      trackStates,
      tracks,
      sampleRate,
      waveHeight,
      timeScaleHeight,
      minimumPlaylistHeight,
      controls,
      engineRef,
      samplesPerPixel,
      timeFormat,
      masterVolume,
      zoom.canZoomIn,
      zoom.canZoomOut,
      barWidth,
      barGap,
      progressBarWidth,
      isReady,
      mono,
    ]
  );

  // Merge user theme with default theme
  const mergedTheme = { ...defaultTheme, ...userTheme };

  return (
    <ThemeProvider theme={mergedTheme}>
      <PlaybackAnimationContext.Provider value={animationValue}>
        <PlaylistStateContext.Provider value={stateValue}>
          <PlaylistControlsContext.Provider value={controlsValue}>
            <PlaylistDataContext.Provider value={dataValue}>
              {children}
            </PlaylistDataContext.Provider>
          </PlaylistControlsContext.Provider>
        </PlaylistStateContext.Provider>
      </PlaybackAnimationContext.Provider>
    </ThemeProvider>
  );
};

// Individual hooks for each context - use these for optimal performance
// Components only re-render when their specific context data changes

export const usePlaybackAnimation = () => {
  const context = useContext(PlaybackAnimationContext);
  if (!context) {
    throw new Error('usePlaybackAnimation must be used within WaveformPlaylistProvider');
  }
  return context;
};

export const usePlaylistState = () => {
  const context = useContext(PlaylistStateContext);
  if (!context) {
    throw new Error('usePlaylistState must be used within WaveformPlaylistProvider');
  }
  return context;
};

export const usePlaylistControls = () => {
  const context = useContext(PlaylistControlsContext);
  if (!context) {
    throw new Error('usePlaylistControls must be used within WaveformPlaylistProvider');
  }
  return context;
};

export const usePlaylistData = () => {
  const context = useContext(PlaylistDataContext);
  if (!context) {
    throw new Error('usePlaylistData must be used within WaveformPlaylistProvider');
  }
  return context;
};
