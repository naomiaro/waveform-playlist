import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockNode {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    close: ReturnType<typeof vi.fn>;
  };
  onprocessorerror: ((event: Event) => void) | null;
  disconnect: ReturnType<typeof vi.fn>;
}

let meterNode: MockNode;
let mockContext: {
  state: string;
  resume: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createAudioWorkletNode: ReturnType<typeof vi.fn>;
  rawContext: { audioWorklet: { addModule: ReturnType<typeof vi.fn> } };
};

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: () => mockContext,
}));

vi.mock('@waveform-playlist/worklets', () => ({
  addMeterWorkletModule: vi.fn(() => Promise.resolve()),
}));

const { useMicrophoneLevel } = await import('../hooks/useMicrophoneLevel');
const worklets = await import('@waveform-playlist/worklets');

function createMockStream(id: string, channelCount = 1): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'audio',
    getSettings: () => ({ channelCount }),
  };
  return { id, getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}

beforeEach(() => {
  meterNode = {
    port: { postMessage: vi.fn(), onmessage: null, close: vi.fn() },
    onprocessorerror: null,
    disconnect: vi.fn(),
  };
  mockContext = {
    state: 'running',
    resume: vi.fn(() => Promise.resolve()),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createAudioWorkletNode: vi.fn(() => meterNode),
    rawContext: { audioWorklet: { addModule: vi.fn(() => Promise.resolve()) } },
  };
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
});

describe('useMicrophoneLevel', () => {
  it('surfaces a setup error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(worklets.addMeterWorkletModule).mockRejectedValueOnce(new Error('CSP blocked'));

    // Stream must be stable across renders — a fresh object per render
    // re-runs the setup effect, which would succeed on the second attempt.
    const stream = createMockStream('s1');
    const { result } = renderHook(() => useMicrophoneLevel(stream));
    await act(async () => {});

    expect(result.current.error).toBeTruthy();
    warnSpy.mockRestore();
  });

  it('clears the error after a successful re-setup on a new stream', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(worklets.addMeterWorkletModule).mockRejectedValueOnce(new Error('CSP blocked'));

    const { result, rerender } = renderHook(
      ({ stream }: { stream: MediaStream }) => useMicrophoneLevel(stream),
      { initialProps: { stream: createMockStream('s1') } }
    );
    await act(async () => {});
    expect(result.current.error).toBeTruthy();

    // New stream, setup succeeds — a stale error would leave the UI showing
    // a permanent failure while metering actually works.
    rerender({ stream: createMockStream('s2') });
    await act(async () => {});

    expect(result.current.error).toBeNull();
    warnSpy.mockRestore();
  });
});
