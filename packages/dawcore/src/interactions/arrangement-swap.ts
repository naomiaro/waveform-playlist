/**
 * Setting `editor.arrangement` (#848 PR 3, P5): the editor plays the
 * arrangement it is given alone, like `video.srcObject`, and goes back to its
 * own on `null`. One assignment for the app; this module is the sequence.
 */
import { isArrangement, type Arrangement } from '@waveform-playlist/engine';

/** What the swap needs from `<daw-editor>`. */
export interface ArrangementSwapHost {
  readonly _ownArrangement: Arrangement;
  readonly _handedIn: Arrangement | null;
  readonly isRecording: boolean;
  readonly isPlaying: boolean;
  /** The arrangement played now (handed-in ?? own). */
  readonly _arrangement: Arrangement;
  _cancelDrags(): boolean;
  stop(): void;
  /** Let the engine go without disposing the adapter (`dispose({ keepAdapter: true })`). */
  _releaseEngine(): void;
  /** Dispose the effects chain of a track id. */
  _disposeTrackChain(trackId: string): void;
  /** Point the editor at `next` (null: its own) and follow it (subscriptions, a fresh announcer). */
  _playArrangement(next: Arrangement | null): void;
  /** Build an engine on the arrangement played now, when connected with an adapter. */
  _buildEngineIfReady(): void;
}

/**
 * The value to play: `null` for the editor's own arrangement (given `null`,
 * `undefined` or the own arrangement itself). Throws a `TypeError` for a
 * value that is not an arrangement.
 */
export function normalizeHandedIn(value: unknown, own: Arrangement): Arrangement | null {
  if (value === null || value === undefined || value === own) return null;
  if (!isArrangement(value)) {
    throw new TypeError(
      '[dawcore] editor.arrangement must be an arrangement made by createArrangement() ' +
        "(@waveform-playlist/engine), or null for the editor's own."
    );
  }
  return value as Arrangement;
}

/**
 * Play `next` (null: the editor's own arrangement). Refused during a take: the
 * take's track would be in neither. Drags are cancelled, playback stops, the
 * engine is let go without its adapter and a new one is built on `next` with
 * the same adapter; effects chains of tracks `next` does not hold are
 * disposed. The editor never disposes or clears an arrangement it was handed.
 */
export function swapArrangement(host: ArrangementSwapHost, next: Arrangement | null): void {
  if (next === host._handedIn) return;
  if (host.isRecording) {
    console.warn(
      '[dawcore] editor.arrangement was not changed: a take is recording. ' +
        'Set it after stopRecording() resolves.'
    );
    return;
  }
  host._cancelDrags();
  if (host.isPlaying) host.stop();
  const before = host._arrangement.getTracks().map((t) => t.id);
  host._releaseEngine();
  host._playArrangement(next);
  const kept = new Set(host._arrangement.getTracks().map((t) => t.id));
  for (const id of before) if (!kept.has(id)) host._disposeTrackChain(id);
  host._buildEngineIfReady();
}
