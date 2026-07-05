import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMicrophoneAccess } from '../hooks/useMicrophoneAccess';

interface MockStream extends MediaStream {
  _track: { stop: ReturnType<typeof vi.fn> };
}

function createMockStream(id: string): MockStream {
  const track = { stop: vi.fn(), kind: 'audio' };
  return {
    id,
    getTracks: () => [track],
    _track: track,
  } as unknown as MockStream;
}

let getUserMediaMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getUserMediaMock = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: getUserMediaMock,
      enumerateDevices: vi.fn(async () => []),
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

describe('useMicrophoneAccess', () => {
  it('exposes the granted stream after requestAccess', async () => {
    const s1 = createMockStream('s1');
    getUserMediaMock.mockResolvedValueOnce(s1);
    const { result } = renderHook(() => useMicrophoneAccess());

    await act(async () => {
      await result.current.requestAccess();
    });

    expect(result.current.stream).toBe(s1);
    expect(result.current.hasPermission).toBe(true);
  });

  it('stops a stream granted after unmount (no hot-mic leak)', async () => {
    let resolveGum!: (s: MediaStream) => void;
    getUserMediaMock.mockImplementation(
      () =>
        new Promise<MediaStream>((r) => {
          resolveGum = r;
        })
    );

    const { result, unmount } = renderHook(() => useMicrophoneAccess());

    let reqPromise!: Promise<void>;
    act(() => {
      reqPromise = result.current.requestAccess();
    });
    await act(async () => {
      unmount();
    });

    // Permission prompt resolves after unmount — nobody holds the stream,
    // so the hook must stop it or the mic-in-use indicator stays on forever.
    const late = createMockStream('late');
    resolveGum(late);
    await act(async () => {
      await reqPromise;
    });

    expect(late._track.stop).toHaveBeenCalled();
  });

  it('stops the superseded stream when requests overlap (last request wins)', async () => {
    const resolvers: Array<(s: MediaStream) => void> = [];
    getUserMediaMock.mockImplementation(
      () =>
        new Promise<MediaStream>((r) => {
          resolvers.push(r);
        })
    );

    const { result } = renderHook(() => useMicrophoneAccess());

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.requestAccess('device-a');
    });
    act(() => {
      p2 = result.current.requestAccess('device-b');
    });

    const s1 = createMockStream('s1');
    const s2 = createMockStream('s2');
    // The newer request resolves first; the stale one resolves late and
    // must NOT overwrite the winner or leak its own live stream.
    resolvers[1](s2);
    await act(async () => {
      await p2;
    });
    resolvers[0](s1);
    await act(async () => {
      await p1;
    });

    expect(s1._track.stop).toHaveBeenCalled();
    expect(s2._track.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(s2);
  });

  it('clears stream state when a device switch fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s1 = createMockStream('s1');
    getUserMediaMock.mockResolvedValueOnce(s1);
    const { result } = renderHook(() => useMicrophoneAccess());

    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.stream).toBe(s1);

    // Switching to a busy device: the old stream's tracks are stopped before
    // getUserMedia, so on failure the state must not keep pointing at a dead
    // stream (consumers would silently record silence from it).
    getUserMediaMock.mockRejectedValueOnce(new Error('NotReadableError'));
    await act(async () => {
      await result.current.requestAccess('busy-device');
    });

    expect(s1._track.stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeTruthy();
    errorSpy.mockRestore();
  });
});
