import { describe, it, expect, vi } from 'vitest';
import { createDefaultClickSounds } from '../audio/click-sounds';

function createMockAudioContext(sampleRate = 48000): AudioContext {
  return {
    sampleRate,
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return {
        duration: length / rate,
        length,
        sampleRate: rate,
        numberOfChannels: channels,
        getChannelData: vi.fn(() => data),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      };
    }),
  } as unknown as AudioContext;
}

describe('createDefaultClickSounds', () => {
  it('returns accent and normal AudioBuffers', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent).toBeDefined();
    expect(normal).toBeDefined();
  });

  it('buffers have correct sample rate', () => {
    const ctx = createMockAudioContext(44100);
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent.sampleRate).toBe(44100);
    expect(normal.sampleRate).toBe(44100);
  });

  it('buffer duration is ~30-50ms', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent.duration).toBeGreaterThanOrEqual(0.03);
    expect(accent.duration).toBeLessThanOrEqual(0.06);
    expect(normal.duration).toBeGreaterThanOrEqual(0.02);
    expect(normal.duration).toBeLessThanOrEqual(0.06);
  });

  it('uses default frequencies when options omitted', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    const accentData = accent.getChannelData(0);
    const normalData = normal.getChannelData(0);
    const accentHasContent = accentData.some((v: number) => v !== 0);
    const normalHasContent = normalData.some((v: number) => v !== 0);
    expect(accentHasContent).toBe(true);
    expect(normalHasContent).toBe(true);
  });

  it('custom frequencies produce different buffer content', () => {
    const ctx = createMockAudioContext();
    const defaults = createDefaultClickSounds(ctx);
    const custom = createDefaultClickSounds(ctx, {
      accentFrequency: 440,
      normalFrequency: 330,
    });
    const defaultData = defaults.accent.getChannelData(0);
    const customData = custom.accent.getChannelData(0);
    let differs = false;
    for (let i = 0; i < defaultData.length; i++) {
      if (Math.abs(defaultData[i] - customData[i]) > 0.001) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});
