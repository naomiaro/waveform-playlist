import { describe, it, expect, beforeEach, vi } from 'vitest';

interface MeterMessage {
  peak: number[];
  rms: number[];
}

interface MockProcessor {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>
  ): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Constructor type for dynamic instantiation
let ProcessorClass: { new (options: Record<string, unknown>): MockProcessor } & Record<string, any>;

// Mock AudioWorklet globals before importing the processor
const mockPort = {
  postMessage: vi.fn(),
  onmessage: null as ((event: MessageEvent) => void) | null,
};

vi.stubGlobal(
  'AudioWorkletProcessor',
  class {
    port = mockPort;
  }
);
vi.stubGlobal('sampleRate', 48000);
vi.stubGlobal('registerProcessor', (_name: string, ctor: typeof ProcessorClass) => {
  ProcessorClass = ctor;
});

await import('../worklet/meter-processor.worklet');

function getProcessorClass(): typeof ProcessorClass {
  return ProcessorClass;
}

function createProcessor(options?: {
  numberOfChannels?: number;
  updateRate?: number;
}): MockProcessor {
  const Processor = getProcessorClass();
  return new Processor({
    processorOptions: {
      numberOfChannels: options?.numberOfChannels ?? 2,
      updateRate: options?.updateRate ?? 60,
    },
  });
}

function makeInput(channels: Float32Array[]): Float32Array[][] {
  return [channels];
}

function makeOutput(channelCount: number): Float32Array[][] {
  return [Array.from({ length: channelCount }, () => new Float32Array(128))];
}

describe('MeterProcessor', () => {
  beforeEach(() => {
    mockPort.postMessage.mockClear();
  });

  it('registers as "meter-processor"', () => {
    expect(ProcessorClass).toBeDefined();
  });

  it('is a pass-through: copies input to output', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const input = new Float32Array(128).fill(0.5);
    const output = new Float32Array(128);
    processor.process([[input]], [[output]], {});
    expect(output[0]).toBe(0.5);
    expect(output[63]).toBe(0.5);
    expect(output[127]).toBe(0.5);
  });

  it('computes correct peak for known samples', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });
    const input = new Float32Array(128).fill(0);
    input[42] = 0.75;
    input[100] = -0.9;
    processor.process(makeInput([input]), makeOutput(1), {});
    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
    const msg = mockPort.postMessage.mock.calls[0][0] as MeterMessage;
    expect(msg.peak[0]).toBeCloseTo(0.9, 5);
  });

  it('computes correct RMS for known samples', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });
    const input = new Float32Array(128).fill(0.5);
    processor.process(makeInput([input]), makeOutput(1), {});
    const msg = mockPort.postMessage.mock.calls[0][0] as MeterMessage;
    expect(msg.rms[0]).toBeCloseTo(0.5, 5);
  });

  it('accumulates peak across multiple quantums before posting', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 60 });
    const silence = new Float32Array(128).fill(0);
    const loud = new Float32Array(128).fill(0);
    loud[0] = 0.8;

    processor.process(makeInput([loud]), makeOutput(1), {});
    for (let i = 1; i < 5; i++) {
      processor.process(makeInput([silence]), makeOutput(1), {});
    }
    expect(mockPort.postMessage).not.toHaveBeenCalled();

    processor.process(makeInput([silence]), makeOutput(1), {});
    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
    const msg = mockPort.postMessage.mock.calls[0][0] as MeterMessage;
    expect(msg.peak[0]).toBeCloseTo(0.8, 5);
  });

  it('handles multi-channel independently', () => {
    const processor = createProcessor({ numberOfChannels: 2, updateRate: 48000 });
    const ch0 = new Float32Array(128).fill(0);
    ch0[0] = 0.3;
    const ch1 = new Float32Array(128).fill(0);
    ch1[0] = 0.7;
    processor.process(makeInput([ch0, ch1]), makeOutput(2), {});
    const msg = mockPort.postMessage.mock.calls[0][0] as MeterMessage;
    expect(msg.peak[0]).toBeCloseTo(0.3, 5);
    expect(msg.peak[1]).toBeCloseTo(0.7, 5);
  });

  it('resets accumulators after posting', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });
    const loud = new Float32Array(128).fill(0);
    loud[0] = 0.9;
    processor.process(makeInput([loud]), makeOutput(1), {});

    const silence = new Float32Array(128).fill(0);
    processor.process(makeInput([silence]), makeOutput(1), {});
    const msg2 = mockPort.postMessage.mock.calls[1][0] as MeterMessage;
    expect(msg2.peak[0]).toBe(0);
  });

  it('returns true to keep processor alive', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const result = processor.process(makeInput([new Float32Array(128)]), makeOutput(1), {});
    expect(result).toBe(true);
  });

  it('handles missing input gracefully', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const result = processor.process([[]], makeOutput(1), {});
    expect(result).toBe(true);
  });
});
