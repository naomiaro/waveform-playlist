import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockWorkletNode {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  };
  onprocessorerror: ((event: Event) => void) | null;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockSource {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockContext {
  state: 'running' | 'suspended';
  sampleRate: number;
  resume: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createAudioWorkletNode: ReturnType<typeof vi.fn>;
  rawContext: { sampleRate: number; audioWorklet: { addModule: ReturnType<typeof vi.fn> } };
}

let mockWorkletNode: MockWorkletNode;
let mockSource: MockSource;
let mockContext: MockContext;

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: () => mockContext,
}));

vi.mock('@waveform-playlist/worklets', () => ({
  addRecordingWorkletModule: vi.fn(() => Promise.resolve()),
}));

vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return {
    ...actual,
    appendPeaks: vi.fn((existing: Int8Array | Int16Array) => existing),
    concatenateAudioData: vi.fn((chunks: Float32Array[]) => {
      // Real concat so AudioBuffer length reflects chunks pushed
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const out = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out;
    }),
    createAudioBuffer: vi.fn((_ctx: AudioContext, channelData: Float32Array[]) => ({
      length: channelData[0]?.length ?? 0,
      sampleRate: 48000,
      numberOfChannels: channelData.length || 1,
      duration: (channelData[0]?.length ?? 0) / 48000,
      _channelData: channelData,
    })),
  };
});

// Import AFTER mocks are declared
const { useRecording } = await import('../hooks/useRecording');

function createMockStream(channelCount = 1): MediaStream {
  return {
    getAudioTracks: () => [
      {
        getSettings: () => ({ channelCount }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    ],
  } as unknown as MediaStream;
}

beforeEach(() => {
  mockWorkletNode = {
    port: {
      // Auto-acknowledge stop synchronously — tests that need a deferred ack
      // override this on the per-test basis.
      postMessage: vi.fn((msg: { command?: string }) => {
        if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
          mockWorkletNode.port.onmessage({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }
      }),
      onmessage: null,
    },
    onprocessorerror: null,
    disconnect: vi.fn(),
  };
  mockSource = { connect: vi.fn(), disconnect: vi.fn() };
  mockContext = {
    state: 'running',
    sampleRate: 48000,
    resume: vi.fn(() => Promise.resolve()),
    createMediaStreamSource: vi.fn(() => mockSource),
    createAudioWorkletNode: vi.fn(() => mockWorkletNode),
    rawContext: {
      sampleRate: 48000,
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useRecording', () => {
  it('pauseRecording posts { command: "pause" } to the worklet', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    mockWorkletNode.port.postMessage.mockClear();

    act(() => {
      result.current.pauseRecording();
    });

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'pause' });
    expect(result.current.isPaused).toBe(true);
  });

  it('resumeRecording posts { command: "resume" } to the worklet', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      result.current.pauseRecording();
    });

    mockWorkletNode.port.postMessage.mockClear();

    act(() => {
      result.current.resumeRecording();
    });

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'resume' });
    expect(result.current.isPaused).toBe(false);
  });

  it('stopRecording awaits done — late samples reach the AudioBuffer', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    // Override auto-ack to defer the done message via queueMicrotask. The
    // late chunk only reaches the AudioBuffer if stopRecording awaits the ack.
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage!({
            data: {
              channels: [new Float32Array(1024).fill(0.5)],
              channelCount: 1,
              done: true,
            },
          } as MessageEvent);
        });
      }
    });

    let buffer: AudioBuffer | null = null;
    await act(async () => {
      buffer = await result.current.stopRecording();
    });

    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBe(1024);
  });

  it('stopRecording proceeds via 1000ms timeout if worklet never acks', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    // Push one chunk so totalSamples > 0 and stopRecording returns a buffer
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(512).fill(0.1)], channelCount: 1 },
      } as MessageEvent);
    });

    // Replace postMessage with a no-op — never acks the stop
    mockWorkletNode.port.postMessage = vi.fn();

    const start = Date.now();
    let buffer: AudioBuffer | null = null;
    await act(async () => {
      buffer = await result.current.stopRecording();
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(1500);
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBe(512); // pre-stop chunk preserved
  });

  it('flips isRecording false even when AudioBuffer creation throws', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(1024)], channelCount: 1 },
      } as MessageEvent);
    });

    // Force createAudioBuffer to throw — the finally block must still reset state
    const core = await import('@waveform-playlist/core');
    vi.mocked(core.createAudioBuffer).mockImplementationOnce(() => {
      throw new Error('synthetic AudioBuffer failure');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to stop recording'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it('clears port.onmessage after stop so late deliveries do not leak', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });
    expect(mockWorkletNode.port.onmessage).not.toBeNull();

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(mockWorkletNode.port.onmessage).toBeNull();
  });

  it('cancels the duration rAF before posting stop to the worklet', async () => {
    // The freeze-rAF-at-top fix prevents the live preview from growing
    // during the stop handshake. Verify the cancel happens BEFORE the
    // stop message is sent.
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const callOrder: string[] = [];
    cancelSpy.mockImplementation(() => {
      callOrder.push('cancelAnimationFrame');
    });
    const originalPost = mockWorkletNode.port.postMessage;
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') callOrder.push('postMessage:stop');
      originalPost.call(mockWorkletNode.port, msg);
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    const cancelIdx = callOrder.indexOf('cancelAnimationFrame');
    const stopIdx = callOrder.indexOf('postMessage:stop');
    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    expect(stopIdx).toBeGreaterThanOrEqual(0);
    expect(cancelIdx).toBeLessThan(stopIdx);

    cancelSpy.mockRestore();
  });

  it('skips peak updates while stop is in flight', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    // Pre-stop: a flush should advance peaks
    const peaksBefore = result.current.peaks;
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(512).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
    });
    expect(result.current.peaks).not.toBe(peaksBefore);
    const peaksAfterPreStop = result.current.peaks;

    // Defer the done message and inject a flush BEFORE done arrives
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        queueMicrotask(() => {
          // In-flight flush during stop — chunks should push but peaks NOT update
          mockWorkletNode.port.onmessage!({
            data: { channels: [new Float32Array(256).fill(0.6)], channelCount: 1 },
          } as MessageEvent);
        });
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage!({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        });
      }
    });

    let buffer: AudioBuffer | null = null;
    await act(async () => {
      buffer = await result.current.stopRecording();
    });

    // The mid-stop flush's chunk made it into the AudioBuffer (512 + 256 = 768)
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBe(768);
    // But peaks state was NOT updated for that intermediate flush — the
    // last setPeaks happened at the pre-stop flush. After stopRecording
    // resolves, finally-block sets isRecording=false but peaks stay.
    // (We can't trivially compare references because the React re-render
    // recreates the wrapper, but length-equivalence is the contract.)
    expect(result.current.peaks).toBe(peaksAfterPreStop);
  });
});
