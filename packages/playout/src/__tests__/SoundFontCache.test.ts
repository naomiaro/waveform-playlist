import { describe, it, expect } from 'vitest';
import {
  timecentsToSeconds,
  getGeneratorValue,
  int16ToFloat32,
  calculatePlaybackRate,
  extractLoopAndEnvelope,
} from '../SoundFontCache';
import type { Generator, ZoneMap } from 'soundfont2';
import { GeneratorType } from 'soundfont2';

describe('timecentsToSeconds', () => {
  it('0 timecents = 1 second (2^0 = 1)', () => {
    expect(timecentsToSeconds(0)).toBeCloseTo(1, 10);
  });

  it('1200 timecents = 2 seconds (2^1 = 2)', () => {
    expect(timecentsToSeconds(1200)).toBeCloseTo(2, 10);
  });

  it('-1200 timecents = 0.5 seconds (2^-1 = 0.5)', () => {
    expect(timecentsToSeconds(-1200)).toBeCloseTo(0.5, 10);
  });

  it('2400 timecents = 4 seconds (2^2 = 4)', () => {
    expect(timecentsToSeconds(2400)).toBeCloseTo(4, 10);
  });

  it('-12000 timecents ~ 0.001 seconds (SF2 default "instant")', () => {
    // 2^(-12000/1200) = 2^(-10) = 1/1024 ~ 0.000977
    expect(timecentsToSeconds(-12000)).toBeCloseTo(Math.pow(2, -10), 10);
  });

  it('600 timecents = sqrt(2) seconds (2^0.5)', () => {
    expect(timecentsToSeconds(600)).toBeCloseTo(Math.SQRT2, 10);
  });

  it('negative values produce sub-second durations', () => {
    expect(timecentsToSeconds(-600)).toBeCloseTo(1 / Math.SQRT2, 10);
  });

  it('large positive value', () => {
    // 12000 timecents = 2^10 = 1024 seconds
    expect(timecentsToSeconds(12000)).toBeCloseTo(1024, 5);
  });

  it('result is always positive', () => {
    // Even extreme negative timecents produce a positive (tiny) value
    expect(timecentsToSeconds(-24000)).toBeGreaterThan(0);
  });
});

describe('getGeneratorValue', () => {
  it('returns the value for an existing generator type', () => {
    const generators: ZoneMap<Generator> = {
      [GeneratorType.AttackVolEnv]: { id: GeneratorType.AttackVolEnv, value: -500 } as Generator,
    };
    expect(getGeneratorValue(generators, GeneratorType.AttackVolEnv)).toBe(-500);
  });

  it('returns undefined for a missing generator type', () => {
    const generators: ZoneMap<Generator> = {};
    expect(getGeneratorValue(generators, GeneratorType.AttackVolEnv)).toBeUndefined();
  });

  it('returns 0 when generator value is 0', () => {
    const generators: ZoneMap<Generator> = {
      [GeneratorType.SustainVolEnv]: { id: GeneratorType.SustainVolEnv, value: 0 } as Generator,
    };
    expect(getGeneratorValue(generators, GeneratorType.SustainVolEnv)).toBe(0);
  });

  it('returns correct value for different generator types', () => {
    const generators: ZoneMap<Generator> = {
      [GeneratorType.CoarseTune]: { id: GeneratorType.CoarseTune, value: 12 } as Generator,
      [GeneratorType.FineTune]: { id: GeneratorType.FineTune, value: -50 } as Generator,
      [GeneratorType.OverridingRootKey]: {
        id: GeneratorType.OverridingRootKey,
        value: 60,
      } as Generator,
    };
    expect(getGeneratorValue(generators, GeneratorType.CoarseTune)).toBe(12);
    expect(getGeneratorValue(generators, GeneratorType.FineTune)).toBe(-50);
    expect(getGeneratorValue(generators, GeneratorType.OverridingRootKey)).toBe(60);
  });
});

describe('int16ToFloat32', () => {
  it('converts 0 to 0', () => {
    const input = new Int16Array([0]);
    const result = int16ToFloat32(input);
    expect(result[0]).toBe(0);
  });

  it('converts 32767 to approximately 1.0', () => {
    const input = new Int16Array([32767]);
    const result = int16ToFloat32(input);
    expect(result[0]).toBeCloseTo(32767 / 32768, 10);
  });

  it('converts -32768 to -1.0', () => {
    const input = new Int16Array([-32768]);
    const result = int16ToFloat32(input);
    expect(result[0]).toBe(-1);
  });

  it('returns an empty Float32Array for empty input', () => {
    const input = new Int16Array([]);
    const result = int16ToFloat32(input);
    expect(result.length).toBe(0);
    expect(result).toBeInstanceOf(Float32Array);
  });

  it('converts multiple samples correctly', () => {
    const input = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const result = int16ToFloat32(input);
    expect(result.length).toBe(5);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.5, 5);
    expect(result[2]).toBeCloseTo(-0.5, 5);
    expect(result[3]).toBeCloseTo(1.0, 3);
    expect(result[4]).toBe(-1.0);
  });

  it('output values are in [-1, 1] range', () => {
    const input = new Int16Array([32767, -32768, 0, 1, -1]);
    const result = int16ToFloat32(input);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(-1);
      expect(result[i]).toBeLessThanOrEqual(1);
    }
  });
});

