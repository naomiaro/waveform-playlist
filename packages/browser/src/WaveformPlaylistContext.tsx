import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { TonePlayout, type EffectsFunction, type TrackEffectsFunction } from '@waveform-playlist/playout';
import { type Track, type ClipTrack, type Fade } from '@waveform-playlist/core';
import { type TimeFormat, type WaveformPlaylistTheme, defaultTheme } from '@waveform-playlist/ui-components';
import { start as toneStart, getContext } from 'tone';
import { generatePeaks } from './peaksUtil';
import type { PeakData } from '@waveform-playlist/webaudio-peaks';
import { parseAeneas, type AnnotationData } from '@waveform-playlist/annotations';
import { useTimeFormat, useZoomControls, useMasterVolume } from './hooks';

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

export interface WaveformPlaylistContextValue {
  // State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: TrackClipPeaks[]; // Array of tracks, each containing array of clip peaks
  trackStates: TrackState[];
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  isAutomaticScroll: boolean;
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;

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
  setTimeFormat: (format: TimeFormat) => void;
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

  // Annotation controls
  setContinuousPlay: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setAnnotations: (annotations: AnnotationData[]) => void;
  setActiveAnnotationId: (id: string | null) => void;

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

// Split contexts for performance optimization
// High-frequency updates (currentTime) are isolated from low-frequency state changes

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
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null; // ID of currently selected track for editing operations
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
  setAnnotations: (annotations: AnnotationData[]) => void;
  setActiveAnnotationId: (id: string | null) => void;
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
  playoutRef: React.RefObject<TonePlayout | null>;
  samplesPerPixel: number;
  timeFormat: string;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  barWidth: number;
  barGap: number;
  /** Width in pixels of progress bars. Defaults to barWidth + barGap (fills gaps). */
  progressBarWidth: number;
}

// Create the 4 separate contexts
const PlaybackAnimationContext = createContext<PlaybackAnimationContextValue | null>(null);
const PlaylistStateContext = createContext<PlaylistStateContextValue | null>(null);
const PlaylistControlsContext = createContext<PlaylistControlsContextValue | null>(null);
const PlaylistDataContext = createContext<PlaylistDataContextValue | null>(null);

