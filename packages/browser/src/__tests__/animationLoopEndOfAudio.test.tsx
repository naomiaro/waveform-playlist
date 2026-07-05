// @vitest-environment jsdom
//
// End-of-audio auto-stop behavior in the WaveformPlaylistProvider animation loop
// (issues #589 / #590).
//
// 1. The stop boundary must track the CURRENT timeline duration. The loop used to
//    close over the `duration` React state (set in an async effect), so a timeline
//    that grew mid-playback (e.g. a recording finalize) kept the old boundary and
//    stopped playback at the stale end.
// 2. While a recording is active, the end-of-audio auto-stop must be suppressed so
//    an overdub can run past the end of existing material (recorded clips land
//    beyond the current duration).
//
// The provider is mounted with an injected fake adapter (createAdapter) whose
// clock the test controls directly — no Tone.js, no real audio.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaybackAnimation,
  usePlaylistControls,
  usePlaylistData,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

// jsdom only provides requestAnimationFrame with pretendToBeVisual — polyfill
// with a short timeout so the provider's animation loop actually ticks.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(startSeconds: number, durationSeconds: number, id: string): AudioClip {
  return {
    id,
    startSample: Math.floor(startSeconds * SAMPLE_RATE),
    durationSamples: Math.floor(durationSeconds * SAMPLE_RATE),
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return {
    id,
    name: id,
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

interface FakeAdapter extends PlayoutAdapter {
  setNow(seconds: number): void;
}

function createFakeAdapter(): FakeAdapter {
  let now = 0;
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
    pause() {},
    stop() {},
    seek(time: number) {
      now = time;
    },
    getCurrentTime: () => now,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
    setNow(seconds: number) {
      now = seconds;
    },
  };
}

interface Probe {
  isPlaying: boolean;
  isReady: boolean;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  setRecordingActive: (active: boolean) => void;
}

let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = usePlaybackAnimation();
  const { play, setRecordingActive } = usePlaylistControls();
  const { isReady } = usePlaylistData();
  probe = {
    isPlaying,
    isReady,
    play,
    setRecordingActive,
  };
  return null;
};

function mountProvider(adapter: FakeAdapter, tracks: ClipTrack[]) {
  return render(
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={() => {}}
      sampleRate={SAMPLE_RATE}
      createAdapter={() => adapter}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
}

function rerenderProvider(
  result: ReturnType<typeof render>,
  adapter: FakeAdapter,
  tracks: ClipTrack[]
) {
  result.rerender(
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={() => {}}
      sampleRate={SAMPLE_RATE}
      createAdapter={() => adapter}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
}

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('animation loop end-of-audio auto-stop', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      cleanup();
    });
    vi.restoreAllMocks();
  });

  it('uses the live timeline duration, not a stale closure, for the stop boundary', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    const result = mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    // Grow the timeline mid-playback via the incremental-add path (existing
    // track object untouched, new track appended) — like a finalize that
    // extends the timeline. The loop must adopt the new 10s boundary.
    const trackB = makeTrack('track-b', [makeClip(0, 10, 'clip-b')]);
    await act(async () => {
      rerenderProvider(result, adapter, [trackA, trackB]);
    });

    // Past the OLD 2s boundary but inside the new 10s timeline: must keep playing.
    await act(async () => {
      adapter.setNow(2.5);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);

    // Past the NEW boundary: must stop.
    await act(async () => {
      adapter.setNow(10.5);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('suppresses the end-of-audio auto-stop while a recording is active', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    expect(typeof probe.setRecordingActive).toBe('function');

    await act(async () => {
      probe.setRecordingActive(true);
    });
    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    // Way past the end of existing audio — recording is active, keep playing.
    await act(async () => {
      adapter.setNow(5);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);

    // Recording ends — the auto-stop applies again on the next frames.
    await act(async () => {
      probe.setRecordingActive(false);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('keeps overdub playback alive on an empty timeline (duration 0)', async () => {
    // The first take records into an empty timeline: play() starts with
    // duration 0, so the very first frame satisfies time >= duration. An
    // eager setRecordingActive(true) (called before play, like the recording
    // example's overdub handler) must keep the transport running.
    const adapter = createFakeAdapter();
    const emptyTrack = makeTrack('track-a', []);
    mountProvider(adapter, [emptyTrack]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true);
      await probe.play(0);
    });
    await act(async () => {
      await settle();
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      probe.setRecordingActive(false);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });
});
