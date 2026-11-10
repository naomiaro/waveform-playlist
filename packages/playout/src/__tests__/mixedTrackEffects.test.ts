import { describe, it, expect, vi, beforeEach } from 'vitest';

const trims: Array<{
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('tone', () => ({
  Gain: vi.fn(function (options: { gain: number }) {
    const node = { gain: { value: options.gain }, connect: vi.fn(), dispose: vi.fn() };
    trims.push(node);
    return node;
  }),
}));

import { mixedTrackMidiEffects } from '../mixedTrackEffects';

// A mixed audio+MIDI track is two playout tracks sharing ONE effects chain.
// With pre-fader effects the chain returns into a channel strip, so both
// halves running the track's closure would connect the chain's output to
// two faders: the whole track would play twice (+6 dB).
describe('mixedTrackMidiEffects', () => {
  const audioHalfInput = { name: 'audio-half-input' };
  const faderInput = { name: 'midi-half-fader', connect: vi.fn() };
  let midiInput: { connect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    trims.length = 0;
    midiInput = { connect: vi.fn() };
    faderInput.connect.mockClear();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = (stereo: boolean) => mixedTrackMidiEffects(audioHalfInput as any, stereo);

  it('sums the MIDI voices into the audio half input and leaves the MIDI fader unfed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanup = run(false)(midiInput as any, faderInput as any, false);

    expect(midiInput.connect).toHaveBeenCalledTimes(1);
    expect(midiInput.connect).toHaveBeenCalledWith(audioHalfInput);
    // Nothing reaches the MIDI half's own strip — one chain, one strip.
    expect(midiInput.connect).not.toHaveBeenCalledWith(faderInput);
    expect(trims).toHaveLength(0);
    expect(cleanup).toBeUndefined();
  });

  it('trims mono voices by 1/√2 into a STEREO audio half (stereo pan law is unity at centre)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanup = run(true)(midiInput as any, faderInput as any, false);

    expect(trims).toHaveLength(1);
    expect(trims[0].gain.value).toBeCloseTo(Math.SQRT1_2, 12);
    expect(midiInput.connect).toHaveBeenCalledWith(trims[0]);
    expect(trims[0].connect).toHaveBeenCalledWith(audioHalfInput);
    expect(midiInput.connect).not.toHaveBeenCalledWith(audioHalfInput);

    (cleanup as () => void)();
    expect(trims[0].dispose).toHaveBeenCalledTimes(1);
  });
});
