import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipTrack,
  type Fade,
  type TrackEffectsFunction,
  type WaveformDataObject,
  type RenderMode,
  type SpectrogramConfig,
  type ColorMapValue,
} from '@waveform-playlist/core';
import * as Tone from 'tone';
import { buildTrackFromConfig } from './buildTrackFromConfig';

/**
 * Configuration for a single audio track to load
 *
 * Audio can be provided in three ways:
 * 1. `src` - URL to fetch and decode (standard loading)
 * 2. `audioBuffer` - Pre-loaded AudioBuffer (skip fetch/decode)
 * 3. `waveformData` only - Peaks-first rendering (audio loads later)
 *
 * For peaks-first rendering, just provide `waveformData` - the sample rate
 * and duration are derived from the waveform data automatically.
 */
export interface AudioTrackConfig {
  /** URL to audio file - used if audioBuffer not provided */
  src?: string;
  /** Pre-loaded AudioBuffer - skips fetch/decode if provided */
  audioBuffer?: AudioBuffer;
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  effects?: TrackEffectsFunction;
  // Multi-clip support
  startTime?: number; // When the clip starts on the timeline (default: 0)
  duration?: number; // Duration of the clip (default: full audio duration)
  offset?: number; // Offset into the source audio file (default: 0)
  // Fade support
  fadeIn?: Fade; // Fade in configuration
  fadeOut?: Fade; // Fade out configuration
  // Pre-computed waveform data (BBC audiowaveform format)
  // For peaks-first rendering, provide this without audioBuffer/src
  // Sample rate and duration are derived from waveformData.sample_rate and waveformData.duration
  waveformData?: WaveformDataObject;
  /** Visualization render mode: 'waveform' | 'spectrogram' | 'both'. Default: 'waveform' */
  renderMode?: RenderMode;
  /** Spectrogram configuration (FFT size, window, frequency scale, etc.) */
  spectrogramConfig?: SpectrogramConfig;
  /** Spectrogram color map name or custom color array */
  spectrogramColorMap?: ColorMapValue;
}

/**
 * Options for useAudioTracks hook
 */
export interface UseAudioTracksOptions {
  /**
   * When true, all tracks render immediately as placeholders with clip geometry
   * from the config. Audio fills in progressively as files decode, and peaks
   * render as each buffer becomes available. Use with `deferEngineRebuild={loading}`
   * on the provider for a single engine build when all tracks are ready.
   *
   * Requires `duration` or `waveformData` in each config so clip dimensions are known upfront.
   * Default: false
   */
  immediate?: boolean;
  /** @deprecated Use `immediate` instead. */
  progressive?: boolean;
}

/**
 * Hook to load audio from URLs and convert to ClipTrack format
 *
 * This hook fetches audio files, decodes them, and creates ClipTrack objects
 * with a single clip per track. Supports custom positioning for multi-clip arrangements.
 *
 * @param configs - Array of audio track configurations
 * @param options - Optional configuration for loading behavior
 * @returns Object with tracks array, loading state, and progress info
 *
 * @example
 * ```typescript
 * // Basic usage (clips positioned at start)
 * const { tracks, loading, error } = useAudioTracks([
 *   { src: 'audio/vocals.mp3', name: 'Vocals' },
 *   { src: 'audio/drums.mp3', name: 'Drums' },
 * ]);
 *
 * // Immediate rendering with deferred engine build (recommended for multi-track)
 * const { tracks, loading } = useAudioTracks(
 *   [
 *     { src: 'audio/vocals.mp3', name: 'Vocals', duration: 30 },
 *     { src: 'audio/drums.mp3', name: 'Drums', duration: 30 },
 *   ],
 *   { immediate: true }
 * );
 * // All tracks render instantly as placeholders, peaks fill in as files load
 * return (
 *   <WaveformPlaylistProvider tracks={tracks} deferEngineRebuild={loading}>
 *     ...
 *   </WaveformPlaylistProvider>
 * );
 *
 * // Pre-loaded AudioBuffer (skip fetch/decode)
 * const { tracks } = useAudioTracks([
 *   { audioBuffer: myPreloadedBuffer, name: 'Pre-loaded' },
 * ]);
 *
 * // Peaks-first rendering (instant visual, audio loads later)
 * const { tracks } = useAudioTracks([
 *   { waveformData: preloadedPeaks, name: 'Peaks Only' },  // Renders immediately
 * ]);
 * ```
 */
