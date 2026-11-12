import { describe, it, expect } from 'vitest';
import { assertTrackKind, clipKind, splitTrackByKind, trackKind } from '../trackKind';
import { createClip, createTrack } from '../types';
import type { AudioClip, ClipTrack } from '../types';

function audioClip(name = 'audio'): AudioClip {
  return createClip({
    startSample: 0,
    durationSamples: 100,
    sampleRate: 48000,
    sourceDurationSamples: 100,
    name,
  });
}

function midiClip(name = 'midi'): AudioClip {
  return createClip({
    startSample: 0,
    durationSamples: 100,
    sampleRate: 48000,
    sourceDurationSamples: 100,
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    name,
  });
}

describe('clipKind', () => {
  it('is midi when the clip has midiNotes, even an empty array', () => {
    expect(clipKind(midiClip())).toBe('midi');
    expect(clipKind({ ...audioClip(), midiNotes: [] })).toBe('midi');
  });

  it('is audio otherwise', () => {
    expect(clipKind(audioClip())).toBe('audio');
  });
});

describe('createTrack', () => {
  it('defaults kind to audio', () => {
    expect(createTrack({ name: 'a' }).kind).toBe('audio');
  });

  it('keeps an explicit kind', () => {
    expect(createTrack({ name: 'm', kind: 'midi' }).kind).toBe('midi');
  });
});

describe('trackKind', () => {
  it('reads a missing kind as audio', () => {
    const { kind: _kind, ...withoutKind } = createTrack({ name: 'a' });
    expect(trackKind(withoutKind as ClipTrack)).toBe('audio');
  });
});

describe('assertTrackKind', () => {
  it('accepts tracks whose clips match, and empty tracks of either kind', () => {
    expect(() => assertTrackKind(createTrack({ name: 'a', clips: [audioClip()] }))).not.toThrow();
    expect(() =>
      assertTrackKind(createTrack({ name: 'm', kind: 'midi', clips: [midiClip()] }))
    ).not.toThrow();
    expect(() => assertTrackKind(createTrack({ name: 'e', kind: 'midi' }))).not.toThrow();
  });

  it('throws for a MIDI clip on an audio track, naming both', () => {
    const track = createTrack({ name: 'Drums', clips: [audioClip(), midiClip('Fill')] });
    expect(() => assertTrackKind(track)).toThrow(/"Drums".*audio.*"Fill".*midi/s);
  });

  it('throws for an audio clip on a MIDI track', () => {
    const track = createTrack({ name: 'Keys', kind: 'midi', clips: [audioClip('Take 1')] });
    expect(() => assertTrackKind(track)).toThrow(/"Keys".*midi.*"Take 1".*audio/s);
  });

  it('throws for a MIDI clip on a track with no kind (read as audio)', () => {
    const { kind: _kind, ...withoutKind } = createTrack({ name: 'Old', clips: [midiClip()] });
    expect(() => assertTrackKind(withoutKind as ClipTrack)).toThrow(/kind: 'midi'/);
  });

  it('throws for a kind that is neither audio nor midi', () => {
    const track = { ...createTrack({ name: 'x' }), kind: 'video' } as unknown as ClipTrack;
    expect(() => assertTrackKind(track)).toThrow(/"video"/);
  });
});

describe('splitTrackByKind', () => {
  it('returns a one-kind track unchanged apart from its kind', () => {
    const track = createTrack({ name: 'a', clips: [audioClip()] });
    expect(splitTrackByKind(track)).toEqual([track]);
  });

  it('sets the kind from the clips when every clip is MIDI', () => {
    const { kind: _kind, ...withoutKind } = createTrack({ name: 'm', clips: [midiClip()] });
    // No cast: saved data without a kind is what the helper is for.
    const result = splitTrackByKind(withoutKind);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('midi');
    expect(result[0].id).toBe(withoutKind.id);
  });

  it('keeps the declared kind of an empty track', () => {
    const track = createTrack({ name: 'e', kind: 'midi' });
    expect(splitTrackByKind(track)).toEqual([track]);
  });

  it('splits a mixed track in two: audio keeps the id, MIDI gets a new one', () => {
    const a = audioClip();
    const m = midiClip();
    const mixed = { ...createTrack({ name: 'Mix', volume: 0.5, pan: -0.2 }), clips: [a, m] };

    const [audio, midi] = splitTrackByKind(mixed);

    expect(audio).toMatchObject({ id: mixed.id, kind: 'audio', name: 'Mix', volume: 0.5 });
    expect(audio.clips).toEqual([a]);
    expect(midi).toMatchObject({ id: mixed.id + '-midi', kind: 'midi', name: 'Mix', pan: -0.2 });
    expect(midi.clips).toEqual([m]);
    expect(() => assertTrackKind(audio)).not.toThrow();
    expect(() => assertTrackKind(midi)).not.toThrow();
    // The input is not modified.
    expect(mixed.clips).toEqual([a, m]);
  });

  it('uses the given id for the MIDI track', () => {
    const mixed = { ...createTrack({ name: 'Mix' }), clips: [audioClip(), midiClip()] };
    expect(splitTrackByKind(mixed, 'keys')[1].id).toBe('keys');
  });
});
