import { describe, it, expect } from 'vitest';
import type { AudioClip } from '@waveform-playlist/core';
import { calculateBoundaryTrim } from '../utils/boundaryTrim';

const SAMPLE_RATE = 44100;
const SAMPLES_PER_PIXEL = 1000;

function makeClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: 441000, // 10 seconds of audio
    gain: 1,
    ...overrides,
  };
}

describe('calculateBoundaryTrim', () => {
  describe('zero delta returns unchanged values', () => {
    it('left boundary with zero delta', () => {
      const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 88200 });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 0,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'left',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(originalClip.startSample);
      expect(result.durationSamples).toBe(originalClip.durationSamples);
      expect(result.offsetSamples).toBe(originalClip.offsetSamples);
    });

    it('right boundary with zero delta', () => {
      const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 88200 });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 0,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(originalClip.startSample);
      expect(result.durationSamples).toBe(originalClip.durationSamples);
      expect(result.offsetSamples).toBe(originalClip.offsetSamples);
    });
  });

  describe('left boundary drag', () => {
    it('dragging right increases offset and startSample, decreases duration', () => {
      const clip = makeClip({
        id: 'c1',
        startSample: 44100,
        durationSamples: 88200,
        offsetSamples: 0,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag right by 10 pixels = 10000 samples
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 10,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'left',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(44100 + 10000);
      expect(result.durationSamples).toBe(88200 - 10000);
      expect(result.offsetSamples).toBe(0 + 10000);
    });

    it('dragging left decreases offset and startSample, increases duration', () => {
      const clip = makeClip({
        id: 'c1',
        startSample: 44100,
        durationSamples: 44100,
        offsetSamples: 44100,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag left by 10 pixels = -10000 samples
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: -10,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'left',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(44100 - 10000);
      expect(result.durationSamples).toBe(44100 + 10000);
      expect(result.offsetSamples).toBe(44100 - 10000);
    });
  });

  describe('right boundary drag', () => {
    it('dragging right increases only durationSamples', () => {
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 44100,
        offsetSamples: 0,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag right by 10 pixels = 10000 samples
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 10,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(0);
      expect(result.durationSamples).toBe(44100 + 10000);
      expect(result.offsetSamples).toBe(0);
    });

    it('dragging left decreases only durationSamples', () => {
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 88200,
        offsetSamples: 0,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag left by 10 pixels = -10000 samples
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: -10,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.startSample).toBe(0);
      expect(result.durationSamples).toBe(88200 - 10000);
      expect(result.offsetSamples).toBe(0);
    });
  });

  describe('minimum duration constraint', () => {
    it('left boundary cannot shrink clip below minimum duration', () => {
      // Minimum duration = floor(0.1 * 44100) = 4410 samples
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 10000,
        offsetSamples: 0,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Try to drag right by 100 pixels = 100000 samples (far exceeds clip duration)
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 100,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'left',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      const minDuration = Math.floor(0.1 * SAMPLE_RATE); // 4410
      expect(result.durationSamples).toBe(minDuration);
      // The constrained delta = durationSamples - minDuration = 10000 - 4410 = 5590
      expect(result.startSample).toBe(0 + (10000 - minDuration));
      expect(result.offsetSamples).toBe(0 + (10000 - minDuration));
    });

    it('right boundary cannot shrink clip below minimum duration', () => {
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 10000,
        offsetSamples: 0,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Try to drag left by 100 pixels = -100000 samples (far exceeds clip duration)
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: -100,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      const minDuration = Math.floor(0.1 * SAMPLE_RATE); // 4410
      expect(result.durationSamples).toBe(minDuration);
      expect(result.startSample).toBe(0);
      expect(result.offsetSamples).toBe(0);
    });
  });

  describe('offset cannot go below 0', () => {
    it('left boundary drag left is clamped when offset would go negative', () => {
      // Clip with offsetSamples = 5000, so dragging left by more than 5000 samples
      // would push offset below 0
      const clip = makeClip({
        id: 'c1',
        startSample: 44100,
        durationSamples: 44100,
        offsetSamples: 5000,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag left by 10 pixels = -10000 samples, but offset is only 5000
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: -10,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'left',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      // Constrained delta should be -5000 (clamped by offset >= 0)
      expect(result.offsetSamples).toBe(0);
      expect(result.startSample).toBe(44100 - 5000);
      expect(result.durationSamples).toBe(44100 + 5000);
    });
  });

  describe('duration cannot exceed source audio length', () => {
    it('right boundary drag right is clamped by source duration', () => {
      // sourceDurationSamples = 441000, offset = 0, duration = 400000
      // Max expansion = 441000 - 0 - 400000 = 41000 samples
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 400000,
        offsetSamples: 0,
        sourceDurationSamples: 441000,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag right by 100 pixels = 100000 samples, but only 41000 available
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 100,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      expect(result.durationSamples).toBe(441000); // offset + duration = sourceDuration
      expect(result.startSample).toBe(0);
      expect(result.offsetSamples).toBe(0);
    });

    it('right boundary drag right is clamped by source duration with offset', () => {
      // sourceDurationSamples = 441000, offset = 100000, duration = 200000
      // Max expansion = 441000 - 100000 - 200000 = 141000 samples
      const clip = makeClip({
        id: 'c1',
        startSample: 0,
        durationSamples: 200000,
        offsetSamples: 100000,
        sourceDurationSamples: 441000,
      });
      const originalClip = {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      };

      // Drag right by 200 pixels = 200000 samples, but only 141000 available
      const result = calculateBoundaryTrim({
        originalClip,
        clip,
        pixelDelta: 200,
        samplesPerPixel: SAMPLES_PER_PIXEL,
        sampleRate: SAMPLE_RATE,
        boundary: 'right',
        sortedClips: [clip],
        sortedIndex: 0,
      });

      // offset + duration should equal sourceDuration
      expect(result.durationSamples).toBe(441000 - 100000);
      expect(result.offsetSamples).toBe(100000);
    });
  });
});
