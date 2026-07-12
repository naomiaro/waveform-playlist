// @vitest-environment jsdom
//
// Regression test for final-review CRITICAL 1 (fix/annotation-playback-followups,
// #608 follow-up): PlaylistEngine now stops ITSELF (via a queued microtask) when
// a bounded play(start, end) completes on an adapter that reports onPlaybackEnded
// (the Tone path). That self-stop rewinds the engine's own current time to
// playStartPosition BEFORE the rAF loop's own end-of-playback checks
// (`time >= playbackEndTimeRef` / `time >= duration`) can ever observe it — so
// those checks never fire, and without a mirror React `isPlaying` stays `true`
// forever with the playhead frozen at the rewound position.
//
// The fix subscribes the provider to the engine's 'stop' event and mirrors it
// into React state (isPlaying, animation loop, time refs) — see
// WaveformPlaylistContext.tsx's `engine.on('stop', ...)` handler and the
// `suppressEngineStopMirrorRef` guard around provider-initiated restarts.
//
// This test drives the mirror directly by capturing the adapter's
// onPlaybackEnded callback (PlaylistEngine subscribes to it in its
// constructor) and invoking it without ever advancing the adapter's clock
// past the bound — proving the rAF loop's own end-time detection could not
// have caught this on its own.
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
  /** Simulates the Tone adapter's scheduleOnce completion firing (#608). */
  triggerPlaybackEnded(): void;
}

// Mirrors the onPlaybackEnded-capable fake adapter pattern from the engine/
// playout #608 test suites, adapted for a browser-provider-level mount.
function createFakeAdapter(): FakeAdapter {
  let now = 0;
  let endedCallback: (() => void) | null = null;
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
    onPlaybackEnded(callback: (() => void) | null) {
      endedCallback = callback;
    },
    setNow(seconds: number) {
      now = seconds;
    },
    triggerPlaybackEnded() {
      endedCallback?.();
    },
  };
}

interface Probe {
  isPlaying: boolean;
  isReady: boolean;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  setSelection: (start: number, end: number) => void;
}

let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = usePlaybackAnimation();
  const { play, setSelection } = usePlaylistControls();
  const { isReady } = usePlaylistData();
  probe = {
    isPlaying,
    isReady,
    play,
    setSelection,
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

// Flushes the queueMicrotask PlaylistEngine defers its self-stop through
// (constructor's onPlaybackEnded subscription — see engine/CLAUDE.md).
const flushEngineMicrotask = () => Promise.resolve().then(() => Promise.resolve());

describe('engine-initiated stop mirror (final-review CRITICAL 1, #608 follow-up)', () => {
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

  it('mirrors an engine-initiated bounded-playback stop into isPlaying=false', async () => {
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 10, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    // Bounded play (selection/annotation style): start 0, duration 1.5s.
    await act(async () => {
      await probe.play(0, 1.5);
    });
    expect(probe.isPlaying).toBe(true);

    // Simulate the adapter's completion callback firing WITHOUT the adapter
    // clock ever reaching the bound — the rAF loop's own
    // `time >= playbackEndTimeRef` check can never observe this on its own,
    // which is exactly the #608 race (Tone's scheduleOnce fires ~lookAhead
    // before Transport.seconds visibly reaches the bound).
    await act(async () => {
      adapter.triggerPlaybackEnded();
      await flushEngineMicrotask();
    });

    await waitFor(() => expect(probe.isPlaying).toBe(false));
    // The adapter clock never advanced past the bound — proves this stop was
    // NOT caught by the rAF loop's own end-time detection.
    expect(adapter.getCurrentTime()).toBeLessThan(1.5);
  });

  it('does not wedge isPlaying=false when a provider-initiated restart races the mirror', async () => {
    // Guards the suppression fix: setSelection() while playing calls
    // engine.stop() + seek() + play() as an implementation detail. The stop()
    // call fires the same engine 'stop' event the mirror listens to — an
    // unguarded mirror would flip isPlaying to false with nothing here to set
    // it back to true (isPlaying was already true on entry).
    const adapter = createFakeAdapter();
    const trackA = makeTrack('track-a', [makeClip(0, 10, 'clip-a')]);
    mountProvider(adapter, [trackA]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      probe.setSelection(1, 3);
    });

    expect(probe.isPlaying).toBe(true);
  });
});
