// @vitest-environment jsdom
//
// `useExportWav().exportWav(tracks, trackStates)` called directly by an app.
// Under the provider both arrays have one entry per track; a direct caller may
// pass fewer states, and a track without one is rendered with its own fields
// (`muted`, `soloed`, `volume`, `pan`). The offline render is replaced by fakes
// that record the track volumes the graph is built with.
import { describe, it, expect, vi, afterEach } from 'vitest';

const built = vi.hoisted(() => ({
  volumesDb: [] as number[],
  panLaws: [] as string[],
  channels: [] as number[],
}));

vi.mock('tone', () => {
  class Node {
    // A clip with audio gets its gain scheduled (`applyClipFades`).
    input = { gain: { setValueAtTime() {} } };
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
  class Gain extends Node {}
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
  renderToneOffline: async (
    build: (context: unknown) => Promise<void>,
    _duration: number,
    channels: number
  ) => {
    built.channels.push(channels);
    await build({ destination: {}, rawContext: {}, transport: { start: () => {} } });
    return { length: 1, numberOfChannels: 1, sampleRate: 48000 } as unknown as AudioBuffer;
  },
}));
vi.mock('../utils/wavEncoder', () => ({
  encodeWav: () => new Blob(),
  downloadBlob: () => {},
}));
vi.mock('@waveform-playlist/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@waveform-playlist/core')>()),
  createPanStage: (_context: unknown, _pan: number, panLaw: string) => {
    built.panLaws.push(panLaw);
    return { input: {}, output: {} };
  },
}));

import { renderHook, act } from '@testing-library/react';
import { gainToDb } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { useExportWav } from '../hooks/useExportWav';

function track(id: string, fields: Partial<ClipTrack>): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: 48000,
    offsetSamples: 0,
    sampleRate: 48000,
  } as AudioClip;
  return {
    id,
    name: id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...fields,
  } as ClipTrack;
}

afterEach(() => {
  built.volumesDb.length = 0;
  built.panLaws.length = 0;
  built.channels.length = 0;
  vi.restoreAllMocks();
});

describe('exportWav called directly with fewer track states than tracks', () => {
  it('renders a track without a state with its own fields', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useExportWav());
    // A has no state: its own fields say soloed, at half volume. B's state
    // is not soloed, so only A is audible.
    const tracks = [track('A', { soloed: true, volume: 0.5 }), track('B', {})];
    // No entry at A's position, one for B.
    const states: Array<{ muted: boolean; soloed: boolean; volume: number; pan: number }> = [];
    states[1] = { muted: false, soloed: false, volume: 1, pan: 0 };

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.exportWav(tracks, states, { autoDownload: false });
    });

    expect(outcome).toMatchObject({ blob: expect.any(Blob) });
    // The master volume (0 dB), then A alone, at its own volume.
    expect(built.volumesDb).toEqual([0, gainToDb(0.5)]);
  });

  it('an empty states array renders every track from its own fields', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useExportWav());
    const tracks = [track('A', { volume: 0.25 }), track('B', { muted: true })];

    await act(async () => {
      await result.current.exportWav(tracks, [], { autoDownload: false });
    });

    // B is muted by its own field and not soloed: only A is built.
    expect(built.volumesDb).toEqual([0, gainToDb(0.25)]);
  });
});

describe('the pan law a track is exported with (#684)', () => {
  const buffer = (numberOfChannels: number) =>
    ({ numberOfChannels, sampleRate: 48000, length: 48000, duration: 1 }) as AudioBuffer;
  /** A track whose one clip has a decoded buffer of `channels` channels. */
  function audioTrackOf(id: string, channels: number, fields: Partial<ClipTrack> = {}): ClipTrack {
    const base = track(id, fields);
    return { ...base, clips: [{ ...base.clips[0], audioBuffer: buffer(channels) }] };
  }
  const state = (panLaw?: 'auto' | 'mono' | 'stereo') => ({
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...(panLaw && { panLaw }),
  });
  async function exportWith(tracks: ClipTrack[], states: ReturnType<typeof state>[]) {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useExportWav());
    await act(async () => {
      await result.current.exportWav(tracks, states, { autoDownload: false });
    });
  }

  it("the state's law wins over the clips: mono clips under 'stereo' write two channels", async () => {
    await exportWith([audioTrackOf('A', 1)], [state('stereo')]);
    expect(built.panLaws).toEqual(['stereo']);
    expect(built.channels).toEqual([2]);
  });

  it("a stereo clip under 'mono' is panned with the mono law and still writes two channels", async () => {
    await exportWith([audioTrackOf('A', 2)], [state('mono')]);
    expect(built.panLaws).toEqual(['mono']);
    expect(built.channels).toEqual([2]);
  });

  it("the state's law wins over the track's own field", async () => {
    await exportWith([audioTrackOf('A', 1, { panLaw: 'stereo' })], [state('mono')]);
    expect(built.panLaws).toEqual(['mono']);
    expect(built.channels).toEqual([1]);
  });

  it("a state that is 'auto' or has no law uses the track's own, else the law of its clips", async () => {
    await exportWith(
      [audioTrackOf('A', 1, { panLaw: 'stereo' }), audioTrackOf('B', 2), audioTrackOf('C', 1)],
      [state('auto'), state(), state()]
    );
    expect(built.panLaws).toEqual(['stereo', 'stereo', 'mono']);
  });

  it('a track without a state is rendered with its own law', async () => {
    await exportWith([audioTrackOf('A', 1, { panLaw: 'stereo' })], []);
    expect(built.panLaws).toEqual(['stereo']);
    expect(built.channels).toEqual([2]);
  });

  it('mono clips with no law anywhere write one channel, as before', async () => {
    await exportWith([audioTrackOf('A', 1)], [state('auto')]);
    expect(built.panLaws).toEqual(['mono']);
    expect(built.channels).toEqual([1]);
  });

  it('a muted, soloed track is left out and does not decide the channel count (#817)', async () => {
    await exportWith(
      [audioTrackOf('A', 1), audioTrackOf('B', 2)],
      [
        { ...state('mono'), soloed: true },
        { ...state('stereo'), soloed: true, muted: true },
      ]
    );
    // A alone is built: one pan stage, one channel.
    expect(built.panLaws).toEqual(['mono']);
    expect(built.channels).toEqual([1]);
  });

  it('a muted track does not decide the channel count', async () => {
    await exportWith(
      [audioTrackOf('A', 1), audioTrackOf('B', 2)],
      [state('mono'), { ...state('stereo'), muted: true }]
    );
    expect(built.channels).toEqual([1]);
  });
});
