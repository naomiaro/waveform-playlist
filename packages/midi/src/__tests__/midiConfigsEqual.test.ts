import { describe, it, expect } from 'vitest';
import type { MidiNoteData } from '@waveform-playlist/core';
import { midiConfigsEqual } from '../midiConfigsEqual';

const note = (midi: number): MidiNoteData => ({
  midi,
  name: 'N',
  time: 0,
  duration: 1,
  velocity: 0.8,
});

describe('midiConfigsEqual', () => {
  it('treats separately built but identical lists as equal', () => {
    expect(
      midiConfigsEqual([{ src: '/a.mid', volume: 0.5 }], [{ src: '/a.mid', volume: 0.5 }])
    ).toBe(true);
    expect(midiConfigsEqual([], [])).toBe(true);
  });

  it('sees a changed, added or removed field', () => {
    expect(midiConfigsEqual([{ src: '/a.mid' }], [{ src: '/b.mid' }])).toBe(false);
    expect(midiConfigsEqual([{ src: '/a.mid' }], [{ src: '/a.mid', flatten: true }])).toBe(false);
    expect(midiConfigsEqual([{ src: '/a.mid', pan: 0 }], [{ src: '/a.mid' }])).toBe(false);
  });

  it('sees a different length or order', () => {
    const a = { src: '/a.mid' };
    const b = { src: '/b.mid' };
    expect(midiConfigsEqual([a], [a, b])).toBe(false);
    expect(midiConfigsEqual([a, b], [b, a])).toBe(false);
  });

  it('compares notes by value when the arrays differ in identity', () => {
    expect(midiConfigsEqual([{ midiNotes: [note(60)] }], [{ midiNotes: [note(60)] }])).toBe(true);
    expect(midiConfigsEqual([{ midiNotes: [note(60)] }], [{ midiNotes: [note(61)] }])).toBe(false);
    expect(
      midiConfigsEqual([{ midiNotes: [note(60)] }], [{ midiNotes: [note(60), note(62)] }])
    ).toBe(false);
    expect(
      midiConfigsEqual([{ midiNotes: [{ ...note(60), channel: 9 }] }], [{ midiNotes: [note(60)] }])
    ).toBe(false);
    expect(midiConfigsEqual([{ midiNotes: [note(60)] }], [{ src: '/a.mid' }])).toBe(false);
  });
});
