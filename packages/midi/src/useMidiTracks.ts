import { useState, useEffect, useRef } from 'react';
import {
  type ClipTrack,
  type MidiNoteData,
  createClipFromSeconds,
  createTrack,
} from '@waveform-playlist/core';
import { parseMidiFile } from '@dawcore/midi';
import { midiConfigsEqual } from './midiConfigsEqual';

/**
 * Configuration for a single MIDI track to load.
 *
 * MIDI data can be provided in two ways:
 * 1. `src` — URL to a .mid file (fetched, parsed with @tonejs/midi)
 * 2. `midiNotes` — Pre-parsed notes (skip fetch+parse)
 */
export interface MidiTrackConfig {
  /** URL to .mid file */
  src?: string;
  /** Pre-parsed MIDI notes (skip fetch+parse) */
  midiNotes?: MidiNoteData[];
  /** Track display name */
  name?: string;
  /** Whether this track is muted */
  muted?: boolean;
  /** Whether this track is soloed */
  soloed?: boolean;
  /** Track volume (default 1.0) */
  volume?: number;
  /** Stereo pan (default 0) */
  pan?: number;
  /** Track color */
  color?: string;
  /** Clip position on timeline in seconds (default 0) */
  startTime?: number;
  /** Override clip duration in seconds (default: derived from last note) */
  duration?: number;
  /** Merge all MIDI tracks from the file into one ClipTrack (default false) */
  flatten?: boolean;
}

export interface UseMidiTracksReturn {
  /** Loaded ClipTrack array with midiNotes on clips */
  tracks: ClipTrack[];
  /** Whether any tracks are still loading */
  loading: boolean;
  /** Error message if loading failed, null otherwise */
  error: string | null;
  /** Number of tracks that have finished loading */
  loadedCount: number;
  /** Total number of tracks (known after parsing) */
  totalCount: number;
}

export interface UseMidiTracksOptions {
  /** Sample rate for sample-based timeline positioning. Pass AudioContext.sampleRate. */
  sampleRate: number;
}

/**
 * Hook to load MIDI files and convert to ClipTrack format with midiNotes.
 *
 * All tracks are returned at once after loading completes. This ensures
 * all track controls and layout containers appear simultaneously in React,
 * while canvas rendering is deferred to the UI layer for progressive drawing.
 *
 * `configs` is compared by value, so it can be written inline: tracks reload
 * only when a config actually changes, not when the array is a new object.
 * Several `src` files are fetched in parallel; tracks keep the config order.
 *
 * @example
 * ```typescript
 * const { tracks, loading, error } = useMidiTracks(
 *   [{ src: '/music/song.mid', name: 'Piano' }],
 *   { sampleRate: audioContext.sampleRate }
 * );
 *
 * // Pre-parsed notes (no fetch)
 * const { tracks } = useMidiTracks(
 *   [{ midiNotes: myNotes, name: 'Synth Lead', duration: 30 }],
 *   { sampleRate: 48000 }
 * );
 * ```
 */
/** End of the last note, in seconds. A loop, not `Math.max(...)`: a spread of a
 * very large note list exceeds the engine's argument limit. */
function lastNoteEnd(notes: MidiNoteData[]): number {
  let end = 0;
  for (const note of notes) {
    const noteEnd = note.time + note.duration;
    if (noteEnd > end) end = noteEnd;
  }
  return end;
}

