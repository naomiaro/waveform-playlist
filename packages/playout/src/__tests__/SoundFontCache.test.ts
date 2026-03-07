import { describe, it, expect } from 'vitest';
import { timecentsToSeconds, getGeneratorValue } from '../SoundFontCache';
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

/**
 * NOTE: The following functions are private methods on SoundFontCache and
 * cannot be tested directly without extraction:
 *
 * - calculatePlaybackRate(midiNote, keyData) - pitch shifting math
 *   SHOULD be exported as a standalone pure function for testing.
 *   Formula: 2^((midiNote - rootKey + coarseTune + (fineTune + pitchCorrection) / 100) / 12)
 *
 * - int16ToAudioBuffer(data, sampleRate) - Int16 to Float32 conversion
 *   SHOULD be exported as a standalone pure function for testing.
 *   Formula: float = int16 / 32768
 *
 * - extractLoopAndEnvelope(keyData) - loop points + volume envelope extraction
 *   Uses timecentsToSeconds and getGeneratorValue (tested above).
 *   SHOULD be exported as a standalone pure function for testing.
 *
 * These are good candidates for extraction into standalone exported functions
 * since they are pure computations with no dependency on SoundFontCache instance
 * state (only this.context for int16ToAudioBuffer's createBuffer call).
 */