describe('calculatePlaybackRate', () => {
  const baseParams = {
    midiNote: 60,
    overrideRootKey: undefined,
    originalPitch: 60,
    coarseTune: 0,
    fineTune: 0,
    pitchCorrection: 0,
  };

  it('returns 1.0 when midiNote equals root key (middle C)', () => {
    const rate = calculatePlaybackRate(baseParams);
    expect(rate).toBeCloseTo(1.0, 10);
  });

  it('doubles rate for one octave up (MIDI 72 from root 60)', () => {
    const rate = calculatePlaybackRate({ ...baseParams, midiNote: 72 });
    expect(rate).toBeCloseTo(2.0, 10);
  });

  it('halves rate for one octave down (MIDI 48 from root 60)', () => {
    const rate = calculatePlaybackRate({ ...baseParams, midiNote: 48 });
    expect(rate).toBeCloseTo(0.5, 10);
  });

  it('one semitone up gives 2^(1/12)', () => {
    const rate = calculatePlaybackRate({ ...baseParams, midiNote: 61 });
    expect(rate).toBeCloseTo(Math.pow(2, 1 / 12), 10);
  });

  it('uses OverridingRootKey when provided', () => {
    // Root key is 48, playing MIDI 60 = one octave up = 2.0
    const rate = calculatePlaybackRate({
      ...baseParams,
      overrideRootKey: 48,
      originalPitch: 60,
    });
    expect(rate).toBeCloseTo(2.0, 10);
  });

  it('OverridingRootKey takes priority over originalPitch', () => {
    // overrideRootKey=60, originalPitch=48. Should use 60, so rate=1.0
    const rate = calculatePlaybackRate({
      ...baseParams,
      overrideRootKey: 60,
      originalPitch: 48,
    });
    expect(rate).toBeCloseTo(1.0, 10);
  });

  it('falls back to 60 when originalPitch is 255 (unpitched)', () => {
    const rate = calculatePlaybackRate({
      ...baseParams,
      overrideRootKey: undefined,
      originalPitch: 255,
    });
    // midiNote=60, rootKey=60 → rate=1.0
    expect(rate).toBeCloseTo(1.0, 10);
  });

  it('applies CoarseTune (semitones)', () => {
    // midiNote=60, rootKey=60, coarseTune=12 → offset = 0 + 12 = 12 semitones → 2.0
    const rate = calculatePlaybackRate({ ...baseParams, coarseTune: 12 });
    expect(rate).toBeCloseTo(2.0, 10);
  });

  it('applies negative CoarseTune', () => {
    // midiNote=60, rootKey=60, coarseTune=-12 → offset = -12 → 0.5
    const rate = calculatePlaybackRate({ ...baseParams, coarseTune: -12 });
    expect(rate).toBeCloseTo(0.5, 10);
  });

  it('applies FineTune (cents)', () => {
    // fineTune=100 cents = 1 semitone
    const rate = calculatePlaybackRate({ ...baseParams, fineTune: 100 });
    expect(rate).toBeCloseTo(Math.pow(2, 1 / 12), 10);
  });

  it('applies pitchCorrection (cents)', () => {
    // pitchCorrection=100 cents = 1 semitone
    const rate = calculatePlaybackRate({ ...baseParams, pitchCorrection: 100 });
    expect(rate).toBeCloseTo(Math.pow(2, 1 / 12), 10);
  });

  it('combines fineTune and pitchCorrection additively', () => {
    // fineTune=50 + pitchCorrection=50 = 100 cents = 1 semitone
    const rate = calculatePlaybackRate({ ...baseParams, fineTune: 50, pitchCorrection: 50 });
    expect(rate).toBeCloseTo(Math.pow(2, 1 / 12), 10);
  });

  it('combines all tuning parameters', () => {
    // coarseTune=11 semitones + fineTune=50 + pitchCorrection=50 = 12 semitones total
    const rate = calculatePlaybackRate({
      ...baseParams,
      coarseTune: 11,
      fineTune: 50,
      pitchCorrection: 50,
    });
    expect(rate).toBeCloseTo(2.0, 10);
  });

  it('result is always positive', () => {
    // Even extreme downshift
    const rate = calculatePlaybackRate({ ...baseParams, midiNote: 0, originalPitch: 127 });
    expect(rate).toBeGreaterThan(0);
  });
});