export function useAudioTracks(configs: AudioTrackConfig[], options: UseAudioTracksOptions = {}) {
  const { immediate = false, progressive = false } = options;
  // progressive is a deprecated alias for immediate
  const isImmediate = immediate || progressive;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalCount = configs.length;

  // For immediate mode: store loaded AudioBuffers by config index
  const [loadedBuffers, setLoadedBuffers] = useState<Map<number, AudioBuffer>>(new Map());

  // Stable track/clip IDs across rebuilds (immediate mode)
  const stableIdsRef = useRef<Map<number, { trackId: string; clipId: string }>>(new Map());

  // AudioContext sample rate, populated once loadTracks runs.
  // Used as fallback when neither buffer nor waveformData provides a sample rate.
  const contextSampleRateRef = useRef<number>(48000);

  // For immediate mode: derive tracks from configs + loaded buffers.
  // Runs on mount (creates placeholders) and each time a buffer loads (attaches audioBuffer).
  const derivedTracks = useMemo(() => {
    if (!isImmediate) return null;

    const result: ClipTrack[] = [];
    for (let i = 0; i < configs.length; i++) {
      // A config whose decode hasn't arrived yet is an EXPECTED transient
      // state in immediate mode — it builds on a later pass once the buffer
      // lands. Suppress the missing-duration warning for those so each
      // rebuild pass doesn't warn about every still-pending track (the
      // count grows quadratically with track count otherwise). Configs with
      // nothing left to load (no src, no buffer coming) keep the warning —
      // for them, missing duration is a real misconfiguration.
      const pendingDecode =
        !loadedBuffers.has(i) && !configs[i].audioBuffer && configs[i].src != null;
      const track = buildTrackFromConfig(
        configs[i],
        i,
        loadedBuffers.get(i),
        stableIdsRef.current,
        contextSampleRateRef.current,
        { suppressMissingDurationWarning: pendingDecode }
      );
      if (track) result.push(track);
    }
    return result;
  }, [isImmediate, configs, loadedBuffers]);

  // Initialize tracks with derivedTracks so immediate-mode placeholders
  // appear on the very first render (no flash of empty content).
  const [tracks, setTracks] = useState<ClipTrack[]>(derivedTracks ?? []);

  // Sync derived tracks into state synchronously during render (not useEffect).
  // useEffect sync causes a 1-render lag — if deferEngineRebuild flips in a
  // separate batch, the provider sees stale tracks and rebuilds the engine twice.
  const prevDerivedRef = useRef(derivedTracks);
  if (derivedTracks !== prevDerivedRef.current) {
    prevDerivedRef.current = derivedTracks;
    if (derivedTracks) setTracks(derivedTracks);
  }

  useEffect(() => {
    if (configs.length === 0) {
      setTracks([]);
      setLoading(false);
      setLoadedCount(0);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);
        setLoadedCount(0);

        if (isImmediate) {
          setLoadedBuffers(new Map());
        }

        const audioContext = Tone.getContext().rawContext as AudioContext;
        contextSampleRateRef.current = audioContext.sampleRate;

        // Process each config
        const loadPromises = configs.map(async (config, index) => {
          // Case 1: Already have audioBuffer - no loading needed
          if (config.audioBuffer) {
            if (isImmediate && !cancelled) {
              setLoadedBuffers((prev) => {
                const next = new Map(prev);
                next.set(index, config.audioBuffer!);
                return next;
              });
              setLoadedCount((prev) => prev + 1);
              return;
            }

            return buildTrackFromConfig(
              config,
              index,
              config.audioBuffer,
              stableIdsRef.current,
              audioContext.sampleRate
            );
          }

          // Case 2: Have waveformData but no src - peaks-only (no audio to load)
          if (!config.src && config.waveformData) {
            if (isImmediate && !cancelled) {
              // No buffer to load — track is already created from waveformData
              setLoadedCount((prev) => prev + 1);
              return;
            }

            return buildTrackFromConfig(
              config,
              index,
              undefined,
              stableIdsRef.current,
              audioContext.sampleRate
            );
          }

          // Case 3: Need to fetch and decode audio from src
          if (!config.src) {
            throw new Error(`Track ${index + 1}: Must provide src, audioBuffer, or waveformData`);
          }

          const response = await fetch(config.src, { signal: abortController.signal });
          if (!response.ok) {
            throw new Error(`Failed to fetch ${config.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Validate audioBuffer
          if (!audioBuffer || !audioBuffer.sampleRate || !audioBuffer.duration) {
            throw new Error(`Invalid audio buffer for ${config.src}`);
          }

          if (isImmediate && !cancelled) {
            // Store buffer — useMemo will derive the updated track
            setLoadedBuffers((prev) => {
              const next = new Map(prev);
              next.set(index, audioBuffer);
              return next;
            });
            setLoadedCount((prev) => prev + 1);
            return;
          }

          return buildTrackFromConfig(
            config,
            index,
            audioBuffer,
            stableIdsRef.current,
            audioContext.sampleRate
          );
        });

        const loadedTracks = await Promise.all(loadPromises);

        if (!cancelled) {
          // For non-immediate mode: set all tracks at once
          if (!isImmediate) {
            const validTracks = loadedTracks.filter((t): t is ClipTrack => t != null);
            setTracks(validTracks);
            setLoadedCount(validTracks.length);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error loading audio';
          setError(errorMessage);
          setLoading(false);
          console.error(`[waveform-playlist] Error loading audio tracks: ${errorMessage}`);
        }
      }
    };

    loadTracks();

    // Cleanup: prevent state updates and abort in-flight fetches on unmount
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [configs, isImmediate]);

  return { tracks, loading, error, loadedCount, totalCount };
}
