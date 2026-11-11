/**
 * useDynamicTracks — imperative hook for runtime track additions.
 *
 * Complements `useAudioTracks` (declarative, configs-driven) with an
 * imperative `addTracks()` API for dynamic loading (drag-and-drop, file pickers).
 *
 * Placeholder tracks appear instantly while audio decodes in parallel.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ClipTrack, createTrack, createClipFromSeconds } from '@waveform-playlist/core';
import { getGlobalAudioContext } from '@waveform-playlist/playout';

/** A source that can be decoded into a track. */
export type TrackSource = File | Blob | string | { src: string; name?: string };

/** Info about a track that failed to load. */
export interface TrackLoadError {
  /** Display name of the source that failed. */
  name: string;
  /** The underlying error. */
  error: Error;
}

export interface UseDynamicTracksReturn {
  /**
   * Current tracks array (placeholders + loaded). Pass to WaveformPlaylistProvider.
   * Placeholder tracks have `clips: []` and names ending with " (loading...)".
   */
  tracks: ClipTrack[];
  /** Add one or more sources — creates placeholder tracks immediately. */
  addTracks: (sources: TrackSource[]) => void;
  /** Remove a track by its id. Aborts in-flight fetch/decode if still loading. */
  removeTrack: (trackId: string) => void;
  /** Number of sources currently decoding. */
  loadingCount: number;
  /** True when any source is still decoding. */
  isLoading: boolean;
  /** Tracks that failed to load (removed from `tracks` automatically). */
  errors: TrackLoadError[];
}

/** Extract a display name from a TrackSource. */
function getSourceName(source: TrackSource): string {
  if (source instanceof File) {
    return source.name.replace(/\.[^/.]+$/, '');
  }
  if (source instanceof Blob) {
    return 'Untitled';
  }
  if (typeof source === 'string') {
    return (
      source
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') ?? 'Untitled'
    );
  }
  return (
    source.name ??
    source.src
      .split('/')
      .pop()
      ?.replace(/\.[^/.]+$/, '') ??
    'Untitled'
  );
}

/** Decode a TrackSource into an AudioBuffer + clean name. */
async function decodeSource(
  source: TrackSource,
  audioContext: AudioContext,
  signal?: AbortSignal
): Promise<{ audioBuffer: AudioBuffer; name: string }> {
  const name = getSourceName(source);

  // File and Blob: read arrayBuffer directly (not abortable, but we check signal after)
  if (source instanceof Blob) {
    const arrayBuffer = await source.arrayBuffer();
    signal?.throwIfAborted();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return { audioBuffer, name };
  }

  const url = typeof source === 'string' ? source : source.src;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  signal?.throwIfAborted();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return { audioBuffer, name };
}

export function useDynamicTracks(): UseDynamicTracksReturn {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [errors, setErrors] = useState<TrackLoadError[]>([]);
  const cancelledRef = useRef(false);
  /** Track IDs currently decoding — for accurate loadingCount on removal. */
  const loadingIdsRef = useRef(new Set<string>());
  /** Per-track AbortControllers for in-flight fetches — keyed by track ID. */
  const abortControllersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    // Cleared on every setup: StrictMode runs setup, cleanup, setup on one
    // instance, and a mark left by that cleanup dropped every later decode.
    cancelledRef.current = false;
    const controllers = abortControllersRef.current;
    return () => {
      cancelledRef.current = true;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  const addTracks = useCallback((sources: TrackSource[]) => {
    if (sources.length === 0) return;

    const audioContext = getGlobalAudioContext();

    // 1. Create placeholder tracks immediately
    const placeholders = sources.map((source) => ({
      track: createTrack({ name: `${getSourceName(source)} (loading...)`, clips: [] }),
      source,
    }));

    setTracks((prev) => [...prev, ...placeholders.map((p) => p.track)]);
    setLoadingCount((prev) => prev + sources.length);

    // 2. Decode each source in parallel (fire-and-forget per source)
    for (const { track, source } of placeholders) {
      loadingIdsRef.current.add(track.id);
      const controller = new AbortController();
      abortControllersRef.current.set(track.id, controller);

      (async () => {
        try {
          const { audioBuffer, name } = await decodeSource(source, audioContext, controller.signal);
          const clip = createClipFromSeconds({
            audioBuffer,
            startTime: 0,
            duration: audioBuffer.duration,
            offset: 0,
            name,
          });

          // Guard: skip state update if hook unmounted or track was removed while decoding
          if (!cancelledRef.current && loadingIdsRef.current.has(track.id)) {
            setTracks((prev) =>
              prev.map((t) => (t.id === track.id ? { ...t, name, clips: [clip] } : t))
            );
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          console.warn('[waveform-playlist] Error loading audio:', error);
          // Guard: skip state update if hook unmounted or track was removed while decoding
          if (!cancelledRef.current && loadingIdsRef.current.has(track.id)) {
            setTracks((prev) => prev.filter((t) => t.id !== track.id));
            setErrors((prev) => [
              ...prev,
              {
                name: getSourceName(source),
                error: error instanceof Error ? error : new Error(String(error)),
              },
            ]);
          }
        } finally {
          abortControllersRef.current.delete(track.id);
          if (!cancelledRef.current && loadingIdsRef.current.delete(track.id)) {
            setLoadingCount((prev) => prev - 1);
          }
        }
      })();
    }
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    // Abort in-flight fetch/decode and update loading state
    const controller = abortControllersRef.current.get(trackId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(trackId);
    }
    if (loadingIdsRef.current.delete(trackId)) {
      setLoadingCount((prev) => prev - 1);
    }
  }, []);

  return {
    tracks,
    addTracks,
    removeTrack,
    loadingCount,
    isLoading: loadingCount > 0,
    errors,
  };
}
