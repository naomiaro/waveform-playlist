import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipTrack,
  createTrack,
  createClipFromSeconds,
  type Fade,
  type TrackEffectsFunction,
  type WaveformDataObject,
  type RenderMode,
  type SpectrogramConfig,
  type ColorMapValue,
} from '@waveform-playlist/core';
import * as Tone from 'tone';

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

/** Build a ClipTrack from config + optional audioBuffer, preserving stable IDs. */
function buildTrackFromConfig(
  config: AudioTrackConfig,
  index: number,
  audioBuffer: AudioBuffer | undefined,
  stableIds: Map<number, { trackId: string; clipId: string }>,
  contextSampleRate: number = 48000
): ClipTrack | null {
  const buffer = audioBuffer ?? config.audioBuffer;

  // Determine if we have enough info to create the track
  // Prefer buffer/waveformData sample rate; fall back to the AudioContext's rate
  const sampleRate = buffer?.sampleRate ?? config.waveformData?.sample_rate ?? contextSampleRate;
  const sourceDuration =
    buffer?.duration ??
    config.waveformData?.duration ??
    (config.duration != null ? config.duration + (config.offset ?? 0) : undefined);

  if (sourceDuration === undefined) {
    console.warn(
      `[waveform-playlist] Track ${index + 1} ("${config.name ?? 'unnamed'}"): ` +
        `Cannot create track — provide duration, audioBuffer, or waveformData with duration.`
    );
    return null;
  }

  const clip = createClipFromSeconds({
    audioBuffer: buffer,
    sampleRate,
    sourceDuration,
    startTime: config.startTime ?? 0,
    duration: config.duration ?? sourceDuration,
    offset: config.offset ?? 0,
    name: config.name || `Track ${index + 1}`,
    fadeIn: config.fadeIn,
    fadeOut: config.fadeOut,
    waveformData: config.waveformData,
  });

  // Validate clip values
  if (isNaN(clip.startSample) || isNaN(clip.durationSamples) || isNaN(clip.offsetSamples)) {
    console.error(
      `[waveform-playlist] Invalid clip values for track ${index + 1} ("${config.name ?? 'unnamed'}"): ` +
        `startSample=${clip.startSample}, durationSamples=${clip.durationSamples}, offsetSamples=${clip.offsetSamples}`
    );
    return null;
  }

  const track: ClipTrack = {
    ...createTrack({
      name: config.name || `Track ${index + 1}`,
      clips: [clip],
      muted: config.muted ?? false,
      soloed: config.soloed ?? false,
      volume: config.volume ?? 1.0,
      pan: config.pan ?? 0,
      color: config.color,
    }),
    effects: config.effects,
    renderMode: config.renderMode,
    spectrogramConfig: config.spectrogramConfig,
    spectrogramColorMap: config.spectrogramColorMap,
  };

  // Preserve stable IDs across rebuilds so React doesn't unmount/remount tracks
  const existingIds = stableIds.get(index);
  if (existingIds) {
    track.id = existingIds.trackId;
    track.clips[0] = { ...track.clips[0], id: existingIds.clipId };
  } else {
    stableIds.set(index, { trackId: track.id, clipId: track.clips[0].id });
  }

  return track;
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
      const track = buildTrackFromConfig(
        configs[i],
        i,
        loadedBuffers.get(i),
        stableIdsRef.current,
        contextSampleRateRef.current
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
