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
  it('linear ramp: ticksToSeconds uses exact logarithmic formula', () => {
    const tm = new TempoMap(960, 120);
    // Ramp from 120 to 140 BPM over 1 bar (3840 ticks)
    tm.setTempo(140, 3840 as Tick, { interpolation: 'linear' });

    // At tick 0: 0 seconds
    expect(tm.ticksToSeconds(0 as Tick)).toBe(0);

    // At tick 3840 (end of ramp): exact logarithmic formula
    // seconds = (T * 60 / (ppqn * deltaBpm)) * ln(bpm1 / bpm0)
    const expected = ((3840 * 60) / (960 * 20)) * Math.log(140 / 120);
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
    // exact: (T * 60 / (ppqn * deltaBpm)) * ln(bpmAtTick / bpm0)
    const expected = ((3840 * 60) / (960 * -60)) * Math.log(90 / 120);
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

    // At bar 4 (tick 7680): step + linear ramp (exact logarithmic)
    const rampSeconds = ((3840 * 60) / (960 * 60)) * Math.log(160 / 100);
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

  it('curve slope validation rejects out-of-range values', () => {
    const tm = new TempoMap(960, 120);
    expect(() =>
      tm.setTempo(140, 3840 as Tick, { interpolation: { type: 'curve', slope: 0 } })
    ).toThrow('between 0 and 1');
    expect(() =>
      tm.setTempo(140, 3840 as Tick, { interpolation: { type: 'curve', slope: 1 } })
    ).toThrow('between 0 and 1');
    expect(() =>
      tm.setTempo(140, 3840 as Tick, { interpolation: { type: 'curve', slope: -0.5 } })
    ).toThrow('between 0 and 1');
    expect(() =>
      tm.setTempo(140, 3840 as Tick, { interpolation: { type: 'curve', slope: NaN } })
    ).toThrow('between 0 and 1');
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

describe('TempoMap curve interpolation', () => {
  it('curve with slope 0.5 behaves like linear', () => {
    const tmLinear = new TempoMap(960, 120);
    tmLinear.setTempo(180, 3840 as Tick, { interpolation: 'linear' });

    const tmCurve = new TempoMap(960, 120);
    tmCurve.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.5 } });

    // At midpoint, both should give ~150 BPM
    expect(tmCurve.getTempo(1920 as Tick)).toBeCloseTo(tmLinear.getTempo(1920 as Tick), 1);

    // Total duration should match closely — curve(0.5) uses the Möbius fast
    // path (returns x), so BPM values are identical to linear. The only
    // difference is subdivided trapezoidal vs exact ln() integration.
    // At 64 subdivisions the error is ~0.011ms (< 1 sample at 48kHz).
    const curveSec = tmCurve.ticksToSeconds(3840 as Tick);
    const linearSec = tmLinear.ticksToSeconds(3840 as Tick);
    expect(Math.abs(curveSec - linearSec) * 1000).toBeLessThan(0.1); // within 0.1ms
  });

  it('curve round-trips via binary search inverse', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, (3840 * 4) as Tick, { interpolation: { type: 'curve', slope: 0.3 } });

    for (const fraction of [0.25, 0.5, 0.75]) {
      const tick = Math.round(3840 * 4 * fraction) as Tick;
      const seconds = tm.ticksToSeconds(tick);
      // Binary search inverse — allow ±1 tick tolerance
      const roundTrip = tm.secondsToTicks(seconds);
      expect(Math.abs(roundTrip - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('concave curve (slope < 0.5): slow start, fast end', () => {
    const tm = new TempoMap(960, 100);
    tm.setTempo(200, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.2 } });

    // At midpoint, concave curve should be below linear midpoint (150)
    const midBpm = tm.getTempo(1920 as Tick);
    expect(midBpm).toBeLessThan(150);
    expect(midBpm).toBeGreaterThan(100);
  });

  it('convex curve (slope > 0.5): fast start, slow end', () => {
    const tm = new TempoMap(960, 100);
    tm.setTempo(200, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.8 } });

    // At midpoint, convex curve should be above linear midpoint (150)
    const midBpm = tm.getTempo(1920 as Tick);
    expect(midBpm).toBeGreaterThan(150);
    expect(midBpm).toBeLessThan(200);
  });

  it('curve getTempo at boundaries returns exact entry BPM', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });

    expect(tm.getTempo(0 as Tick)).toBe(120);
    expect(tm.getTempo(3840 as Tick)).toBe(180);
  });

  it('descending curve round-trips (bpm0 > bpm1)', () => {
    const tm = new TempoMap(960, 180);
    tm.setTempo(80, (3840 * 4) as Tick, { interpolation: { type: 'curve', slope: 0.3 } });

    for (const fraction of [0.25, 0.5, 0.75]) {
      const tick = Math.round(3840 * 4 * fraction) as Tick;
      const seconds = tm.ticksToSeconds(tick);
      expect(Math.abs(tm.secondsToTicks(seconds) - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('convex curve round-trips (slope > 0.5)', () => {
    const tm = new TempoMap(960, 100);
    tm.setTempo(200, (3840 * 4) as Tick, { interpolation: { type: 'curve', slope: 0.8 } });

    for (const fraction of [0.25, 0.5, 0.75]) {
      const tick = Math.round(3840 * 4 * fraction) as Tick;
      const seconds = tm.ticksToSeconds(tick);
      expect(Math.abs(tm.secondsToTicks(seconds) - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('mixed curve + linear + step segments', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(160, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });
    tm.setTempo(100, 7680 as Tick, { interpolation: 'linear' });
    tm.setTempo(100, 11520 as Tick); // step (stays at 100)

    // Round-trips within each segment type
    for (const tick of [1920, 5760, 9600] as Tick[]) {
      const seconds = tm.ticksToSeconds(tick);
      expect(Math.abs(tm.secondsToTicks(seconds) - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('degenerate curve (same BPM) matches step', () => {
    const tmCurve = new TempoMap(960, 120);
    tmCurve.setTempo(120, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });

    const tmStep = new TempoMap(960, 120);
    tmStep.setTempo(120, 3840 as Tick);

    expect(tmCurve.ticksToSeconds(3840 as Tick)).toBeCloseTo(tmStep.ticksToSeconds(3840 as Tick));
  });

  it('curve duration bounded by constant-BPM extremes', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });

    const curveSec = tm.ticksToSeconds(3840 as Tick);
    const fastSec = (3840 * 60) / (180 * 960); // all at fastest BPM
    const slowSec = (3840 * 60) / (120 * 960); // all at slowest BPM
    expect(curveSec).toBeGreaterThan(fastSec);
    expect(curveSec).toBeLessThan(slowSec);
  });
});