describe('extractLoopAndEnvelope', () => {
  const makeGenerators = (
    entries: Array<{ type: GeneratorType; value: number }>
  ): ZoneMap<Generator> => {
    const map: ZoneMap<Generator> = {};
    for (const { type, value } of entries) {
      map[type] = { id: type, value } as Generator;
    }
    return map;
  };

  it('returns default values with no generators', () => {
    const result = extractLoopAndEnvelope({
      generators: {},
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    expect(result.loopMode).toBe(0);
    expect(result.loopStart).toBe(0);
    expect(result.loopEnd).toBe(0);
    // Default envelope: -12000 timecents = 2^(-10) ~ 0.000977s
    const defaultTime = Math.pow(2, -10);
    expect(result.attackVolEnv).toBeCloseTo(defaultTime, 5);
    expect(result.holdVolEnv).toBeCloseTo(defaultTime, 5);
    expect(result.decayVolEnv).toBeCloseTo(defaultTime, 5);
    expect(result.releaseVolEnv).toBeCloseTo(defaultTime, 5);
    // Default sustain: 0 centibels = full volume = 1.0
    expect(result.sustainVolEnv).toBeCloseTo(1.0, 10);
  });

  it('extracts loop mode from SampleModes generator', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.SampleModes, value: 1 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    expect(result.loopMode).toBe(1);
  });

  it('sustain loop mode (3)', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.SampleModes, value: 3 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    expect(result.loopMode).toBe(3);
  });

  it('computes loop start and end in seconds', () => {
    const result = extractLoopAndEnvelope({
      generators: {},
      header: { startLoop: 44100, endLoop: 88200, sampleRate: 44100 },
    });
    expect(result.loopStart).toBeCloseTo(1.0, 10);
    expect(result.loopEnd).toBeCloseTo(2.0, 10);
  });

  it('applies fine loop address offsets', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([
        { type: GeneratorType.StartLoopAddrsOffset, value: 4410 },
        { type: GeneratorType.EndLoopAddrsOffset, value: -4410 },
      ]),
      header: { startLoop: 44100, endLoop: 88200, sampleRate: 44100 },
    });
    // startLoop: (44100 + 4410) / 44100 = 1.1s
    expect(result.loopStart).toBeCloseTo(1.1, 5);
    // endLoop: (88200 - 4410) / 44100 = 1.9s
    expect(result.loopEnd).toBeCloseTo(1.9, 5);
  });

  it('applies coarse loop address offsets (x32768)', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.StartLoopAddrsCoarseOffset, value: 1 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // startLoop: (0 + 1*32768) / 44100
    expect(result.loopStart).toBeCloseTo(32768 / 44100, 5);
  });

  it('extracts attack volume envelope', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.AttackVolEnv, value: 0 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 0 timecents = 2^0 = 1 second
    expect(result.attackVolEnv).toBeCloseTo(1.0, 10);
  });

  it('extracts hold volume envelope', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.HoldVolEnv, value: 1200 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 1200 timecents = 2 seconds
    expect(result.holdVolEnv).toBeCloseTo(2.0, 10);
  });

  it('extracts decay volume envelope', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.DecayVolEnv, value: -1200 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // -1200 timecents = 0.5 seconds
    expect(result.decayVolEnv).toBeCloseTo(0.5, 10);
  });

  it('caps release at MAX_RELEASE_SECONDS (5s)', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.ReleaseVolEnv, value: 12000 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 12000 timecents = 1024 seconds, but capped at 5
    expect(result.releaseVolEnv).toBe(5);
  });

  it('does not cap release when under 5s', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.ReleaseVolEnv, value: 1200 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 1200 timecents = 2 seconds, not capped
    expect(result.releaseVolEnv).toBeCloseTo(2.0, 10);
  });

  it('converts sustain centibels attenuation to linear gain', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.SustainVolEnv, value: 200 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 200 centibels → 10^(-200/200) = 10^(-1) = 0.1
    expect(result.sustainVolEnv).toBeCloseTo(0.1, 10);
  });

  it('sustain 0 centibels = full volume (1.0)', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.SustainVolEnv, value: 0 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    expect(result.sustainVolEnv).toBeCloseTo(1.0, 10);
  });

  it('sustain 1440 centibels is near silence', () => {
    const result = extractLoopAndEnvelope({
      generators: makeGenerators([{ type: GeneratorType.SustainVolEnv, value: 1440 }]),
      header: { startLoop: 0, endLoop: 0, sampleRate: 44100 },
    });
    // 10^(-1440/200) = 10^(-7.2) ≈ 6.3e-8
    expect(result.sustainVolEnv).toBeLessThan(0.0001);
    expect(result.sustainVolEnv).toBeGreaterThan(0);
  });
});
