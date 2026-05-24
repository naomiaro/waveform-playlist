/**
 * MIDI loading logic extracted from daw-editor to keep the editor under 800
 * lines. Operates on the editor instance via a narrow interface — `<daw-editor>`
 * satisfies it via its existing public `addTrack` method, so no new fields are
 * exposed on the host.
 */

import type { TrackConfig } from '../types';
import type { DawTrackElement } from '../elements/daw-track';

/** Public option / result shapes — re-exported from `@dawcore/midi`. */
export type { MidiLoadOptions, MidiLoadResult } from '@dawcore/midi';

import type { MidiLoadOptions, MidiLoadResult } from '@dawcore/midi';

/**
 * Minimal host surface needed by `loadMidiImpl`. `<daw-editor>` satisfies this
 * via its existing `addTrack` method — no new methods required on the host.
 */
export interface MidiLoaderHost {
  addTrack(config: TrackConfig): Promise<DawTrackElement>;
}

const INSTALL_HINT =
  '@dawcore/midi is required for loadMidi(). Install with: npm install @dawcore/midi';

/**
 * Loads a `.mid` file (URL or `File`) and creates N `<daw-track>` elements,
 * one per note-bearing MIDI track. On any per-track failure, every
 * successfully-created track is removed so the editor returns to its
 * pre-call state (cleanup-on-failure).
 */
export async function loadMidiImpl(
  host: MidiLoaderHost,
  source: string | File,
  options: MidiLoadOptions = {}
): Promise<MidiLoadResult> {
  // (1) Dynamic-import the optional peer dep with a friendly install hint on failure.
  let midiModule: typeof import('@dawcore/midi');
  try {
    midiModule = await import('@dawcore/midi');
  } catch {
    throw new Error(INSTALL_HINT);
  }
  const { parseMidiUrl, parseMidiFile } = midiModule;

  // (2) Branch on source type.
  const parsed =
    typeof source === 'string'
      ? await parseMidiUrl(source, undefined, options.signal)
      : parseMidiFile(await source.arrayBuffer());

  // (3) Concurrent addTrack with allSettled so we can clean up on any failure.
  const startTime = options.startTime ?? 0;
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

  // (4) Partition fulfilled vs rejected.
  const succeeded: DawTrackElement[] = [];
  let firstError: unknown = null;
  for (const s of settlements) {
    if (s.status === 'fulfilled') {
      succeeded.push(s.value);
    } else if (firstError === null) {
      firstError = s.reason;
    }
  }

  // (5) On any rejection: cleanup and rethrow.
  if (firstError !== null) {
    for (const el of succeeded) {
      el.remove();
    }
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }

  // (6) Build the result.
  return {
    trackIds: succeeded.map((el) => el.trackId),
    bpm: parsed.bpm,
    timeSignature: parsed.timeSignature,
    duration: parsed.duration,
    name: parsed.name,
  };
}
