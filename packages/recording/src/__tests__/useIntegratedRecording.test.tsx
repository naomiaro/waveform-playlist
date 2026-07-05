import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClipTrack } from '@waveform-playlist/core';

interface MockNode {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    close: ReturnType<typeof vi.fn>;
  };
  onprocessorerror: ((event: Event) => void) | null;
  disconnect: ReturnType<typeof vi.fn>;
}

function createMockNode(autoAckStop = true): MockNode {
  const node: MockNode = {
    port: {
      postMessage: vi.fn((msg: { command?: string }) => {
        if (autoAckStop && msg?.command === 'stop' && node.port.onmessage) {
          node.port.onmessage({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }
      }),
      onmessage: null,
      close: vi.fn(),
    },
    onprocessorerror: null,
    disconnect: vi.fn(),
  };
  return node;
}

let recNode: MockNode;
let meterNode: MockNode;
let mockContext: {
  state: string;
  sampleRate: number;
  lookAhead: number;
  resume: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createAudioWorkletNode: ReturnType<typeof vi.fn>;
  rawContext: { sampleRate: number; audioWorklet: { addModule: ReturnType<typeof vi.fn> } };
};
let mockRawAudioContext: { outputLatency: number; sampleRate: number };

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: () => mockContext,
  getGlobalAudioContext: () => mockRawAudioContext,
  resumeGlobalAudioContext: vi.fn(() => Promise.resolve()),
}));

vi.mock('@waveform-playlist/worklets', () => ({
  addRecordingWorkletModule: vi.fn(() => Promise.resolve()),
  addMeterWorkletModule: vi.fn(() => Promise.resolve()),
}));

vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return {
    ...actual,
    appendPeaks: vi.fn((existing: Int8Array | Int16Array) => existing),
    concatenateAudioData: vi.fn((chunks: Float32Array[]) => {
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      return new Float32Array(total);
    }),
    createAudioBuffer: vi.fn((_ctx: unknown, channelData: Float32Array[]) => ({
      length: channelData[0]?.length ?? 0,
      sampleRate: 48000,
      numberOfChannels: channelData.length || 1,
      duration: (channelData[0]?.length ?? 0) / 48000,
    })),
  };
});

const { useIntegratedRecording } = await import('../hooks/useIntegratedRecording');

