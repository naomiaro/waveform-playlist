import { describe, it, expect, beforeAll } from 'vitest';
import { pixelsToSeconds } from '@waveform-playlist/core';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

describe('DawEditorElement interactions', () => {
  it('pixelsToSeconds from core converts correctly', () => {
    // pixel 100, spp=1024, sr=48000 → (100 * 1024) / 48000 = 2.1333...
    expect(pixelsToSeconds(100, 1024, 48000)).toBeCloseTo(2.1333, 3);
  });

  it('pixelsToSeconds at origin is 0', () => {
    expect(pixelsToSeconds(0, 1024, 48000)).toBe(0);
  });
});
