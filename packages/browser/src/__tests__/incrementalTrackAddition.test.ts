import { describe, it, expect, vi } from 'vitest';

/**
 * Incremental track addition detection logic extracted from WaveformPlaylistContext.
 *
 * When new tracks are appended to the playlist (file drop, new empty track),
 * the provider skips a full engine rebuild and calls engine.addTrack() per
 * new track instead. This avoids disposing and recreating all audio nodes.
 *
 * Detection criteria (from WaveformPlaylistContext lines 465-472):
 *   1. Engine exists (engineRef.current !== null)
 *   2. Previous tracks exist (prevTracks.length > 0)
 *   3. Track count increased (tracks.length > prevTracks.length)
 *   4. All previous tracks unchanged (reference equality per track)
 */

interface ClipTrack {
  id: string;
  name: string;
  clips: unknown[];
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
}

function makeTrack(id: string, name = `Track ${id}`): ClipTrack {
  return { id, name, clips: [], volume: 1, muted: false, soloed: false, pan: 0 };
}

/**
 * Pure function mirroring the isIncrementalAdd detection from WaveformPlaylistContext
 */
function isIncrementalAdd(
  prevTracks: ClipTrack[],
  tracks: ClipTrack[],
  engineExists: boolean
): boolean {
  return (
    engineExists &&
    prevTracks.length > 0 &&
    tracks.length > prevTracks.length &&
    prevTracks.every((pt) => {
      const current = tracks.find((t) => t.id === pt.id);
      return current === pt; // reference equality
    })
  );
}

describe('incremental track addition detection', () => {
  it('detects appending a single new track', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    const tracks = [track1, makeTrack('2')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(true);
  });

  it('detects appending multiple new tracks', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    const tracks = [track1, makeTrack('2'), makeTrack('3')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(true);
  });

  it('rejects when engine does not exist', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    const tracks = [track1, makeTrack('2')];

    expect(isIncrementalAdd(prevTracks, tracks, false)).toBe(false);
  });

  it('rejects when no previous tracks exist', () => {
    const tracks = [makeTrack('1')];

    expect(isIncrementalAdd([], tracks, true)).toBe(false);
  });

  it('rejects when track count is same (modification, not addition)', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    const tracks = [track1]; // Same count

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(false);
  });

  it('rejects when track count decreased (removal)', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const prevTracks = [track1, track2];
    const tracks = [track1]; // Removal

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(false);
  });

  it('rejects when an existing track object changes identity', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    // Spread creates a new object — same id but different reference
    const modifiedTrack1 = { ...track1, name: 'Modified' };
    const tracks = [modifiedTrack1, makeTrack('2')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(false);
  });

  it('rejects when existing track has clip added (new reference)', () => {
    const track1 = makeTrack('1');
    const prevTracks = [track1];
    // Simulates recording adding a clip to existing track
    const track1WithClip = { ...track1, clips: [{ id: 'clip-1' }] };
    const tracks = [track1WithClip, makeTrack('2')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(false);
  });

  it('detects addition with multiple existing tracks preserved', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const track3 = makeTrack('3');
    const prevTracks = [track1, track2, track3];
    const tracks = [track1, track2, track3, makeTrack('4')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(true);
  });

  it('rejects when one of many existing tracks changes', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const track3 = makeTrack('3');
    const prevTracks = [track1, track2, track3];
    // track2 replaced with new reference
    const tracks = [track1, { ...track2 }, track3, makeTrack('4')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(false);
  });

  it('handles reordered existing tracks (still reference-equal)', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const prevTracks = [track1, track2];
    // track2 now first, track1 second, new track appended
    // find() by id still matches, and reference equality holds
    const tracks = [track2, track1, makeTrack('3')];

    expect(isIncrementalAdd(prevTracks, tracks, true)).toBe(true);
  });
});

describe('engine.addTrack incremental path', () => {
  it('calls adapter.addTrack for incremental additions (not setTracks)', () => {
    // Mirrors PlaylistEngine.addTrack() behavior
    const addTrackSpy = vi.fn();
    const setTracksSpy = vi.fn();
    const adapter = {
      addTrack: addTrackSpy,
      setTracks: setTracksSpy,
    };

    const track = makeTrack('new-track');

    // Simulate engine.addTrack logic
    if (adapter.addTrack) {
      adapter.addTrack(track);
    } else {
      adapter.setTracks([track]);
    }

    expect(addTrackSpy).toHaveBeenCalledWith(track);
    expect(setTracksSpy).not.toHaveBeenCalled();
  });

  it('falls back to setTracks when adapter lacks addTrack', () => {
    const setTracksSpy = vi.fn();
    const adapter: { addTrack?: (t: ClipTrack) => void; setTracks: (t: ClipTrack[]) => void } = {
      setTracks: setTracksSpy,
    };

    const track = makeTrack('new-track');
    const existingTracks = [makeTrack('1')];

    // Simulate engine.addTrack fallback
    const allTracks = [...existingTracks, track];
    if (adapter.addTrack) {
      adapter.addTrack(track);
    } else {
      adapter.setTracks(allTracks);
    }

    expect(setTracksSpy).toHaveBeenCalledWith(allTracks);
  });

  it('identifies new tracks by filtering against previous IDs', () => {
    // Mirrors the WaveformPlaylistContext incremental add logic (lines 535-536)
    const prevTracks = [makeTrack('1'), makeTrack('2')];
    const newTrack3 = makeTrack('3');
    const newTrack4 = makeTrack('4');
    const tracks = [prevTracks[0], prevTracks[1], newTrack3, newTrack4];

    const prevIds = new Set(prevTracks.map((t) => t.id));
    const addedTracks = tracks.filter((t) => !prevIds.has(t.id));

    expect(addedTracks).toEqual([newTrack3, newTrack4]);
    expect(addedTracks).toHaveLength(2);
  });

  it('merges track state overrides into added tracks', () => {
    // Mirrors the WaveformPlaylistContext track state merge (lines 540-549)
    const newTrack = makeTrack('3');
    const trackStates = [
      { name: 'Track 1', muted: false, soloed: false, volume: 1, pan: 0 },
      { name: 'Track 2', muted: false, soloed: false, volume: 1, pan: 0 },
      { name: 'Track 3', muted: true, soloed: false, volume: 0.5, pan: -0.3 },
    ];

    const trackIndex = 2; // Index of newTrack in full tracks array
    const trackState = trackStates[trackIndex];

    const trackWithState = {
      ...newTrack,
      volume: trackState?.volume ?? newTrack.volume,
      muted: trackState?.muted ?? newTrack.muted,
      soloed: trackState?.soloed ?? newTrack.soloed,
      pan: trackState?.pan ?? newTrack.pan,
    };

    expect(trackWithState.volume).toBe(0.5);
    expect(trackWithState.muted).toBe(true);
    expect(trackWithState.pan).toBe(-0.3);
  });

  it('computes duration from all tracks including newly added', () => {
    // Mirrors the duration update in incremental add path (lines 554-560)
    const existingClip = { startSample: 0, durationSamples: 44100, sampleRate: 44100 };
    const newClip = { startSample: 44100, durationSamples: 88200, sampleRate: 44100 };

    const tracks = [{ clips: [existingClip] }, { clips: [newClip] }];

    let maxDuration = 0;
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const clipEnd = (clip.startSample + clip.durationSamples) / clip.sampleRate;
        maxDuration = Math.max(maxDuration, clipEnd);
      });
    });

    // existingClip ends at 1.0s, newClip ends at (44100 + 88200) / 44100 = 3.0s
    expect(maxDuration).toBe(3.0);
  });
});
