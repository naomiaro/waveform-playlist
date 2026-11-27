// #814: a track's render mode, spectrogram config and colour map have one
// owner, the arrangement. The track menu, `useTrack().setRenderMode` and the
// settings dialog's Apply change the track through `arrangement.updateTrack`,
// so a choice is an undo step, an app's own change of the track is what is
// drawn, and nothing is kept for a track that is gone.
//
// The real providers on a real arrangement (browser from `dist`); only the
// worker pool is faked, keeping its audio as the real one does.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import {
  WaveformPlaylistProvider,
  useCreateArrangement,
  useArrangement,
  useSpectrogramIntegration,
  usePlaylistTimeline,
  type SpectrogramIntegration,
} from '@waveform-playlist/browser';
import type { ArrangementTrack, AudioClip, ClipTrack, RenderMode } from '@waveform-playlist/core';

type Arrangement = ReturnType<typeof useArrangement>;

const fake = vi.hoisted(() => ({
  pools: [] as Array<{ audio: Set<string>; terminated: boolean }>,
}));

vi.mock('@dawcore/spectrogram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dawcore/spectrogram')>();
  return {
    ...actual,
    createSpectrogramWorkerPool: () => {
      const pool = { audio: new Set<string>(), terminated: false };
      fake.pools.push(pool);
      return {
        registerAudioData: (key: string) => pool.audio.add(key),
        unregisterAudioData: (key: string) => pool.audio.delete(key),
        registeredAudioClipIds: () => [...pool.audio],
        abortGeneration() {},
        registerCanvas() {},
        unregisterCanvas() {},
        async computeFFT() {
          return { cacheKey: 'k' };
        },
        async renderChunks() {},
        terminate() {
          pool.terminated = true;
          pool.audio.clear();
        },
      };
    },
  };
});

