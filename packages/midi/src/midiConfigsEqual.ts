import type { MidiNoteData } from '@waveform-playlist/core';
import type { MidiTrackConfig } from './useMidiTracks';

// Every field is compared with Object.is, so NaN equals NaN. With `!==` a NaN
// anywhere would make equal lists look different on every render.
const NOTE_KEYS = ['midi', 'time', 'duration', 'velocity', 'name', 'channel'] as const;

// Only the fields the hook reads. Extra properties on a config object (from a
// spread of a wider object, say) neither trigger a reload nor defeat the check.
const SCALAR_CONFIG_KEYS = [
  'src',
  'name',
  'muted',
  'soloed',
  'volume',
  'pan',
  'color',
  'startTime',
  'duration',
  'flatten',
] as const satisfies ReadonlyArray<Exclude<keyof MidiTrackConfig, 'midiNotes'>>;

function noteEqual(a: MidiNoteData, b: MidiNoteData): boolean {
  return a === b || NOTE_KEYS.every((key) => Object.is(a[key], b[key]));
}

function notesEqual(a: MidiNoteData[] | undefined, b: MidiNoteData[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!noteEqual(a[i], b[i])) return false;
  }
  return true;
}

function configEqual(a: MidiTrackConfig, b: MidiTrackConfig): boolean {
  if (a === b) return true;
  return (
    SCALAR_CONFIG_KEYS.every((key) => Object.is(a[key], b[key])) &&
    notesEqual(a.midiNotes, b.midiNotes)
  );
}

/**
 * Whether two config lists describe the same tracks. Compares values, not
 * identity, so a list written inline (a new array and new objects on every
 * render) equals the one from the previous render.
 *
 * Notes are compared by identity first; a note list that is itself rebuilt on
 * every render is compared note by note, which costs one pass over the notes
 * per render. Keep the note array's identity stable to avoid that pass.
 *
 * Configs and notes are treated as immutable: an object or array that is the
 * same reference as last time is taken to be unchanged.
 */
export function midiConfigsEqual(a: MidiTrackConfig[], b: MidiTrackConfig[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!configEqual(a[i], b[i])) return false;
  }
  return true;
}
