import { describe, it, expect } from 'vitest';
import {
  createClip,
  createClipFromSeconds,
  createClipFromTicks,
  createTrack,
  createTimeline,
  getClipsInRange,
  getClipsAtSample,
  clipsOverlap,
  sortClipsByTime,
  findGaps,
} from '../types/clip';
import type { AudioClip, ClipTrack } from '../types/clip';

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

function makeTrack(clips: AudioClip[], name = 'Track 1'): ClipTrack {
  return {
    id: 'track-1',
    name,
    clips,
    muted: false,
    soloed: false,
    volume: 1.0,
    pan: 0,
  };
}

// --- createClip ---

describe('createClip', () => {
  it('generates a unique ID', () => {
    const clip = createClip({
      startSample: 0,
      sampleRate: 44100,
      sourceDurationSamples: 44100,
    });
    expect(clip.id).toBeTruthy();
    expect(typeof clip.id).toBe('string');
  });

  it('generates different IDs for each call', () => {
    const clip1 = createClip({
      startSample: 0,
      sampleRate: 44100,
      sourceDurationSamples: 44100,
    });
    const clip2 = createClip({
      startSample: 0,
      sampleRate: 44100,
      sourceDurationSamples: 44100,
    });
    expect(clip1.id).not.toBe(clip2.id);
  });

  it('applies default values', () => {
    const clip = createClip({
      startSample: 1000,
      sampleRate: 44100,
      sourceDurationSamples: 88200,
    });
    expect(clip.offsetSamples).toBe(0);
    expect(clip.gain).toBe(1.0);
    expect(clip.durationSamples).toBe(88200); // defaults to full source duration
  });

  it('uses explicit values over defaults', () => {
    const clip = createClip({
      startSample: 1000,
      durationSamples: 22050,
      offsetSamples: 500,
      gain: 0.5,
      sampleRate: 44100,
      sourceDurationSamples: 88200,
      name: 'Test Clip',
      color: '#ff0000',
    });
    expect(clip.startSample).toBe(1000);
    expect(clip.durationSamples).toBe(22050);
    expect(clip.offsetSamples).toBe(500);
    expect(clip.gain).toBe(0.5);
    expect(clip.name).toBe('Test Clip');
    expect(clip.color).toBe('#ff0000');
  });

  it('throws when sampleRate is missing and no audioBuffer', () => {
    expect(() =>
      createClip({
        startSample: 0,
        sourceDurationSamples: 44100,
      })
    ).toThrow('sampleRate is required');
  });

  it('throws when sourceDurationSamples is missing and no audioBuffer', () => {
    expect(() =>
      createClip({
        startSample: 0,
        sampleRate: 44100,
      })
    ).toThrow('sourceDurationSamples is required');
  });

  it('passes through fadeIn and fadeOut', () => {
    const clip = createClip({
      startSample: 0,
      sampleRate: 44100,
      sourceDurationSamples: 44100,
      fadeIn: { duration: 0.5, type: 'linear' },
      fadeOut: { duration: 1.0, type: 'exponential' },
    });
    expect(clip.fadeIn).toEqual({ duration: 0.5, type: 'linear' });
    expect(clip.fadeOut).toEqual({ duration: 1.0, type: 'exponential' });
  });

  it('passes through MIDI fields', () => {
    const notes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    const clip = createClip({
      startSample: 0,
      sampleRate: 44100,
      sourceDurationSamples: 44100,
      midiNotes: notes,
      midiChannel: 0,
      midiProgram: 1,
    });
    expect(clip.midiNotes).toBe(notes);
    expect(clip.midiChannel).toBe(0);
    expect(clip.midiProgram).toBe(1);
  });

  it('passes through startTick when provided', () => {
    const clip = createClip({
      startSample: 48000,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      startTick: 960,
    });
    expect(clip.startTick).toBe(960);
  });

  it('leaves startTick undefined when not provided', () => {
    const clip = createClip({
      startSample: 48000,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
    });
    expect(clip.startTick).toBeUndefined();
  });

  it('derives sampleRate from waveformData when not explicit', () => {
    const waveformData = {
      sample_rate: 48000,
      scale: 512,
      length: 100,
      bits: 16,
      duration: 1.0,
      channels: 1,
      channel: () => ({ min_array: () => [], max_array: () => [] }),
      resample: () => waveformData,
      slice: () => waveformData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const clip = createClip({
      startSample: 0,
      waveformData,
    });
    expect(clip.sampleRate).toBe(48000);
  });
});

// --- createClipFromSeconds ---

describe('createClipFromSeconds', () => {
  it('converts seconds to samples using Math.round', () => {
    const clip = createClipFromSeconds({
      startTime: 1.0,
      duration: 2.0,
      offset: 0.5,
      sampleRate: 44100,
      sourceDuration: 10.0,
    });
    expect(clip.startSample).toBe(Math.round(1.0 * 44100));
    expect(clip.durationSamples).toBe(Math.round(2.0 * 44100));
    expect(clip.offsetSamples).toBe(Math.round(0.5 * 44100));
  });

  it('passes through startTick when provided', () => {
    const clip = createClipFromSeconds({
      startTime: 1.0,
      sampleRate: 48000,
      sourceDuration: 2.0,
      startTick: 960,
    });
    expect(clip.startTick).toBe(960);
  });

  it('uses Math.ceil for sourceDurationSamples', () => {
    const clip = createClipFromSeconds({
      startTime: 0,
      sampleRate: 44100,
      sourceDuration: 1 / 3, // produces fractional samples
    });
    expect(clip.sourceDurationSamples).toBe(Math.ceil((1 / 3) * 44100));
  });

  it('defaults duration to full source duration', () => {
    const clip = createClipFromSeconds({
      startTime: 0,
      sampleRate: 44100,
      sourceDuration: 5.0,
    });
    expect(clip.durationSamples).toBe(Math.round(5.0 * 44100));
  });

  it('defaults offset to 0', () => {
    const clip = createClipFromSeconds({
      startTime: 0,
      sampleRate: 44100,
      sourceDuration: 1.0,
    });
    expect(clip.offsetSamples).toBe(0);
  });

  it('throws when sampleRate is missing', () => {
    expect(() =>
      createClipFromSeconds({
        startTime: 0,
        sourceDuration: 1.0,
      })
    ).toThrow('sampleRate is required');
  });

  it('throws when sourceDuration is missing', () => {
    expect(() =>
      createClipFromSeconds({
        startTime: 0,
        sampleRate: 44100,
      })
    ).toThrow('sourceDuration is required');
  });

  it('passes through optional properties', () => {
    const clip = createClipFromSeconds({
      startTime: 0,
      sampleRate: 44100,
      sourceDuration: 1.0,
      gain: 0.7,
      name: 'My Clip',
      color: '#00ff00',
    });
    expect(clip.gain).toBe(0.7);
    expect(clip.name).toBe('My Clip');
    expect(clip.color).toBe('#00ff00');
  });

  it('round-trips integer samples at 44100Hz without drift', () => {
    // Simulate: 132300 samples at 44100Hz = exactly 3.0 seconds
    const samples = 132300;
    const rate = 44100;
    const clip = createClipFromSeconds({
      startTime: samples / rate,
      duration: samples / rate,
      sampleRate: rate,
      sourceDuration: samples / rate,
    });
    expect(clip.startSample).toBe(samples);
    expect(clip.durationSamples).toBe(samples);
  });

  it('round-trips integer samples at 48000Hz without drift', () => {
    const samples = 144000;
    const rate = 48000;
    const clip = createClipFromSeconds({
      startTime: samples / rate,
      duration: samples / rate,
      sampleRate: rate,
      sourceDuration: samples / rate,
    });
    expect(clip.startSample).toBe(samples);
    expect(clip.durationSamples).toBe(samples);
  });

  it('round-trips odd sample counts without losing samples', () => {
    // 99999 / 48000 = 2.0833125 — not exactly representable in float64
    const samples = 99999;
    const rate = 48000;
    const clip = createClipFromSeconds({
      startTime: samples / rate,
      duration: samples / rate,
      sampleRate: rate,
      sourceDuration: samples / rate,
    });
    // Math.round should recover the original integer
    expect(clip.startSample).toBe(samples);
    expect(clip.durationSamples).toBe(samples);
  });

  it('drifts when division and multiplication use different rates', () => {
    // This documents the footgun: dividing by one rate, multiplying by another
    const samples = 132300;
    const editorRate = 44100;
    const bufferRate = 48000;
    const clip = createClipFromSeconds({
      startTime: samples / editorRate, // 3.0 seconds
      duration: samples / editorRate, // 3.0 seconds
      sampleRate: bufferRate, // but clip uses 48000
      sourceDuration: samples / editorRate,
    });
    // 3.0 * 48000 = 144000, NOT 132300 — a 8.8% error
    expect(clip.startSample).not.toBe(samples);
    expect(clip.startSample).toBe(Math.round(3.0 * 48000)); // 144000
  });
});

// --- createClipFromTicks ---

describe('createClipFromTicks', () => {
  it('creates a clip with startTick and derives startSample', () => {
    const clip = createClipFromTicks({
      startTick: 960,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      bpm: 120,
      ppqn: 960,
    });
    expect(clip.startTick).toBe(960);
    expect(clip.startSample).toBe(24000);
  });

  it('defaults durationSamples to full source duration', () => {
    const clip = createClipFromTicks({
      startTick: 0,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      bpm: 120,
      ppqn: 960,
    });
    expect(clip.durationSamples).toBe(96000);
  });

  it('uses ticksToSeconds callback when provided', () => {
    const ticksToSeconds = (tick: number) => tick / 480;
    const clip = createClipFromTicks({
      startTick: 480,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      ticksToSeconds,
    });
    expect(clip.startTick).toBe(480);
    expect(clip.startSample).toBe(48000);
  });

  it('prefers ticksToSeconds over bpm/ppqn', () => {
    const ticksToSeconds = (tick: number) => tick / 100;
    const clip = createClipFromTicks({
      startTick: 100,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      ticksToSeconds,
      bpm: 120,
      ppqn: 960,
    });
    expect(clip.startSample).toBe(48000);
  });

  it('throws when neither ticksToSeconds nor bpm+ppqn provided', () => {
    expect(() =>
      createClipFromTicks({
        startTick: 960,
        sampleRate: 48000,
        sourceDurationSamples: 96000,
      })
    ).toThrow('createClipFromTicks');
  });

  it('throws when sampleRate cannot be determined', () => {
    expect(() =>
      createClipFromTicks({
        startTick: 0,
        bpm: 120,
        ppqn: 960,
        sourceDurationSamples: 96000,
      })
    ).toThrow('sampleRate');
  });

  it('throws when startTick is negative', () => {
    expect(() =>
      createClipFromTicks({
        startTick: -100,
        sampleRate: 48000,
        sourceDurationSamples: 96000,
        bpm: 120,
        ppqn: 960,
      })
    ).toThrow('non-negative');
  });
});

// --- createTrack ---

describe('createTrack', () => {
  it('generates a unique ID', () => {
    const track = createTrack({ name: 'Track 1' });
    expect(track.id).toBeTruthy();
    expect(typeof track.id).toBe('string');
  });

  it('generates different IDs for each call', () => {
    const track1 = createTrack({ name: 'Track 1' });
    const track2 = createTrack({ name: 'Track 2' });
    expect(track1.id).not.toBe(track2.id);
  });

  it('applies default values', () => {
    const track = createTrack({ name: 'Track 1' });
    expect(track.name).toBe('Track 1');
    expect(track.clips).toEqual([]);
    expect(track.muted).toBe(false);
    expect(track.soloed).toBe(false);
    expect(track.volume).toBe(1.0);
    expect(track.pan).toBe(0);
  });

  it('uses explicit values over defaults', () => {
    const clips = [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })];
    const track = createTrack({
      name: 'Bass',
      clips,
      muted: true,
      soloed: true,
      volume: 0.8,
      pan: -0.5,
      color: '#0000ff',
      height: 200,
    });
    expect(track.name).toBe('Bass');
    expect(track.clips).toBe(clips);
    expect(track.muted).toBe(true);
    expect(track.soloed).toBe(true);
    expect(track.volume).toBe(0.8);
    expect(track.pan).toBe(-0.5);
    expect(track.color).toBe('#0000ff');
    expect(track.height).toBe(200);
  });
});

