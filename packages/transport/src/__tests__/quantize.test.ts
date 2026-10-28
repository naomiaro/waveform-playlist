import { describe, it, expect } from 'vitest';
import { quantizeTick } from '../timeline/quantize';
import { MeterMap } from '../timeline/meter-map';
import type { Tick } from '../types';

const PPQN = 960;
const EIGHTH = 480;
const QUARTER = 960;

describe('quantizeTick', () => {
  const fourFour = () => new MeterMap(PPQN, 4, 4);

  it('nearest snaps down below the midpoint and up above it', () => {
    expect(quantizeTick(fourFour(), 100 as Tick, EIGHTH)).toBe(0);
    expect(quantizeTick(fourFour(), 400 as Tick, EIGHTH)).toBe(480);
  });

  it('nearest breaks an exact tie upward', () => {
    expect(quantizeTick(fourFour(), 240 as Tick, EIGHTH)).toBe(480);
  });

  it('previous floors and next ceils', () => {
    expect(quantizeTick(fourFour(), 400 as Tick, EIGHTH, { mode: 'previous' })).toBe(0);
    expect(quantizeTick(fourFour(), 100 as Tick, EIGHTH, { mode: 'next' })).toBe(480);
  });

  it('a tick already on a grid line stays put in every mode', () => {
    for (const mode of ['nearest', 'previous', 'next'] as const) {
      expect(quantizeTick(fourFour(), 960 as Tick, EIGHTH, { mode })).toBe(960);
    }
  });

  it('strength scales the move toward the grid line', () => {
    // 400 → 480 is +80; half strength lands on 440.
    expect(quantizeTick(fourFour(), 400 as Tick, EIGHTH, { strength: 0.5 })).toBe(440);
    expect(quantizeTick(fourFour(), 400 as Tick, EIGHTH, { strength: 0 })).toBe(400);
  });

  it('grid lines restart at each bar line so odd meters stay aligned', () => {
    // 7/8: a bar is 3.5 quarters = 3360 ticks. Quarter-note lines fall at
    // 0, 960, 1920, 2880 and then the NEXT BAR at 3360 — never at 3840.
    const sevenEight = new MeterMap(PPQN, 7, 8);
    expect(quantizeTick(sevenEight, 3200 as Tick, QUARTER, { mode: 'next' })).toBe(3360);
    expect(quantizeTick(sevenEight, 3200 as Tick, QUARTER, { mode: 'previous' })).toBe(2880);
    expect(quantizeTick(sevenEight, 3200 as Tick, QUARTER)).toBe(3360);
    // Second bar's grid is anchored at 3360, not at a multiple of 960.
    expect(quantizeTick(sevenEight, 3400 as Tick, QUARTER, { mode: 'previous' })).toBe(3360);
    expect(quantizeTick(sevenEight, 4000 as Tick, QUARTER, { mode: 'next' })).toBe(4320);
  });

  it("'bar' and 'beat' subdivisions follow the meter in force at the tick", () => {
    // Two bars of 4/4 (7680 ticks) then 3/4 (2880 ticks per bar).
    const map = new MeterMap(PPQN, 4, 4);
    map.setMeter(3, 4, 7680 as Tick);
    expect(quantizeTick(map, 8000 as Tick, 'bar', { mode: 'previous' })).toBe(7680);
    expect(quantizeTick(map, 8000 as Tick, 'bar', { mode: 'next' })).toBe(10560);
    expect(quantizeTick(map, 5000 as Tick, 'bar', { mode: 'next' })).toBe(7680);
    // 6/8: a beat is an eighth (480 ticks). 700 is nearer 480 than 960.
    const sixEight = new MeterMap(PPQN, 6, 8);
    expect(quantizeTick(sixEight, 700 as Tick, 'beat')).toBe(480);
    expect(quantizeTick(sixEight, 700 as Tick, 'beat', { mode: 'next' })).toBe(960);
  });

  it('a subdivision larger than the bar snaps to bar lines', () => {
    // 3/4 bar = 2880 ticks; a whole-note (3840) step cannot fit, so the only
    // lines are the bar lines.
    const threeFour = new MeterMap(PPQN, 3, 4);
    expect(quantizeTick(threeFour, 3000 as Tick, 3840, { mode: 'previous' })).toBe(2880);
    expect(quantizeTick(threeFour, 3000 as Tick, 3840, { mode: 'next' })).toBe(5760);
  });

  it('accepts a fractional tick position and returns an integer line', () => {
    expect(quantizeTick(fourFour(), 479.6, EIGHTH)).toBe(480);
    expect(quantizeTick(fourFour(), 0.4, EIGHTH, { mode: 'next' })).toBe(480);
  });

  it('returns integer ticks even with a fractional strength', () => {
    const result = quantizeTick(fourFour(), 401 as Tick, EIGHTH, { strength: 0.3 });
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(425); // 401 + 0.3 × 79 = 424.7
  });

  it('rejects invalid input instead of guessing', () => {
    expect(() => quantizeTick(fourFour(), -1 as Tick, EIGHTH)).toThrow(/tick/);
    expect(() => quantizeTick(fourFour(), NaN as Tick, EIGHTH)).toThrow(/tick/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, 0)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, -480)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, 480.5)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { strength: 1.5 })).toThrow(
      /strength/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { strength: -0.1 })).toThrow(
      /strength/
    );
  });
});
