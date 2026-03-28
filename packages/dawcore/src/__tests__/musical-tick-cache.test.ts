import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@waveform-playlist/core', async () => {
  const actual = await vi.importActual('@waveform-playlist/core');
  return {
    ...actual,
    computeMusicalTicks: vi.fn((params) => ({
      ticks: [],
      pixelsPerBar: 3840 / params.ticksPerPixel,
      pixelsPerBeat: 960 / params.ticksPerPixel,
      zoomLevel: 'beat',
    })),
  };
});

import { getCachedMusicalTicks, clearMusicalTickCache } from '../utils/musical-tick-cache';
import { computeMusicalTicks } from '@waveform-playlist/core';

describe('getCachedMusicalTicks', () => {
  beforeEach(() => {
    clearMusicalTickCache();
    vi.mocked(computeMusicalTicks).mockClear();
  });

  const params = {
    timeSignature: [4, 4] as [number, number],
    ticksPerPixel: 4,
    startPixel: 0,
    endPixel: 1000,
    ppqn: 960,
  };

  it('calls computeMusicalTicks on first call', () => {
    getCachedMusicalTicks(params);
    expect(computeMusicalTicks).toHaveBeenCalledTimes(1);
  });

  it('returns cached result on same params', () => {
    const a = getCachedMusicalTicks(params);
    const b = getCachedMusicalTicks(params);
    expect(computeMusicalTicks).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('recomputes on changed ticksPerPixel', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, ticksPerPixel: 8 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed startPixel', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, startPixel: 500 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed endPixel', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, endPixel: 2000 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed timeSignature numerator', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, timeSignature: [3, 4] });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed timeSignature denominator', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, timeSignature: [4, 8] });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed ppqn', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, ppqn: 480 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('treats undefined ppqn the same as 960', () => {
    const withExplicit = { ...params, ppqn: 960 };
    const withUndefined = {
      timeSignature: [4, 4] as [number, number],
      ticksPerPixel: 4,
      startPixel: 0,
      endPixel: 1000,
    };
    getCachedMusicalTicks(withExplicit);
    getCachedMusicalTicks(withUndefined);
    expect(computeMusicalTicks).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the input timeSignature array', () => {
    const ts: [number, number] = [4, 4];
    getCachedMusicalTicks({ ...params, timeSignature: ts });
    expect(ts).toEqual([4, 4]);
  });
});
