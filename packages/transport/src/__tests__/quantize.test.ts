import { describe, it, expect } from 'vitest';
import { quantizeTick } from '../timeline/quantize';
import { MeterMap } from '../timeline/meter-map';
import type { Tick } from '../types';

const PPQN = 960;
const EIGHTH = { ticks: 480 };
const QUARTER = { ticks: 960 };

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
    expect(quantizeTick(threeFour, 3000 as Tick, { ticks: 3840 }, { mode: 'previous' })).toBe(2880);
    expect(quantizeTick(threeFour, 3000 as Tick, { ticks: 3840 }, { mode: 'next' })).toBe(5760);
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

  it('a tick within float noise of a grid line counts as on the line', () => {
    // timeToTickExact() at 120 BPM yields values like 1920.0000000000002 for a
    // note exactly on a beat; 'next'/'previous' must not jump a whole step.
    expect(quantizeTick(fourFour(), 959.9999999999999, EIGHTH, { mode: 'previous' })).toBe(960);
    expect(quantizeTick(fourFour(), 960.0000000000001, EIGHTH, { mode: 'next' })).toBe(960);
    expect(quantizeTick(fourFour(), 1920.0000000000002, EIGHTH, { mode: 'next' })).toBe(1920);
    expect(quantizeTick(fourFour(), 1919.9999999999998, EIGHTH, { mode: 'previous' })).toBe(1920);
  });

  it('rejects a subdivision that is neither a tick count nor bar/beat', () => {
    expect(() => quantizeTick(fourFour(), 100 as Tick, '8n' as never)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, undefined as never)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, null as never)).toThrow(/subdivision/);
  });

  it('a meter change mid-bar-count anchors the grid at the new entry', () => {
    // 4/4 for one bar (3840), then 3/4: bar 2 starts at 3840 and is 2880 long,
    // so a quarter grid in bar 2 is 3840, 4800, 5760, then bar 3 at 6720.
    const map = new MeterMap(PPQN, 4, 4);
    map.setMeter(3, 4, 3840 as Tick);
    expect(quantizeTick(map, 6000 as Tick, QUARTER, { mode: 'previous' })).toBe(5760);
    expect(quantizeTick(map, 6000 as Tick, QUARTER, { mode: 'next' })).toBe(6720);
    expect(quantizeTick(map, 6000 as Tick, 'bar', { mode: 'next' })).toBe(6720);
  });

  it('note-value subdivisions are PPQN-independent: { note: 8 } is an eighth at any ppqn', () => {
    expect(quantizeTick(fourFour(), 400 as Tick, { note: 8 })).toBe(480);
    const fine = new MeterMap(1920, 4, 4);
    expect(quantizeTick(fine, 800 as Tick, { note: 8 })).toBe(960);
    // dotted eighth = 720 ticks, eighth triplet = 320 ticks at 960 PPQN
    expect(quantizeTick(fourFour(), 700 as Tick, { note: 8, dotted: true })).toBe(720);
    expect(quantizeTick(fourFour(), 330 as Tick, { note: 8, triplet: true })).toBe(320);
  });

  it('float tolerance also applies at the clamped next-bar line', () => {
    const sevenEight = new MeterMap(PPQN, 7, 8); // bar = 3360
    expect(quantizeTick(sevenEight, 3359.9999999999995, QUARTER, { mode: 'previous' })).toBe(3360);
    expect(quantizeTick(sevenEight, 3359.9999999999995, QUARTER, { mode: 'next' })).toBe(3360);
    const map = new MeterMap(PPQN, 4, 4);
    map.setMeter(3, 4, 7680 as Tick);
    expect(quantizeTick(map, 7679.999999999999, QUARTER, { mode: 'previous' })).toBe(7680);
  });

  it('strength scales the move in every mode', () => {
    expect(quantizeTick(fourFour(), 400 as Tick, EIGHTH, { mode: 'previous', strength: 0.5 })).toBe(
      200
    );
    expect(quantizeTick(fourFour(), 100 as Tick, EIGHTH, { mode: 'next', strength: 0.25 })).toBe(
      195
    );
  });

  it('strength 0 on a fractional tick returns the nearest integer, not a grid line', () => {
    expect(quantizeTick(fourFour(), 200.4, EIGHTH, { strength: 0 })).toBe(200);
    expect(quantizeTick(fourFour(), 200.6, EIGHTH, { strength: 0 })).toBe(201);
  });

  it('a tick exactly on a meter-change entry stays put in every mode and unit', () => {
    const map = new MeterMap(PPQN, 4, 4);
    map.setMeter(3, 4, 7680 as Tick);
    for (const mode of ['nearest', 'previous', 'next'] as const) {
      expect(quantizeTick(map, 7680 as Tick, QUARTER, { mode })).toBe(7680);
      expect(quantizeTick(map, 7680 as Tick, 'bar', { mode })).toBe(7680);
      expect(quantizeTick(map, 7680 as Tick, 'beat', { mode })).toBe(7680);
    }
    // Approaching the entry from a grid that does not divide the old bar:
    // step 720 in 4/4 → lines 0, 720, …, 3600, then the entry at 3840.
    const odd = new MeterMap(PPQN, 4, 4);
    odd.setMeter(3, 4, 3840 as Tick);
    expect(quantizeTick(odd, 3700 as Tick, { ticks: 720 }, { mode: 'next' })).toBe(3840);
    expect(quantizeTick(odd, 3700 as Tick, { ticks: 720 })).toBe(3600);
  });

  it("'beat' in 7/8 is an eighth and restarts at the bar line", () => {
    const sevenEight = new MeterMap(PPQN, 7, 8);
    expect(quantizeTick(sevenEight, 3300 as Tick, 'beat', { mode: 'previous' })).toBe(2880);
    expect(quantizeTick(sevenEight, 3300 as Tick, 'beat', { mode: 'next' })).toBe(3360);
    expect(quantizeTick(sevenEight, 3400 as Tick, 'beat', { mode: 'previous' })).toBe(3360);
  });

  it('a subdivision equal to the bar behaves like bar', () => {
    expect(quantizeTick(fourFour(), 5000 as Tick, { ticks: 3840 }, { mode: 'previous' })).toBe(
      3840
    );
    expect(quantizeTick(fourFour(), 5000 as Tick, { ticks: 3840 }, { mode: 'next' })).toBe(7680);
    expect(quantizeTick(fourFour(), 5000 as Tick, 'bar', { mode: 'next' })).toBe(7680);
  });

  it('stays exact at very large tick positions', () => {
    expect(quantizeTick(fourFour(), 960_000_000_100, EIGHTH, { mode: 'previous' })).toBe(
      960_000_000_000
    );
    expect(quantizeTick(fourFour(), 960_000_000_100, EIGHTH, { mode: 'next' })).toBe(
      960_000_000_480
    );
    expect(quantizeTick(fourFour(), 960_000_000_000, EIGHTH, { mode: 'next' })).toBe(
      960_000_000_000
    );
  });

  it('rejects invalid input instead of guessing', () => {
    expect(() => quantizeTick(fourFour(), -1 as Tick, EIGHTH)).toThrow(/tick/);
    expect(() => quantizeTick(fourFour(), NaN as Tick, EIGHTH)).toThrow(/tick/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, { ticks: 0 })).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, { ticks: -480 })).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, { ticks: 480.5 })).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, 480 as never)).toThrow(/subdivision/);
    expect(() => quantizeTick(fourFour(), 100 as Tick, { note: 0 } as never)).toThrow(
      /subdivision/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, { note: 3 } as never)).toThrow(
      /subdivision/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { mode: 'floor' as never })).toThrow(
      /mode/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { strength: NaN })).toThrow(
      /strength/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { strength: 1.5 })).toThrow(
      /strength/
    );
    expect(() => quantizeTick(fourFour(), 100 as Tick, EIGHTH, { strength: -0.1 })).toThrow(
      /strength/
    );
  });
});
