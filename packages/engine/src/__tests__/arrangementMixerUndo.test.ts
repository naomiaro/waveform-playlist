/**
 * The mixer setters are undo steps (#843). Changes that name the same
 * `gesture` id, one after another, are one step; `undoable: false` is no
 * step and writes the value into every saved state as well.
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

function track(id: string, clips: AudioClip[]): ClipTrack {
  return { ...createTrack({ name: id, clips }), id };
}

function fixture(): ClipTrack[] {
  return [track('A', [clip('a1', 0)]), track('B', [clip('b1', 0)])];
}

function setup() {
  const arrangement = new Arrangement({ timeBase: timeBase() });
  arrangement.setTracks(fixture());
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  return { arrangement, changes };
}

function volumeOf(arrangement: Arrangement, trackId = 'A'): number | undefined {
  return arrangement.getMixer().get(trackId)?.volume;
}

function undoAll(arrangement: Arrangement): number {
  let steps = 0;
  while (arrangement.canUndo) {
    arrangement.undo();
    steps++;
  }
  return steps;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a setter call is an undo step', () => {
  it('undo takes the value back, redo brings it again', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5);
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.canRedo).toBe(true);
    arrangement.redo();
    expect(volumeOf(arrangement)).toBe(0.5);
  });

  it.each([
    [
      'mute',
      (a: Arrangement) => a.setTrackMute('A', true),
      (a: Arrangement) => a.getMixer().get('A')?.muted,
      false,
    ],
    [
      'solo',
      (a: Arrangement) => a.setTrackSolo('A', true),
      (a: Arrangement) => a.getMixer().get('A')?.soloed,
      false,
    ],
    [
      'pan',
      (a: Arrangement) => a.setTrackPan('A', -0.5),
      (a: Arrangement) => a.getMixer().get('A')?.pan,
      0,
    ],
  ] as const)('%s is an undo step too', (_name, change, read, before) => {
    const { arrangement } = setup();
    change(arrangement);
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(read(arrangement)).toBe(before);
  });

  it('a new step clears the redo states', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    expect(arrangement.canRedo).toBe(true);
    arrangement.setTrackVolume('A', 0.5);
    expect(arrangement.canRedo).toBe(false);
  });

  it('announces the mixer change only (no history announcement of its own)', () => {
    const { arrangement, changes } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.setTrackVolume('A', 1, { gesture: 'g' });
    expect(changes.map((c) => c.type)).toEqual(['mixer', 'mixer']);
  });
});

describe('gesture', () => {
  it('changes with one gesture id are one step', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g' });
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.canUndo).toBe(false);
    arrangement.redo();
    expect(volumeOf(arrangement)).toBe(0.5);
  });

  it('two ids are two steps', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g1' });
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g2' });
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(0.9);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a change without an id between two of one gesture splits it', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g' });
    arrangement.setTrackPan('B', 0.5);
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(3);
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.getMixer().get('B')?.pan).toBe(0);
  });

  it('another edit between two changes of one gesture splits it', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g' });
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(3);
  });

  it('a gesture that comes back to where it began leaves no step', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    arrangement.setTrackVolume('A', 1, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(false);
    expect(volumeOf(arrangement)).toBe(1);
    // The next change of that gesture pushes a new step.
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a gesture that comes back keeps the steps below it', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    arrangement.setTrackVolume('A', 1, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(1);
  });

  it('a gesture does not join a step after an undo', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.undo();
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(true);
    // The redo state was cleared by a new step.
    expect(arrangement.canRedo).toBe(false);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a gesture does not join a step after a redo', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.undo();
    arrangement.redo();
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(2);
  });

  it('a gesture does not join a step after clearHistory', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.clearHistory();
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(0.5);
  });

  it('a gesture after setTracks pushes a new step', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.setTracks(arrangement.getTracks());
    expect(() => arrangement.setTrackVolume('A', 0.4, { gesture: 'g' })).not.toThrow();
    expect(undoAll(arrangement)).toBe(1);
    expect(volumeOf(arrangement)).toBe(0.5);
  });

  it('a gesture does not join the step a transaction committed', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.commitTransaction();
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(3);
  });

  it('a gesture does not join a step after a purge', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.removeTrack('B', { undoable: false });
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(2);
  });

  it('inside an open transaction a gesture change joins the transaction', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.commitTransaction();
    expect(undoAll(arrangement)).toBe(1);
    expect(volumeOf(arrangement)).toBe(1);
  });

  it('a setter without an id inside a transaction is part of it, not a step of its own', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackVolume('A', 0.5);
    expect(arrangement.canUndo).toBe(false);
    arrangement.commitTransaction();
    expect(undoAll(arrangement)).toBe(1);
  });

  it('the undo limit holds for gesture steps', () => {
    const arrangement = new Arrangement({ timeBase: timeBase(), undoLimit: 2 });
    arrangement.setTracks(fixture());
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g1' });
    arrangement.setTrackVolume('A', 0.8, { gesture: 'g2' });
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g3' });
    arrangement.setTrackVolume('A', 0.6, { gesture: 'g3' });
    expect(undoAll(arrangement)).toBe(2);
    expect(volumeOf(arrangement)).toBe(0.9);
  });

  it('with an undo limit of 0 a gesture makes no step and does not throw', () => {
    const arrangement = new Arrangement({ timeBase: timeBase(), undoLimit: 0 });
    arrangement.setTracks(fixture());
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    arrangement.setTrackVolume('A', 1, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(false);
    expect(volumeOf(arrangement)).toBe(1);
  });
});

describe('undoable: false', () => {
  it('writes through every saved state: a step that became a repeat is dropped', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5);
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(arrangement.canUndo).toBe(false);
    expect(volumeOf(arrangement)).toBe(0.2);
  });

  it('an undo of an earlier edit keeps the value', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.5);
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(0.2);
    expect(arrangement.getClipBounds('A', 'a1')?.startSample).toBe(0);
    expect(arrangement.canUndo).toBe(false);
    arrangement.redo();
    expect(volumeOf(arrangement)).toBe(0.2);
    expect(arrangement.getClipBounds('A', 'a1')?.startSample).toBe(1000);
  });

  it('a redo state holds the value too', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(arrangement.canRedo).toBe(true);
    arrangement.redo();
    expect(volumeOf(arrangement)).toBe(0.2);
  });

  it('is no step and leaves the redo states', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(true);
  });

  it('wins over gesture', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.2, { gesture: 'g', undoable: false });
    expect(arrangement.canUndo).toBe(false);
    expect(volumeOf(arrangement)).toBe(0.2);
  });

  it('does not join a gesture, and the gesture goes on after it', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('B', 0.9, { gesture: 'g' });
    arrangement.setTrackPan('A', 0.3, { undoable: false });
    arrangement.setTrackVolume('B', 0.7, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(2);
    expect(arrangement.getMixer().get('A')?.pan).toBe(0.3);
    expect(volumeOf(arrangement, 'B')).toBe(1);
  });

  it('a gesture whose step was dropped as a repeat pushes a new step', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(arrangement.canUndo).toBe(false);
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(volumeOf(arrangement)).toBe(0.2);
  });

  it("is written into an open transaction's base: an abort keeps it", () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    arrangement.abortTransaction();
    expect(volumeOf(arrangement)).toBe(0.2);
    expect(arrangement.getClipBounds('A', 'a1')?.startSample).toBe(0);
  });

  it('inside a transaction that changes nothing else, a commit pushes no step', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(false);
  });

  it('saved states that shared a Map go on sharing one, and no saved Map is written to', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.moveClip('A', 'a1', 1000);
    // The three steps below hold the Map from before any mixer change.
    const shared = arrangement.getMixer();
    arrangement.setTrackVolume('B', 0.5);
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(shared.get('A')?.volume).toBe(1);
    arrangement.undo();
    const written = arrangement.getMixer();
    expect(written).not.toBe(shared);
    expect(written.get('A')?.volume).toBe(0.2);
    expect(written.get('B')?.volume).toBe(1);
    arrangement.undo();
    expect(arrangement.getMixer()).toBe(written);
    arrangement.undo();
    expect(arrangement.getMixer()).toBe(written);
  });

  it('announces one mixer change', () => {
    const { arrangement, changes } = setup();
    arrangement.setTrackVolume('A', 0.5);
    changes.length = 0;
    arrangement.setTrackVolume('A', 0.2, { undoable: false });
    expect(changes).toEqual([{ type: 'mixer', trackId: 'A', values: { volume: 0.2 } }]);
  });
});

describe('a change that changes nothing', () => {
  it('a value that does not change makes no step and announces nothing', () => {
    const { arrangement, changes } = setup();
    const mixer = arrangement.getMixer();
    const version = arrangement.mixerVersion;
    arrangement.setTrackVolume('A', 1);
    arrangement.setTrackMute('A', false, { gesture: 'g' });
    arrangement.setTrackPan('A', 0, { undoable: false });
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.mixerVersion).toBe(version);
    expect(changes).toEqual([]);
  });

  it('an id not in the current tracks does nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.setTrackVolume('nope', 0.5);
    arrangement.setTrackVolume('nope', 0.5, { gesture: 'g' });
    arrangement.setTrackVolume('nope', 0.5, { undoable: false });
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toEqual([]);
  });

  it('a change that changes nothing does not split a gesture', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.9, { gesture: 'g' });
    arrangement.setTrackVolume('B', 1);
    arrangement.setTrackVolume('A', 0.7, { gesture: 'g' });
    expect(undoAll(arrangement)).toBe(1);
  });
});
