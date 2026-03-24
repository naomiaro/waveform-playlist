import { describe, it, expect } from 'vitest';
import { SampleTimeline } from '../timeline/sample-timeline';

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
