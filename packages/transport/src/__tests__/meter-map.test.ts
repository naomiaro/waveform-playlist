// packages/transport/src/__tests__/meter-map.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MeterMap } from '../timeline/meter-map';

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
    expect(() => mm.setMeter(4, 4, -1)).toThrow();
  });
});
