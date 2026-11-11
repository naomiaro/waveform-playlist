import type { MidiNoteData } from '@waveform-playlist/core';
import type { MidiTrackConfig } from './useMidiTracks';

function notesEqual(a: MidiNoteData[] | undefined, b: MidiNoteData[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x !== y &&
      (x.midi !== y.midi ||
        x.time !== y.time ||
        x.duration !== y.duration ||
        x.velocity !== y.velocity ||
        x.name !== y.name ||
        x.channel !== y.channel)
    ) {
      return false;
    }
  }
  return true;
}

function configEqual(a: MidiTrackConfig, b: MidiTrackConfig): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof MidiTrackConfig>;
  for (const key of keys) {
    if (key === 'midiNotes') {
      if (!notesEqual(a.midiNotes, b.midiNotes)) return false;
    } else if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Whether two config lists describe the same tracks. Compares values, not
 * identity, so a list written inline (a new array and new objects on every
 * render) equals the one from the previous render.
 *
 * Notes are compared by identity first; a note list that is itself rebuilt on
 * every render is compared note by note, which costs one pass over the notes
 * per render. Keep the note array's identity stable to avoid that pass.
 */
export function midiConfigsEqual(a: MidiTrackConfig[], b: MidiTrackConfig[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!configEqual(a[i], b[i])) return false;
  }
  return true;
}
