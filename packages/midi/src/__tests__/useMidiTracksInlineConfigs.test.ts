// #700: useMidiTracks keyed its effect on the identity of the `configs` array.
// The hook's own documented usage passes an inline array literal, which is a new
// array on every render: effect -> setTracks -> render -> effect, without end.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { MidiNoteData } from '@waveform-playlist/core';
import { Midi } from '@tonejs/midi';
import { useMidiTracks } from '../useMidiTracks';

function midiBuffer(trackName: string): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(120);
  const track = midi.addTrack();
  track.name = trackName;
  track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
  const bytes = midi.toArray();
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function okResponse(buffer: ArrayBuffer) {
  return { ok: true, statusText: 'OK', arrayBuffer: async () => buffer };
}

const NOTES: MidiNoteData[] = [
  { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
  { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
];

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Counts renders and throws once there are far too many. A regression of the
 * loop then fails the test; without this it runs the worker out of memory.
 */
function renderGuard() {
  const guard = {
    count: 0,
    tick() {
      guard.count++;
      if (guard.count > 50) throw new Error('render loop: more than 50 renders');
    },
  };
  return guard;
}

/** Let any render loop run for a while. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

describe('useMidiTracks with configs written inline', () => {
  it('loads once when the array literal holds pre-parsed notes', async () => {
    const renders = renderGuard();
    const { result } = renderHook(() => {
      renders.tick();
      return useMidiTracks([{ midiNotes: NOTES, name: 'Synth Lead', duration: 30 }], {
        sampleRate: 48000,
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const tracks = result.current.tracks;
    const rendersWhenLoaded = renders.count;

    await settle();

    expect(renders.count).toBe(rendersWhenLoaded);
    expect(result.current.tracks).toBe(tracks);
  });

  it('loads once when the notes themselves are written inline', async () => {
    const renders = renderGuard();
    const { result } = renderHook(() => {
      renders.tick();
      return useMidiTracks(
        [
          {
            midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
            name: 'Inline',
          },
        ],
        { sampleRate: 48000 }
      );
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const tracks = result.current.tracks;
    const rendersWhenLoaded = renders.count;

    await settle();

    expect(renders.count).toBe(rendersWhenLoaded);
    expect(result.current.tracks).toBe(tracks);
  });

  it('fetches and parses once when the array literal holds a src', async () => {
    mockFetch.mockResolvedValue(okResponse(midiBuffer('Piano')));
    const renders = renderGuard();
    const { result } = renderHook(() => {
      renders.tick();
      return useMidiTracks([{ src: '/music/song.mid', name: 'Piano' }], { sampleRate: 48000 });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const tracks = result.current.tracks;
    const rendersWhenLoaded = renders.count;

    await settle();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(renders.count).toBe(rendersWhenLoaded);
    expect(result.current.tracks).toBe(tracks);
  });

  it('does not retry forever when an inline config fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Not Found' });
    const renders = renderGuard();
    const { result } = renderHook(() => {
      renders.tick();
      return useMidiTracks([{ src: '/missing.mid' }], { sampleRate: 48000 });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    await settle();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('reloads when a config value actually changes', async () => {
    const { result, rerender } = renderHook(
      ({ volume }: { volume: number }) =>
        useMidiTracks([{ midiNotes: NOTES, name: 'Synth', volume }], { sampleRate: 48000 }),
      { initialProps: { volume: 1 } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tracks[0].volume).toBe(1);

    rerender({ volume: 0.25 });
    await waitFor(() => expect(result.current.tracks[0].volume).toBe(0.25));
  });

  it('reloads when a note changes inside inline notes', async () => {
    const { result, rerender } = renderHook(
      ({ midi }: { midi: number }) =>
        useMidiTracks([{ midiNotes: [{ midi, name: 'N', time: 0, duration: 1, velocity: 0.8 }] }], {
          sampleRate: 48000,
        }),
      { initialProps: { midi: 60 } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ midi: 72 });
    await waitFor(() => expect(result.current.tracks[0].clips[0].midiNotes?.[0].midi).toBe(72));
  });
});

describe('useMidiTracks loading several files', () => {
  it('starts every fetch before any has finished, and keeps config order', async () => {
    const resolvers = new Map<string, (value: unknown) => void>();
    mockFetch.mockImplementation(
      (url: string) => new Promise((resolve) => resolvers.set(url, resolve))
    );
    const configs = [{ src: '/a.mid' }, { src: '/b.mid' }];
    const { result } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    // Finish in the opposite order.
    await act(async () => {
      resolvers.get('/b.mid')!(okResponse(midiBuffer('B')));
    });
    await act(async () => {
      resolvers.get('/a.mid')!(okResponse(midiBuffer('A')));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tracks.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('aborts the fetches still in flight when one file fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const signals = new Map<string, AbortSignal>();
    mockFetch.mockImplementation((url: string, init: { signal: AbortSignal }) => {
      signals.set(url, init.signal);
      if (url === '/bad.mid') return Promise.resolve({ ok: false, statusText: 'Not Found' });
      return new Promise(() => {}); // never finishes
    });
    const configs = [{ src: '/slow.mid' }, { src: '/bad.mid' }];
    const { result } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));

    await waitFor(() => expect(result.current.error).toBe('Failed to fetch /bad.mid: Not Found'));
    expect(signals.get('/slow.mid')?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('reports no error when unmounted while a fetch is in flight', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let signal: AbortSignal | undefined;
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = init.signal;
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const configs = [{ src: '/slow.mid' }];
    const { unmount } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    unmount();
    await settle();

    expect(signal?.aborted).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('fetches a URL once when two configs share it', async () => {
    mockFetch.mockResolvedValue(okResponse(midiBuffer('Shared')));
    const configs = [
      { src: '/shared.mid', volume: 1 },
      { src: '/shared.mid', volume: 0.5 },
    ];
    const { result } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.tracks.map((t) => t.volume)).toEqual([1, 0.5]);
  });
});

describe('useMidiTracks with a very large note list', () => {
  it('derives the duration without exceeding the argument limit', async () => {
    const count = 500_000;
    const notes: MidiNoteData[] = Array.from({ length: count }, (_, i) => ({
      midi: 60,
      name: 'C4',
      time: i * 0.001,
      duration: 0.001,
      velocity: 0.8,
    }));
    const configs = [{ midiNotes: notes }];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.tracks[0].clips[0].durationSamples).toBe(
      Math.round(count * 0.001 * 48000)
    );
  });
});
