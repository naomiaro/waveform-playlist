import { describe, it, expect } from 'vitest';
import { SampleTimeline } from '../timeline/sample-timeline';
import { TempoMap } from '../timeline/tempo-map';
import type { Tick, Sample } from '../types';

describe('SampleTimeline', () => {
  it('samplesToSeconds converts at given rate', () => {
    const st = new SampleTimeline(48000);
    expect(st.samplesToSeconds(48000 as Sample)).toBe(1);
    expect(st.samplesToSeconds(24000 as Sample)).toBe(0.5);
    expect(st.samplesToSeconds(0 as Sample)).toBe(0);
  });

  it('secondsToSamples converts at given rate', () => {
    const st = new SampleTimeline(48000);
    expect(st.secondsToSamples(1)).toBe(48000);
    expect(st.secondsToSamples(0.5)).toBe(24000);
    expect(st.secondsToSamples(0)).toBe(0);
  });

  it('round-trips accurately', () => {
    const st = new SampleTimeline(44100);
    const samples = 123456;
    expect(st.secondsToSamples(st.samplesToSeconds(samples as Sample))).toBe(samples);
  });

  it('sampleRate getter returns rate', () => {
    const st = new SampleTimeline(44100);
    expect(st.sampleRate).toBe(44100);
  });
});

describe('SampleTimeline tick conversions', () => {
  it('ticksToSamples converts via seconds', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    // 960 ticks = 0.5s at 120 BPM = 24000 samples at 48kHz
    expect(st.ticksToSamples(960 as Tick)).toBe(24000);
    expect(st.ticksToSamples(1920 as Tick)).toBe(48000);
    expect(st.ticksToSamples(0 as Tick)).toBe(0);
  });

  it('samplesToTicks converts via seconds', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    expect(st.samplesToTicks(24000 as Sample)).toBe(960);
    expect(st.samplesToTicks(48000 as Sample)).toBe(1920);
    expect(st.samplesToTicks(0 as Sample)).toBe(0);
  });

  it('tick-sample round-trip is exact', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    const ticks = 4800;
    expect(st.samplesToTicks(st.ticksToSamples(ticks as Tick))).toBe(ticks);
  });

  it('ticksToSamples throws if no tempoMap set', () => {
    const st = new SampleTimeline(48000);
    expect(() => st.ticksToSamples(960 as Tick)).toThrow();
  });
});

describe('samplesToTicks integer contract', () => {
  it('returns integer ticks at a non-commensurate sample rate', () => {
    // 44100 Hz at 120 BPM/960 PPQN: 1 tick = 22.96875 samples — every
    // conversion involves rounding. The integer contract must hold at this
    // boundary, not by accident of TempoMap internals.
    const tempoMap = new TempoMap(960, 120);
    const timeline = new SampleTimeline(44100);
    timeline.setTempoMap(tempoMap);
    for (const ticks of [1, 7, 240, 961, 12345]) {
      const samples = timeline.ticksToSamples(ticks as Tick);
      const back = timeline.samplesToTicks(samples);
      expect(Number.isInteger(back as number)).toBe(true);
      expect(Math.abs((back as number) - ticks)).toBeLessThanOrEqual(0); // exact round-trip here
    }
  });
});
