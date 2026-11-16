// @vitest-environment jsdom
//
// `useExportWav().exportWav(tracks, trackStates)` called directly by an app.
// Under the provider both arrays have one entry per track; a direct caller may
// pass fewer states, and a track without one is rendered with its own fields
// (`muted`, `soloed`, `volume`, `pan`). The offline render is replaced by fakes
// that record the track volumes the graph is built with.
import { describe, it, expect, vi, afterEach } from 'vitest';

const built = vi.hoisted(() => ({ volumesDb: [] as number[] }));

vi.mock('tone', () => {
  class Node {
    input = { gain: {} };
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
  renderToneOffline: async (build: (context: unknown) => Promise<void>) => {
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
  createPanStage: () => ({ input: {}, output: {} }),
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