// Keep the original context for backwards compatibility
const WaveformPlaylistContext = createContext<WaveformPlaylistContextValue | null>(null);

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
    annotations?: any[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: any[];
  };
  effects?: EffectsFunction;
  onReady?: () => void;
  onAnnotationUpdate?: (annotations: AnnotationData[]) => void;
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
  barWidth = 1,
  barGap = 0,
  progressBarWidth: progressBarWidthProp,
  children,
}) => {
  // Default progressBarWidth to barWidth + barGap (fills gaps)
  const progressBarWidth = progressBarWidthProp ?? (barWidth + barGap);
  // State
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
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
  const [continuousPlay, setContinuousPlayState] = useState(annotationList?.isContinuousPlay ?? false);
  const [linkEndpoints, setLinkEndpoints] = useState(annotationList?.linkEndpoints ?? true);
  const [annotationsEditable, setAnnotationsEditable] = useState(annotationList?.editable ?? false);

  // Refs
  const playoutRef = useRef<TonePlayout | null>(null);
  const playStartPositionRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0); // context.currentTime when playback started
  const audioStartPositionRef = useRef<number>(0); // Audio position when playback started
  const playbackEndTimeRef = useRef<number | null>(null); // Audio position where playback should stop (for selections)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAutomaticScrollRef = useRef<boolean>(false);
  const continuousPlayRef = useRef<boolean>(annotationList?.isContinuousPlay ?? false);
  const activeAnnotationIdRef = useRef<string | null>(null);
  const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);

  // Custom hooks
  const { timeFormat, setTimeFormat, formatTime } = useTimeFormat();
  const zoom = useZoomControls({ initialSamplesPerPixel, zoomLevels });
  const samplesPerPixel = zoom.samplesPerPixel;
  const { masterVolume, setMasterVolume } = useMasterVolume({ playoutRef, initialVolume: 1.0 });

  // Custom setter for continuousPlay that updates BOTH state and ref synchronously
  // This ensures the ref is updated immediately, before the animation loop can read it
  const setContinuousPlay = useCallback((value: boolean) => {
    continuousPlayRef.current = value;  // Update ref synchronously
    setContinuousPlayState(value);       // Update state (triggers re-render)
  }, []);

  // Custom setter for activeAnnotationId that updates BOTH state and ref synchronously
  const setActiveAnnotationId = useCallback((value: string | null) => {
    activeAnnotationIdRef.current = value;  // Update ref synchronously
    setActiveAnnotationIdState(value);       // Update state (triggers re-render)
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    isAutomaticScrollRef.current = isAutomaticScroll;
  }, [isAutomaticScroll]);

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
    if (tracks.length === 0) {
      // Clear state when all tracks are removed
      setAudioBuffers([]);
      setDuration(0);
      setTrackStates([]);
      setPeaksDataArray([]);
      if (playoutRef.current) {
        playoutRef.current.dispose();
        playoutRef.current = null;
      }
      return;
    }

    // Capture playback state before rebuilding playout
    const wasPlaying = isPlaying;
    const resumePosition = currentTimeRef.current;

    // Stop current playback and animation before disposing
    if (playoutRef.current && wasPlaying) {
      playoutRef.current.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Mark that we need to resume playback after playout is rebuilt
      pendingResumeRef.current = { position: resumePosition };
    }

    const loadAudio = async () => {
      try {
        // Extract all audio buffers from clips
        // For now, collect the first clip's buffer from each track
        const buffers: AudioBuffer[] = [];

        tracks.forEach((track) => {
          if (track.clips.length > 0) {
            // Use first clip's buffer for now (full multi-clip support comes in next phase)
            buffers.push(track.clips[0].audioBuffer);
          }
        });

        // Calculate total timeline duration from all clips across all tracks
        let maxDuration = 0;
        tracks.forEach((track) => {
          track.clips.forEach((clip) => {
            const sampleRate = clip.audioBuffer.sampleRate;
            const clipEndSample = clip.startSample + clip.durationSamples;
            const clipEnd = clipEndSample / sampleRate;
            maxDuration = Math.max(maxDuration, clipEnd);
          });
        });

        setAudioBuffers(buffers);
        setDuration(maxDuration);

        // Initialize track states from ClipTrack properties
        setTrackStates(tracks.map((track) => ({
          name: track.name,
          muted: track.muted,
          soloed: track.soloed,
          volume: track.volume,
          pan: track.pan,
        })));

        // Dispose old playout before creating new one
        if (playoutRef.current) {
          playoutRef.current.dispose();
        }

        // Create playout with clips
        const playout = new TonePlayout({
          effects,
        });

        // For each track, create a ToneTrack with all clips
        tracks.forEach((track, index) => {
          if (track.clips.length > 0) {
            // Calculate track start and end times from clips (converting samples to seconds)
            const sampleRate = track.clips[0].audioBuffer.sampleRate;
            const startTime = Math.min(...track.clips.map(c => c.startSample / sampleRate));
            const endTime = Math.max(...track.clips.map(c => (c.startSample + c.durationSamples) / sampleRate));

            const trackObj: Track = {
              id: `track-${index}`, // Use consistent index-based ID for track controls
              name: track.name,
              gain: track.volume, // Use track-level volume
              muted: track.muted,
              soloed: track.soloed,
              stereoPan: track.pan,
              startTime,
              endTime,
            };

            // Convert ClipTrack clips to ToneTrack ClipInfo format
            // Note: ClipInfo.startTime is relative to track start, not absolute timeline
            const clipInfos = track.clips.map(clip => {
              const sampleRate = clip.audioBuffer.sampleRate;
              return {
                buffer: clip.audioBuffer,
                startTime: (clip.startSample / sampleRate) - startTime, // Make relative to track start
                duration: clip.durationSamples / sampleRate,
                offset: clip.offsetSamples / sampleRate,
                fadeIn: clip.fadeIn,
                fadeOut: clip.fadeOut,
                gain: clip.gain,
              };
            });

            playout.addTrack({
              clips: clipInfos,
              track: trackObj,
              effects: track.effects, // Pass track effects
            });
          }
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
  }, [tracks, onReady, isPlaying]);

  // Regenerate peaks when zoom or mono changes (without reloading audio)
  useEffect(() => {
    if (tracks.length === 0) return;

    const bits = 16;

    // Generate peaks for each clip in each track
    const allTrackPeaks: TrackClipPeaks[] = tracks.map((track) => {
      const clipPeaks: ClipPeaks[] = track.clips.map((clip) => {
        // Generate peaks with trimming based on clip's offset and duration
        const sampleRate = clip.audioBuffer.sampleRate;
        const peaks = generatePeaks(
          clip.audioBuffer,
          samplesPerPixel,
          mono,
          bits,
          clip.offsetSamples / sampleRate,        // Time offset into the audio file (in seconds)
          clip.durationSamples / sampleRate       // Duration of the clip (in seconds)
        );

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
  }, [tracks, samplesPerPixel, mono]);

  // Load annotations from annotationList prop
  useEffect(() => {
    if (annotationList?.annotations) {
      // Parse Aeneas format annotations to AnnotationData format
      const parsedAnnotations = annotationList.annotations.map((ann: any) => {
        // If it's already in the correct format, use it
        if (typeof ann.start === 'number') {
          return ann;
        }
        // Otherwise parse from Aeneas format
        return parseAeneas(ann);
      });
      setAnnotations(parsedAnnotations);
    }
  }, [annotationList]);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    // Cancel any existing animation frame before starting a new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const updateTime = () => {
      // Calculate current position based on context.currentTime timing
      const elapsed = getContext().currentTime - playbackStartTimeRef.current;
      const time = audioStartPositionRef.current + elapsed;
      currentTimeRef.current = time;

      // Update state on every frame - context splitting isolates this from other components
      setCurrentTime(time);

      // Handle annotation playback based on continuous play mode
      if (annotations.length > 0) {
        const currentAnnotation = annotations.find(
          (ann) => time >= ann.start && time < ann.end
        );

        if (continuousPlayRef.current) {
          // Continuous play ON: update active annotation and stop after last annotation
          if (currentAnnotation && currentAnnotation.id !== activeAnnotationIdRef.current) {
            setActiveAnnotationId(currentAnnotation.id);
          } else if (!currentAnnotation && activeAnnotationIdRef.current !== null) {
            // We're no longer in any annotation - check if we're past the last one
            const lastAnnotation = annotations[annotations.length - 1];
            if (time >= lastAnnotation.end) {
              // Stop playback - we've finished all annotations
              if (playoutRef.current) {
                playoutRef.current.stop();
              }
              setIsPlaying(false);
              currentTimeRef.current = playStartPositionRef.current;
              setCurrentTime(playStartPositionRef.current);
              setActiveAnnotationId(null);
              return;
            }
          }
        } else {
          // Continuous play OFF: stop at end of current annotation
          if (activeAnnotationIdRef.current) {
            const activeAnnotation = annotations.find(ann => ann.id === activeAnnotationIdRef.current);
            if (activeAnnotation && time >= activeAnnotation.end) {
              // Stop playback at end of current annotation
              if (playoutRef.current) {
                playoutRef.current.stop();
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
        // Stop playback at selection end
        if (playoutRef.current) {
          playoutRef.current.stop();
        }
        setIsPlaying(false);
        currentTimeRef.current = playbackEndTimeRef.current;
        setCurrentTime(playbackEndTimeRef.current);
        playbackEndTimeRef.current = null; // Clear the end time
        return;
      }

      if (time >= duration) {
        // Stop playback - inline to avoid circular dependency
        if (playoutRef.current) {
          playoutRef.current.stop();
        }
        setIsPlaying(false);
        currentTimeRef.current = playStartPositionRef.current;
        setCurrentTime(playStartPositionRef.current);
        setActiveAnnotationId(null);
        return;
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [duration, audioBuffers, samplesPerPixel, annotations, continuousPlay]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Restart animation loop and reschedule playout when continuousPlay changes during playback
  // This ensures the loop always has the current continuousPlay value
  // and removes duration limits when switching to continuous play
  useEffect(() => {
    const reschedulePlayback = async () => {
      if (isPlaying && animationFrameRef.current && playoutRef.current) {
        // When toggling continuous play ON, reschedule playout without duration limit
        // so audio continues past the current annotation boundary
        if (continuousPlay) {
          const currentPos = currentTimeRef.current;

          // Stop current playout (which may have duration limit + pause callback)
          playoutRef.current.stop();
          stopAnimationLoop();

          // Initialize and restart from current position without duration limit
          await playoutRef.current.init();

          // Clear any existing playback complete callback
          playoutRef.current.setOnPlaybackComplete(() => {});

          const context = getContext();
          const timeNow = context.currentTime;
          playbackStartTimeRef.current = timeNow;
          audioStartPositionRef.current = currentPos;

          // Play without duration - will play to end of track
          playoutRef.current.play(timeNow, currentPos);
          startAnimationLoop();
        } else {
          // Just restart animation loop for continuous play OFF
          stopAnimationLoop();
          startAnimationLoop();
        }
      }
    };

    reschedulePlayback();
  }, [continuousPlay, isPlaying, startAnimationLoop, stopAnimationLoop]);

  // Resume playback after tracks change (e.g., after splitting a clip during playback)
  useEffect(() => {
    const resumePlayback = async () => {
      if (pendingResumeRef.current && playoutRef.current) {
        const { position } = pendingResumeRef.current;
        pendingResumeRef.current = null;

        await playoutRef.current.init();
        playoutRef.current.setOnPlaybackComplete(() => {});

        const context = getContext();
        const timeNow = context.currentTime;
        playbackStartTimeRef.current = timeNow;
        audioStartPositionRef.current = position;

        playoutRef.current.play(timeNow, position);
        setIsPlaying(true);
        startAnimationLoop();
      }
    };

    resumePlayback();
  }, [tracks, startAnimationLoop]);

  // Playback controls
  const play = useCallback(async (startTime?: number, playDuration?: number) => {
    if (!playoutRef.current || audioBuffers.length === 0) return;

    await playoutRef.current.init();

    // Resume Tone.js context if needed (required for Safari and user interaction)
    await toneStart();

    const actualStartTime = startTime ?? currentTimeRef.current;
    playStartPositionRef.current = actualStartTime;

    // Update currentTimeRef to match the actual start position
    // This ensures the animation loop starts from the correct position
    currentTimeRef.current = actualStartTime;

    // Clear any existing playback complete callback before stopping
    // Otherwise stopping will trigger the old callback and interfere with new playback
    playoutRef.current.setOnPlaybackComplete(() => {});

    // Stop any existing playback and animation loop before starting
    playoutRef.current.stop();
    stopAnimationLoop();

    // Record timing for accurate position tracking using Tone.js context
    const context = getContext();
    // Tone.js context wraps Web Audio - need to use .currentTime from wrapped context
    const startTimeNow = context.currentTime;
    playbackStartTimeRef.current = startTimeNow;
    audioStartPositionRef.current = actualStartTime;

    // Set playback end time if playing with duration (e.g., selection playback)
    playbackEndTimeRef.current = playDuration !== undefined ? actualStartTime + playDuration : null;

    // Don't set up playback complete callback for annotations
    // The animation loop handles stopping at annotation boundaries
    // This avoids callback timing issues when switching between annotations

    playoutRef.current.play(startTimeNow, actualStartTime, playDuration);
    setIsPlaying(true);
    startAnimationLoop();
  }, [audioBuffers.length, startAnimationLoop, stopAnimationLoop]);

  const pause = useCallback(() => {
    if (!playoutRef.current) return;

    // Calculate exact pause position using context.currentTime timing
    const elapsed = getContext().currentTime - playbackStartTimeRef.current;
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

  // Seek to a specific time - works whether playing or stopped
  const seekTo = useCallback((time: number) => {
    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(time, duration));

    // Update the current time state
    currentTimeRef.current = clampedTime;
    setCurrentTime(clampedTime);

    // If currently playing, stop and restart at the new position
    if (isPlaying && playoutRef.current) {
      playoutRef.current.stop();
      stopAnimationLoop();
      // Use play() which handles all the timing setup
      play(clampedTime);
    }
  }, [duration, isPlaying, play, stopAnimationLoop]);

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
      playoutRef.current.play(getContext().currentTime, start);
    }
  }, [isPlaying]);

  // Memoize setScrollContainer callback
  const setScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  const sampleRate = audioBuffers[0]?.sampleRate || 44100;
  const timeScaleHeight = timescale ? 30 : 0;
  const minimumPlaylistHeight = (tracks.length * waveHeight) + timeScaleHeight;

  // Split context values for performance optimization
  // High-frequency updates (currentTime) isolated from other state

  const animationValue: PlaybackAnimationContextValue = {
    isPlaying,
    currentTime,
    currentTimeRef,
    playbackStartTimeRef,
    audioStartPositionRef,
  };

  const stateValue: PlaylistStateContextValue = {
    continuousPlay,
    linkEndpoints,
    annotationsEditable,
    isAutomaticScroll,
    annotations,
    activeAnnotationId,
    selectionStart,
    selectionEnd,
    selectedTrackId,
  };

  const controlsValue: PlaylistControlsContextValue = {
    // Playback controls
    play,
    pause,
    stop,
    seekTo,
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
    setSelectedTrackId,

    // Time format
    setTimeFormat,
    formatTime,

    // Zoom
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,

    // Master volume
    setMasterVolume,

    // Automatic scroll
    setAutomaticScroll: (enabled: boolean) => {
      setIsAutomaticScroll(enabled);
    },
    setScrollContainer,
    scrollContainerRef,

    // Annotation controls
    setContinuousPlay,
    setLinkEndpoints,
    setAnnotationsEditable,
    setAnnotations,
    setActiveAnnotationId,
  };

  const dataValue: PlaylistDataContextValue = {
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
    playoutRef,
    samplesPerPixel,
    timeFormat,
    masterVolume,
    canZoomIn: zoom.canZoomIn,
    canZoomOut: zoom.canZoomOut,
    barWidth,
    barGap,
    progressBarWidth,
  };

  // Combined value for backwards compatibility
  const value: WaveformPlaylistContextValue = {
    ...animationValue,
    ...stateValue,
    ...controlsValue,
    ...dataValue,
  };

  // Merge user theme with default theme
  const mergedTheme = { ...defaultTheme, ...userTheme };

  return (
    <ThemeProvider theme={mergedTheme}>
      <PlaybackAnimationContext.Provider value={animationValue}>
        <PlaylistStateContext.Provider value={stateValue}>
          <PlaylistControlsContext.Provider value={controlsValue}>
            <PlaylistDataContext.Provider value={dataValue}>
              <WaveformPlaylistContext.Provider value={value}>
                {children}
              </WaveformPlaylistContext.Provider>
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

// Main hook that combines all contexts - use this for backwards compatibility
// or when you need access to multiple contexts
export const useWaveformPlaylist = () => {
  const context = useContext(WaveformPlaylistContext);
  if (!context) {
    throw new Error('useWaveformPlaylist must be used within WaveformPlaylistProvider');
  }
  return context;
};
