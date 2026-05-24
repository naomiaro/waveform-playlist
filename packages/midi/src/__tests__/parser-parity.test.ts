import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile as parseFromReactPkg } from '@waveform-playlist/midi';
import { parseMidiFile as parseFromDawcorePkg } from '@dawcore/midi';

/**
 * @waveform-playlist/midi re-exports parseMidiFile from @dawcore/midi. This
 * test guards against accidental local copies (which would silently diverge
 * over time). Identity equality is unreliable across bundle boundaries so we
 * assert behavioral parity instead — same input, structurally equal output.
 *
 * Inputs cover each notable parser branch (multi-track, percussion channel,
 * explicit GM program, empty, flatten) so a regression in any one branch
 * fails this test instead of slipping through to runtime.
 */
describe('parser parity', () => {
  it('matches on a basic single-track input', () => {
    const midi = new Midi();
    midi.header.setTempo(140);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });
    const track = midi.addTrack();
    track.name = 'Test';
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
    track.addNote({ midi: 64, time: 0.5, duration: 0.5, velocity: 0.7 });
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer)).toEqual(parseFromDawcorePkg(buffer));
  });

  it('matches on a multi-track input with mixed channels', () => {
    const midi = new Midi();
    const t1 = midi.addTrack();
    t1.name = 'Lead';
    t1.channel = 0;
    t1.addNote({ midi: 72, time: 0, duration: 1.0 });
    const t2 = midi.addTrack();
    t2.name = 'Bass';
    t2.channel = 1;
    t2.addNote({ midi: 36, time: 0, duration: 2.0 });
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer)).toEqual(parseFromDawcorePkg(buffer));
  });

  it('matches on a percussion (channel 9) track — exercises the "Drums" naming branch', () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.name = 'Percussion';
    track.channel = 9;
    track.addNote({ midi: 42, time: 0, duration: 0.1 });
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer)).toEqual(parseFromDawcorePkg(buffer));
  });

  it('matches when an explicit GM program is set — exercises the title-cased instrument branch', () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.name = 'My Track';
    track.channel = 0;
    track.instrument.name = 'electric bass (finger)';
    track.addNote({ midi: 36, time: 0, duration: 1.0 });
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer)).toEqual(parseFromDawcorePkg(buffer));
  });

  it('matches on a MIDI file with no note-bearing tracks (empty)', () => {
    const midi = new Midi();
    midi.addTrack();
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer)).toEqual(parseFromDawcorePkg(buffer));
  });

  it('matches with flatten: true on a multi-track input', () => {
    const midi = new Midi();
    const t1 = midi.addTrack();
    t1.name = 'Track1';
    t1.channel = 0;
    t1.addNote({ midi: 60, time: 0, duration: 0.5 });
    const t2 = midi.addTrack();
    t2.name = 'Track2';
    t2.channel = 1;
    t2.addNote({ midi: 72, time: 0.25, duration: 0.5 });
    const buffer = midi.toArray().buffer;

    expect(parseFromReactPkg(buffer, { flatten: true })).toEqual(
      parseFromDawcorePkg(buffer, { flatten: true })
    );
  });
});