import { SpectrogramProvider } from '../SpectrogramProvider';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeBuffer(): AudioBuffer {
  const channel = new Float32Array(SAMPLE_RATE);
  return {
    numberOfChannels: 1,
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE,
    duration: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer;
}

function makeTrack(id: string, renderMode?: RenderMode): ClipTrack {
  return {
    id,
    name: id,
    kind: 'audio',
    ...(renderMode !== undefined && { renderMode }),
    clips: [
      {
        id: `${id}-clip`,
        startSample: 0,
        durationSamples: SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
        audioBuffer: makeBuffer(),
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

const createAdapter = () =>
  ({
    audioContext: { currentTime: 0, sampleRate: SAMPLE_RATE, state: 'running', outputLatency: 0 },
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  }) as never;

const seen: {
  integration: SpectrogramIntegration | null;
  arrangement: Arrangement | null;
  tracks: readonly ClipTrack[];
} = { integration: null, arrangement: null, tracks: [] };

const Probe: React.FC = () => {
  seen.integration = useSpectrogramIntegration();
  seen.arrangement = useArrangement();
  seen.tracks = usePlaylistTimeline().tracks;
  return null;
};

function mount(tracks: ClipTrack[]) {
  const Playlist: React.FC = () => {
    const arrangement = useCreateArrangement(() => tracks);
    return (
      <WaveformPlaylistProvider
        arrangement={arrangement}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
      >
        <SpectrogramProvider>
          <Probe />
        </SpectrogramProvider>
      </WaveformPlaylistProvider>
    );
  };
  render(<Playlist />);
}

const settle = () => act(async () => {});
const integration = () => seen.integration!;
const arrangement = () => seen.arrangement!;
const track = (id: string) =>
  arrangement()
    .getTracks()
    .find((t: ArrangementTrack) => t.id === id)!;
const livePool = () => fake.pools.filter((p) => !p.terminated).pop();

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  fake.pools = [];
  seen.integration = null;
  seen.arrangement = null;
  seen.tracks = [];
});

describe('a spectrogram choice is stored on the track (#814)', () => {
  it('the integration keeps no per-track overrides of its own', async () => {
    mount([makeTrack('t1')]);
    await settle();
    expect(integration()).not.toHaveProperty('trackSpectrogramOverrides');
  });

  it('a mode chosen in the menu is the track’s renderMode, and one undo step', async () => {
    mount([makeTrack('t1')]);
    await settle();
    expect(arrangement().canUndo).toBe(false);

    await act(async () => integration().setTrackRenderMode('t1', 'spectrogram'));

    expect(track('t1').renderMode).toBe('spectrogram');
    expect(seen.tracks[0].renderMode).toBe('spectrogram');
    expect(arrangement().canUndo).toBe(true);

    await act(async () => arrangement().undo());
    expect(track('t1').renderMode).toBeUndefined();
    expect(arrangement().canUndo).toBe(false);
  });

  it('choosing the mode the track already has is no undo step', async () => {
    mount([makeTrack('t1', 'both')]);
    await settle();

    await act(async () => integration().setTrackRenderMode('t1', 'both'));

    expect(arrangement().canUndo).toBe(false);
  });

  it('applying settings writes the track’s config and colour map and keeps its mode', async () => {
    mount([makeTrack('t1', 'spectrogram')]);
    await settle();

    await act(async () =>
      integration().setTrackSpectrogramConfig('t1', { fftSize: 4096, alpha: 0.6 }, 'magma')
    );

    expect(track('t1')).toMatchObject({
      renderMode: 'spectrogram',
      spectrogramConfig: { fftSize: 4096, alpha: 0.6 },
      spectrogramColorMap: 'magma',
    });
  });

  it('applying settings without a colour map keeps the track’s own', async () => {
    mount([{ ...makeTrack('t1', 'spectrogram'), spectrogramColorMap: 'inferno' }]);
    await settle();

    await act(async () => integration().setTrackSpectrogramConfig('t1', { fftSize: 4096 }));

    expect(track('t1').spectrogramColorMap).toBe('inferno');
  });

  it('an app’s own change of the track after a menu choice is what applies', async () => {
    mount([makeTrack('t1', 'spectrogram')]);
    await settle();

    await act(async () => integration().setTrackRenderMode('t1', 'waveform'));
    await act(async () =>
      arrangement().updateTrack('t1', (t: ArrangementTrack) => ({
        ...t,
        renderMode: 'both' as const,
      }))
    );

    expect(seen.tracks[0].renderMode).toBe('both');
    expect(livePool()?.audio.size).toBe(1);
  });

  it('a menu choice sends the track’s audio to the pool, and back to waveform releases it', async () => {
    mount([makeTrack('t1')]);
    await settle();
    expect(fake.pools).toEqual([]);

    await act(async () => integration().setTrackRenderMode('t1', 'both'));
    expect(livePool()?.audio.size).toBe(1);

    await act(async () => integration().setTrackRenderMode('t1', 'waveform'));
    expect(livePool()?.audio.size).toBe(0);
  });

  it('choosing waveform for a track with no mode is no undo step: it is drawn as one already', async () => {
    mount([makeTrack('t1')]);
    await settle();

    await act(async () => integration().setTrackRenderMode('t1', 'waveform'));

    expect(arrangement().canUndo).toBe(false);
    expect(track('t1').renderMode).toBeUndefined();
  });

  it('a mode chosen for a MIDI track changes nothing: it is drawn as a piano roll', async () => {
    const midi: ClipTrack = { ...makeTrack('m1'), kind: 'midi', clips: [] };
    mount([makeTrack('t1'), midi]);
    await settle();

    await act(async () => integration().setTrackRenderMode('m1', 'spectrogram'));

    expect(arrangement().canUndo).toBe(false);
    expect(track('m1').renderMode).toBeUndefined();
  });

  it('a new track with the id of a removed one starts from its own fields', async () => {
    mount([makeTrack('t1')]);
    await settle();

    await act(async () => integration().setTrackRenderMode('t1', 'spectrogram'));
    expect(livePool()?.audio.size).toBe(1);
    await act(async () => arrangement().removeTrack('t1'));
    await act(async () => arrangement().addTrack(makeTrack('t1')));

    // A waveform track: its audio is not sent to the pool.
    expect(seen.tracks[0].renderMode).toBeUndefined();
    expect(livePool()?.audio.size ?? 0).toBe(0);
  });
});