// --- createTimeline ---

describe('createTimeline', () => {
  it('calculates duration from clips', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    const track = makeTrack([clip]);
    const timeline = createTimeline([track], 44100);
    expect(timeline.duration).toBe(1); // 44100 / 44100 = 1 second
  });

  it('uses the latest clip end across all tracks', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    const clip2 = makeClip({ id: 'c2', startSample: 44100, durationSamples: 44100 });
    const track1 = makeTrack([clip1], 'Track 1');
    const track2 = makeTrack([clip2], 'Track 2');
    const timeline = createTimeline([track1, track2], 44100);
    // clip2 ends at 44100 + 44100 = 88200 samples = 2 seconds
    expect(timeline.duration).toBe(2);
  });

  it('returns 0 duration for empty tracks', () => {
    const track = makeTrack([]);
    const timeline = createTimeline([track], 44100);
    expect(timeline.duration).toBe(0);
  });

  it('returns 0 duration for no tracks', () => {
    const timeline = createTimeline([], 44100);
    expect(timeline.duration).toBe(0);
  });

  it('defaults sampleRate to 44100', () => {
    const timeline = createTimeline([]);
    expect(timeline.sampleRate).toBe(44100);
  });

  it('accepts optional metadata', () => {
    const timeline = createTimeline([], 44100, {
      name: 'My Project',
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });
    expect(timeline.name).toBe('My Project');
    expect(timeline.tempo).toBe(120);
    expect(timeline.timeSignature).toEqual({ numerator: 4, denominator: 4 });
  });

  it('handles multiple clips per track', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 22050 });
    const clip2 = makeClip({ id: 'c2', startSample: 44100, durationSamples: 22050 });
    const track = makeTrack([clip1, clip2]);
    const timeline = createTimeline([track], 44100);
    // Latest clip end: 44100 + 22050 = 66150 samples
    expect(timeline.duration).toBeCloseTo(66150 / 44100);
  });
});

