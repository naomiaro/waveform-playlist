import { describe, it, expect } from 'vitest';
import { audioPanLaw, isDecidedPanLaw, trackPanLaw, DEFAULT_PAN_LAW } from '../panLaw';

const buf = (numberOfChannels: number) => ({ audioBuffer: { numberOfChannels } });

describe('trackPanLaw', () => {
  it('a decided law wins over the clips', () => {
    expect(trackPanLaw({ panLaw: 'mono', clips: [buf(2)] })).toBe('mono');
    expect(trackPanLaw({ panLaw: 'stereo', clips: [buf(1)] })).toBe('stereo');
  });

  it("'auto' or no field takes the law from the clips, highest channel count", () => {
    expect(trackPanLaw({ panLaw: 'auto', clips: [buf(1), buf(2)] })).toBe('stereo');
    expect(trackPanLaw({ clips: [buf(1)] })).toBe('mono');
    expect(trackPanLaw({ clips: [] })).toBe('mono');
    expect(trackPanLaw({ clips: [{}] })).toBe('mono'); // MIDI or peaks-only clip
  });

  it('a value that is not a law counts as auto', () => {
    for (const bad of ['bogus', null, 2, '']) {
      expect(trackPanLaw({ panLaw: bad as never, clips: [buf(2)] })).toBe('stereo');
      expect(isDecidedPanLaw(bad)).toBe(false);
    }
  });
});

describe('audioPanLaw', () => {
  it('is null without a buffer', () => {
    expect(audioPanLaw({ clips: [] })).toBeNull();
    expect(audioPanLaw({ clips: [{}] })).toBeNull();
  });

  it('is mono for mono buffers and stereo as soon as one has two or more channels', () => {
    expect(audioPanLaw({ clips: [buf(1)] })).toBe('mono');
    expect(audioPanLaw({ clips: [{}, buf(1)] })).toBe('mono');
    expect(audioPanLaw({ clips: [buf(1), buf(6)] })).toBe('stereo');
  });
});

describe('isDecidedPanLaw', () => {
  it('is true for the two laws only', () => {
    expect(isDecidedPanLaw('mono')).toBe(true);
    expect(isDecidedPanLaw('stereo')).toBe(true);
    expect(isDecidedPanLaw('auto')).toBe(false);
    expect(isDecidedPanLaw(undefined)).toBe(false);
  });

  it('the default is auto', () => {
    expect(DEFAULT_PAN_LAW).toBe('auto');
  });
});
