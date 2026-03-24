import { describe, it, expect, vi } from 'vitest';
import { Transport } from '../transport';

function createMockAudioContext() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
    })),
    destination: { connect: vi.fn() },
  } as unknown as AudioContext;
}

describe('Transport loop APIs', () => {
  it('setLoop accepts ticks as primary API', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    expect(() => transport.setLoop(true, 0, 3840)).not.toThrow();
  });

  it('setLoopSeconds converts seconds to ticks', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    expect(() => transport.setLoopSeconds(true, 0, 2)).not.toThrow();
  });

  it('setLoopSamples converts samples to ticks', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    expect(() => transport.setLoopSamples(true, 0, 96000)).not.toThrow();
  });
});