// --- getClipsInRange ---

describe('getClipsInRange', () => {
  const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
  const clip2 = makeClip({ id: 'c2', startSample: 2000, durationSamples: 1000 });
  const clip3 = makeClip({ id: 'c3', startSample: 5000, durationSamples: 1000 });
  const track = makeTrack([clip1, clip2, clip3]);

  it('returns clips that overlap the range', () => {
    const result = getClipsInRange(track, 500, 2500);
    expect(result).toEqual([clip1, clip2]);
  });

  it('returns empty array when no clips in range', () => {
    const result = getClipsInRange(track, 1500, 1900);
    expect(result).toEqual([]);
  });

  it('includes clip that starts at range start (boundary)', () => {
    const result = getClipsInRange(track, 2000, 2500);
    expect(result).toEqual([clip2]);
  });

  it('excludes clip that starts exactly at range end', () => {
    const result = getClipsInRange(track, 0, 2000);
    // clip1 (0-1000) overlaps, clip2 starts at 2000 which is NOT < 2000
    expect(result).toEqual([clip1]);
  });

  it('excludes clip that ends exactly at range start', () => {
    const result = getClipsInRange(track, 1000, 1500);
    // clip1 ends at 1000, clipEnd (1000) is NOT > 1000
    expect(result).toEqual([]);
  });

  it('returns all clips when range encompasses everything', () => {
    const result = getClipsInRange(track, 0, 10000);
    expect(result).toEqual([clip1, clip2, clip3]);
  });

  it('handles empty track', () => {
    const emptyTrack = makeTrack([]);
    const result = getClipsInRange(emptyTrack, 0, 1000);
    expect(result).toEqual([]);
  });
});