export function useMidiTracks(
  configsProp: MidiTrackConfig[],
  options: UseMidiTracksOptions
): UseMidiTracksReturn {
  // The effect below is keyed on `configs`. Keep the previous array while the new
  // one describes the same tracks, so an inline array literal (a new identity on
  // every render) does not re-run the effect, which sets state, which renders,
  // which re-runs the effect.
  const [configs, setConfigs] = useState(configsProp);
  if (configs !== configsProp && !midiConfigsEqual(configs, configsProp)) {
    setConfigs(configsProp);
  }

  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(configs.length);

  // Cache fetched ArrayBuffers by URL so re-parses skip the network.
  const bufferCacheRef = useRef(new Map<string, ArrayBuffer>());

  useEffect(() => {
    if (configs.length === 0) {
      setTracks([]);
      setLoading(false);
      setLoadedCount(0);
      setTotalCount(0);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const createTrackFromNotes = (
      config: MidiTrackConfig,
      notes: MidiNoteData[],
      trackName: string,
      noteDuration: number,
      midiChannel?: number,
      midiProgram?: number
    ): ClipTrack => {
      const sampleRate = options.sampleRate;
      const clipDuration = config.duration ?? noteDuration;

      const clip = createClipFromSeconds({
        startTime: config.startTime ?? 0,
        duration: clipDuration,
        sampleRate,
        sourceDuration: clipDuration,
        midiNotes: notes,
        midiChannel,
        midiProgram,
        name: trackName,
      });

      return createTrack({
        name: trackName,
        clips: [clip],
        muted: config.muted ?? false,
        soloed: config.soloed ?? false,
        volume: config.volume ?? 1.0,
        pan: config.pan ?? 0,
        color: config.color,
      });
    };

    // Check if all src URLs are already cached — if so, skip loading state
    // to avoid flashing the loading overlay on re-parse-only changes.
    const allCached = configs.every((c) => !c.src || bufferCacheRef.current.has(c.src));

    const loadTracks = async () => {
      try {
        if (!allCached) {
          setLoading(true);
          setLoadedCount(0);
        }
        setError(null);

        for (const config of configs) {
          if (!config.midiNotes && !config.src) {
            throw new Error('MIDI track config must provide src or midiNotes');
          }
        }

        // Fetch every file at once. A URL used by several configs is fetched once.
        const inflight = new Map<string, Promise<ArrayBuffer>>();
        const loadBuffer = (src: string): Promise<ArrayBuffer> => {
          const cached = bufferCacheRef.current.get(src);
          if (cached) return Promise.resolve(cached);
          const pending = inflight.get(src);
          if (pending) return pending;
          const request = (async () => {
            const response = await fetch(src, { signal: abortController.signal });
            if (!response.ok) {
              throw new Error(`Failed to fetch ${src}: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            bufferCacheRef.current.set(src, buffer);
            return buffer;
          })();
          inflight.set(src, request);
          return request;
        };
        const buffers = await Promise.all(
          configs.map((config) =>
            !config.midiNotes && config.src ? loadBuffer(config.src) : undefined
          )
        );
        if (cancelled) return;

        // Build in config order, whatever order the fetches finished in.
        const allTracks: ClipTrack[] = [];
        configs.forEach((config, index) => {
          const buffer = buffers[index];
          if (config.midiNotes) {
            // Pre-parsed notes — no fetch needed
            const notes = config.midiNotes;
            const trackName = config.name || 'MIDI Track';
            allTracks.push(createTrackFromNotes(config, notes, trackName, lastNoteEnd(notes)));
          } else if (buffer) {
            const parsed = parseMidiFile(buffer, {
              flatten: config.flatten,
            });
            for (const parsedTrack of parsed.tracks) {
              allTracks.push(
                createTrackFromNotes(
                  config,
                  parsedTrack.notes,
                  parsedTrack.name,
                  parsedTrack.duration,
                  parsedTrack.channel,
                  parsedTrack.programNumber
                )
              );
            }
          }
        });

        if (!cancelled) {
          setTracks(allTracks);
          setLoadedCount(allTracks.length);
          setTotalCount(allTracks.length);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error loading MIDI';
          setError(errorMessage);
          setLoading(false);
          console.error('Error loading MIDI tracks:', err);
          // One file failed: stop the others still in flight.
          abortController.abort();
        }
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [configs, options.sampleRate]);

  return { tracks, loading, error, loadedCount, totalCount };
}
