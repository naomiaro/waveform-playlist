// @vitest-environment jsdom
//
// What `useExportWav().exportWav()` renders and reports (#817): one track is
// chosen by id and exported as it sounds alone (its mute and the others' solo
// are ignored); fades are always rendered and the effect chains whenever their
// functions are given; `isExporting` stays true while any export of the hook
// call is running. The offline render is replaced by fakes that record the
// graph the export builds.
import { describe, it, expect, vi, afterEach } from 'vitest';

const built = vi.hoisted(() => ({
  volumesDb: [] as number[],
  gains: [] as unknown[],
  fadeCalls: [] as string[],
  downloads: [] as string[],
  /** When true, each render waits until its resolver in `held` is called. */
  hold: false,
  held: [] as Array<() => void>,
}));

vi.mock('tone', () => {
  class Node {
    input = {
      gain: {
        setValueAtTime(value: number, time: number) {
          built.fadeCalls.push(`set ${value} @ ${time}`);
        },
        linearRampToValueAtTime(value: number, time: number) {
          built.fadeCalls.push(`ramp ${value} @ ${time}`);
        },
        exponentialRampToValueAtTime() {},
        setValueCurveAtTime() {},
      },
    };
    connect() {
      return this;
    }
  }
  class Volume extends Node {
    constructor(db: number) {
      super();
      built.volumesDb.push(db);
    }
  }
  class Gain extends Node {
    constructor(value: unknown) {
      super();
      built.gains.push(value);
    }
  }
  class Player extends Node {
    start() {}
  }
  class ToneAudioBuffer {}
  return { Volume, Gain, Player, ToneAudioBuffer, connect: () => {} };
});
vi.mock('@waveform-playlist/playout', () => ({
  getGlobalAudioContext: () => ({ sampleRate: 48000 }),
}));
vi.mock('../utils/renderToneOffline', () => ({
  renderToneOffline: async (build: (context: unknown) => Promise<void>) => {
    if (built.hold) {
      await new Promise<void>((resolve) => built.held.push(resolve));
    }
    await build({ destination: {}, rawContext: {}, transport: { start: () => {} } });
    return { length: 1, numberOfChannels: 1, sampleRate: 48000 } as unknown as AudioBuffer;
  },
}));
vi.mock('../utils/wavEncoder', () => ({
  encodeWav: () => new Blob(),
  downloadBlob: (_blob: Blob, name: string) => {
    built.downloads.push(name);
  },
}));
vi.mock('@waveform-playlist/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@waveform-playlist/core')>()),
  createPanStage: () => ({ input: {}, output: {} }),
}));

import { renderHook, act } from '@testing-library/react';
import { gainToDb } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { useExportWav } from '../hooks/useExportWav';

const RATE = 48000;