// --- getClipsAtSample ---

describe('getClipsAtSample', () => {
  const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
  const clip2 = makeClip({ id: 'c2', startSample: 500, durationSamples: 1000 });
  const track = makeTrack([clip1, clip2]);

  it('returns clips at a specific sample position', () => {
    // sample 600 is within both clip1 (0-1000) and clip2 (500-1500)
    const result = getClipsAtSample(track, 600);
    expect(result).toEqual([clip1, clip2]);
  });

  it('includes clip at its start sample (inclusive)', () => {
    const result = getClipsAtSample(track, 0);
    expect(result).toEqual([clip1]);
  });

  it('excludes clip at its end sample (exclusive)', () => {
    // clip1 ends at sample 1000, which is exclusive
    const result = getClipsAtSample(track, 1000);
    expect(result).toEqual([clip2]);
  });

  it('returns empty array between clips', () => {
    const gappedClip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 100 });
    const gappedClip2 = makeClip({ id: 'c2', startSample: 200, durationSamples: 100 });
    const gappedTrack = makeTrack([gappedClip1, gappedClip2]);
    const result = getClipsAtSample(gappedTrack, 150);
    expect(result).toEqual([]);
  });

  it('handles empty track', () => {
    const emptyTrack = makeTrack([]);
    const result = getClipsAtSample(emptyTrack, 500);
    expect(result).toEqual([]);
  });
});

// --- clipsOverlap ---

