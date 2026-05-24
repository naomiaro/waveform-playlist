/**
 * MIDI loading logic extracted from daw-editor. Operates on the editor via a
 * narrow host interface (`addTrack` + `querySelectorAll`) — `<daw-editor>`
 * satisfies it without any new public surface.
 *
 * Numbered steps below match the Data Flow diagram in
 * `docs/specs/2026-05-23-dawcore-load-midi-design.md`.
 */

import type { MidiLoadOptions, MidiLoadResult } from '@dawcore/midi';
import type { TrackConfig } from '../types';
import type { DawTrackElement } from '../elements/daw-track';

export type { MidiLoadOptions, MidiLoadResult };

/**
 * Minimal host surface needed by `loadMidiImpl`. `<daw-editor>` satisfies this
 * structurally. `querySelectorAll` is needed for cleanup-on-failure so the
 * loader can identify `<daw-track>` elements appended during this call (both
 * those whose `addTrack` resolved and those that rejected after `_loadTrack`
 * fired `daw-track-error` — the latter aren't in the `addTrack` resolution
 * value, so we need DOM observation to find them).
 */
export interface MidiLoaderHost {
  addTrack(config: TrackConfig): Promise<DawTrackElement>;
  querySelectorAll(selector: string): NodeListOf<Element>;
}

const INSTALL_HINT =
  '@dawcore/midi is required for loadMidi(). Install with: npm install @dawcore/midi';

/**
 * Loads a `.mid` file (URL or `File`) and creates N `<daw-track>` elements,
 * one per note-bearing MIDI track. On any per-track failure, every
 * `<daw-track>` appended during this call is removed so the editor returns
 * to its pre-call state (cleanup-on-failure — covers both `addTrack`
 * successes and the elements that `addTrack` left in the DOM before its
 * promise rejected).
 *
 * AbortSignal is forwarded to the fetch phase only. Aborting after parsing
 * does not cancel in-flight `addTrack` calls (documented limitation).
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
  let midiModule: typeof import('@dawcore/midi');
  try {
    midiModule = await import('@dawcore/midi');
  } catch (originalErr) {
    console.warn('[dawcore] @dawcore/midi dynamic import failed: ' + String(originalErr));
    throw new Error(INSTALL_HINT);
  }
  const { parseMidiUrl, parseMidiFile } = midiModule;

  // (2) Branch on source type. Wrap the File path so a failed disk read
  // surfaces with file context instead of a bare DOMException.
  let parsed;
  if (typeof source === 'string') {
    parsed = await parseMidiUrl(source, undefined, options.signal);
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

  // (3) Snapshot existing tracks so cleanup can identify the ones we appended.
  const childrenBefore = new Set<Element>(host.querySelectorAll('daw-track'));

  // (4) Concurrent addTrack with allSettled so we can wait for every settlement
  // before deciding. Promise.all would early-reject while other addTrack calls
  // keep running, leaving orphan tracks after cleanup.
  const settlements = await Promise.allSettled(
    parsed.tracks.map((t) =>
      host.addTrack({
        name: t.name,
        renderMode: 'piano-roll',
        clips: [
          {
            midiNotes: t.notes,
            midiChannel: t.channel,
            midiProgram: t.programNumber,
            start: startTime,
          },
        ],
      })
    )
  );

  // (5) Partition fulfilled vs rejected. Capture EVERY rejection (not just
  // the first) for diagnosability of multi-track failures.
  const succeeded: DawTrackElement[] = [];
  const rejections: unknown[] = [];
  for (const s of settlements) {
    if (s.status === 'fulfilled') {
      succeeded.push(s.value);
    } else {
      rejections.push(s.reason);
    }
  }

  // (6) On any rejection: remove ALL tracks appended during this call (both
  // succeeded and the ones addTrack left in the DOM before rejecting), then
  // throw a summary Error and console.warn each additional rejection so
  // multi-track failure modes stay diagnosable.
  if (rejections.length > 0) {
    const appendedTracks = Array.from(host.querySelectorAll('daw-track')).filter(
      (el) => !childrenBefore.has(el)
    );
    for (const el of appendedTracks) {
      try {
        el.remove();
      } catch (cleanupErr) {
        console.warn('[dawcore] loadMidi cleanup failed for a track: ' + String(cleanupErr));
      }
    }
    // Let MutationObserver microtasks flush so engine state is consistent
    // before rethrow.
    await Promise.resolve();

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
    trackIds: succeeded.map((el) => el.trackId),
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