function createMockStream(id: string): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'audio',
    getSettings: () => ({ channelCount: 1 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return {
    id,
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

let getUserMediaMock: ReturnType<typeof vi.fn>;

function makeTrack(id: string, clips: ClipTrack['clips'] = []): ClipTrack {
  return { id, name: id, clips } as ClipTrack;
}

beforeEach(() => {
  recNode = createMockNode();
  meterNode = createMockNode();
  mockContext = {
    state: 'running',
    sampleRate: 48000,
    lookAhead: 0,
    resume: vi.fn(() => Promise.resolve()),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createAudioWorkletNode: vi.fn((name: string) =>
      name === 'recording-processor' ? recNode : meterNode
    ),
    rawContext: {
      sampleRate: 48000,
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
    },
  };
  mockRawAudioContext = { outputLatency: 0, sampleRate: 48000 };
  getUserMediaMock = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: getUserMediaMock,
      enumerateDevices: vi.fn(async () => [
        { kind: 'audioinput', deviceId: 'dev-a', label: 'Mic A', groupId: 'g1' },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
});

describe('useIntegratedRecording', () => {
  async function setupRecording(initialTracks: ClipTrack[], setTracks: (t: ClipTrack[]) => void) {
    const stream = createMockStream('mic');
    getUserMediaMock.mockResolvedValue(stream);

    const rendered = renderHook(
      ({ tracks }: { tracks: ClipTrack[] }) => useIntegratedRecording(tracks, setTracks, 'track-1'),
      { initialProps: { tracks: initialTracks } }
    );

    await act(async () => {
      await rendered.result.current.requestMicAccess();
    });
    await act(async () => {
      await rendered.result.current.startRecording();
    });
    expect(rendered.result.current.isRecording).toBe(true);
    return rendered;
  }

  it('rejects changeDevice while recording (stream untouched, error surfaced)', async () => {
    const setTracks = vi.fn();
    const { result } = await setupRecording([makeTrack('track-1')], setTracks);

    const streamBefore = result.current.stream;
    getUserMediaMock.mockClear();

    await act(async () => {
      await result.current.changeDevice('dev-b');
    });

    // Switching devices mid-recording stops the old stream's tracks without
    // firing 'ended' — the rest of the take silently records silence. The
    // guard must refuse instead.
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(streamBefore);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.error?.message).toMatch(/recording/i);
  });

  it('rejects requestMicAccess while recording', async () => {
    const setTracks = vi.fn();
    const { result } = await setupRecording([makeTrack('track-1')], setTracks);

    getUserMediaMock.mockClear();
    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it('punch-in: recorded clip lands at the playhead and replaces overlapped content (#579)', async () => {
    const setTracks = vi.fn();
    const existingClip = {
      id: 'existing',
      startSample: 0,
      durationSamples: 2048,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 2048,
      gain: 1,
    };
    const rendered = await setupRecording(
      [makeTrack('track-1', [existingClip as ClipTrack['clips'][number]])],
      setTracks
    );

    act(() => {
      recNode.port.onmessage!({
        data: { channels: [new Float32Array(1024).fill(0.2)], channelCount: 1 },
      } as MessageEvent);
    });
    await act(async () => {
      await rendered.result.current.stopRecording();
    });

    const finalTracks = setTracks.mock.calls[0][0] as ClipTrack[];
    const t1 = finalTracks.find((t) => t.id === 'track-1')!;
    expect(t1.clips).toHaveLength(2);

    const recorded = t1.clips.find((c) => c.id !== 'existing')!;
    const carved = t1.clips.find((c) => c.id === 'existing')!;

    // The take lands AT the playhead (0), not clamped past the existing clip
    expect(recorded.startSample).toBe(0);
    expect(recorded.durationSamples).toBe(1024);

    // The overlapped head of the existing clip is carved away
    expect(carved.startSample).toBe(1024);
    expect(carved.offsetSamples).toBe(1024);
    expect(carved.durationSamples).toBe(1024);
  });

  it('finalizes the clip against the latest tracks (concurrent edits survive the stop handshake)', async () => {
    const setTracks = vi.fn();
    const trackOne = makeTrack('track-1');
    const rendered = await setupRecording([trackOne], setTracks);

    // Push one chunk so the finalized buffer is non-empty
    act(() => {
      recNode.port.onmessage!({
        data: { channels: [new Float32Array(1024).fill(0.2)], channelCount: 1 },
      } as MessageEvent);
    });

    // Defer the stop ack so the handshake stays in flight while tracks change
    recNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') {
        setTimeout(() => {
          recNode.port.onmessage?.({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }, 20);
      }
    });

    let stopPromise!: Promise<void>;
    act(() => {
      stopPromise = rendered.result.current.stopRecording() as unknown as Promise<void>;
    });

    // A concurrent edit lands while the stop handshake is in flight
    const trackTwo = makeTrack('track-2');
    rendered.rerender({ tracks: [trackOne, trackTwo] });

    await act(async () => {
      await stopPromise;
    });

    expect(setTracks).toHaveBeenCalledTimes(1);
    const finalTracks = setTracks.mock.calls[0][0] as ClipTrack[];
    // The concurrently-added track must survive...
    expect(finalTracks.some((t) => t.id === 'track-2')).toBe(true);
    // ...and the recorded clip lands on track-1
    const t1 = finalTracks.find((t) => t.id === 'track-1')!;
    expect(t1.clips).toHaveLength(1);
  });
});
