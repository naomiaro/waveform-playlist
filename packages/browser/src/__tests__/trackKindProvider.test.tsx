// @vitest-environment jsdom
//
// #756: a track holds one kind of clip, and #812 refuses two tracks with one
// id. Since #812 the arrangement checks a track when it enters: a refused
// track throws to whoever called the arrangement (`createArrangement`,
// `addTrack`, ...) and the provider's `onError` is not involved (QB). What
// `onError` still reports is an engine or adapter that cannot be built, with
// one console error that says the playlist cannot be played.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';
import { TestProvider, testArrangement } from './helpers/arrangementProvider';
import { usePlaylistTimeline } from '../contexts/playlistContexts';
import type { ClipTrack, AudioClip, TrackKind } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function clip(id: string, midi = false): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sourceDurationSamples: SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    gain: 1,
    ...(midi && {
      midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    }),
  };
}

function track(id: string, kind: TrackKind, clips: AudioClip[]): ClipTrack {
  return { id, kind, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

function createFakeAdapter() {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn(async () => {}),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  } satisfies PlayoutAdapter;
}

let isReady = false;
const Probe: React.FC = () => {
  isReady = usePlaylistTimeline().isReady;
  return null;
};

function mount(
  tracks: ClipTrack[],
  options: { withOnError?: boolean; onReady?: () => void; failBuild?: Error } = {}
) {
  const { withOnError = true, onReady, failBuild } = options;
  const adapters: ReturnType<typeof createFakeAdapter>[] = [];
  const onError = vi.fn();
  const arrangement = testArrangement(tracks);
  render(
    <TestProvider
      arrangement={arrangement}
      sampleRate={SAMPLE_RATE}
      onError={withOnError ? onError : undefined}
      onReady={onReady}
      createAdapter={() => {
        if (failBuild) throw failBuild;
        const adapter = createFakeAdapter();
        adapters.push(adapter);
        return adapter;
      }}
    >
      <Probe />
    </TestProvider>
  );
  return { adapters, onError, arrangement };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  isReady = false;
});

describe('a wrong-kind track in the provider (#756)', () => {
  it('a wrong-kind track added to a mounted playlist throws to the caller; onError is not called, nothing reaches the adapter and the playlist stays ready', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapters, onError, arrangement } = mount([track('a', 'audio', [clip('c1')])]);
    await waitFor(() => expect(isReady).toBe(true));
    const running = adapters[adapters.length - 1];

    expect(() => act(() => arrangement.addTrack(track('m', 'audio', [clip('c3', true)])))).toThrow(
      /"m" is an audio track/
    );

    expect(onError).not.toHaveBeenCalled();
    expect(running.addTrack).not.toHaveBeenCalled();
    expect(adapters).toHaveLength(1);
    expect(isReady).toBe(true);
  });

  it('accepts an audio track and a MIDI track side by side', async () => {
    const { onError } = mount([
      track('a', 'audio', [clip('c1')]),
      track('m', 'midi', [clip('c2', true)]),
    ]);

    await waitFor(() => expect(isReady).toBe(true));
    expect(onError).not.toHaveBeenCalled();
  });

  describe('a playlist that cannot be built says so as a console error', () => {
    const noEngine = () => new Error('no audio engine here');

    it('onError gets the error, and one console.error names the cause and the state', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { onError } = mount([track('a', 'audio', [clip('a')])], { failBuild: noEngine() });

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onError.mock.calls[0][0].message).toBe('no audio engine here');
      expect(isReady).toBe(false);

      const messages = error.mock.calls.map((call) => String(call[0]));
      const ours = messages.filter((message) => message.startsWith('[waveform-playlist]'));
      expect(ours).toHaveLength(1);
      expect(ours[0]).toMatch(/could not be built/);
      expect(ours[0]).toMatch(/stays in its loading state/);
      // The waveform is drawn from the tracks all the same: only playback is missing.
      expect(ours[0]).toMatch(/cannot be played/);
      expect(ours[0]).not.toMatch(/nothing is drawn/);
      expect(ours[0]).toMatch(/no audio engine here/);
      // With an onError prop the app is handling it: no hint to add one.
      expect(ours[0]).not.toMatch(/onError/);
    });

    it('without an onError prop, the message says how to handle it in the app', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      mount([track('a', 'audio', [clip('a')])], { withOnError: false, failBuild: noEngine() });

      await waitFor(() =>
        expect(
          error.mock.calls.some((call) => String(call[0]).startsWith('[waveform-playlist]'))
        ).toBe(true)
      );
      const ours = error.mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.startsWith('[waveform-playlist]'));
      expect(ours).toHaveLength(1);
      expect(ours[0]).toMatch(/no audio engine here/);
      expect(ours[0]).toMatch(/onError/);
    });

    it('an onReady callback that throws is reported as that, not as a playlist that could not be built', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { onError } = mount([track('t1', 'audio', [clip('a')])], {
        onReady: () => {
          throw new Error('my handler broke');
        },
      });
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(isReady).toBe(true);
      const ours = error.mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.startsWith('[waveform-playlist]'));
      expect(ours).toHaveLength(1);
      expect(ours[0]).toMatch(/onReady/);
      expect(ours[0]).toMatch(/my handler broke/);
      expect(ours[0]).not.toMatch(/could not be built/);
    });
  });
});
