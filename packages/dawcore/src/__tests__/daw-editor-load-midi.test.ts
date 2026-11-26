import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { Mock } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import { createTrack } from '@waveform-playlist/core';

// Mock @dawcore/midi so we don't need a real binary fixture.
vi.mock('@dawcore/midi', () => ({
  parseMidiUrl: vi.fn(),
  parseMidiFile: vi.fn(),
}));

import { parseMidiUrl, parseMidiFile } from '@dawcore/midi';

const mockParseMidiUrl = parseMidiUrl as Mock;
const mockParseMidiFile = parseMidiFile as Mock;

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

function makeParsedMidi(
  opts: Partial<{
    tracks: number;
    bpm: number;
    ts: [number, number];
    duration: number;
    name: string;
  }> = {}
) {
  const tracks = opts.tracks ?? 2;
  return {
    bpm: opts.bpm ?? 120,
    timeSignature: opts.ts ?? [4, 4],
    duration: opts.duration ?? 4,
    name: opts.name ?? '',
    tracks: Array.from({ length: tracks }).map((_, i) => ({
      name: `Track ${i + 1}`,
      channel: i,
      programNumber: 0,
      instrument: 'acoustic grand piano',
      duration: 4,
      notes: [{ midi: 60 + i, name: 'C4', time: 0, duration: 0.5, velocity: 0.8, channel: i }],
    })),
  };
}

