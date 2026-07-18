// @vitest-environment jsdom
//
// Regression test (track-reordering feature, #612): trackStates is a
// positionally-indexed array (name/mute/solo/volume/pan per track index) with
// no track id of its own. PlaylistEngine.reorderTrack is "purely organizational"
// — it reorders the engine's own tracks array without ever calling
// adapter.setTracks() or rebuilding — so before this fix, the mirror handler in
// WaveformPlaylistContext's `engine.on('statechange', ...)` forwarded the
// reordered `tracks` array via onTracksChange but never touched trackStates.
// Consumers' control panels are rendered from `tracks[i]` (which DID move) paired
// with `trackStates[i]` (which did NOT move), so after a reorder the panel at
// each position silently showed/controlled the WRONG track's name, mute, solo,
// volume, and pan — order looked "reordered" only if you read track ids, not if
// you read what the UI actually renders.
//
// The fix re-derives an id->state map from the pre-reorder (tracksRef,
// trackStatesRef) pairing and re-projects it onto the new track order inside the
// same statechange handler, so trackStates travels with its track.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistData,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

// Each track gets a distinct muted/volume/pan fingerprint so a positional
// mismatch (state didn't follow the track) is unambiguous from an id mismatch
// (state did follow, but to the wrong slot).
function makeTrack(id: string, muted: boolean, volume: number): ClipTrack {
  return {
    id,
    name: id,
    clips: [makeClip(id + '-clip')],
    muted,
    soloed: false,
    volume,
    pan: 0,
  } as ClipTrack;
}

function createFakeAdapter(): PlayoutAdapter {
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
  };
}

let probe: {
  tracks: ClipTrack[];
  trackStates: { name: string; muted: boolean; volume: number }[];
  isReady: boolean;
  reorderTrack: (id: string, i: number) => void;
};

const ProbeChild: React.FC = () => {
  const { tracks, trackStates, isReady } = usePlaylistData();
  const { reorderTrack } = usePlaylistControls();
  probe = { tracks, trackStates, isReady, reorderTrack };
  return null;
};

describe('reorderTrack keeps trackStates aligned with its track', () => {
  it('mixer state (name/mute/volume) follows the track after a reorder, not the index', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createFakeAdapter();
    const t1 = makeTrack('track-1', false, 0.2);
    const t2 = makeTrack('track-2', true, 0.5);
    const t3 = makeTrack('track-3', false, 0.9);

    let externalTracks: ClipTrack[] = [t1, t2, t3];
    const setExternalTracks = (t: ClipTrack[]) => {
      externalTracks = t;
      rerender();
    };

    const Wrapper: React.FC = () => (
      <WaveformPlaylistProvider
        tracks={externalTracks}
        onTracksChange={setExternalTracks}
        sampleRate={SAMPLE_RATE}
        createAdapter={() => adapter}
      >
        <ProbeChild />
      </WaveformPlaylistProvider>
    );

    const { rerender: doRerender } = render(<Wrapper />);
    const rerender = () => doRerender(<Wrapper />);

    await waitFor(() => expect(probe.isReady).toBe(true));
    expect(probe.tracks.map((t) => t.id)).toEqual(['track-1', 'track-2', 'track-3']);
    expect(probe.trackStates.map((s) => s.name)).toEqual(['track-1', 'track-2', 'track-3']);

    // Move track-1 (index 0) down to index 1 — matches the "Move track down"
    // button's call shape (SortableTrackControls drag commits the same way).
    await act(async () => {
      probe.reorderTrack('track-1', 1);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(probe.tracks.map((t) => t.id)).toEqual(['track-2', 'track-1', 'track-3']);

    // The bug: trackStates stayed at ['track-1', 'track-2', 'track-3'] (by
    // index) instead of following the ids into their new positions.
    expect(probe.trackStates.map((s) => s.name)).toEqual(['track-2', 'track-1', 'track-3']);
    expect(probe.trackStates.map((s) => s.muted)).toEqual([true, false, false]);
    expect(probe.trackStates.map((s) => s.volume)).toEqual([0.5, 0.2, 0.9]);

    cleanup();
  });

  it('does not touch trackStates for non-reorder structural changes (order unchanged)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createFakeAdapter();
    const t1 = makeTrack('track-1', false, 0.2);
    const t2 = makeTrack('track-2', true, 0.5);

    let externalTracks: ClipTrack[] = [t1, t2];
    const setExternalTracks = (t: ClipTrack[]) => {
      externalTracks = t;
      rerender();
    };

    const Wrapper: React.FC = () => (
      <WaveformPlaylistProvider
        tracks={externalTracks}
        onTracksChange={setExternalTracks}
        sampleRate={SAMPLE_RATE}
        createAdapter={() => adapter}
      >
        <ProbeChild />
      </WaveformPlaylistProvider>
    );

    const { rerender: doRerender } = render(<Wrapper />);
    const rerender = () => doRerender(<Wrapper />);

    await waitFor(() => expect(probe.isReady).toBe(true));

    // reorderTrack to the SAME index is a no-op in the engine (clamped ===
    // fromIndex bails before emitting) — trackStates must stay untouched.
    const statesBefore = probe.trackStates;
    await act(async () => {
      probe.reorderTrack('track-1', 0);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(probe.trackStates).toBe(statesBefore);

    cleanup();
  });
});
