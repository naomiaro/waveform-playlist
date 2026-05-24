/**
 * Options accepted by `editor.loadMidi(source, options)` on `<daw-editor>`.
 */
export interface MidiLoadOptions {
  /**
   * Timeline position in seconds applied to every created clip (default: 0).
   * Must be a non-negative finite number; `loadMidi` throws RangeError otherwise.
   */
  startTime?: number;
  /**
   * AbortSignal forwarded to `fetch()` when the source is a URL.
   *
   * Scope is **fetch-only**: aborting after parsing has finished does NOT
   * cancel the in-flight `addTrack` calls (a documented v1 limitation —
   * `addTrack` itself doesn't yet accept a signal). For a URL source,
   * pre-parse abort propagates as a `DOMException` named `AbortError`.
   */
  signal?: AbortSignal;
}

/**
 * Result returned from `editor.loadMidi(...)`. All fields are frozen
 * snapshots of what was loaded — treat as immutable.
 */
export interface MidiLoadResult {
  /** IDs of the `<daw-track>` elements created, in MIDI track order. */
  readonly trackIds: readonly string[];
  /** Tempo from the MIDI header (defaults to 120 if absent). */
  readonly bpm: number;
  /** Time signature [numerator, denominator] (defaults to [4, 4] if absent). */
  readonly timeSignature: readonly [number, number];
  /** Total duration of the loaded MIDI in seconds (max across tracks; 0 if the file has no note-bearing tracks). */
  readonly duration: number;
  /** Song name from the MIDI header — empty string when not set. */
  readonly name: string;
}