describe('clipsOverlap', () => {
  it('detects overlapping clips', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 500, durationSamples: 1000 });
    expect(clipsOverlap(clip1, clip2)).toBe(true);
  });

  it('detects overlap in reverse order', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 500, durationSamples: 1000 });
    expect(clipsOverlap(clip2, clip1)).toBe(true);
  });

  it('returns false for adjacent clips (no overlap)', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 1000, durationSamples: 1000 });
    expect(clipsOverlap(clip1, clip2)).toBe(false);
  });

  it('returns false for non-overlapping clips with gap', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 500 });
    const clip2 = makeClip({ id: 'c2', startSample: 1000, durationSamples: 500 });
    expect(clipsOverlap(clip1, clip2)).toBe(false);
  });

  it('detects full containment as overlap', () => {
    const outer = makeClip({ id: 'c1', startSample: 0, durationSamples: 2000 });
    const inner = makeClip({ id: 'c2', startSample: 500, durationSamples: 500 });
    expect(clipsOverlap(outer, inner)).toBe(true);
    expect(clipsOverlap(inner, outer)).toBe(true);
  });

  it('detects identical clips as overlapping', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 100, durationSamples: 500 });
    const clip2 = makeClip({ id: 'c2', startSample: 100, durationSamples: 500 });
    expect(clipsOverlap(clip1, clip2)).toBe(true);
  });
});

// --- sortClipsByTime ---

describe('sortClipsByTime', () => {
  it('sorts clips by startSample ascending', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 2000, durationSamples: 100 });
    const clip2 = makeClip({ id: 'c2', startSample: 500, durationSamples: 100 });
    const clip3 = makeClip({ id: 'c3', startSample: 1000, durationSamples: 100 });
    const sorted = sortClipsByTime([clip1, clip2, clip3]);
    expect(sorted.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('does not mutate the original array', () => {
    const clips = [
      makeClip({ id: 'c1', startSample: 2000, durationSamples: 100 }),
      makeClip({ id: 'c2', startSample: 500, durationSamples: 100 }),
    ];
    const sorted = sortClipsByTime(clips);
    expect(clips[0].id).toBe('c1'); // original unchanged
    expect(sorted[0].id).toBe('c2');
  });

  it('handles empty array', () => {
    expect(sortClipsByTime([])).toEqual([]);
  });

  it('handles single clip', () => {
    const clip = makeClip({ id: 'c1', startSample: 100, durationSamples: 50 });
    const sorted = sortClipsByTime([clip]);
    expect(sorted).toEqual([clip]);
  });

  it('preserves order for clips at the same position', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 100, durationSamples: 50 });
    const clip2 = makeClip({ id: 'c2', startSample: 100, durationSamples: 200 });
    const sorted = sortClipsByTime([clip1, clip2]);
    // Both have same startSample, original order preserved (stable sort)
    expect(sorted.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

// --- findGaps ---

describe('findGaps', () => {
  it('finds gaps between clips', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 2000, durationSamples: 1000 });
    const track = makeTrack([clip1, clip2]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([{ startSample: 1000, endSample: 2000, durationSamples: 1000 }]);
  });

  it('returns empty array when no gaps', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 1000, durationSamples: 1000 });
    const track = makeTrack([clip1, clip2]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([]);
  });

  it('returns empty array for empty track', () => {
    const track = makeTrack([]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([]);
  });

  it('returns empty array for single clip', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const track = makeTrack([clip]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([]);
  });

  it('finds multiple gaps', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 100 });
    const clip2 = makeClip({ id: 'c2', startSample: 200, durationSamples: 100 });
    const clip3 = makeClip({ id: 'c3', startSample: 500, durationSamples: 100 });
    const track = makeTrack([clip1, clip2, clip3]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([
      { startSample: 100, endSample: 200, durationSamples: 100 },
      { startSample: 300, endSample: 500, durationSamples: 200 },
    ]);
  });

  it('handles unsorted clips (sorts internally)', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 500, durationSamples: 100 });
    const clip2 = makeClip({ id: 'c2', startSample: 0, durationSamples: 100 });
    const track = makeTrack([clip1, clip2]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([{ startSample: 100, endSample: 500, durationSamples: 400 }]);
  });

  it('ignores overlapping clips (no gap)', () => {
    const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 1000 });
    const clip2 = makeClip({ id: 'c2', startSample: 500, durationSamples: 1000 });
    const track = makeTrack([clip1, clip2]);
    const gaps = findGaps(track);
    expect(gaps).toEqual([]);
  });
});
