import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for RecordingProcessor's buffer boundary handling.
 *
 * The AudioWorklet quantum is always 128 samples. Buffer sizes derived from
 * sampleRate * 0.016 (e.g., 705 at 44100Hz) may not be multiples of 128.
 * The process() loop must handle frames that cross the buffer boundary.
 */

interface ProcessorMessage {
  channels: Float32Array[];
  sampleRate: number;
  channelCount: number;
}

interface MockProcessor {
  port: {
    onmessage: ((event: { data: Record<string, unknown> }) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>
  ): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Constructor type for dynamic instantiation
let ProcessorClass: { new (): MockProcessor } & Record<string, any>;
const messages: ProcessorMessage[] = [];

// Mock AudioWorklet globals before importing the worklet
vi.stubGlobal('sampleRate', 44100);
vi.stubGlobal(
  'AudioWorkletProcessor',
  class {
    port = {
      onmessage: null as ((event: { data: Record<string, unknown> }) => void) | null,
      postMessage: vi.fn((msg: ProcessorMessage) => messages.push(structuredClone(msg))),
    };
  }
);
vi.stubGlobal('registerProcessor', (_name: string, ctor: typeof ProcessorClass) => {
  ProcessorClass = ctor;
});

// Import after globals are mocked
await import('../worklet/recording-processor.worklet');

/** Helper: create a processor and start recording */
function createProcessor(rate = 44100, channelCount = 1) {
  messages.length = 0;
  // Worklet uses the global sampleRate, not the message payload
  vi.stubGlobal('sampleRate', rate);
  const proc = new ProcessorClass();
  proc.port.onmessage({ data: { command: 'start', channelCount } });
  return proc;
}

/** Helper: create a mono input frame of given length filled with a value */
function monoInput(length: number, value = 0.5): Float32Array[][] {
  const channel = new Float32Array(length).fill(value);
  return [[channel]];
}

/** Helper: create a stereo input frame */
function stereoInput(length: number, leftVal = 0.1, rightVal = 0.9): Float32Array[][] {
  const left = new Float32Array(length).fill(leftVal);
  const right = new Float32Array(length).fill(rightVal);
  return [[left, right]];
}

describe('RecordingProcessor', () => {
  beforeEach(() => {
    messages.length = 0;
  });

  describe('buffer boundary crossing', () => {
    it('flushes when buffer fills exactly', () => {
      // bufferSize at 48000Hz = floor(48000 * 0.016) = 768
      const proc = createProcessor(48000, 1);
      // 768 / 128 = 6 frames exactly
      for (let i = 0; i < 6; i++) {
        proc.process(monoInput(128), [], {});
      }

      expect(messages.length).toBe(1);
      expect(messages[0].channels[0].length).toBe(768);
    });

    it('handles non-128-divisible buffer size (44100Hz)', () => {
      // bufferSize at 44100Hz = floor(44100 * 0.016) = 705
      const proc = createProcessor(44100, 1);

      // 705 / 128 = 5.507... → takes 6 frames
      // After 5 frames: 640 samples collected, 65 remaining
      // Frame 6 (128 samples): first 65 fill buffer → flush, remaining 63 start new buffer
      for (let i = 0; i < 6; i++) {
        proc.process(monoInput(128), [], {});
      }

      expect(messages.length).toBe(1);
      expect(messages[0].channels[0].length).toBe(705);
    });

    it('carries over samples after boundary crossing', () => {
      const proc = createProcessor(44100, 1);
      // bufferSize = 705

      // Fill first buffer: 6 frames = 768 samples → 705 flushed, 63 carried over
      for (let i = 0; i < 6; i++) {
        proc.process(monoInput(128), [], {});
      }
      expect(messages.length).toBe(1);

      // Continue filling: need 705 - 63 = 642 more samples = 5.015... frames
      // 5 more frames = 640 → total 703, still 2 short
      for (let i = 0; i < 5; i++) {
        proc.process(monoInput(128), [], {});
      }
      expect(messages.length).toBe(1); // Not yet flushed

      // One more frame pushes past boundary again
      proc.process(monoInput(128), [], {});
      expect(messages.length).toBe(2);
      expect(messages[1].channels[0].length).toBe(705);
    });

    it('preserves sample values across boundary', () => {
      // bufferSize = 705 at 44100Hz
      const proc = createProcessor(44100, 1);

      // Fill 5 frames with 0.1
      for (let i = 0; i < 5; i++) {
        proc.process(monoInput(128, 0.1), [], {});
      }
      // Frame 6: crosses boundary. Fill with 0.9 so we can distinguish
      proc.process(monoInput(128, 0.9), [], {});

      expect(messages.length).toBe(1);
      const flushed = messages[0].channels[0];
      expect(flushed.length).toBe(705);

      // First 640 samples should be 0.1, next 65 should be 0.9
      expect(flushed[639]).toBeCloseTo(0.1);
      expect(flushed[640]).toBeCloseTo(0.9);
      expect(flushed[704]).toBeCloseTo(0.9);
    });

    it('no samples lost over many frames at 44100Hz', () => {
      const proc = createProcessor(44100, 1);
      // bufferSize = 705
      // Send 100 frames of 128 = 12800 total samples
      // Should produce floor(12800 / 705) = 18 full flushes with 12800 - 18*705 = 110 remaining
      const totalFrames = 100;
      for (let i = 0; i < totalFrames; i++) {
        proc.process(monoInput(128), [], {});
      }

      const totalSamples = totalFrames * 128; // 12800
      const expectedFlushes = Math.floor(totalSamples / 705); // 18
      expect(messages.length).toBe(expectedFlushes);

      // Verify total flushed samples
      const flushedTotal = messages.reduce((sum, m) => sum + m.channels[0].length, 0);
      expect(flushedTotal).toBe(expectedFlushes * 705);
    });

    it('no samples lost over many frames at 48000Hz', () => {
      const proc = createProcessor(48000, 1);
      // bufferSize at 48000Hz = floor(48000 * 0.016) = 768
      // 768 / 128 = 6 exactly (no boundary crossing), but verify over long run
      const totalFrames = 100;
      for (let i = 0; i < totalFrames; i++) {
        proc.process(monoInput(128), [], {});
      }

      const totalSamples = totalFrames * 128; // 12800
      const expectedFlushes = Math.floor(totalSamples / 768); // 16
      expect(messages.length).toBe(expectedFlushes);

      const flushedTotal = messages.reduce((sum, m) => sum + m.channels[0].length, 0);
      expect(flushedTotal).toBe(expectedFlushes * 768); // 12288

      // Stop to flush remaining 512 samples
      proc.port.onmessage({ data: { command: 'stop' } });
      expect(messages.length).toBe(expectedFlushes + 1);
      expect(messages[expectedFlushes].channels[0].length).toBe(
        totalSamples - expectedFlushes * 768
      ); // 512
    });
  });

  describe('multi-channel', () => {
    it('processes stereo input', () => {
      const proc = createProcessor(48000, 2);
      // bufferSize = 768, fill with 6 frames
      for (let i = 0; i < 6; i++) {
        proc.process(stereoInput(128), [], {});
      }

      expect(messages.length).toBe(1);
      expect(messages[0].channels.length).toBe(2);
      expect(messages[0].channels[0].length).toBe(768);
      expect(messages[0].channels[1].length).toBe(768);
      expect(messages[0].channelCount).toBe(2);
    });

    it('preserves per-channel values', () => {
      const proc = createProcessor(48000, 2);
      for (let i = 0; i < 6; i++) {
        proc.process(stereoInput(128, 0.25, 0.75), [], {});
      }

      const [left, right] = messages[0].channels;
      expect(left[0]).toBeCloseTo(0.25);
      expect(right[0]).toBeCloseTo(0.75);
      expect(left[767]).toBeCloseTo(0.25);
      expect(right[767]).toBeCloseTo(0.75);
    });
  });

  describe('edge cases', () => {
    it('returns true when not recording (keeps processor alive)', () => {
      const proc = new ProcessorClass();
      const result = proc.process(monoInput(128), [], {});
      expect(result).toBe(true);
    });

    it('returns true for empty input', () => {
      const proc = createProcessor(44100, 1);
      const result = proc.process([[]], [], {});
      expect(result).toBe(true);
      expect(messages.length).toBe(0);
    });

    it('returns true when bufferSize is 0 (not yet configured)', () => {
      const proc = new ProcessorClass();
      // Manually set isRecording without sending start
      (proc as unknown as { isRecording: boolean }).isRecording = true;
      const result = proc.process(monoInput(128), [], {});
      expect(result).toBe(true);
      expect(messages.length).toBe(0);
    });

    it('flushes remaining samples on stop', () => {
      const proc = createProcessor(44100, 1);
      // Send 2 frames = 256 samples (less than bufferSize 705)
      proc.process(monoInput(128, 0.3), [], {});
      proc.process(monoInput(128, 0.6), [], {});
      expect(messages.length).toBe(0);

      // Stop should flush partial buffer
      proc.port.onmessage({ data: { command: 'stop' } });
      expect(messages.length).toBe(1);
      expect(messages[0].channels[0].length).toBe(256);
    });

    it('does not flush on stop if buffer is empty', () => {
      const proc = createProcessor(44100, 1);
      proc.port.onmessage({ data: { command: 'stop' } });
      expect(messages.length).toBe(0);
    });

    it('handles no input channels gracefully', () => {
      const proc = createProcessor(44100, 1);
      const result = proc.process([], [], {});
      expect(result).toBe(true);
      expect(messages.length).toBe(0);
    });
  });
});
