import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile as parseFromReactPkg } from '@waveform-playlist/midi';
import { parseMidiFile as parseFromDawcorePkg } from '@dawcore/midi';

/**
 * @waveform-playlist/midi re-exports parseMidiFile from @dawcore/midi. This
 * test guards against accidental local copies (which would silently diverge
 * over time). Identity equality is unreliable across bundle boundaries so we
 * assert behavioral parity instead — same input, structurally equal output.
 */
describe('parser parity', () => {
  it('produces structurally equal output from both packages', () => {
    const midi = new Midi();
    midi.header.setTempo(140);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });
    const track = midi.addTrack();
    track.name = 'Test';
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
    track.addNote({ midi: 64, time: 0.5, duration: 0.5, velocity: 0.7 });
    const buffer = midi.toArray().buffer;

    const fromReact = parseFromReactPkg(buffer);
    const fromDawcore = parseFromDawcorePkg(buffer);

    expect(fromReact).toEqual(fromDawcore);
  });
});
