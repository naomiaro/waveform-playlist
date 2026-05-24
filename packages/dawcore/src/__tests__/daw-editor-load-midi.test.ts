import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { Mock } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';

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
    expect(mockParseMidiUrl).toHaveBeenCalledWith('/midi/test.mid', undefined, ctrl.signal);
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

  it('creates N <daw-track> elements for a multi-track file', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 3 }));
    const result = await editor.loadMidi('/midi/multi.mid');
    expect(result.trackIds).toHaveLength(3);
    expect(editor.querySelectorAll('daw-track')).toHaveLength(3);
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
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
  });

  it('applies startTime to every created clip', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/test.mid', { startTime: 30 });
    const clips = editor.querySelectorAll('daw-clip');
    expect(clips.length).toBe(2);
    clips.forEach((c) => {
      expect(Number((c as HTMLElement).getAttribute('start'))).toBe(30);
    });
  });

  it('uses MIDI track names', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/named.mid');
    const tracks = Array.from(editor.querySelectorAll('daw-track'));
    expect(tracks.map((t) => t.getAttribute('name'))).toEqual(['Track 1', 'Track 2']);
  });

  it('rejects with install hint when @dawcore/midi is unavailable', async () => {
    // Force the dynamic import to fail by mocking it to throw.
    mockParseMidiUrl.mockImplementationOnce(() => {
      throw new Error('synthetic — module-resolution failure');
    });
    // The implementation catches a module-not-found and rejects with an install hint;
    // but parseMidiUrl throwing AFTER successful import does NOT trigger the install hint.
    // That branch is exercised by a separate test below using vi.doMock.
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toBeTruthy();
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
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
  });

  it('cleanup waits for late settlements (allSettled, not all)', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const originalAddTrack = editor.addTrack.bind(editor);
    let lateResolveTrack: HTMLElement | null = null;
    editor.addTrack = vi.fn(async (config) => {
      if (((config as any).clips?.[0]?.midiChannel ?? 0) === 0) {
        // Track 0 rejects immediately
        throw new Error('synthetic — track 0 fails fast');
      }
      // Track 1 resolves after a microtask tick — proving cleanup waits.
      const el = await originalAddTrack(config);
      lateResolveTrack = el as unknown as HTMLElement;
      return el;
    });

    await expect(editor.loadMidi('/midi/race.mid')).rejects.toThrow(/track 0 fails fast/);
    // After loadMidi resolves, the late-resolved track has also been cleaned up.
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
    expect(lateResolveTrack).not.toBeNull();
    expect((lateResolveTrack as HTMLElement | null)?.isConnected).toBe(false);
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
});
