/**
 * A saved state holds the mix (#843): an undo step, a redo step and a
 * transaction's base are the tracks AND the mixer Map from that moment, so
 * undo, redo and abort bring back both. The setters are not undo steps yet;
 * a mixer change becomes one here by being made inside a transaction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import type { ArrangementChange } from '../arrangement/Arrangement';

const SAMPLE_RATE = 48000;

function timeBase() {
  return {
    sampleRate: SAMPLE_RATE,
    ppqn: 960,
    secondsToTicks: (seconds: number) => Math.round(seconds * 1920),
    ticksToSeconds: (tick: number) => tick / 1920,
  };
}

function clip(id: string, startSample: number): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: SAMPLE_RATE,
      sourceDurationSamples: 96000,
    }),
    id,
  };
}

function track(id: string, clips: AudioClip[], mix: Partial<ClipTrack> = {}): ClipTrack {
  return { ...createTrack({ name: id, clips }), ...mix, id };
}

function setup() {
  const arrangement = new Arrangement({ timeBase: timeBase() });
  arrangement.setTracks([track('A', [clip('a1', 0)]), track('B', [clip('b1', 0)])]);
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  return { arrangement, changes };
}

function startOf(arrangement: Arrangement, clipId: string): number | undefined {
  const found = arrangement.getClipBounds('A', clipId);
  return found?.startSample;
}

/** A mixer change as an undo step of its own (until the setters are steps). */
function volumeStep(arrangement: Arrangement, trackId: string, volume: number): void {
  arrangement.beginTransaction();
  arrangement.setTrackVolume(trackId, volume);
  arrangement.commitTransaction();
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a saved state holds the mix', () => {
  it('an undo of a removal brings the track back with the mix it had', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.6);
    arrangement.removeTrack('A');
    // The current Map holds the current tracks only.
    expect(arrangement.getMixer().has('A')).toBe(false);
    arrangement.undo();
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.6);
  });

  // Rule (#843): the entry of a removed track is not kept; before, re-adding
  // the id found the kept entry (volume 0.3).
  it('re-adding the id of a removed track seeds its mix from the new track’s fields', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.removeTrack('A');
    arrangement.addTrack(track('A', [], { volume: 0.9, pan: 0.5 }));
    expect(arrangement.getMixer().get('A')).toEqual({
      volume: 0.9,
      muted: false,
      soloed: false,
      pan: 0.5,
    });
  });

  it('an undo that changes only the mix does not increment tracksVersion', () => {
    const { arrangement, changes } = setup();
    volumeStep(arrangement, 'A', 0.4);
    const tracks = arrangement.getTracks();
    const { tracksVersion, mixerVersion } = arrangement;
    changes.length = 0;

    arrangement.undo();

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(arrangement.canRedo).toBe(true);
    expect(changes.map((c) => c.type)).toEqual(['restoreMix']);
  });

  it('a redo of a mix-only step brings the mix forward again, as its own kind of change', () => {
    const { arrangement, changes } = setup();
    volumeStep(arrangement, 'A', 0.4);
    arrangement.undo();
    const { tracksVersion, mixerVersion } = arrangement;
    const undone = arrangement.getMixer();
    changes.length = 0;

    arrangement.redo();

    expect(arrangement.getMixer().get('A')?.volume).toBe(0.4);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(changes).toEqual([{ type: 'restoreMix', previousMixer: undone }]);
  });

  it('commitTransaction pushes a step when only the mix changed', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
  });

  it('commitTransaction pushes no step when the mix is back where it began', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.setTrackVolume('A', 1);
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(false);
  });

  // Rule (#843): before, a mixer change made inside a transaction survived its abort.
  it('abort takes back a mixer change made inside the transaction', () => {
    const { arrangement, changes } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.2);
    const moved = arrangement.getTracks();
    const mixed = arrangement.getMixer();
    changes.length = 0;

    arrangement.abortTransaction();

    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
    expect(startOf(arrangement, 'a1')).toBe(0);
    expect(changes).toEqual([{ type: 'restore', previous: moved, previousMixer: mixed }]);
  });

  it('abort of a transaction that changed only the mix is a mix-only change', () => {
    const { arrangement, changes } = setup();
    const { tracksVersion } = arrangement;
    arrangement.beginTransaction();
    arrangement.setTrackPan('B', -1);
    changes.length = 0;
    arrangement.abortTransaction();
    expect(arrangement.getMixer().get('B')?.pan).toBe(0);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(changes.map((c) => c.type)).toEqual(['restoreMix']);
  });

  it('an undo of a move that came with a mix change brings both back in one change', () => {
    const { arrangement, changes } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackMute('B', true);
    arrangement.commitTransaction();
    const { tracksVersion, mixerVersion } = arrangement;
    changes.length = 0;

    arrangement.undo();

    expect(startOf(arrangement, 'a1')).toBe(0);
    expect(arrangement.getMixer().get('B')?.muted).toBe(false);
    expect(arrangement.tracksVersion).toBe(tracksVersion + 1);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(changes.map((c) => c.type)).toEqual(['restore']);
  });

  it('an undo of a move without a mix change leaves mixerVersion and the Map as they were', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    const mixer = arrangement.getMixer();
    const { mixerVersion } = arrangement;
    arrangement.undo();
    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
  });

  it('undo of a rename brings back the old id with the mix it had', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.6);
    arrangement.updateTrack('A', track('A2', [clip('a1', 0)]));
    expect(arrangement.getMixer().get('A2')?.volume).toBe(0.6);
    expect(arrangement.getMixer().has('A')).toBe(false);
    arrangement.setTrackVolume('A2', 0.2);

    arrangement.undo();

    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.6);
    expect(arrangement.getMixer().has('A2')).toBe(false);
    arrangement.redo();
    expect(arrangement.getMixer().get('A2')?.volume).toBe(0.2);
    expect(arrangement.getMixer().has('A')).toBe(false);
  });

  it('a rename onto the id of a removed track: undoing past the removal brings back that track’s own mix', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.6);
    arrangement.setTrackVolume('B', 0.2);
    arrangement.removeTrack('A');
    arrangement.updateTrack('B', track('A', [clip('b1', 0)]));
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.2);

    arrangement.undo(); // the rename
    arrangement.undo(); // the removal

    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.6);
    expect(arrangement.getMixer().get('B')?.volume).toBe(0.2);
  });

  it('clearHistory and setTracks need no clean-up: the current Map holds the current tracks', () => {
    const { arrangement } = setup();
    arrangement.removeTrack('A');
    expect([...arrangement.getMixer().keys()]).toEqual(['B']);
    arrangement.clearHistory();
    expect([...arrangement.getMixer().keys()]).toEqual(['B']);
    arrangement.setTracks([track('C', [])]);
    expect([...arrangement.getMixer().keys()]).toEqual(['C']);
  });

  it('a saved Map is never written to', () => {
    const { arrangement } = setup();
    const before = arrangement.getMixer();
    const entryA = before.get('A');
    volumeStep(arrangement, 'A', 0.4);
    arrangement.removeTrack('B');
    arrangement.undo();
    arrangement.undo();
    expect(arrangement.getMixer()).toBe(before);
    expect(before.get('A')).toBe(entryA);
    expect(before.get('A')?.volume).toBe(1);
    expect([...before.keys()]).toEqual(['A', 'B']);
  });
});

describe('a removal that is not an undo step (purge)', () => {
  it('takes the track’s entry out of every saved state, and drops steps that no longer differ', () => {
    const { arrangement } = setup();
    volumeStep(arrangement, 'B', 0.5); // a step that differs only in B's mix
    arrangement.removeTrack('B', { undoable: false });
    // The only step differed in B alone: with B gone it is the current state, and goes.
    expect(arrangement.canUndo).toBe(false);
    expect([...arrangement.getMixer().keys()]).toEqual(['A']);
  });

  it('keeps a step that still differs in another track’s mix, without the purged entry', () => {
    const { arrangement } = setup();
    volumeStep(arrangement, 'A', 0.5);
    arrangement.removeTrack('B', { undoable: false });
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A']);
    expect([...arrangement.getMixer().keys()]).toEqual(['A']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
  });

  it('an open transaction’s base loses the entry too', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackVolume('A', 0.5);
    arrangement.removeTrack('B', { undoable: false });
    arrangement.abortTransaction();
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A']);
    expect([...arrangement.getMixer().keys()]).toEqual(['A']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
  });
});
