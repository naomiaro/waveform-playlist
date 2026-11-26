/**
 * MIDI loading logic extracted from daw-editor. Operates on the editor via a
 * narrow host interface (`addTrack`, `_discardTrack`, `_operationSignal`) —
 * `<daw-editor>` satisfies it.
 *
 * Numbered steps below match the Data Flow diagram in
 * `docs/specs/2026-05-23-dawcore-load-midi-design.md`.
 */

import type { MidiLoadOptions, MidiLoadResult } from '@dawcore/midi';
import type { EditorCallOptions, TrackConfig } from '../types';
import { installCommand } from '../utils/install-command';
import { reasonOf } from './abort';

export type { MidiLoadOptions, MidiLoadResult };

/**
 * Minimal host surface needed by `loadMidiImpl`. `<daw-editor>` satisfies this
 * structurally. A track `addTrack` added is taken out for good on a failure
 * or an abort; a track whose entry was refused never entered, so there is
 * nothing to remove (#848: `addTrack` makes no element).
 */
export interface MidiLoaderHost {
  /** Resolves with the track id once the track has entered (#848). */
  addTrack(config: TrackConfig, options?: EditorCallOptions): Promise<string>;
  /** Take a track out for good: no undo step, and no undo brings it back. */
  _discardTrack(trackId: string): void;
  /** The caller's signal combined with the arrangement played (D6). */
  _operationSignal(signal?: AbortSignal): AbortSignal;
}

// Built when thrown, so a bundler can drop it with the code that throws it.
const installHint = (): string =>
  '@dawcore/midi is required for loadMidi(). Install with: ' + installCommand('@dawcore/midi');

/**
 * Loads a `.mid` file (URL or `File`) and adds N tracks, one per note-bearing
 * MIDI track. On any per-track failure or an abort, every track added during
 * this call is removed for good (no undo step), so the editor is as before
 * the call.
 *
 * `options.signal` reaches the fetch and the parse and, combined with the
 * arrangement played (a swap aborts it too), the `addTrack` waits (#848, D6).
 */
export async function loadMidiImpl(
  host: MidiLoaderHost,
  source: string | File,
  options: MidiLoadOptions = {}
): Promise<MidiLoadResult> {
  // Reject NaN / Infinity / negative startTime up front. Without this, every
  // clip silently inherits the bogus value and the timeline corrupts.
  const startTime = options.startTime ?? 0;
  if (!Number.isFinite(startTime) || startTime < 0) {
    throw new RangeError(
      'loadMidi: startTime must be a non-negative finite number (got ' +
        String(options.startTime) +
        ')'
    );
  }

  // (1) Dynamic-import the optional peer dep. Log the original error so
  // debugging isn't blocked when the failure is something other than
  // "not installed" (broken exports map, 404 chunk, CSP, etc.). Targeting
  // ES2020 means we can't use Error.cause yet; console.warn carries the
  // diagnostic detail.
  const signal = host._operationSignal(options.signal);
  if (signal.aborted) throw reasonOf(signal);
  let midiModule: typeof import('@dawcore/midi');
  try {
    midiModule = await import('@dawcore/midi');
  } catch (originalErr) {
    console.warn('[dawcore] @dawcore/midi dynamic import failed: ' + String(originalErr));
    throw new Error(installHint());
  }
  const { parseMidiUrl, parseMidiFile } = midiModule;

  // (2) Branch on source type. Wrap the File path so a failed disk read
  // surfaces with file context instead of a bare DOMException.
  let parsed;
  if (typeof source === 'string') {
    parsed = await parseMidiUrl(source, undefined, signal);
  } else {
    let buffer: ArrayBuffer;
    try {
      buffer = await source.arrayBuffer();
    } catch (err) {
      throw new Error(
        'loadMidi: failed to read File "' +
          source.name +
          '" (' +
          source.size +
          ' bytes): ' +
          String(err)
      );
    }
    parsed = parseMidiFile(buffer);
  }
  if (signal.aborted) throw reasonOf(signal);

  // (4) Concurrent addTrack with allSettled so we can wait for every settlement
  // before deciding. Promise.all would early-reject while other addTrack calls
  // keep running, leaving orphan tracks after cleanup.
  const settlements = await Promise.allSettled(
    parsed.tracks.map((t) =>
      host.addTrack(
        {
          name: t.name,
          kind: 'midi',
          clips: [
            {
              midiNotes: t.notes,
              midiChannel: t.channel,
              midiProgram: t.programNumber,
              start: startTime,
            },
          ],
        },
        { signal }
      )
    )
  );

  // (5) Partition fulfilled vs rejected. Capture EVERY rejection (not just
  // the first) for diagnosability of multi-track failures.
  const succeeded: string[] = [];
  const rejections: unknown[] = [];
  for (const s of settlements) {
    if (s.status === 'fulfilled') {
      succeeded.push(s.value);
    } else {
      rejections.push(s.reason);
    }
  }

  // (6) On any rejection: remove every track added during this call, then
  // throw a summary Error and console.warn each additional rejection so
  // multi-track failure modes stay diagnosable.
  if (rejections.length > 0) {
    for (const trackId of succeeded) {
      try {
        host._discardTrack(trackId);
      } catch (cleanupErr) {
        console.warn('[dawcore] loadMidi cleanup failed for a track: ' + String(cleanupErr));
      }
    }
    // Aborted: the abort is the outcome, not the per-track rejections it caused.
    if (signal.aborted) throw reasonOf(signal);

    // Log every rejection beyond the first so multi-track failure modes are
    // diagnosable (the thrown Error only carries the first). AggregateError
    // would be ideal here but requires ES2021+; defer until the project
    // bumps its lib target.
    for (let i = 1; i < rejections.length; i++) {
      console.warn(
        '[dawcore] loadMidi: additional track failure (' +
          i +
          '): ' +
          stringifyReason(rejections[i])
      );
    }
    const first = rejections[0];
    if (rejections.length > 1) {
      const message =
        'loadMidi: ' +
        rejections.length +
        ' of ' +
        settlements.length +
        ' tracks failed; first: ' +
        (first instanceof Error ? first.message : stringifyReason(first));
      throw new Error(message);
    }
    throw first instanceof Error ? first : new Error(stringifyReason(first));
  }

  // (7) Build the result.
  return {
    trackIds: succeeded,
    bpm: parsed.bpm,
    timeSignature: parsed.timeSignature,
    duration: parsed.duration,
    name: parsed.name,
  };
}

/**
 * Render a non-Error rejection reason as a useful string. Plain `String(x)`
 * gives `"[object Object]"` for object rejections, losing all structured info.
 */
function stringifyReason(reason: unknown): string {
  if (reason === null) return 'null';
  if (reason === undefined) return 'undefined';
  if (typeof reason === 'object') {
    try {
      return JSON.stringify(reason);
    } catch {
      return Object.prototype.toString.call(reason);
    }
  }
  return String(reason);
}
