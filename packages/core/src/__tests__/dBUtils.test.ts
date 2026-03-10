import { describe, it, expect, vi } from 'vitest';
import { dBToNormalized, normalizedToDb, gainToNormalized } from '../utils/dBUtils';

describe('dBToNormalized', () => {
  it('warns and returns 0 for NaN input', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(dBToNormalized(NaN)).toBe(0);
    expect(spy).toHaveBeenCalledWith('[waveform-playlist] dBToNormalized received NaN');
    spy.mockRestore();
  });
  it('warns and returns 0 for non-negative floor', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(dBToNormalized(-50, 0)).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('maps 0 dB to 1.0', () => {
    expect(dBToNormalized(0)).toBe(1);
  });
  it('maps -100 dB (floor) to 0.0', () => {
    expect(dBToNormalized(-100)).toBe(0);
  });
  it('maps -50 dB to 0.5', () => {
    expect(dBToNormalized(-50)).toBe(0.5);
  });
  it('clamps below floor to 0', () => {
    expect(dBToNormalized(-120)).toBe(0);
  });
  it('maps above 0 dB to values > 1', () => {
    expect(dBToNormalized(5)).toBe(1.05);
  });
  it('handles -Infinity as 0', () => {
    expect(dBToNormalized(-Infinity)).toBe(0);
  });
  it('handles Firefox low values (-85 dB)', () => {
    const result = dBToNormalized(-85);
    expect(result).toBeCloseTo(0.15, 2);
  });
  it('accepts custom floor', () => {
    expect(dBToNormalized(-60, -60)).toBe(0);
    expect(dBToNormalized(-30, -60)).toBe(0.5);
  });
});

describe('normalizedToDb', () => {
  it('warns and returns default floor for non-negative floor', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizedToDb(0.5, 0)).toBe(-100);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('maps 1.0 to 0 dB', () => {
    expect(normalizedToDb(1)).toBe(0);
  });
  it('maps 0.0 to floor dB', () => {
    expect(normalizedToDb(0)).toBe(-100);
  });
  it('maps 0.5 to -50 dB', () => {
    expect(normalizedToDb(0.5)).toBe(-50);
  });
  it('accepts custom floor', () => {
    expect(normalizedToDb(0, -60)).toBe(-60);
    expect(normalizedToDb(0.5, -60)).toBe(-30);
  });
  it('maps values above 1 to positive dB', () => {
    expect(normalizedToDb(1.05)).toBe(5);
  });
  it('clamps values below 0 to floor', () => {
    expect(normalizedToDb(-1)).toBe(-100);
  });
  it('handles NaN as floor', () => {
    expect(normalizedToDb(NaN)).toBe(-100);
  });
  it('handles Infinity as floor', () => {
    expect(normalizedToDb(Infinity)).toBe(-100);
  });
  it('round-trips with dBToNormalized', () => {
    const original = -42;
    expect(normalizedToDb(dBToNormalized(original))).toBeCloseTo(original, 10);
  });
  it('round-trips above 0 dB', () => {
    const original = 3;
    expect(normalizedToDb(dBToNormalized(original))).toBeCloseTo(original, 10);
  });
});

describe('gainToNormalized', () => {
  it('maps gain 1.0 (0 dB) to normalized 1.0', () => {
    expect(gainToNormalized(1.0)).toBe(1);
  });
  it('maps gain 0 to normalized 0', () => {
    expect(gainToNormalized(0)).toBe(0);
  });
  it('maps negative gain to 0', () => {
    expect(gainToNormalized(-0.5)).toBe(0);
  });
  it('maps gain > 1 to normalized > 1', () => {
    // gain 1.122 ≈ +1 dB → normalized ~1.01
    expect(gainToNormalized(1.122)).toBeCloseTo(1.01, 1);
  });
  it('maps typical mic level (gain 0.1 ≈ -20 dB) to 0.8', () => {
    expect(gainToNormalized(0.1)).toBeCloseTo(0.8, 1);
  });
  it('maps very quiet signal (gain 0.00001 ≈ -100 dB) to 0', () => {
    expect(gainToNormalized(0.00001)).toBeCloseTo(0, 1);
  });
  it('accepts custom floor', () => {
    // With floor -60, gain 0.001 ≈ -60 dB → normalized 0
    expect(gainToNormalized(0.001, -60)).toBeCloseTo(0, 1);
  });
  it('is consistent with dBToNormalized pipeline', () => {
    const gain = 0.5;
    const db = 20 * Math.log10(gain);
    expect(gainToNormalized(gain)).toBe(dBToNormalized(db));
  });
});
