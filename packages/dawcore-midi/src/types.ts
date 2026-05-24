/**
 * Options accepted by `editor.loadMidi(source, options)` on `<daw-editor>`.
 */
export interface MidiLoadOptions {
  /** Timeline position in seconds applied to every created clip (default: 0). */
  startTime?: number;
  /** AbortSignal forwarded to fetch() when the source is a URL. */
  signal?: AbortSignal;
}

/**
 * Result returned from `editor.loadMidi(...)`.
 */
export interface MidiLoadResult {
  /** IDs of the `<daw-track>` elements created, in MIDI track order. */
  trackIds: string[];
  /** Tempo from the MIDI header (defaults to 120 if absent). */
  bpm: number;
  /** Time signature [numerator, denominator] (defaults to [4, 4] if absent). */
  timeSignature: [number, number];
  /** Total duration of the loaded MIDI in seconds (max across tracks). */
  duration: number;
  /** Song name from the MIDI header — empty string when not set. */
  name: string;
}
