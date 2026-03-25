import { describe, it, expect } from 'vitest';
import { TempoMap } from '../timeline/tempo-map';
import type { Tick } from '../types';

describe('TempoMap', () => {
  it('single tempo: ticksToSeconds at 120 BPM, 960 PPQN', () => {
    const tm = new TempoMap(960, 120);
    // 1 beat = 960 ticks = 0.5s at 120 BPM
    expect(tm.ticksToSeconds(960 as Tick)).toBeCloseTo(0.5);
    expect(tm.ticksToSeconds(1920 as Tick)).toBeCloseTo(1.0);
    expect(tm.ticksToSeconds(0 as Tick)).toBe(0);
  });

  it('single tempo: secondsToTicks', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.secondsToTicks(0.5)).toBe(960);
    expect(tm.secondsToTicks(1.0)).toBe(1920);
  });

  it('round-trips ticks through seconds', () => {
    const tm = new TempoMap(960, 140);
    const ticks = 4800;
    expect(tm.secondsToTicks(tm.ticksToSeconds(ticks as Tick))).toBe(ticks);
  });

  it('getTempo returns BPM', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.getTempo()).toBe(120);
  });

  it('setTempo changes conversion', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60);
    // 1 beat = 960 ticks = 1.0s at 60 BPM
    expect(tm.ticksToSeconds(960 as Tick)).toBeCloseTo(1.0);
  });

  it('multiple tempos: second region uses new tempo', () => {
    const tm = new TempoMap(960, 120);
    // At tick 1920 (1s at 120BPM), switch to 60 BPM
    tm.setTempo(60, 1920);
    // First 1920 ticks at 120 BPM = 1.0s
    expect(tm.ticksToSeconds(1920 as Tick)).toBeCloseTo(1.0);
    // Next 960 ticks at 60 BPM = 1.0s (total: 2.0s)
    expect(tm.ticksToSeconds(2880 as Tick)).toBeCloseTo(2.0);
  });

  it('secondsToTicks with multiple tempos', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60, 1920);
    expect(tm.secondsToTicks(1.0)).toBe(1920);
    expect(tm.secondsToTicks(2.0)).toBe(2880);
  });

  it('beatsToSeconds convenience', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.beatsToSeconds(1)).toBeCloseTo(0.5);
    expect(tm.beatsToSeconds(4)).toBeCloseTo(2.0);
  });
});
