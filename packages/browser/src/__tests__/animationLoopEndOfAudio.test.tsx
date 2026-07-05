// @vitest-environment jsdom
//
// End-of-audio playback semantics in the WaveformPlaylistProvider animation
// loop (issues #589 / #590 — semantics matched with dawcore's <daw-editor>):
//
// 1. Default: playback auto-stops at the end of the timeline (player style)
//    and the cursor returns to the play-start position.
// 2. `indefinitePlayback` opts out — the transport rolls until an explicit
//    stop/pause (DAW style, = dawcore's `indefinite-playback` attribute).
// 3. An active recording session suppresses the auto-stop so overdub
//    playback runs past the end of existing material. Consumers call
//    setRecordingActive eagerly (before play()) — a render round-trip loses
//    the race against the first animation frame on an empty timeline.
// 4. setRecordingActive(active, armedTrackId) also transiently mutes the
//    armed track for the session (punch-in replaces its overlapped content —
//    the doomed material must not play under the take) and restores the
//    previous mute state on release.
// 5. Explicit ends still stop: selection playback passes a playDuration and
//    stops at its end regardless.
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

function makeTrack(id: string, clips: AudioClip[], muted = false): ClipTrack {
  return {
    id,
    name: id,
    clips,
    muted,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

interface FakeAdapter extends PlayoutAdapter {
  setNow(seconds: number): void;
  muteCalls: Array<{ trackId: string; muted: boolean }>;
}

function createFakeAdapter(): FakeAdapter {
  let now = 0;
  const muteCalls: Array<{ trackId: string; muted: boolean }> = [];
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
    setTrackMute(trackId: string, muted: boolean) {
      muteCalls.push({ trackId, muted });
    },
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
    setNow(seconds: number) {
      now = seconds;
    },
    muteCalls,
  };
}

interface Probe {
  isPlaying: boolean;
  isReady: boolean;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
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

function mountProvider(
  adapter: FakeAdapter,
  tracks: ClipTrack[],
  opts: { indefinitePlayback?: boolean } = {}
) {
  return render(
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={() => {}}
      sampleRate={SAMPLE_RATE}
      createAdapter={() => adapter}
      indefinitePlayback={opts.indefinitePlayback}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
}

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('end-of-audio auto-stop semantics', () => {
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

  it('auto-stops at the end of the timeline by default (player style)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      adapter.setNow(2.1);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('indefinitePlayback rolls past the end until explicit stop (DAW style)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA], { indefinitePlayback: true });
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    await act(async () => {
      adapter.setNow(30);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);
  });

  it('an active recording session suppresses the auto-stop (overdub past the end)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true, 'track-a');
      await probe.play(0);
    });
    await act(async () => {
      adapter.setNow(5);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);

    // Session ends — the auto-stop applies again on the next frames.
    await act(async () => {
      probe.setRecordingActive(false);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('keeps a recording session alive on an empty timeline (duration 0, first take)', async () => {
    // The first take records into an empty timeline: play() starts with
    // duration 0, so the very first frame satisfies time >= duration. The
    // eager setRecordingActive(true) (called before play, like the recording
    // example's overdub handler) must keep the transport running.
    const adapter = createFakeAdapter();
    const emptyTrack = makeTrack('track-a', []);
    mountProvider(adapter, [emptyTrack]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true, 'track-a');
      await probe.play(0);
    });
    await act(async () => {
      adapter.setNow(5);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      probe.setRecordingActive(false);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('still stops at an explicit playDuration end (selection playback)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 10, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0, 1.5);
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      adapter.setNow(1.6);
    });
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });
});

describe('setRecordingActive armed-track mute', () => {
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

  it('mutes the armed track for the session and restores it on release', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    const trackB = makeTrack('track-b', [makeClip(0, 2, 'clip-b')]);
    mountProvider(adapter, [trackA, trackB]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true, 'track-a');
    });
    expect(adapter.muteCalls).toContainEqual({ trackId: 'track-a', muted: true });
    // only the armed track is touched
    expect(adapter.muteCalls.some((c) => c.trackId === 'track-b')).toBe(false);

    adapter.muteCalls.length = 0;
    await act(async () => {
      probe.setRecordingActive(false);
    });
    expect(adapter.muteCalls).toContainEqual({ trackId: 'track-a', muted: false });
  });

  it('is idempotent while active (eager consumer call + prop-driven sync)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true, 'track-a');
      probe.setRecordingActive(true, 'track-a');
    });
    expect(adapter.muteCalls.filter((c) => c.trackId === 'track-a')).toHaveLength(1);
  });

  it('restores a previously-muted armed track to muted, not unmuted', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')], /* muted */ true);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true, 'track-a');
    });
    adapter.muteCalls.length = 0;
    await act(async () => {
      probe.setRecordingActive(false);
    });
    // release restores the pre-session state: still muted
    expect(adapter.muteCalls).toContainEqual({ trackId: 'track-a', muted: true });
  });

  it('activation without a trackId does not touch any track mute', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      probe.setRecordingActive(true);
      probe.setRecordingActive(false);
    });
    expect(adapter.muteCalls).toHaveLength(0);
  });
});