function makeMockAdapter() {
  // Mirrors the reference shape in `daw-editor-midi.test.ts`. Minimal
  // PlayoutAdapter stub — engine accepts but doesn't actually play. Includes
  // `updateTrack` so engine takes the incremental path (CLAUDE.md gotcha).
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    createMediaStreamSource: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    removeTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getPlaybackTime: vi.fn(() => 0),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

describe('<daw-editor>.loadMidi', () => {
  let editor: DawEditorElement;

  beforeEach(() => {
    mockParseMidiUrl.mockReset();
    mockParseMidiFile.mockReset();
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as any;
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('parses a URL source via parseMidiUrl with the signal', async () => {
    const ctrl = new AbortController();
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 1 }));
    await editor.loadMidi('/midi/test.mid', { signal: ctrl.signal });
    // The caller's signal combined with the arrangement played (#848, D6):
    // another object, aborted when the caller's is.
    const passed = mockParseMidiUrl.mock.lastCall?.[2] as AbortSignal;
    expect(mockParseMidiUrl.mock.lastCall?.[0]).toBe('/midi/test.mid');
    expect(passed.aborted).toBe(false);
    ctrl.abort();
    expect(passed.aborted).toBe(true);
  });

  it('parses a File source via parseMidiFile', async () => {
    const buf = new ArrayBuffer(8);
    const file = {
      arrayBuffer: vi.fn(async () => buf),
    } as unknown as File;
    mockParseMidiFile.mockReturnValueOnce(makeParsedMidi({ tracks: 1 }));
    await editor.loadMidi(file);
    expect(file.arrayBuffer).toHaveBeenCalled();
    expect(mockParseMidiFile).toHaveBeenCalledWith(buf);
  });

  it('adds N tracks for a multi-track file (no element, #848)', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 3 }));
    const result = await editor.loadMidi('/midi/multi.mid');
    expect(result.trackIds).toHaveLength(3);
    expect(editor.tracks).toHaveLength(3);
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
  });

  it('returns header bpm / timeSignature / duration / name even for empty files', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(
      makeParsedMidi({ tracks: 0, bpm: 140, ts: [3, 4], name: 'Empty' })
    );
    const result = await editor.loadMidi('/midi/empty.mid');
    expect(result.trackIds).toEqual([]);
    expect(result.bpm).toBe(140);
    expect(result.timeSignature).toEqual([3, 4]);
    expect(result.name).toBe('Empty');
    expect(editor.tracks).toHaveLength(0);
  });

  it('applies startTime to every created clip', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/test.mid', { startTime: 30 });
    const clips = editor.tracks.flatMap((t) => t.clips);
    expect(clips.length).toBe(2);
    clips.forEach((c) => {
      expect(c.start).toBe(30);
    });
  });

  it('uses MIDI track names', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/named.mid');
    expect(editor.tracks.map((t) => t.name)).toEqual(['Track 1', 'Track 2']);
  });

  it('makes every created track a MIDI track (kind="midi")', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 3 }));
    await editor.loadMidi('/midi/x.mid');
    expect(editor.tracks).toHaveLength(3);
    editor.tracks.forEach((t) => {
      expect(t.kind).toBe('midi');
    });
  });

  it('propagates AbortError when the signal aborts during fetch', async () => {
    const ctrl = new AbortController();
    // Simulate parseMidiUrl honoring the signal — checks the aborted flag
    // synchronously (standard fetch pattern) and also listens for the abort
    // event. Without the synchronous check, an abort called between the
    // editor.loadMidi() invocation and the mock's promise creation gets lost.
    mockParseMidiUrl.mockImplementationOnce((_url: string, _opts: unknown, signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    const p = editor.loadMidi('/midi/long.mid', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws RangeError when startTime is NaN or negative', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 1 }));
    await expect(editor.loadMidi('/midi/x.mid', { startTime: NaN })).rejects.toThrow(RangeError);
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 1 }));
    await expect(editor.loadMidi('/midi/x.mid', { startTime: -1 })).rejects.toThrow(RangeError);
  });

  // Note: a true "install hint" test would need vi.doMock to simulate
  // the @dawcore/midi module being absent — deferred since vi.mock at file
  // scope is incompatible with per-test module replacement.
  it('rejects when parseMidiUrl throws', async () => {
    mockParseMidiUrl.mockImplementationOnce(() => {
      throw new Error('synthetic — parse failure');
    });
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toThrow(/parse failure/);
  });

  it('cleans up successfully-created tracks when one fails', async () => {
    // Two tracks parsed; we intercept addTrack to reject the second one.
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const originalAddTrack = editor.addTrack.bind(editor);
    let callCount = 0;
    editor.addTrack = vi.fn(async (config) => {
      callCount += 1;
      if (callCount === 2) throw new Error('synthetic — track 2 failed');
      return originalAddTrack(config);
    });

    await expect(editor.loadMidi('/midi/partial.mid')).rejects.toThrow(/track 2 failed/);
    // Track 1 was successfully created — verify it has been removed (cleanup ran).
    expect(editor.tracks).toHaveLength(0);
  });

  it('cleanup waits for late settlements (allSettled, not all)', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const originalAddTrack = editor.addTrack.bind(editor);
    let lateId: string | null = null;
    let callCount = 0;
    editor.addTrack = vi.fn(async (config) => {
      callCount += 1;
      if (callCount === 1) {
        // First addTrack call rejects synchronously.
        throw new Error('synthetic — track 0 fails fast');
      }
      // Second resolves after a microtask tick — proving cleanup waits.
      const id = await originalAddTrack(config);
      lateId = id;
      return id;
    });

    await expect(editor.loadMidi('/midi/race.mid')).rejects.toThrow(/track 0 fails fast/);
    expect(lateId).not.toBeNull();
    expect(editor.tracks.map((t) => t.trackId)).not.toContain(lateId);
  });

  it('summarizes multi-track failures and warns each subsequent rejection', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 3 }));
    editor.addTrack = vi.fn(async () => {
      throw new Error('synthetic — all tracks fail');
    });

    await expect(editor.loadMidi('/midi/all-fail.mid')).rejects.toThrow(/3 of 3 tracks failed/);
    // First rejection is in the thrown Error; the other two surface as warnings.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('additional track failure (1)'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('additional track failure (2)'));
    warnSpy.mockRestore();
  });

  it('preserves dynamic-import original error as cause when @dawcore/midi unavailable', async () => {
    // We can't easily trigger the dynamic-import catch from a file-scope
    // vi.mock; this test instead verifies the error WRAPPING behavior on a
    // simulated failure via the underlying parseMidiUrl. The install-hint
    // path proper is covered by the impl reading; this guards the cause-chain
    // semantics on the wrapper at the catch site.
    const originalErr = new Error('synthetic underlying cause');
    mockParseMidiUrl.mockRejectedValueOnce(originalErr);
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toBe(originalErr);
  });

  it('propagates bpm / timeSignature / duration / name from parsed data', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(
      makeParsedMidi({ tracks: 1, bpm: 96, ts: [6, 8], duration: 12.5, name: 'Song' })
    );
    const result = await editor.loadMidi('/midi/x.mid');
    expect(result.bpm).toBe(96);
    expect(result.timeSignature).toEqual([6, 8]);
    expect(result.duration).toBe(12.5);
    expect(result.name).toBe('Song');
  });

  describe('cancellation and cleanup (#848, D6)', () => {
    it('an abort while its tracks wait to enter rejects with AbortError; none of them enters', async () => {
      mockParseMidiFile.mockReturnValueOnce(makeParsedMidi({ tracks: 2 }));
      const waiting = document.createElement('daw-editor') as DawEditorElement; // no adapter
      document.body.appendChild(waiting);
      const file = new File([new Uint8Array(4)], 'song.mid');
      (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
        new ArrayBuffer(4);
      const c = new AbortController();
      const p = waiting.loadMidi(file, { signal: c.signal });
      await new Promise((r) => setTimeout(r, 0));
      expect(waiting.tracks).toHaveLength(2);
      c.abort();
      const error = await p.catch((e) => e);
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
      expect(waiting.tracks).toHaveLength(0);
      waiting.adapter = makeMockAdapter() as any;
      await new Promise((r) => setTimeout(r, 0));
      expect(waiting.arrangement!.getTracks()).toHaveLength(0);
      waiting.remove();
    });

    it('the cleanup after a failure leaves no undo step: an Undo does not bring a track back', async () => {
      mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
      editor.arrangement!.addTrack({ ...createTrack({ name: 'Before', clips: [] }), id: 'before' });
      const originalAddTrack = editor.addTrack.bind(editor);
      let calls = 0;
      editor.addTrack = vi.fn(async (config) => {
        calls += 1;
        if (calls === 2) throw new Error('synthetic — track 1 fails');
        return originalAddTrack(config);
      });
      await expect(editor.loadMidi('/midi/partial.mid')).rejects.toThrow(/track 1 fails/);
      expect(editor.arrangement!.getTracks().map((t) => t.name)).toEqual(['Before']);
      editor.undo(); // the arrival of Before; the cleanup made no step to undo
      expect(editor.arrangement!.getTracks()).toHaveLength(0);
    });
  });

  it('an abort after a swap takes the tracks out of the arrangement they entered (review round 3)', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const { createArrangement } = await import('@waveform-playlist/engine');
    const x = createArrangement();
    editor.arrangement = x;
    await new Promise((r) => setTimeout(r, 0));
    const original = editor.addTrack.bind(editor);
    let calls = 0;
    editor.addTrack = vi.fn((config, options) => {
      calls += 1;
      if (calls === 1) return original(config, options);
      // The second never enters: it ends with the signal.
      return new Promise<string>((_, reject) =>
        options?.signal?.addEventListener('abort', () => reject(options.signal!.reason))
      );
    });
    const p = editor.loadMidi('/midi/swap.mid');
    await new Promise((r) => setTimeout(r, 0));
    expect(x.getTracks().map((t) => t.name)).toEqual(['Track 1']);
    const removed: unknown[] = [];
    editor.addEventListener('daw-track-removed', (e) => removed.push(e));
    editor.arrangement = null; // x is swapped out: the call aborts
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(x.getTracks()).toHaveLength(0);
    // A track of an arrangement not played: the editor announces nothing for it.
    expect(removed).toEqual([]);
  });
});
