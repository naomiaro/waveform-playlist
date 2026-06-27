import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { ClipTrack } from '@waveform-playlist/core';

// Regression test for #501: PlaylistEngine's per-track mixer setters
// (setTrackVolume/Mute/Solo/Pan) must emit statechange + bump tracksVersion so
// <daw-editor>'s tracksVersion-gated resync keeps `_engineTracks` fresh. Without
// that, an unrelated `addTrack` (which rebuilds the engine via
// `engine.setTracks([...this._engineTracks.values()])`) reverts live mixer state.

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  // happy-dom 20 upgrades cloned <daw-piano-roll> only if defined before cloning.
  await import('../elements/daw-piano-roll');
});

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  fetchSpy = vi.fn().mockRejectedValue(new Error('fetch should not have been called'));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

function midiTrackConfig(name: string) {
  return {
    name,
    midi: {
      notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    },
  };
}

describe('<daw-editor> mixer-change persistence (#501)', () => {
  it('keeps a muted track muted when an unrelated track is added afterwards', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    // Add track A and mute it via the track-controls UI path.
    const trackAEl = await editor.addTrack(midiTrackConfig('A'));
    const trackAId: string = trackAEl.trackId;

    editor.dispatchEvent(
      new CustomEvent('daw-track-control', {
        bubbles: true,
        composed: true,
        detail: { trackId: trackAId, prop: 'muted', value: true },
      })
    );

    // The engine cache should reflect the mute synchronously (statechange fired).
    expect(editor._engineTracks.get(trackAId).muted).toBe(true);

    // Adding an unrelated track rebuilds the engine from `_engineTracks`.
    adapter.setTracks.mockClear();
    await editor.addTrack(midiTrackConfig('B'));

    // The most recent rebuild must still carry track A as muted — without the
    // engine fix, the stale cache would have reverted it to muted:false.
    const lastCall = adapter.setTracks.mock.calls[adapter.setTracks.mock.calls.length - 1];
    const rebuiltTracks = lastCall[0] as ClipTrack[];
    const rebuiltA = rebuiltTracks.find((t) => t.id === trackAId);
    expect(rebuiltA).toBeDefined();
    expect(rebuiltA!.muted).toBe(true);

    document.body.removeChild(editor);
  });
});
