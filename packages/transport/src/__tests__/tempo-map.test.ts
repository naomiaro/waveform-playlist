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

    // Total duration should match — slope 0.5 is inside the linear fast path,
    // so the curve segment integrates with the same exact ln() formula.
    const curveSec = tmCurve.ticksToSeconds(3840 as Tick);
    const linearSec = tmLinear.ticksToSeconds(3840 as Tick);
    expect(Math.abs(curveSec - linearSec) * 1000).toBeLessThan(0.1); // within 0.1ms
  });

  it('curve round-trips via the closed-form inverse', () => {
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

describe('TempoMap BPM validation', () => {
  it('rejects zero, negative, and non-finite BPM in setTempo', () => {
    const map = new TempoMap(960, 120);
    // bpm <= 0 poisons the secondsAtTick cache (Infinity / non-monotonic
    // values that break the secondsToTicks binary search) — reject at the
    // boundary like curve-slope validation already does.
    expect(() => map.setTempo(0)).toThrow(/finite positive/);
    expect(() => map.setTempo(-120, 960 as Tick)).toThrow(/finite positive/);
    expect(() => map.setTempo(NaN)).toThrow(/finite positive/);
    expect(() => map.setTempo(Infinity)).toThrow(/finite positive/);
  });

  it('rejects an invalid initial BPM in the constructor', () => {
    expect(() => new TempoMap(960, 0)).toThrow(/finite positive/);
    expect(() => new TempoMap(960, -1)).toThrow(/finite positive/);
  });

  it('a rejected setTempo leaves the map unchanged', () => {
    const map = new TempoMap(960, 120);
    map.setTempo(140, 960 as Tick);
    expect(() => map.setTempo(0, 1920 as Tick)).toThrow();
    expect(map.getTempo(1920 as Tick)).toBe(140); // still the prior tempo
    expect(map.ticksToSeconds(960 as Tick)).toBeCloseTo(0.5, 12);
  });
});

describe('TempoMap.removeTempo', () => {
  it('removes an entry and recomputes the seconds cache for later entries', () => {
    const map = new TempoMap(960, 120);
    map.setTempo(60, 960 as Tick); // beat 2 onward at 60 BPM
    map.setTempo(240, 1920 as Tick); // beat 3 onward at 240 BPM
    // With the 60 BPM entry: t(1920) = 0.5 + 1.0 = 1.5s
    expect(map.ticksToSeconds(1920 as Tick)).toBeCloseTo(1.5, 12);

    map.removeTempo(960 as Tick);
    // Now 120 BPM holds until tick 1920: t(1920) = 1.0s, and the 240 BPM
    // entry's cached secondsAtTick must have been recomputed.
    expect(map.ticksToSeconds(1920 as Tick)).toBeCloseTo(1.0, 12);
    expect(map.ticksToSeconds(2880 as Tick)).toBeCloseTo(1.25, 12); // +1 beat at 240
    expect(map.getTempo(960 as Tick)).toBe(120);
  });

  it('treats tick 0 as permanent and unknown ticks as no-ops', () => {
    const map = new TempoMap(960, 120);
    map.setTempo(60, 960 as Tick);
    map.removeTempo(0 as Tick); // permanent
    map.removeTempo(480 as Tick); // no entry there
    expect(map.getTempo(0 as Tick)).toBe(120);
    expect(map.getTempo(960 as Tick)).toBe(60);
  });
});

describe('TempoMap.entryCount', () => {
  it('returns 1 for a new map', () => {
    const map = new TempoMap();
    expect(map.entryCount).toBe(1);
  });

  it('increments when an entry is added at a later tick', () => {
    const map = new TempoMap();
    map.setTempo(140, 960 as Tick);
    expect(map.entryCount).toBe(2);
  });

  it('stays 1 when the tick-0 entry is overwritten', () => {
    const map = new TempoMap();
    map.setTempo(90);
    expect(map.entryCount).toBe(1);
  });

  it('decrements when an entry is removed', () => {
    const map = new TempoMap();
    map.setTempo(140, 960 as Tick);
    map.removeTempo(960 as Tick);
    expect(map.entryCount).toBe(1);
  });
});

describe('TempoMap curve integration accuracy', () => {
  const ppqn = 960;
  const BAR = 4 * ppqn;

  /** Möbius-Ease normalized curve, written with expm1 so the reference keeps
   *  full precision as slope → 0.5 (the pow(r, 2x) − 1 form cancels there). */
  function curveRef(x: number, slope: number): number {
    const d = 1 - 2 * slope;
    const c = 2 * Math.log1p(d / slope);
    return ((slope * slope) / d) * Math.expm1(c * x);
  }

  /** Independent reference: composite Simpson over bpm(x) with 20k panels.
   *  Error is O(h^4) ≈ 1e-17 relative for these smooth, monotone curves. */
  function referenceSeconds(
    ticks: number,
    bpm0: number,
    bpm1: number,
    segmentTicks: number,
    slope: number
  ): number {
    const n = 20000;
    const h = ticks / n;
    const f = (t: number) =>
      60 / (ppqn * (bpm0 + curveRef(t / segmentTicks, slope) * (bpm1 - bpm0)));
    let sum = f(0) + f(ticks);
    for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(i * h);
    return (sum * h) / 3;
  }

  const ONE_MICROSECOND = 1e-6;
  // 0.4999991 / 0.5000009 sit INSIDE a 1e-6 linear window (the old fast
  // path): the curve there differs from linear by ~1e-6 relative (0.38 ms on
  // a 256-bar ramp), so a linear shortcut would fail the 1 µs bar. 1e-6 and
  // 1 − 1e-6 drive the plain forward form (1 + y ≤ 0.5) and the inverse's
  // product form, which the moderate slopes never reach.
  const slopes = [1e-6, 0.05, 0.2, 0.45, 0.4999991, 0.5000009, 0.55, 0.8, 0.95, 1 - 1e-6];
  const ramps: Array<[number, number]> = [
    [60, 240],
    [200, 40],
    [120, 180],
    [10, 300],
    [300, 10],
  ];

  it.each([1, 16, 256])('%i-bar curved ramp integrates within 1 µs of reference', (bars) => {
    const segment = bars * BAR;
    for (const [bpm0, bpm1] of ramps) {
      for (const slope of slopes) {
        const tm = new TempoMap(ppqn, bpm0);
        tm.setTempo(bpm1, segment as Tick, { interpolation: { type: 'curve', slope } });
        for (const fraction of [0.1, 0.5, 0.999, 1]) {
          const ticks = Math.round(segment * fraction);
          const expected = referenceSeconds(ticks, bpm0, bpm1, segment, slope);
          const actual = tm.ticksToSeconds(ticks as Tick);
          expect(
            Math.abs(actual - expected),
            `bars=${bars} ${bpm0}->${bpm1} slope=${slope} fraction=${fraction}`
          ).toBeLessThan(ONE_MICROSECOND);
        }
      }
    }
  });

  it('long curved ramp round-trips secondsToTicks within 1 tick', () => {
    const segment = 256 * BAR;
    const tm = new TempoMap(ppqn, 60);
    tm.setTempo(240, segment as Tick, { interpolation: { type: 'curve', slope: 0.8 } });
    for (const fraction of [0.01, 0.25, 0.5, 0.75, 0.99]) {
      const tick = Math.round(segment * fraction) as Tick;
      const roundTrip = tm.secondsToTicks(tm.ticksToSeconds(tick));
      expect(Math.abs(roundTrip - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('slope inside a 1e-6 window of 0.5 integrates the curve itself, not the linear approximation', () => {
    const segment = 256 * BAR;
    const tmLinear = new TempoMap(ppqn, 120);
    tmLinear.setTempo(180, segment as Tick, { interpolation: 'linear' });
    const tmCurve = new TempoMap(ppqn, 120);
    tmCurve.setTempo(180, segment as Tick, { interpolation: { type: 'curve', slope: 0.5000005 } });
    // 0.5000005 is inside a 1e-6 window. There the curve differs from linear
    // by ~5e-7 relative (≈0.06 ms on this 415 s ramp) — a linear shortcut
    // would miss the 1 µs bar. The reference comparison pins the curve itself.
    const expected = referenceSeconds(segment, 120, 180, segment, 0.5000005);
    expect(Math.abs(tmCurve.ticksToSeconds(segment as Tick) - expected)).toBeLessThan(
      ONE_MICROSECOND
    );
    expect(tmCurve.ticksToSeconds(segment as Tick)).toBeCloseTo(
      tmLinear.ticksToSeconds(segment as Tick),
      2
    );
  });

  it('ramp with bpm0 just off the curve offset (A/B ≈ 1e-8) stays within 1 µs', () => {
    // Between A = 0 and |A/B| ≈ 1e-5 the plain (c·x − ln(bpm/bpm0))/(c·A) form
    // cancels catastrophically (18 µs at 1e-8 on this ramp); the log1p form
    // must take over there.
    const segment = 256 * BAR;
    const tm = new TempoMap(ppqn, 20.0000002);
    tm.setTempo(180, segment as Tick, { interpolation: { type: 'curve', slope: 0.25 } });
    for (const fraction of [0.5, 1]) {
      const ticks = Math.round(segment * fraction);
      const expected = referenceSeconds(ticks, 20.0000002, 180, segment, 0.25);
      expect(Math.abs(tm.ticksToSeconds(ticks as Tick) - expected)).toBeLessThan(ONE_MICROSECOND);
    }
  });

  it('closed-form inverse round-trips within 1 tick across extreme slopes, ratios and lengths', () => {
    // Flat-then-jump curves (slope → 0) and their mirror (slope → 1) stress the
    // inverse: forming e^(−c·x) as 1 + z loses tens of ticks (up to ~39 in
    // this grid, 300 → 10 at slope 1e-6 near the end); the product form keeps
    // it exact.
    const segment = 1024 * BAR;
    const extremeSlopes = [1e-6, 0.05, 0.25, 0.4999991, 0.5000009, 0.8, 0.95, 1 - 1e-6];
    const ramps: Array<[number, number]> = [
      [10, 300],
      [300, 10],
      [180, 20],
      [20, 180],
      [20.0000002, 180],
      [320, 20],
    ];
    for (const [bpm0, bpm1] of ramps) {
      for (const slope of extremeSlopes) {
        const tm = new TempoMap(ppqn, bpm0);
        tm.setTempo(bpm1, segment as Tick, { interpolation: { type: 'curve', slope } });
        for (const fraction of [0.001, 0.1, 0.5, 0.9, 0.999, 1]) {
          const tick = Math.round(segment * fraction) as Tick;
          const roundTrip = tm.secondsToTicks(tm.ticksToSeconds(tick));
          expect(
            Math.abs(roundTrip - tick),
            `${bpm0}->${bpm1} slope=${slope} fraction=${fraction}`
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('curveNormalizedAt matches the published pow form, not just the expm1 rewrite', () => {
    // getTempo at 37% of a 120 → 180 ramp at slope 0.3, against
    // (p²/(1−2p))·(((1−p)/p)^(2x) − 1) written out literally.
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });
    const x = 1421 / 3840;
    const expected = 120 + 60 * ((0.09 / 0.4) * (Math.pow(7 / 3, 2 * x) - 1));
    expect(tm.getTempo(1421 as Tick)).toBeCloseTo(expected, 10);
  });

  it('slope exactly 0.5 is the linear path, bit for bit, in both directions', () => {
    const linear = new TempoMap(960, 120);
    linear.setTempo(180, 3840 as Tick, { interpolation: 'linear' });
    const curve = new TempoMap(960, 120);
    curve.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.5 } });
    expect(curve.ticksToSeconds(1920 as Tick)).toBe(linear.ticksToSeconds(1920 as Tick));
    expect(curve.secondsToTicks(curve.ticksToSeconds(1920 as Tick))).toBe(1920);
  });

  it('positions before tick 0 convert at the constant initial tempo, whatever the first segment is', () => {
    // Before the timeline starts the tempo is the tick-0 tempo. Extrapolating
    // a ramp backwards instead is undefined past its asymptote (a convex
    // decreasing curve went to NaN at −1 s) and dawcore drags do reach
    // negative seconds before they clamp.
    const step = new TempoMap(960, 120);
    step.setTempo(180, 3840 as Tick);
    const linear = new TempoMap(960, 120);
    linear.setTempo(180, 3840 as Tick, { interpolation: 'linear' });
    const curve = new TempoMap(960, 120);
    curve.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });
    for (const tm of [step, linear, curve]) {
      expect(tm.secondsToTicks(-0.5)).toBe(-960); // 120 BPM × 960 PPQN = 1920 ticks/s
      expect(tm.ticksToSeconds(-960 as Tick)).toBeCloseTo(-0.5, 12);
    }
    const convexDown = new TempoMap(960, 180);
    convexDown.setTempo(60, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.9 } });
    expect(convexDown.secondsToTicks(-1)).toBe(-2880);
    expect(Number.isFinite(convexDown.secondsToTicks(-1e4))).toBe(true);
  });

  it('non-finite input is rejected instead of leaking NaN into the scheduler', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(180, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });
    expect(() => tm.secondsToTicks(NaN)).toThrow(/finite/);
    expect(() => tm.secondsToTicks(Infinity)).toThrow(/finite/);
    expect(() => tm.ticksToSeconds(NaN as Tick)).toThrow(/finite/);
    expect(() => tm.ticksToSeconds(-Infinity as Tick)).toThrow(/finite/);
  });

  it('ramp where bpm0 equals the curve offset (A = 0) stays finite and accurate', () => {
    // bpm(x) = bpm0 + Δ·k·(r^2x − 1) with k = p²/(1−2p); at slope 0.25, k = 1/8,
    // so bpm0 = Δ/8 (20 → 180) makes the constant term vanish — a pure exponential.
    const segment = 4 * BAR;
    const tm = new TempoMap(ppqn, 20);
    tm.setTempo(180, segment as Tick, { interpolation: { type: 'curve', slope: 0.25 } });
    const actual = tm.ticksToSeconds(segment as Tick);
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs(actual - referenceSeconds(segment, 20, 180, segment, 0.25))).toBeLessThan(
      ONE_MICROSECOND
    );
  });
});

describe('TempoMap fractional conversions (#636)', () => {
  // 120 BPM × 960 PPQN = 1920 ticks per second → 0.0005 s is 0.96 ticks.
  it('secondsToTicksExact returns the unrounded tick position', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.secondsToTicksExact(0.0005)).toBeCloseTo(0.96, 10);
  });

  it('secondsToTicks rounds that exact value once, at the integer-Tick boundary', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.secondsToTicks(0.0005)).toBe(1);
    expect(tm.secondsToTicks(0.00025)).toBe(0); // 0.48 ticks
  });

  it('secondsToTicksExact round-trips fractional ticks through step, linear and curve segments', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(160, 3840 as Tick, { interpolation: { type: 'curve', slope: 0.3 } });
    tm.setTempo(100, 7680 as Tick, { interpolation: 'linear' });
    tm.setTempo(100, 11520 as Tick);
    for (const tick of [1234.5, 5000.25, 9000.75, 12000.125]) {
      const seconds = tm.ticksToSeconds(tick as Tick);
      expect(tm.secondsToTicksExact(seconds)).toBeCloseTo(tick, 6);
    }
  });

  it('secondsToBeats is continuous, not quantised to whole ticks', () => {
    const tm = new TempoMap(960, 120);
    // 0.96 ticks = 0.001 beats; the old integer path returned 1/960 ≈ 0.00104.
    expect(tm.secondsToBeats(0.0005)).toBeCloseTo(0.001, 10);
  });
});
