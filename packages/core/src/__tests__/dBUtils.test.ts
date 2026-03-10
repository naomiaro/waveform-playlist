import { describe, it, expect } from 'vitest';
import { dBToNormalized, normalizedToDb } from '../utils/dBUtils';

describe('dBToNormalized', () => {
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
