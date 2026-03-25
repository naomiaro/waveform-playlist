// packages/transport/src/__tests__/meter-map.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MeterMap } from '../timeline/meter-map';
import type { Tick } from '../types';

describe('MeterMap', () => {
  it('defaults to 4/4', () => {
    const mm = new MeterMap(960);
    const meter = mm.getMeter();
    expect(meter.numerator).toBe(4);
    expect(meter.denominator).toBe(4);
  });

  it('constructor accepts initial meter', () => {
    const mm = new MeterMap(960, 6, 8);
    const meter = mm.getMeter();
    expect(meter.numerator).toBe(6);
    expect(meter.denominator).toBe(8);
  });

  it('ticksPerBeat for 4/4 at 960 PPQN', () => {
    const mm = new MeterMap(960);
    expect(mm.ticksPerBeat()).toBe(960); // quarter note
  });

  it('ticksPerBeat for 6/8 at 960 PPQN', () => {
    const mm = new MeterMap(960, 6, 8);
    expect(mm.ticksPerBeat()).toBe(480); // eighth note
  });

  it('ticksPerBar for 4/4', () => {
    const mm = new MeterMap(960);
    expect(mm.ticksPerBar()).toBe(3840);
  });

  it('ticksPerBar for 7/8', () => {
    const mm = new MeterMap(960, 7, 8);
    expect(mm.ticksPerBar()).toBe(3360);
  });

  it('ticksPerBar for 6/8', () => {
    const mm = new MeterMap(960, 6, 8);
    expect(mm.ticksPerBar()).toBe(2880);
  });

  it('ppqn getter returns PPQN', () => {
    const mm = new MeterMap(960);
    expect(mm.ppqn).toBe(960);
  });

  it('setMeter at tick 0 replaces default', () => {
    const mm = new MeterMap(960);
    mm.setMeter(3, 4);
    expect(mm.getMeter().numerator).toBe(3);
    expect(mm.getMeter().denominator).toBe(4);
  });

  it('validates numerator is positive integer', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(0, 4)).toThrow();
    expect(() => mm.setMeter(-1, 4)).toThrow();
    expect(() => mm.setMeter(1.5, 4)).toThrow();
  });

  it('validates denominator is power of 2', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(4, 3)).toThrow();
    expect(() => mm.setMeter(4, 5)).toThrow();
    expect(() => mm.setMeter(4, 0)).toThrow();
  });

  it('accepts denominator 1 (whole note) and 16', () => {
    const mm = new MeterMap(960);
    mm.setMeter(4, 1);
    expect(mm.ticksPerBeat()).toBe(3840); // whole note
    mm.setMeter(4, 16);
    expect(mm.ticksPerBeat()).toBe(240); // sixteenth note
  });

  it('validates atTick is non-negative', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(4, 4, -1 as Tick)).toThrow();
  });

  it('setMeter at bar boundary inserts entry', () => {
    const mm = new MeterMap(960); // 4/4, ticksPerBar = 3840
    mm.setMeter(7, 8, 3840 as Tick); // switch to 7/8 at bar 2
    expect(mm.getMeter(0 as Tick).numerator).toBe(4);
    expect(mm.getMeter(3840 as Tick).numerator).toBe(7);
    expect(mm.getMeter(3840 as Tick).denominator).toBe(8);
  });

  it('setMeter snaps to bar boundary with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mm = new MeterMap(960); // 4/4, ticksPerBar = 3840
    mm.setMeter(3, 4, 1000 as Tick); // mid-bar → snaps to 3840
    expect(warnSpy).toHaveBeenCalled();
    expect(mm.getMeter(3840 as Tick).numerator).toBe(3);
    // No entry at the original tick — it was snapped
    expect(mm.getMeter(1000 as Tick).numerator).toBe(4); // still 4/4
    warnSpy.mockRestore();
  });

  it('setMeter at tick 0 preserves downstream entries (re-snapped)', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick); // bar 2 in 4/4
    mm.setMeter(6, 8); // change tick 0 to 6/8 (ticksPerBar=2880)
    expect(mm.getMeter(0 as Tick).numerator).toBe(6);
    // 3840 is not on a 6/8 bar boundary — entry re-snapped to 5760 (2*2880)
    expect(mm.getMeter(3840 as Tick).numerator).toBe(6); // still 6/8 at 3840
    expect(mm.getMeter(5760 as Tick).numerator).toBe(7); // 7/8 moved here
  });

  it('clearMeters preserves non-default initial meter', () => {
    const mm = new MeterMap(960, 6, 8);
    mm.setMeter(4, 4, 2880 as Tick);
    mm.clearMeters();
    expect(mm.getMeter().numerator).toBe(6);
    expect(mm.getMeter().denominator).toBe(8);
  });

  it('barToTick round-trips after removeMeter', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    mm.removeMeter(3840 as Tick);
    // After removal, back to 4/4 everywhere
    expect(mm.barToTick(2)).toBe(3840);
    expect(mm.barToTick(3)).toBe(7680);
    expect(mm.tickToBar(3840 as Tick)).toBe(2);
  });

  it('barToTick with single meter', () => {
    const mm = new MeterMap(960); // 4/4
    expect(mm.barToTick(1)).toBe(0);
    expect(mm.barToTick(2)).toBe(3840);
    expect(mm.barToTick(3)).toBe(7680);
  });

  it('barToTick with mixed meters', () => {
    const mm = new MeterMap(960); // 4/4
    mm.setMeter(7, 8, 3840 as Tick); // bar 2 starts 7/8 (ticksPerBar = 3360)
    expect(mm.barToTick(1)).toBe(0); // bar 1: 4/4
    expect(mm.barToTick(2)).toBe(3840); // bar 2: 7/8 starts
    expect(mm.barToTick(3)).toBe(3840 + 3360); // bar 3: still 7/8
  });

  it('tickToBar with single meter', () => {
    const mm = new MeterMap(960);
    expect(mm.tickToBar(0 as Tick)).toBe(1);
    expect(mm.tickToBar(3840 as Tick)).toBe(2);
    expect(mm.tickToBar(5000 as Tick)).toBe(2); // mid-bar 2
  });

  it('tickToBar with mixed meters', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    expect(mm.tickToBar(0 as Tick)).toBe(1);
    expect(mm.tickToBar(3840 as Tick)).toBe(2);
    expect(mm.tickToBar((3840 + 3360) as Tick)).toBe(3);
  });

  it('isBarBoundary', () => {
    const mm = new MeterMap(960); // 4/4
    expect(mm.isBarBoundary(0 as Tick)).toBe(true);
    expect(mm.isBarBoundary(960 as Tick)).toBe(false); // beat 2
    expect(mm.isBarBoundary(3840 as Tick)).toBe(true); // bar 2
  });

  it('isBarBoundary with 6/8', () => {
    const mm = new MeterMap(960, 6, 8); // ticksPerBar = 2880
    expect(mm.isBarBoundary(0 as Tick)).toBe(true);
    expect(mm.isBarBoundary(480 as Tick)).toBe(false); // beat 2 (eighth note)
    expect(mm.isBarBoundary(2880 as Tick)).toBe(true); // bar 2
  });

  it('removeMeter removes entry', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    mm.removeMeter(3840 as Tick);
    expect(mm.getMeter(3840 as Tick).numerator).toBe(4); // back to 4/4
  });

  it('removeMeter at tick 0 throws', () => {
    const mm = new MeterMap(960);
    expect(() => mm.removeMeter(0 as Tick)).toThrow();
  });

  it('clearMeters resets to single entry', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    mm.setMeter(3, 4, 7200 as Tick);
    mm.clearMeters();
    expect(mm.getMeter(3840 as Tick).numerator).toBe(4); // default 4/4
  });

  it('barToTick round-trips with tickToBar', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    for (let bar = 1; bar <= 10; bar++) {
      const tick = mm.barToTick(bar);
      expect(mm.tickToBar(tick)).toBe(bar);
    }
  });

  it('setMeter at tick 0 re-snaps downstream entries', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick); // bar 2 in 4/4
    mm.setMeter(6, 8); // change tick 0 to 6/8 (ticksPerBar=2880)
    // 3840 is not on a 6/8 bar boundary (3840/2880=1.33)
    // Should snap to 2880*2=5760
    // Verify barToTick still round-trips
    const bar2Tick = mm.barToTick(2);
    expect(mm.tickToBar(bar2Tick)).toBe(2);
    // barAtTick should be integer
    expect(Number.isInteger(mm.tickToBar(bar2Tick))).toBe(true);
  });

  it('setMeter updating an existing non-zero entry recomputes cache', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick);
    // Update the same tick with different meter
    mm.setMeter(5, 4, 3840 as Tick);
    expect(mm.getMeter(3840 as Tick).numerator).toBe(5);
    expect(mm.getMeter(3840 as Tick).denominator).toBe(4);
    // barToTick should still work
    expect(mm.barToTick(2)).toBe(3840);
    expect(mm.tickToBar(3840 as Tick)).toBe(2);
  });

  it('barToTick throws for bar < 1', () => {
    const mm = new MeterMap(960);
    expect(() => mm.barToTick(0)).toThrow();
    expect(() => mm.barToTick(-1)).toThrow();
  });

  it('removeMeter warns for non-existent tick', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mm = new MeterMap(960);
    mm.removeMeter(9999 as Tick);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no entry at tick'));
    warnSpy.mockRestore();
  });

  it('isBarBoundary with mixed meters: old bar boundary is not bar boundary in new meter', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840 as Tick); // bar 2 starts 7/8 (ticksPerBar=3360)
    // 7680 was bar 3 in 4/4 (2*3840), but in 7/8 section:
    // 7680 - 3840 = 3840, 3840 % 3360 = 480 ≠ 0
    expect(mm.isBarBoundary(7680 as Tick)).toBe(false);
    // Actual bar 3 in 7/8: 3840 + 3360 = 7200
    expect(mm.isBarBoundary(7200 as Tick)).toBe(true);
  });
});
