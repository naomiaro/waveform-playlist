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
    tm.setTempo(60, 1920 as Tick);
    // First 1920 ticks at 120 BPM = 1.0s
    expect(tm.ticksToSeconds(1920 as Tick)).toBeCloseTo(1.0);
    // Next 960 ticks at 60 BPM = 1.0s (total: 2.0s)
    expect(tm.ticksToSeconds(2880 as Tick)).toBeCloseTo(2.0);
  });

  it('secondsToTicks with multiple tempos', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60, 1920 as Tick);
    expect(tm.secondsToTicks(1.0)).toBe(1920);
    expect(tm.secondsToTicks(2.0)).toBe(2880);
  });

  it('beatsToSeconds convenience', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.beatsToSeconds(1)).toBeCloseTo(0.5);
    expect(tm.beatsToSeconds(4)).toBeCloseTo(2.0);
  });
});

describe('TempoMap linear interpolation', () => {
  it('linear ramp: ticksToSeconds uses trapezoidal integration', () => {
    const tm = new TempoMap(960, 120);
    // Ramp from 120 to 140 BPM over 1 bar (3840 ticks)
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });

    // At tick 0: 0 seconds
    expect(tm.ticksToSeconds(0 as Tick)).toBe(0);

    // At tick 3840 (end of ramp): trapezoidal formula
    // seconds = ticks * 60/ppqn * (1/bpm0 + 1/bpm1) / 2 ≈ 1.857
    const expected = (((3840 * 60) / 960) * (1 / 120 + 1 / 140)) / 2;
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(expected);
  });

  it('linear ramp: secondsToTicks round-trips', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });

    // Round-trip at midpoint of ramp
    const midTick = 1920 as Tick;
    const seconds = tm.ticksToSeconds(midTick);
    expect(tm.secondsToTicks(seconds)).toBe(midTick);
  });

  it('linear ramp: getTempo returns interpolated BPM', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });

    // Start of ramp
    expect(tm.getTempo(0 as Tick)).toBe(120);
    // Midpoint: (120 + 140) / 2 = 130
    expect(tm.getTempo(1920 as Tick)).toBeCloseTo(130);
    // End of ramp (at the entry itself — getTempo returns entry BPM)
    expect(tm.getTempo(3840 as Tick)).toBe(140);
  });

  it('linear ramp: partial segment ticksToSeconds', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60, 3840 as Tick, { interpolation: 'linear' });

    // Midpoint: 1920 ticks into a 120→60 ramp over 3840 ticks
    // BPM at midpoint: 120 + (60 - 120) * (1920/3840) = 90
    // seconds = 1920 * 60/960 * (1/120 + 1/90) / 2
    const expected = (((1920 * 60) / 960) * (1 / 120 + 1 / 90)) / 2;
    expect(tm.ticksToSeconds(1920 as Tick)).toBeCloseTo(expected);
  });

  it('linear ramp: mixed step + linear', () => {
    const tm = new TempoMap(960, 120);
    // Step to 100 at bar 2, then linear ramp to 160 at bar 4
    tm.setTempo(100, 3840 as Tick);
    tm.setTempo(160, 7680 as Tick, { interpolation: 'linear' });

    // At bar 2 (tick 3840): step segment at 120 BPM
    const secondsAtBar2 = (3840 * 60) / (120 * 960);
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(secondsAtBar2);

    // At bar 4 (tick 7680): step + linear ramp
    const rampSeconds = (((3840 * 60) / 960) * (1 / 100 + 1 / 160)) / 2;
    expect(tm.ticksToSeconds(7680 as Tick)).toBeCloseTo(secondsAtBar2 + rampSeconds);
  });

  it('linear ramp: degenerate (same BPM) falls back to step', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(120, 3840 as Tick, { interpolation: 'linear' });

    // 120→120 linear = same as step
    const expected = (3840 * 60) / (120 * 960);
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(expected);
  });

  it('linear ramp: secondsToTicks round-trips at multiple points', () => {
    const tm = new TempoMap(960, 100);
    tm.setTempo(180, (3840 * 4) as Tick, { interpolation: 'linear' });

    // Test round-trip at 25%, 50%, 75% through the ramp
    for (const fraction of [0.25, 0.5, 0.75]) {
      const tick = Math.round(3840 * 4 * fraction) as Tick;
      const seconds = tm.ticksToSeconds(tick);
      expect(tm.secondsToTicks(seconds)).toBe(tick);
    }
  });

  it('curve interpolation throws', () => {
    const tm = new TempoMap(960, 120);
    expect(() =>
      tm.setTempo(140, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.5 } })
    ).toThrow('not yet supported');
  });

  it('setTempo without options defaults to step', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 3840 as Tick);

    // Should behave as step — constant 120 BPM until tick 3840
    const expected = (3840 * 60) / (120 * 960);
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(expected);
  });

  it('clearTempos resets after linear entries', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, 3840 as Tick, { interpolation: 'linear' });
    tm.clearTempos();

    // Should revert to constant 120 BPM
    expect(tm.getTempo(0 as Tick)).toBe(120);
    expect(tm.getTempo(1920 as Tick)).toBe(120);
    const expected = (3840 * 60) / (120 * 960);
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(expected);
  });

  it('setTempo at tick 0 with linear is coerced to step', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 0 as Tick, { interpolation: 'linear' });

    // First entry is always step — no previous entry to ramp from
    expect(tm.getTempo(0 as Tick)).toBe(140);
    const expected = (960 * 60) / (140 * 960);
    expect(tm.ticksToSeconds(960 as Tick)).toBeCloseTo(expected);
  });

  it('extreme ramp ratio round-trips (10 to 300 BPM)', () => {
    const tm = new TempoMap(960, 10);
    tm.setTempo(300, (3840 * 4) as Tick, { interpolation: 'linear' });

    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const tick = Math.round(3840 * 4 * fraction) as Tick;
      const seconds = tm.ticksToSeconds(tick);
      expect(tm.secondsToTicks(seconds)).toBe(tick);
    }
  });

  it('getTempo beyond last linear entry returns that entry BPM', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });

    // Beyond the ramp: should return 140 (the last entry's BPM)
    expect(tm.getTempo(7680 as Tick)).toBe(140);
  });

  it('overwrite linear entry with step at same tick', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });
    // Overwrite with step
    tm.setTempo(140, 3840 as Tick);

    // Should now be step — constant 120 BPM until tick 3840
    expect(tm.getTempo(1920 as Tick)).toBe(120);
    const expected = (3840 * 60) / (120 * 960);
    expect(tm.ticksToSeconds(3840 as Tick)).toBeCloseTo(expected);
  });
});
