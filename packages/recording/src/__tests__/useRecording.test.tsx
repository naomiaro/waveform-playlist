import { StrictMode } from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

interface MockWorkletNode {
  port: {
    postMessage: Mock<(msg: { command?: string }) => void>;
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

afterEach(async () => {
  // Unmount inside act() so React's concurrent scheduler flushes commit work
  // (e.g. final renders triggered by useEffect cleanups, pending rAF→setState
  // ticks) before vitest tears down jsdom. Without this, scheduler tasks fire
  // post-teardown and throw "window is not defined" — flaky on React 19 CI.
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
});

/** Let one animation frame (and the publish it carries) run. */
async function nextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe('useRecording', () => {
  it('startRecording resolves true on success and false without a stream', async () => {
    const noStream = renderHook(() => useRecording(null));
    let noStreamResult: boolean | undefined;
    await act(async () => {
      noStreamResult = await noStream.result.current.startRecording();
    });
    expect(noStreamResult).toBe(false);
    expect(noStream.result.current.isRecording).toBe(false);

    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));
    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.startRecording();
    });
    expect(started).toBe(true);
    expect(result.current.isRecording).toBe(true);
  });

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

  it('concurrent startRecording calls build only one capture pipeline', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      const p1 = result.current.startRecording();
      const p2 = result.current.startRecording();
      await Promise.all([p1, p2]);
    });

    // A second pipeline would interleave duplicate chunks into the shared
    // accumulator and leak a never-stopped worklet into later sessions.
    expect(mockContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(mockContext.createAudioWorkletNode).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
  });

  it('concurrent stopRecording calls share one handshake and one stop command', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(512).fill(0.2)], channelCount: 1 },
      } as MessageEvent);
    });

    // Defer the done ack so the second stop lands mid-handshake
    let stopCommands = 0;
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') {
        stopCommands++;
        setTimeout(() => {
          mockWorkletNode.port.onmessage?.({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }, 10);
      }
    });

    let b1: AudioBuffer | null = null;
    let b2: AudioBuffer | null = null;
    await act(async () => {
      const p1 = result.current.stopRecording();
      const p2 = result.current.stopRecording();
      [b1, b2] = await Promise.all([p1, p2]);
    });

    // One stop command (a second would overwrite the ack resolver and hit
    // the worklet's already-emptied buffers); both callers get the same buffer.
    expect(stopCommands).toBe(1);
    expect(b1).not.toBeNull();
    expect(b2).toBe(b1);
  });

  it('pauseRecording works in the same tick as startRecording (refs, not stale state)', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
      // Same tick — no re-render yet, so a state-based guard sees
      // isRecording === false and silently drops the pause command.
      result.current.pauseRecording();
    });

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'pause' });
    expect(result.current.isPaused).toBe(true);
  });

  it('resumeRecording works in the same tick as pauseRecording', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
      result.current.pauseRecording();
      result.current.resumeRecording();
    });

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'resume' });
    expect(result.current.isPaused).toBe(false);
  });

  it('records under StrictMode (unmount flag reset on remount)', async () => {
    // StrictMode dev runs mount → unmount → remount on the SAME hook
    // instance; refs persist, so an unmount flag set by the first cleanup
    // must be reset in the effect body or startRecording aborts forever.
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream), { wrapper: StrictMode });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
  });

  it('unmount during startRecording awaits aborts the session (no leaked pipeline)', async () => {
    const worklets = await import('@waveform-playlist/worklets');
    let resolveLoad!: () => void;
    vi.mocked(worklets.addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolveLoad = r;
        })
    );

    const stream = createMockStream();
    const { result, unmount } = renderHook(() => useRecording(stream));

    let startPromise!: Promise<boolean>;
    act(() => {
      startPromise = result.current.startRecording();
    });
    await act(async () => {
      unmount();
    });
    resolveLoad();
    await act(async () => {
      await startPromise;
    });

    // The continuation must not build the capture graph after unmount —
    // nothing would ever stop it (infinite rAF + unbounded chunk growth).
    expect(mockContext.createMediaStreamSource).not.toHaveBeenCalled();
    expect(mockWorkletNode.port.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'start' })
    );
  });

  it('skips peak updates while stop is in flight', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));

    await act(async () => {
      await result.current.startRecording();
    });

    // Pre-stop: a flush advances the published peaks on the next frame
    const progress = result.current.progress;
    const peaksBefore = progress.getSnapshot().peaks;
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(512).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
    });
    await nextFrame();
    expect(progress.getSnapshot().peaks).not.toBe(peaksBefore);
    const peaksAfterPreStop = progress.getSnapshot().peaks;

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
    // But the published peaks were NOT updated for that intermediate flush:
    // the preview must not grow past where the user stopped.
    expect(progress.getSnapshot().peaks).toBe(peaksAfterPreStop);
  });

  it('publishes duration and peaks once per frame without re-rendering', async () => {
    const stream = createMockStream();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useRecording(stream);
    });
    const progress = result.current.progress;
    expect(progress.getSnapshot()).toEqual({ duration: 0, peaks: [new Int16Array(0)] });

    await act(async () => {
      await result.current.startRecording();
    });
    const listener = vi.fn();
    progress.subscribe(listener);
    const rendersBefore = renders;

    // Several worklet flushes inside one frame are one publish.
    act(() => {
      for (let i = 0; i < 3; i++) {
        mockWorkletNode.port.onmessage!({
          data: { channels: [new Float32Array(128).fill(0.3)], channelCount: 1 },
        } as MessageEvent);
      }
    });
    expect(listener).not.toHaveBeenCalled();
    await nextFrame();
    expect(listener).toHaveBeenCalledTimes(1);
    const first = progress.getSnapshot();
    expect(first.duration).toBeGreaterThan(0);

    await nextFrame();
    await nextFrame();
    expect(progress.getSnapshot().duration).toBeGreaterThan(first.duration);
    // Peaks did not change after the first frame: same arrays, new duration.
    expect(progress.getSnapshot().peaks).toBe(first.peaks);
    expect(renders).toBe(rendersBefore);
    expect(result.current.progress).toBe(progress);
  });

  it('has one empty peaks array per channel as soon as recording starts', async () => {
    const stream = createMockStream(2);
    const { result } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.progress.getSnapshot().peaks).toHaveLength(2);
  });

  it('ends on the recorded buffer length after stop', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(4800).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(result.current.progress.getSnapshot().duration).toBeCloseTo(0.1, 5);
    expect(result.current.audioBuffer).not.toBeNull();
  });

  it('starts the next take from zero', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(4800).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    const restarted = result.current.progress.getSnapshot();
    expect(restarted.duration).toBeLessThan(0.05);
    expect(restarted.peaks[0]).toHaveLength(0);
  });

  it('publishes what arrived since the last frame when it pauses', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    await nextFrame();
    const progress = result.current.progress;
    const before = progress.getSnapshot();

    // A flush and a pause inside one frame: the loop is cancelled before it
    // would have published the flush.
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(512).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
      result.current.pauseRecording();
    });

    expect(progress.getSnapshot().peaks).not.toBe(before.peaks);

    // A flush that was already queued when the pause was sent still shows.
    const paused = progress.getSnapshot();
    act(() => {
      mockWorkletNode.port.onmessage!({
        data: { channels: [new Float32Array(128).fill(0.3)], channelCount: 1 },
      } as MessageEvent);
    });
    expect(progress.getSnapshot().peaks).not.toBe(paused.peaks);
    expect(progress.getSnapshot().duration).toBe(paused.duration);
  });

  it('continues from the paused duration on resume', async () => {
    const stream = createMockStream();
    const { result } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    await nextFrame();
    await nextFrame();
    act(() => result.current.pauseRecording());
    const pausedAt = result.current.progress.getSnapshot().duration;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(result.current.progress.getSnapshot().duration).toBe(pausedAt);

    act(() => result.current.resumeRecording());
    await nextFrame();

    const resumed = result.current.progress.getSnapshot().duration;
    expect(resumed).toBeGreaterThanOrEqual(pausedAt);
    expect(resumed).toBeLessThan(pausedAt + 0.07);
  });

  it('publishes nothing after unmount', async () => {
    const stream = createMockStream();
    const { result, unmount } = renderHook(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    await nextFrame();
    const listener = vi.fn();
    result.current.progress.subscribe(listener);

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(listener).not.toHaveBeenCalled();
  });

  it('returns no per-frame values of its own', () => {
    const { result } = renderHook(() => useRecording(createMockStream()));
    expect(Object.keys(result.current).sort()).toEqual([
      'audioBuffer',
      'error',
      'isPaused',
      'isRecording',
      'pauseRecording',
      'progress',
      'resumeRecording',
      'startRecording',
      'stopRecording',
    ]);
  });
});
