import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile } from '../src/parseMidiFile';

/**
 * Helper: create a minimal MIDI ArrayBuffer using @tonejs/midi's Midi constructor.
 */
function createTestMidi(options?: {
  name?: string;
  bpm?: number;
  timeSignature?: [number, number];
  tracks?: Array<{
    name?: string;
    channel?: number;
    instrument?: string;
    notes: Array<{
      midi: number;
      time: number;
      duration: number;
      velocity?: number;
    }>;
  }>;
}): ArrayBuffer {
  const midi = new Midi();

  if (options?.name) {
    midi.name = options.name;
  }

  if (options?.bpm) {
    // Must use setTempo() API — directly assigning header.tempos creates
    // invalid MIDI binary data that causes infinite loops on re-parse
    midi.header.setTempo(options.bpm);
  }

  if (options?.timeSignature) {
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: options.timeSignature,
      measures: 0,
    });
  }

  for (const trackDef of options?.tracks ?? []) {
    const track = midi.addTrack();
    if (trackDef.name) track.name = trackDef.name;
    if (trackDef.channel !== undefined) track.channel = trackDef.channel;
    if (trackDef.instrument) track.instrument.name = trackDef.instrument;

    for (const note of trackDef.notes) {
      track.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity ?? 0.8,
      });
    }
  }

  return midi.toArray().buffer;
}

describe('parseMidiFile', () => {
  it('parses a single-track MIDI file', () => {
    const buffer = createTestMidi({
      name: 'Test Song',
      bpm: 140,
      timeSignature: [4, 4],
      tracks: [
        {
          name: 'Piano',
          channel: 0,
          notes: [
            { midi: 60, time: 0, duration: 0.5, velocity: 0.9 },
            { midi: 64, time: 0.5, duration: 0.5, velocity: 0.7 },
            { midi: 67, time: 1.0, duration: 1.0, velocity: 0.8 },
          ],
        },
      ],
    });

    const result = parseMidiFile(buffer);

    expect(result.name).toBe('Test Song');
    // BPM has minor precision loss from MIDI's microseconds-per-beat integer format
    expect(result.bpm).toBeCloseTo(140, 0);
    expect(result.timeSignature).toEqual([4, 4]);
    expect(result.tracks).toHaveLength(1);

    const track = result.tracks[0];
    expect(track.name).toBe('Piano');
    expect(track.notes).toHaveLength(3);
    expect(track.channel).toBe(0);

    // Check note mapping — MIDI serialization introduces precision loss:
    // velocity is stored as 0-127 integer, duration/time use tick quantization
    const note = track.notes[0];
    expect(note.midi).toBe(60);
    expect(note.name).toBe('C4');
    expect(note.time).toBeCloseTo(0, 2);
    expect(note.duration).toBeCloseTo(0.5, 2);
    expect(note.velocity).toBeCloseTo(0.9, 1);

    // Duration should be end of last note
    expect(track.duration).toBeCloseTo(2.0, 2); // 1.0 + 1.0
  });

  it('parses multi-track MIDI files', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          name: 'Lead',
          channel: 0,
          notes: [{ midi: 72, time: 0, duration: 1.0 }],
        },
        {
          name: 'Bass',
          channel: 1,
          notes: [{ midi: 36, time: 0, duration: 2.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].name).toBe('Lead');
    expect(result.tracks[1].name).toBe('Bass');
    expect(result.duration).toBe(2.0); // max of all tracks
  });

  it('filters out tracks with no notes', () => {
    const buffer = createTestMidi({
      tracks: [
        { name: 'Empty', channel: 0, notes: [] },
        {
          name: 'HasNotes',
          channel: 1,
          notes: [{ midi: 60, time: 0, duration: 1.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].name).toBe('HasNotes');
  });

  it('flattens multi-track into single track', () => {
    const buffer = createTestMidi({
      name: 'Flattened',
      tracks: [
        {
          name: 'Track1',
          channel: 0,
          notes: [{ midi: 60, time: 0, duration: 0.5 }],
        },
        {
          name: 'Track2',
          channel: 1,
          notes: [{ midi: 72, time: 0.25, duration: 0.5 }],
        },
      ],
    });

    const result = parseMidiFile(buffer, { flatten: true });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].name).toBe('Flattened');
    expect(result.tracks[0].notes).toHaveLength(2);
    // Notes should be sorted by time
    expect(result.tracks[0].notes[0].time).toBe(0);
    expect(result.tracks[0].notes[1].time).toBe(0.25);
  });

  it('uses defaults for missing metadata', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          channel: 0,
          notes: [{ midi: 60, time: 0, duration: 1.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);

    expect(result.name).toBe('');
    expect(result.bpm).toBe(120); // MIDI default
    expect(result.timeSignature).toEqual([4, 4]); // MIDI default
  });

  it('handles empty MIDI file with no tracks', () => {
    const buffer = createTestMidi({ tracks: [] });

    const result = parseMidiFile(buffer);

    expect(result.tracks).toHaveLength(0);
    expect(result.duration).toBe(0);
  });

  it('assigns default name for unnamed tracks', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          channel: 3,
          notes: [{ midi: 60, time: 0, duration: 1.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);
    // No track name and program 0 → falls back to GM instrument name
    expect(result.tracks[0].name).toBe('Acoustic Grand Piano');
  });

  it('uses GM instrument name for non-default programs', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          name: 'My Track',
          channel: 0,
          instrument: 'electric bass (finger)',
          notes: [{ midi: 36, time: 0, duration: 1.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);
    // Non-default program → GM instrument name takes priority, title-cased
    expect(result.tracks[0].name).toBe('Electric Bass (Finger)');
  });

  it('labels percussion tracks as Drums', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          name: 'Percussion',
          channel: 9,
          notes: [{ midi: 42, time: 0, duration: 0.1 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);
    expect(result.tracks[0].name).toBe('Drums');
  });

  it('calculates total duration from all tracks', () => {
    const buffer = createTestMidi({
      tracks: [
        {
          name: 'Short',
          channel: 0,
          notes: [{ midi: 60, time: 0, duration: 1.0 }],
        },
        {
          name: 'Long',
          channel: 1,
          notes: [{ midi: 72, time: 5.0, duration: 3.0 }],
        },
      ],
    });

    const result = parseMidiFile(buffer);
    expect(result.duration).toBe(8.0); // 5.0 + 3.0
  });
});