function track(id: string, fields: Partial<ClipTrack> = {}, clip: Partial<AudioClip> = {}) {
  const audioBuffer = { numberOfChannels: 1, sampleRate: RATE, length: RATE, duration: 1 };
  return {
    id,
    name: 'name-' + id,
    clips: [
      {
        id: id + '-clip',
        startSample: 0,
        durationSamples: RATE,
        offsetSamples: 0,
        sampleRate: RATE,
        gain: 1,
        audioBuffer,
        ...clip,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...fields,
  } as ClipTrack;
}

const state = (fields: Partial<{ muted: boolean; soloed: boolean; volume: number }> = {}) => ({
  muted: false,
  soloed: false,
  volume: 1,
  pan: 0,
  ...fields,
});

afterEach(() => {
  built.volumesDb.length = 0;
  built.gains.length = 0;
  built.fadeCalls.length = 0;
  built.downloads.length = 0;
  built.hold = false;
  built.held.length = 0;
  vi.restoreAllMocks();
});

describe('one track chosen by id', () => {
  it('renders that track alone, with its own volume', async () => {
    const { result } = renderHook(() => useExportWav());
    const tracks = [track('A'), track('B'), track('C')];
    const states = [state({ volume: 0.5 }), state({ volume: 0.25 }), state({ volume: 0.125 })];
    await act(async () => {
      await result.current.exportWav(tracks, states, { trackId: 'B', autoDownload: false });
    });
    // The master volume (0 dB), then B alone.
    expect(built.volumesDb).toEqual([0, gainToDb(0.25)]);
  });

  it("a muted track is exported with its audio: its mute is ignored, like the others' solo", async () => {
    const { result } = renderHook(() => useExportWav());
    const tracks = [track('A'), track('B')];
    const states = [state({ muted: true, volume: 0.5 }), state({ soloed: true })];
    await act(async () => {
      await result.current.exportWav(tracks, states, { trackId: 'A', autoDownload: false });
    });
    expect(built.volumesDb).toEqual([0, gainToDb(0.5)]);
    // No gain stage of the graph is closed: the track's mute stage is at 1.
    expect(built.gains).not.toContain(0);
  });

  it('a track id that is not in the tracks rejects and sets the error', async () => {
    const { result } = renderHook(() => useExportWav());
    let thrown: unknown;
    await act(async () => {
      await result.current
        .exportWav([track('A')], [state()], { trackId: 'nope', autoDownload: false })
        .catch((error: unknown) => {
          thrown = error;
        });
    });
    expect((thrown as Error).message).toBe('No track with id "nope" to export');
    expect(result.current.error).toBe('No track with id "nope" to export');
    expect(built.volumesDb).toEqual([]);
    expect(result.current.isExporting).toBe(false);
  });

  it('an export with no tracks rejects and sets the error without starting', async () => {
    const { result } = renderHook(() => useExportWav());
    let thrown: unknown;
    await act(async () => {
      await result.current.exportWav([], [], { autoDownload: false }).catch((error: unknown) => {
        thrown = error;
      });
    });
    expect((thrown as Error).message).toBe('No tracks to export');
    expect(result.current.error).toBe('No tracks to export');
    expect(result.current.isExporting).toBe(false);
    expect(built.volumesDb).toEqual([]);
  });

  it("downloads as the filename followed by the track's name", async () => {
    const { result } = renderHook(() => useExportWav());
    await act(async () => {
      await result.current.exportWav([track('A'), track('B')], [state(), state()], {
        trackId: 'B',
        filename: 'take',
      });
    });
    expect(built.downloads).toEqual(['take_name-B.wav']);
  });

  it('control characters and / \\ : * ? " < > | in a track name become underscores in the file name', async () => {
    const { result } = renderHook(() => useExportWav());
    const named = {
      ...track('A'),
      name: 'Drums / Kit: "Take" <1>|2*?\\\t\u0007\u007f\u0085é',
    } as ClipTrack;
    await act(async () => {
      await result.current.exportWav([named], [state()], { trackId: 'A', filename: 'take' });
    });
    // Spaces and é stay; / \ : * ? " < > | and control characters (a tab, a
    // bell, DEL, U+0085) become _.
    expect(built.downloads).toEqual(['take_Drums _ Kit_ _Take_ _1__2_______é.wav']);
  });

  it('without a track id the mix is exported; muted tracks, soloed or not, are left out', async () => {
    const { result } = renderHook(() => useExportWav());
    const tracks = [track('A'), track('B'), track('C')];
    const states = [
      state({ volume: 0.5, soloed: true }),
      state({ volume: 0.25, muted: true, soloed: true }),
      state({ volume: 0.125 }),
    ];
    await act(async () => {
      await result.current.exportWav(tracks, states, { filename: 'mix' });
    });
    // A and B are soloed, so C is not heard; B is muted, and a muted track is
    // silent soloed or not (as live), so it is not built either.
    expect(built.volumesDb).toEqual([0, gainToDb(0.5)]);
    expect(built.downloads).toEqual(['mix.wav']);
  });
});

describe('fades and effect chains', () => {
  const fadeIn = { duration: 0.5, type: 'linear' as const };

  it('fades are rendered with no effect function given', async () => {
    const { result } = renderHook(() => useExportWav());
    await act(async () => {
      await result.current.exportWav([track('A', {}, { fadeIn })], [state()], {
        autoDownload: false,
      });
    });
    expect(built.fadeCalls).toEqual(['set 0 @ 0', 'set 0 @ 0', 'ramp 1 @ 0.5']);
  });

  it('the master and track chains are inserted when their functions are given', async () => {
    const master = vi.fn();
    const trackChain = vi.fn();
    const createOfflineTrackEffects = vi.fn((trackId: string) =>
      trackId === 'A' ? trackChain : undefined
    );
    const { result } = renderHook(() => useExportWav());
    await act(async () => {
      await result.current.exportWav([track('A', {}, { fadeIn }), track('B')], [state(), state()], {
        autoDownload: false,
        effectsFunction: master,
        createOfflineTrackEffects,
      });
    });
    expect(master).toHaveBeenCalledTimes(1);
    expect(master.mock.lastCall?.[2]).toBe(true);
    expect(createOfflineTrackEffects.mock.calls).toEqual([['A'], ['B']]);
    expect(trackChain).toHaveBeenCalledTimes(1);
    // Fades are rendered beside the chains too.
    expect(built.fadeCalls).toContain('ramp 1 @ 0.5');
  });

  it('a track chain is inserted without a master chain', async () => {
    const trackChain = vi.fn();
    const { result } = renderHook(() => useExportWav());
    await act(async () => {
      await result.current.exportWav([track('A')], [state()], {
        autoDownload: false,
        createOfflineTrackEffects: () => trackChain,
      });
    });
    expect(trackChain).toHaveBeenCalledTimes(1);
    expect(trackChain.mock.lastCall?.[2]).toBe(true);
  });
});

describe('isExporting while exports overlap', () => {
  it('stays true until the last export of the hook call has finished; progress is the last one started', async () => {
    built.hold = true;
    const { result } = renderHook(() => useExportWav());
    const tracks = [track('A')];
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      // One after the other: two `import('tone')` in flight at once give the
      // second the real module under vitest, not the mock.
      first = result.current.exportWav(tracks, [state()], { autoDownload: false });
      await vi.waitFor(() => expect(built.held).toHaveLength(1));
      second = result.current.exportWav(tracks, [state()], { autoDownload: false });
      await vi.waitFor(() => expect(built.held).toHaveLength(2));
    });
    expect(result.current.isExporting).toBe(true);

    const [releaseFirst, releaseSecond] = built.held;
    await act(async () => {
      releaseFirst();
      await first;
    });
    expect(result.current.isExporting).toBe(true);
    // The first export reached 1, but only the export started last writes
    // `progress`: the second is still at the 0.1 it reported before rendering.
    expect(result.current.progress).toBe(0.1);

    await act(async () => {
      releaseSecond();
      await second;
    });
    expect(result.current.isExporting).toBe(false);
    expect(result.current.progress).toBe(1);
  });

  const refusals: Array<{ name: string; tracks: ClipTrack[]; trackId?: string; message: string }> =
    [
      {
        name: 'an unknown id',
        tracks: [track('A')],
        trackId: 'nope',
        message: 'No track with id "nope" to export',
      },
      { name: 'no tracks', tracks: [], message: 'No tracks to export' },
    ];
  it.each(refusals)(
    'an export refused at once ($name) while another runs changes neither isExporting nor progress',
    async ({ tracks: refusedTracks, trackId, message }) => {
      built.hold = true;
      const { result } = renderHook(() => useExportWav());
      let failed!: Promise<unknown>;
      let running!: Promise<unknown>;
      await act(async () => {
        running = result.current.exportWav([track('A')], [state()], { autoDownload: false });
        // The running export has reported 0.1 and waits in its render.
        await vi.waitFor(() => expect(built.held).toHaveLength(1));
        failed = result.current
          .exportWav(refusedTracks, [], { trackId, autoDownload: false })
          .catch(() => undefined);
        await failed;
      });
      expect(result.current.isExporting).toBe(true);
      // The running export's 0.1, not a 0 from the refused one.
      expect(result.current.progress).toBe(0.1);
      expect(result.current.error).toBe(message);

      await act(async () => {
        // Every held render, so a mutant that renders the failed one too cannot hang.
        built.held.forEach((release) => release());
        await running;
      });
      expect(result.current.isExporting).toBe(false);
    }
  );
});
