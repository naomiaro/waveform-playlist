import { describe, it, expect } from 'vitest';
import {
  clipStartTime,
  clipEndTime,
  clipOffsetTime,
  clipDurationTime,
  clipPixelWidth,
  trackChannelCount,
} from '../clipTimeHelpers';
import type { AudioClip, ClipTrack } from '../types';

function makeClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    ...overrides,
  };
}

describe('clipStartTime', () => {
  it('converts startSample to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipStartTime(clip)).toBe(1);
  });

  it('returns 0 for clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipStartTime(clip)).toBe(0);
  });

  it('uses clip sampleRate', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 48000,
      durationSamples: 48000,
      sampleRate: 48000,
    });
    expect(clipStartTime(clip)).toBe(1);
  });
});

describe('clipEndTime', () => {
  it('computes start + duration in seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipEndTime(clip)).toBe(1.5);
  });

  it('handles clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipEndTime(clip)).toBe(1);
  });
});

describe('clipOffsetTime', () => {
  it('converts offsetSamples to seconds', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 0,
      durationSamples: 44100,
      offsetSamples: 22050,
    });
    expect(clipOffsetTime(clip)).toBe(0.5);
  });

  it('returns 0 when offset is 0', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipOffsetTime(clip)).toBe(0);
  });
});

describe('clipDurationTime', () => {
  it('converts durationSamples to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 22050 });
    expect(clipDurationTime(clip)).toBe(0.5);
  });
});

describe('clipPixelWidth', () => {
  it('computes width for clip at origin', () => {
    // 44100 samples / 1024 spp = floor(44100/1024) - floor(0/1024) = 43 - 0 = 43
    expect(clipPixelWidth(0, 44100, 1024)).toBe(43);
  });

  it('computes width for clip with non-zero start', () => {
    // start=48000, dur=48000, spp=1024
    // floor((48000+48000)/1024) - floor(48000/1024) = floor(93.75) - floor(46.875) = 93 - 46 = 47
    expect(clipPixelWidth(48000, 48000, 1024)).toBe(47);
  });

  it('adjacent clips have no pixel gap', () => {
    // Two clips: [0, 44100) and [44100, 88200)
    const spp = 1024;
    const w1 = clipPixelWidth(0, 44100, spp);
    const w2 = clipPixelWidth(44100, 44100, spp);
    const left1 = Math.floor(0 / spp);
    const left2 = Math.floor(44100 / spp);
    // End of clip 1 should be start of clip 2 (no gap, no overlap)
    expect(left1 + w1).toBe(left2);
    // Combined should equal a single clip spanning both
    expect(w1 + w2).toBe(clipPixelWidth(0, 88200, spp));
  });

  it('returns 0 for zero-duration clip', () => {
    expect(clipPixelWidth(0, 0, 1024)).toBe(0);
    expect(clipPixelWidth(44100, 0, 1024)).toBe(0);
  });

  it('handles small samplesPerPixel (zoomed in)', () => {
    // spp=1: every sample is a pixel
    expect(clipPixelWidth(0, 100, 1)).toBe(100);
    expect(clipPixelWidth(50, 100, 1)).toBe(100);
  });

  it('adjacent clips have no gap with default spp=1000', () => {
    const spp = 1000;
    const w1 = clipPixelWidth(0, 44100, spp);
    const w2 = clipPixelWidth(44100, 44100, spp);
    const left1 = Math.floor(0 / spp);
    const left2 = Math.floor(44100 / spp);
    expect(left1 + w1).toBe(left2);
    expect(w1 + w2).toBe(clipPixelWidth(0, 88200, spp));
  });

  it('handles large samplesPerPixel (zoomed out)', () => {
    // spp=4096, 20s at 48kHz = 960000 samples
    // floor(960000/4096) - floor(0/4096) = 234 - 0 = 234
    expect(clipPixelWidth(0, 960000, 4096)).toBe(234);
  });

  it('is independent of peaksData length (the original bug)', () => {
    // Scenario: clip configured for 20s but audio file is only 16s
    // The clip pixel width must be based on clip duration, not audio length
    const sampleRate = 48000;
    const spp = 1024;
    const clipDuration = 20 * sampleRate; // 960000
    const audioLength = 16 * sampleRate; // 768000

    const clipWidth = clipPixelWidth(0, clipDuration, spp);
    const peaksWidth = clipPixelWidth(0, audioLength, spp);

    // clipWidth should be larger than peaksWidth
    expect(clipWidth).toBeGreaterThan(peaksWidth);
    // Progress overlay must use clipWidth (937), not peaksWidth (750)
    expect(clipWidth).toBe(Math.floor(960000 / 1024));
    expect(peaksWidth).toBe(Math.floor(768000 / 1024));
  });
});

function makeTrack(clips: Partial<AudioClip>[]): ClipTrack {
  return {
    id: 't1',
    name: 'Track 1',
    volume: 1,
    pan: 0,
    muted: false,
    soloed: false,
    clips: clips.map((c, i) =>
      makeClip({
        id: `c${i}`,
        startSample: 0,
        durationSamples: 44100,
        ...c,
      })
    ),
  } as ClipTrack;
}

function makeFakeBuffer(numberOfChannels: number) {
  return {
    numberOfChannels,
    length: 44100,
    duration: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(),
  } as unknown as import('../types').AudioBuffer;
}

describe('trackChannelCount', () => {
  it('returns 1 for track with no clips', () => {
    expect(trackChannelCount(makeTrack([]))).toBe(1);
  });

  it('returns 1 for clips without audioBuffer (peaks-only)', () => {
    expect(trackChannelCount(makeTrack([{}, {}]))).toBe(1);
  });

  it('returns 1 for mono clips', () => {
    const track = makeTrack([{ audioBuffer: makeFakeBuffer(1) }]);
    expect(trackChannelCount(track)).toBe(1);
  });

  it('returns 2 for stereo clips', () => {
    const track = makeTrack([{ audioBuffer: makeFakeBuffer(2) }]);
    expect(trackChannelCount(track)).toBe(2);
  });

  it('returns max across mixed mono and stereo clips', () => {
    const track = makeTrack([
      { audioBuffer: makeFakeBuffer(1) },
      { audioBuffer: makeFakeBuffer(2) },
    ]);
    expect(trackChannelCount(track)).toBe(2);
  });

  it('ignores clips without audioBuffer when others have it', () => {
    const track = makeTrack([{}, { audioBuffer: makeFakeBuffer(2) }]);
    expect(trackChannelCount(track)).toBe(2);
  });
});
