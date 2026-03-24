import { describe, it, expect } from 'vitest';
import { SampleTimeline } from '../timeline/sample-timeline';
import { TempoMap } from '../timeline/tempo-map';

describe('SampleTimeline', () => {
  it('samplesToSeconds converts at given rate', () => {
    const st = new SampleTimeline(48000);
    expect(st.samplesToSeconds(48000)).toBe(1);
    expect(st.samplesToSeconds(24000)).toBe(0.5);
    expect(st.samplesToSeconds(0)).toBe(0);
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
    expect(st.secondsToSamples(st.samplesToSeconds(samples))).toBe(samples);
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
    expect(st.ticksToSamples(960)).toBe(24000);
    expect(st.ticksToSamples(1920)).toBe(48000);
    expect(st.ticksToSamples(0)).toBe(0);
  });

  it('samplesToTicks converts via seconds', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    expect(st.samplesToTicks(24000)).toBe(960);
    expect(st.samplesToTicks(48000)).toBe(1920);
    expect(st.samplesToTicks(0)).toBe(0);
  });

  it('tick-sample round-trip is exact', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    const ticks = 4800;
    expect(st.samplesToTicks(st.ticksToSamples(ticks))).toBe(ticks);
  });

  it('ticksToSamples throws if no tempoMap set', () => {
    const st = new SampleTimeline(48000);
    expect(() => st.ticksToSamples(960)).toThrow();
  });
});
