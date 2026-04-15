import { describe, it, expect, vi } from 'vitest';
import { createAudioBuffer, appendToAudioBuffer } from '../utils/audioBufferUtils';

/** Assert Float32Array contents match expected values within Float32 precision */
function expectF32(actual: Float32Array, expected: number[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

/** Minimal AudioBuffer mock that tracks copyToChannel calls. */
function mockAudioContext() {
  const channelStore = new Map<number, Float32Array>();

  const mockBuffer = {
    numberOfChannels: 0,
    length: 0,
    sampleRate: 0,
    duration: 0,
    copyToChannel: vi.fn((data: Float32Array, ch: number) => {
      channelStore.set(ch, new Float32Array(data));
    }),
    getChannelData: vi.fn((ch: number) => {
      return channelStore.get(ch) ?? new Float32Array(0);
    }),
  };

  const ctx = {
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      mockBuffer.numberOfChannels = channels;
      mockBuffer.length = length;
      mockBuffer.sampleRate = rate;
      mockBuffer.duration = length / rate;
      channelStore.clear();
      return mockBuffer;
    }),
  } as unknown as AudioContext;

  return { ctx, mockBuffer, channelStore };
}

describe('createAudioBuffer', () => {
  it('creates a mono buffer from Float32Array[] (single channel)', () => {
    const { ctx, mockBuffer } = mockAudioContext();
    const data = [new Float32Array([0.1, 0.2, 0.3])];

    const result = createAudioBuffer(ctx, data, 44100, 1);

    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 3, 44100);
    expect(mockBuffer.copyToChannel).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(3);
  });

  it('creates a stereo buffer from Float32Array[]', () => {
    const { ctx, mockBuffer, channelStore } = mockAudioContext();
    const left = new Float32Array([0.1, 0.2]);
    const right = new Float32Array([0.3, 0.4]);

    createAudioBuffer(ctx, [left, right], 48000, 2);

    expect(ctx.createBuffer).toHaveBeenCalledWith(2, 2, 48000);
    expect(mockBuffer.copyToChannel).toHaveBeenCalledTimes(2);
    expectF32(channelStore.get(0)!, [0.1, 0.2]);
    expectF32(channelStore.get(1)!, [0.3, 0.4]);
  });

  it('accepts a single Float32Array for backwards compatibility', () => {
    const { ctx, mockBuffer, channelStore } = mockAudioContext();
    const samples = new Float32Array([0.5, -0.5, 0.25]);

    createAudioBuffer(ctx, samples, 44100);

    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 3, 44100);
    expect(mockBuffer.copyToChannel).toHaveBeenCalledTimes(1);
    expectF32(channelStore.get(0)!, [0.5, -0.5, 0.25]);
  });

  it('copies only up to min(channelCount, channels.length)', () => {
    const { ctx, mockBuffer } = mockAudioContext();
    // channelCount=1 but 2 channels provided — should only copy first
    const data = [new Float32Array([0.1]), new Float32Array([0.2])];

    createAudioBuffer(ctx, data, 44100, 1);

    expect(mockBuffer.copyToChannel).toHaveBeenCalledTimes(1);
  });

  it('handles empty channel data', () => {
    const { ctx } = mockAudioContext();

    const result = createAudioBuffer(ctx, [], 44100, 1);

    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 0, 44100);
    expect(result.length).toBe(0);
  });

  it('defaults channelCount to 1', () => {
    const { ctx } = mockAudioContext();
    const data = [new Float32Array([0.1, 0.2])];

    createAudioBuffer(ctx, data, 44100);

    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 2, 44100);
  });
});

describe('appendToAudioBuffer', () => {
  it('creates a new buffer when existing is null', () => {
    const { ctx, channelStore } = mockAudioContext();
    const samples = new Float32Array([0.1, 0.2, 0.3]);

    const result = appendToAudioBuffer(ctx, null, samples, 44100);

    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 3, 44100);
    expectF32(channelStore.get(0)!, [0.1, 0.2, 0.3]);
    expect(result.length).toBe(3);
  });

  it('appends samples to an existing buffer', () => {
    const { ctx, mockBuffer, channelStore } = mockAudioContext();

    // First create an initial buffer
    const initial = new Float32Array([0.1, 0.2]);
    createAudioBuffer(ctx, [initial], 44100);

    // Set up getChannelData to return the stored data
    const existingBuffer = {
      ...mockBuffer,
      length: 2,
      getChannelData: vi.fn(() => new Float32Array([0.1, 0.2])),
    } as unknown as AudioBuffer;

    const newSamples = new Float32Array([0.3, 0.4, 0.5]);

    appendToAudioBuffer(ctx, existingBuffer, newSamples, 44100);

    // Should create a buffer with combined length
    expect(ctx.createBuffer).toHaveBeenLastCalledWith(1, 5, 44100);
    const stored = channelStore.get(0)!;
    expectF32(stored, [0.1, 0.2, 0.3, 0.4, 0.5]);
  });
});
