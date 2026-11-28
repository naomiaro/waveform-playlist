import { StrictMode, useEffect, useLayoutEffect } from 'react';
import { renderHook, render, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMicrophoneAccess } from '../hooks/useMicrophoneAccess';
import { renderHookInActivity } from './helpers/activity';

interface MockStream extends MediaStream {
  _track: { stop: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> };
}

function createMockStream(id: string): MockStream {
  const track = { stop: vi.fn(), kind: 'audio', addEventListener: vi.fn() };
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

  it('acquires a stream under StrictMode (unmount flag reset on remount)', async () => {
    // StrictMode dev runs mount → unmount → remount on the SAME hook
    // instance; refs persist, so an unmount flag set by the first cleanup
    // must be reset in the effect body or the hook is dead after remount.
    const s1 = createMockStream('s1');
    getUserMediaMock.mockResolvedValueOnce(s1);
    const { result } = renderHook(() => useMicrophoneAccess(), { wrapper: StrictMode });

    await act(async () => {
      await result.current.requestAccess();
    });

    expect(s1._track.stop).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(s1);
  });

  it('clears stream state when a device switch fails', async () => {
    const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

  // #822
  it('clears the stream when the component is hidden', async () => {
    const s1 = createMockStream('s1');
    getUserMediaMock.mockResolvedValueOnce(s1);
    const { result, hide, show } = renderHookInActivity(() => useMicrophoneAccess());
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.stream).toBe(s1);

    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });

    // The cleanup stopped the stream; the state must not keep offering it.
    expect(s1._track.stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();

    // Asking again works.
    const s2 = createMockStream('s2');
    getUserMediaMock.mockResolvedValueOnce(s2);
    await act(async () => {
      await result.current.requestAccess();
    });
    expect(result.current.stream).toBe(s2);
  });

  it('has no hasPermission field: an open microphone is `stream !== null` (#947)', () => {
    const { result } = renderHook(() => useMicrophoneAccess());
    expect('hasPermission' in result.current).toBe(false);
  });

  // #947: a request pending across a hide belongs to the hidden component. The
  // setup that runs on the show resets isUnmountedRef, so the request must be
  // told apart by the setup it started under.
  // A request made before the hook's own mount effect has run: a child's
  // effects run before the parent's, and every layout effect before any
  // passive one. The review of #948 found the first epoch bump in the setup
  // threw these grants away.
  describe("a request made on mount, before the hook's effect runs", () => {
    type Mic = ReturnType<typeof useMicrophoneAccess>;

    const mountWithChildRequest = (useChildEffect: typeof useEffect, strict: boolean) => {
      const latest: { mic?: Mic } = {};
      const Child = ({ request }: { request: Mic['requestAccess'] }) => {
        useChildEffect(() => {
          void request();
        }, [request]);
        return null;
      };
      const Parent = () => {
        const mic = useMicrophoneAccess();
        latest.mic = mic;
        return <Child request={mic.requestAccess} />;
      };
      render(
        strict ? (
          <StrictMode>
            <Parent />
          </StrictMode>
        ) : (
          <Parent />
        )
      );
      return latest;
    };

    for (const [name, effect] of [
      ['useEffect', useEffect],
      ['useLayoutEffect', useLayoutEffect],
    ] as const) {
      for (const strict of [false, true]) {
        it(`a child's ${name}${strict ? ' under StrictMode' : ''} opens the microphone`, async () => {
          const granted: MockStream[] = [];
          getUserMediaMock.mockImplementation(async () => {
            const s = createMockStream(`s${granted.length + 1}`);
            granted.push(s);
            return s;
          });
          const latest = mountWithChildRequest(effect, strict);
          await act(async () => {
            await Promise.resolve();
          });

          const held = latest.mic!.stream as MockStream | null;
          expect(held).toBe(granted[granted.length - 1]);
          expect(held!._track.stop).not.toHaveBeenCalled();
          expect(latest.mic!.isLoading).toBe(false);
        });
      }
    }

    it("a child's mount request that is refused sets error", async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getUserMediaMock.mockRejectedValue(new Error('NotAllowedError'));
      const latest = mountWithChildRequest(useEffect, false);
      await act(async () => {
        await Promise.resolve();
      });

      expect(latest.mic!.error?.message).toBe('NotAllowedError');
      expect(latest.mic!.isLoading).toBe(false);
      warn.mockRestore();
    });
  });

  describe('a request pending across a hide (#947)', () => {
    /** A getUserMedia that answers when the test says so. */
    const holdNextGrant = () => {
      let settle!: { resolve: (s: MediaStream) => void; reject: (e: Error) => void };
      getUserMediaMock.mockImplementationOnce(
        () =>
          new Promise<MediaStream>((resolve, reject) => {
            settle = { resolve, reject };
          })
      );
      return () => settle;
    };

    /** A grant, then a second request (a device switch) held back, then a hide. */
    const switchThenHide = async () => {
      const s1 = createMockStream('s1');
      getUserMediaMock.mockResolvedValueOnce(s1);
      const view = renderHookInActivity(() => useMicrophoneAccess());
      await act(async () => {
        await view.result.current.requestAccess();
      });
      const settle = holdNextGrant();
      let pending!: Promise<void>;
      act(() => {
        pending = view.result.current.requestAccess('dev-b');
      });
      await act(async () => {
        view.hide();
      });
      return { ...view, pending, settle };
    };

    it('a grant that arrives while hidden is stopped, and the hook is idle after the show', async () => {
      const { result, show, pending, settle } = await switchThenHide();
      const late = createMockStream('late');
      settle().resolve(late);
      await act(async () => {
        await pending;
      });
      await act(async () => {
        show();
      });

      expect(late._track.stop).toHaveBeenCalled();
      expect(result.current.stream).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('a grant that arrives after the show is stopped, not installed', async () => {
      const { result, show, pending, settle } = await switchThenHide();
      await act(async () => {
        show();
      });
      const late = createMockStream('late');
      settle().resolve(late);
      await act(async () => {
        await pending;
      });

      expect(late._track.stop).toHaveBeenCalled();
      expect(result.current.stream).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('a refusal that arrives after the show sets no error', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, show, pending, settle } = await switchThenHide();
      await act(async () => {
        show();
      });
      settle().reject(new Error('NotAllowedError'));
      await act(async () => {
        await pending;
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      warn.mockRestore();
    });

    it('is not loading after the show while the old request is still open', async () => {
      const { result, show } = await switchThenHide();
      await act(async () => {
        show();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('a request made after the show opens its microphone', async () => {
      const { result, show, pending, settle } = await switchThenHide();
      await act(async () => {
        show();
      });
      const s2 = createMockStream('s2');
      getUserMediaMock.mockResolvedValueOnce(s2);
      await act(async () => {
        await result.current.requestAccess();
      });
      const late = createMockStream('late');
      settle().resolve(late);
      await act(async () => {
        await pending;
      });

      expect(result.current.stream).toBe(s2);
      expect(s2._track.stop).not.toHaveBeenCalled();
      expect(late._track.stop).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  // A hidden component's handlers are normally out of reach; an app can still
  // call requestAccess from a timer. That request belongs to the hidden mount.
  describe('a request made while hidden', () => {
    const requestWhileHidden = async () => {
      let resolveGum!: (s: MediaStream) => void;
      getUserMediaMock.mockImplementationOnce(
        () =>
          new Promise<MediaStream>((r) => {
            resolveGum = r;
          })
      );
      const view = renderHookInActivity(() => useMicrophoneAccess());
      await act(async () => {
        view.hide();
      });
      let pending!: Promise<void>;
      act(() => {
        pending = view.result.current.requestAccess();
      });
      return { ...view, pending, grant: (s: MediaStream) => resolveGum(s) };
    };

    it('granted while hidden: the stream is stopped and the loading ends', async () => {
      const { result, show, pending, grant } = await requestWhileHidden();
      const late = createMockStream('late');
      grant(late);
      await act(async () => {
        await pending;
      });
      await act(async () => {
        show();
      });

      expect(late._track.stop).toHaveBeenCalled();
      expect(result.current.stream).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('granted after the show: the stream is installed', async () => {
      const { result, show, pending, grant } = await requestWhileHidden();
      await act(async () => {
        show();
      });
      const late = createMockStream('late');
      grant(late);
      await act(async () => {
        await pending;
      });

      expect(result.current.stream).toBe(late);
      expect(late._track.stop).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('stopStream while a request is pending stops its grant and ends the loading (#947)', async () => {
    let resolveGum!: (s: MediaStream) => void;
    getUserMediaMock.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((r) => {
          resolveGum = r;
        })
    );
    const { result } = renderHook(() => useMicrophoneAccess());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.requestAccess();
    });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.stopStream();
    });
    const late = createMockStream('late');
    resolveGum(late);
    await act(async () => {
      await pending;
    });

    expect(late._track.stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  describe('where navigator.mediaDevices is undefined (an http origin that is not localhost)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    });

    it('mounts and unmounts without throwing, with no devices', async () => {
      const { result, unmount } = renderHook(() => useMicrophoneAccess());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.devices).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(() => unmount()).not.toThrow();
    });

    it('requestAccess reports why there is no microphone', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useMicrophoneAccess());

      await act(async () => {
        await result.current.requestAccess();
      });

      expect(result.current.stream).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toMatch(/secure context \(https or localhost\)/);
      warn.mockRestore();
    });
  });

  it('logs a failed request as a prefixed warning with the error as text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getUserMediaMock.mockRejectedValueOnce(new Error('NotAllowedError'));
    const { result } = renderHook(() => useMicrophoneAccess());

    await act(async () => {
      await result.current.requestAccess();
    });

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[waveform-playlist] Failed to access microphone:',
      'Error: NotAllowedError'
    );
    warn.mockRestore();
    error.mockRestore();
  });

  it('reports a device list that cannot be read at mount, as a prefixed warning and an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    (
      navigator.mediaDevices as unknown as { enumerateDevices: ReturnType<typeof vi.fn> }
    ).enumerateDevices.mockRejectedValueOnce(new Error('NotReadableError'));
    const { result } = renderHook(() => useMicrophoneAccess());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error?.message).toBe('NotReadableError');
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[waveform-playlist] Failed to enumerate devices:',
      'Error: NotReadableError'
    );
    warn.mockRestore();
    error.mockRestore();
  });

  describe('when the microphone track ends (unplugged, or its permission revoked)', () => {
    /** The browser ends the stream's track: every `ended` listener runs. */
    const end = (stream: MockStream) => {
      for (const [type, listener] of stream._track.addEventListener.mock.calls) {
        if (type === 'ended') listener();
      }
    };

    it('clears the stream, and says why', async () => {
      const s1 = createMockStream('s1');
      getUserMediaMock.mockResolvedValueOnce(s1);
      const { result } = renderHook(() => useMicrophoneAccess());
      await act(async () => {
        await result.current.requestAccess();
      });
      expect(result.current.stream).toBe(s1);

      act(() => end(s1));

      expect(result.current.stream).toBeNull();
      expect(result.current.error?.message).toBe(
        'The microphone was disconnected or its permission was revoked. Request microphone access again.'
      );
      // Nothing is opened in its place.
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });

    it('asking again opens a microphone and clears the error', async () => {
      const s1 = createMockStream('s1');
      const s2 = createMockStream('s2');
      getUserMediaMock.mockResolvedValueOnce(s1).mockResolvedValueOnce(s2);
      const { result } = renderHook(() => useMicrophoneAccess());
      await act(async () => {
        await result.current.requestAccess();
      });
      act(() => end(s1));

      await act(async () => {
        await result.current.requestAccess();
      });

      expect(result.current.stream).toBe(s2);
      expect(result.current.error).toBeNull();
    });

    it('ignores the end of a stream it has already replaced', async () => {
      const s1 = createMockStream('s1');
      const s2 = createMockStream('s2');
      getUserMediaMock.mockResolvedValueOnce(s1).mockResolvedValueOnce(s2);
      const { result } = renderHook(() => useMicrophoneAccess());
      await act(async () => {
        await result.current.requestAccess();
      });
      await act(async () => {
        await result.current.requestAccess('device-b');
      });
      expect(result.current.stream).toBe(s2);

      act(() => end(s1));

      expect(result.current.stream).toBe(s2);
      expect(result.current.error).toBeNull();
    });
  });
});
