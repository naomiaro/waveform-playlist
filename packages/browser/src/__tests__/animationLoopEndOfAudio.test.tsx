// @vitest-environment jsdom
//
// DAW-transport playback semantics in the WaveformPlaylistProvider animation
// loop (issues #589 / #590).
//
// 1. Playback does NOT auto-stop at the end of the timeline — like a DAW
//    transport (and dawcore's native transport), it rolls until an explicit
//    stop/pause. This is what lets overdub recording run past the end of
//    existing material with no special casing.
// 2. Explicit ends still stop: selection playback passes a playDuration and
//    must stop at its end.
// 3. setRecordingActive(active, armedTrackId) transiently mutes the armed
//    track for the recording session (punch-in replaces its content — the
//    doomed material must not play under the take) and restores the previous
//    mute state on release.
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

const settle = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('DAW-transport playback semantics', () => {
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

  it('does not auto-stop at the end of the timeline (rolls until explicit stop)', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 2, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    // Far past the 2s end of audio — the transport keeps rolling.
    await act(async () => {
      adapter.setNow(30);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);
  });

  it('keeps rolling on an empty timeline (duration 0, e.g. first-take overdub)', async () => {
    const adapter = createFakeAdapter();
    const emptyTrack = makeTrack('track-a', []);
    mountProvider(adapter, [emptyTrack]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    await act(async () => {
      adapter.setNow(5);
      await settle();
    });
    expect(probe.isPlaying).toBe(true);
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
