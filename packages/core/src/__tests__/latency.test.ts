import { describe, it, expect } from 'vitest';
import { audibleLatencySamples } from '../utils/latency';

describe('audibleLatencySamples', () => {
  it('returns floor((outputLatency + lookAhead) * sampleRate)', () => {
    expect(audibleLatencySamples(0.005, 0.1, 48000)).toBe(Math.floor(0.105 * 48000));
    expect(audibleLatencySamples(0.005, 0.1, 44100)).toBe(Math.floor(0.105 * 44100));
  });

  it('returns 0 when total latency is zero or negative', () => {
    expect(audibleLatencySamples(0, 0, 48000)).toBe(0);
    expect(audibleLatencySamples(-0.005, 0, 48000)).toBe(0);
  });

  it('returns 0 for non-finite inputs (NaN, Infinity)', () => {
    expect(audibleLatencySamples(NaN, 0.1, 48000)).toBe(0);
    expect(audibleLatencySamples(0.005, NaN, 48000)).toBe(0);
    expect(audibleLatencySamples(0.005, 0.1, NaN)).toBe(0);
    expect(audibleLatencySamples(Infinity, 0, 48000)).toBe(0);
  });

  it('returns 0 for non-positive sampleRate', () => {
    expect(audibleLatencySamples(0.005, 0.1, 0)).toBe(0);
    expect(audibleLatencySamples(0.005, 0.1, -48000)).toBe(0);
  });

  it('handles native-adapter case (lookAhead = 0)', () => {
    expect(audibleLatencySamples(0.003, 0, 48000)).toBe(Math.floor(0.003 * 48000));
  });
});
