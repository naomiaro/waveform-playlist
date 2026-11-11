import { describe, it, expect } from 'vitest';
import {
  calculateDuration,
  calculateZoomScrollPosition,
  findClosestZoomIndex,
  clampSeekPosition,
} from '../operations/timelineOperations';

describe('calculateDuration', () => {
  it('returns 0 for empty tracks', () => {
    expect(calculateDuration([])).toBe(0);
  });

  it('returns 0 for tracks with no clips', () => {
    const tracks = [
      {
        id: '1',
        kind: 'audio' as const,
        name: 'Track 1',
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
    ];
    expect(calculateDuration(tracks)).toBe(0);
  });

  it('calculates duration from the furthest clip end', () => {
    const tracks = [
      {
        id: '1',
        kind: 'audio' as const,
        name: 'Track 1',
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
        clips: [
          {
            id: 'c1',
            startSample: 0,
            durationSamples: 44100,
            offsetSamples: 0,
            sampleRate: 44100,
            sourceDurationSamples: 44100,
            gain: 1,
          },
          {
            id: 'c2',
            startSample: 44100,
            durationSamples: 22050,
            offsetSamples: 0,
            sampleRate: 44100,
            sourceDurationSamples: 22050,
            gain: 1,
          },
        ],
      },
    ];
    expect(calculateDuration(tracks)).toBe(1.5);
  });

  it('considers clips across multiple tracks', () => {
    const tracks = [
      {
        id: '1',
        kind: 'audio' as const,
        name: 'Track 1',
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
        clips: [
          {
            id: 'c1',
            startSample: 0,
            durationSamples: 44100,
            offsetSamples: 0,
            sampleRate: 44100,
            sourceDurationSamples: 44100,
            gain: 1,
          },
        ],
      },
      {
        id: '2',
        kind: 'audio' as const,
        name: 'Track 2',
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
        clips: [
          {
            id: 'c2',
            startSample: 88200,
            durationSamples: 44100,
            offsetSamples: 0,
            sampleRate: 44100,
            sourceDurationSamples: 44100,
            gain: 1,
          },
        ],
      },
    ];
    expect(calculateDuration(tracks)).toBe(3);
  });
});

describe('findClosestZoomIndex', () => {
  const levels = [256, 512, 1024, 2048, 4096, 8192];

  it('returns exact match index', () => {
    expect(findClosestZoomIndex(1024, levels)).toBe(2);
  });

  it('returns closest index when no exact match found', () => {
    // 999 is closest to 1024 (index 2), not middle of array
    expect(findClosestZoomIndex(999, levels)).toBe(2);
  });

  it('returns closest for value between two levels', () => {
    // 700 is closer to 512 (diff=188) than 1024 (diff=324)
    expect(findClosestZoomIndex(700, levels)).toBe(1);
  });

  it('returns 0 for first level match', () => {
    expect(findClosestZoomIndex(256, levels)).toBe(0);
  });
});

describe('calculateZoomScrollPosition', () => {
  it('keeps viewport centered when zooming in', () => {
    const result = calculateZoomScrollPosition(1024, 512, 500, 1000, 44100);
    expect(result).toBeGreaterThan(500);
  });

  it('returns 0 when result would be negative', () => {
    // Zooming out from near the start: center time is small, new pixel position
    // can't fill half the container, so scrollLeft would go negative => clamped to 0.
    const result = calculateZoomScrollPosition(512, 1024, 0, 1000, 44100);
    expect(result).toBe(0);
  });
});

describe('clampSeekPosition', () => {
  it('clamps negative values to 0', () => {
    expect(clampSeekPosition(-1, 10)).toBe(0);
  });

  it('clamps values beyond duration', () => {
    expect(clampSeekPosition(15, 10)).toBe(10);
  });

  it('passes through valid values', () => {
    expect(clampSeekPosition(5, 10)).toBe(5);
  });
});
