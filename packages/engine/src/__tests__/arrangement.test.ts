/**
 * The arrangement alone: tracks, versions, history and the change it
 * announces, with a fake time base and no engine (#812).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import type { ArrangementChange, ArrangementTimeBase } from '../arrangement/Arrangement';
import { loaded } from './helpers/loadedTracks';

const SAMPLE_RATE = 48000;
const TICKS_PER_SECOND = 1920; // 960 ppqn at 120 bpm

function timeBase(ticksPerSecond = TICKS_PER_SECOND): ArrangementTimeBase {
  return {
    sampleRate: SAMPLE_RATE,
    ppqn: 960,
    secondsToTicks: (seconds) => Math.round(seconds * ticksPerSecond),
    ticksToSeconds: (tick) => tick / ticksPerSecond,
  };
}

function clip(id: string, startSample: number) {
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

function track(id: string, clips: ReturnType<typeof clip>[]): ClipTrack {
  return { ...createTrack({ name: id, clips }), id };
}

function fixture(): ClipTrack[] {
  return [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 0)])];
}

function setup(options: { undoLimit?: number } = {}) {
  const arrangement = new Arrangement({ ...options, timeBase: timeBase() });
  arrangement.setTracks(fixture());
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  const ids = () => arrangement.getTracks().map((t) => t.id);
  const clipOf = (trackId: string, clipId: string) => {
    const found = loaded(arrangement)
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId);
    if (!found) throw new Error(`no clip ${clipId} on ${trackId}`);
    return found;
  };
  return { arrangement, changes, ids, clipOf };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Arrangement: tracks', () => {
  it('starts empty, with no history', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    expect(arrangement.getTracks()).toEqual([]);
    expect(arrangement.tracksVersion).toBe(0);
    expect(arrangement.mixerVersion).toBe(0);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
  });

  it('setTracks stores copies with a startTick on every clip, bumps tracksVersion, announces "set"', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const changes: ArrangementChange[] = [];
    arrangement.onChange((change) => changes.push(change));
    const given = fixture();

    arrangement.setTracks(given);

    expect(arrangement.getTracks()).not.toBe(given);
    expect(arrangement.getTracks()[0]).not.toBe(given[0]);
    expect(loaded(arrangement)[0].clips.map((c) => c.startTick)).toEqual([0, 3840]);
    expect(given[0].clips[1].startTick).toBeUndefined();
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([{ type: 'set' }]);
  });

  it('setTracks keeps a startTick a clip already has', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    arrangement.setTracks([track('A', [{ ...clip('a1', 48000), startTick: 7 }])]);
    expect(loaded(arrangement)[0].clips[0].startTick).toBe(7);
  });

  it('setTracks clears the history', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.moveClip('A', 'a1', 500);
    expect(arrangement.canUndo).toBe(true);
    arrangement.setTracks(fixture());
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
  });

  // #812: addTrack and updateTrack return nothing, as in the design (during the
  // extraction they returned the stored track for the engine's adapter call).
  it('addTrack appends, gives ticks, is an undo step, announces "add"', () => {
    const { arrangement, changes, ids } = setup();
    const before = arrangement.getTracks();
    arrangement.addTrack(track('C', [clip('c1', 48000)]));

    expect(ids()).toEqual(['A', 'B', 'C']);
    expect(arrangement.getTracks()).not.toBe(before);
    expect(loaded(arrangement)[2].clips[0].startTick).toBe(1920);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([{ type: 'add', trackId: 'C' }]);
  });

  it('removeTrack removes, is an undo step, announces "remove"', () => {
    const { arrangement, changes, ids } = setup();
    arrangement.removeTrack('A');
    expect(ids()).toEqual(['B']);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([{ type: 'remove', trackId: 'A' }]);
  });

  it('removeTrack of an unknown id changes nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.removeTrack('nope');
    expect(arrangement.tracksVersion).toBe(1);
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toEqual([]);
  });

  it('updateTrack replaces the track, gives ticks, is an undo step, announces "update"', () => {
    const { arrangement, changes } = setup();
    arrangement.updateTrack('A', track('A', [clip('a3', 48000)]));
    expect(loaded(arrangement)[0].clips.map((c) => [c.id, c.startTick])).toEqual([['a3', 1920]]);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  // updateTrack with an unknown id, history announcements, validation and the
  // order of delivery are in arrangementRules.test.ts.

  it('reorderTrack moves the track, clamps the index, is an undo step, announces "reorder"', () => {
    const { arrangement, changes, ids } = setup();
    arrangement.reorderTrack('A', 99);
    expect(ids()).toEqual(['B', 'A']);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([{ type: 'reorder' }]);
  });

  it('reorderTrack to the same place, or of an unknown id, changes nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.reorderTrack('A', 0);
    arrangement.reorderTrack('A', -5);
    arrangement.reorderTrack('nope', 1);
    expect(arrangement.tracksVersion).toBe(1);
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toEqual([]);
  });

  it.each([
    ['setTracks', (a: Arrangement, bad: ClipTrack) => a.setTracks([bad])],
    ['addTrack', (a: Arrangement, bad: ClipTrack) => void a.addTrack(bad)],
    ['updateTrack', (a: Arrangement, bad: ClipTrack) => void a.updateTrack('A', bad)],
  ])('%s with a track of the wrong kind throws and leaves everything as it was', (_, run) => {
    const { arrangement, changes } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    changes.length = 0;
    const tracks = arrangement.getTracks();
    const bad: ClipTrack = { ...track('A', [clip('x', 0)]), kind: 'midi' };

    expect(() => run(arrangement, bad)).toThrow(/\[waveform-playlist\]/);

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(2);
    expect(changes).toEqual([]);
    // The history holds the one step from before, and no step for the refused call.
    arrangement.undo();
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('Arrangement: clips', () => {
  it('moveClip moves by the constrained delta, updates the tick, announces "update", returns the delta', () => {
    const { arrangement, changes, clipOf } = setup();
    const others = arrangement.getTracks()[1];

    expect(arrangement.moveClip('A', 'a1', 24000)).toBe(24000);

    expect(clipOf('A', 'a1').startSample).toBe(24000);
    expect(clipOf('A', 'a1').startTick).toBe(960);
    expect(arrangement.getTracks()[1]).toBe(others);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  it('moveClip stops at a neighbour', () => {
    const { arrangement, clipOf } = setup();
    expect(arrangement.moveClip('A', 'a1', 500000)).toBe(48000);
    expect(clipOf('A', 'a1').startSample).toBe(48000);
  });

  it('moveClip that cannot move returns 0 and changes nothing', () => {
    const { arrangement, changes } = setup();
    expect(arrangement.moveClip('A', 'a1', -1000)).toBe(0);
    expect(arrangement.tracksVersion).toBe(1);
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toEqual([]);
  });

  it('moveClip, trimClip and splitClip warn for an unknown track or clip and change nothing', () => {
    const { arrangement, changes } = setup();
    expect(arrangement.moveClip('nope', 'a1', 10)).toBe(0);
    expect(arrangement.moveClip('A', 'nope', 10)).toBe(0);
    arrangement.trimClip('nope', 'a1', 'left', 10);
    arrangement.trimClip('A', 'nope', 'left', 10);
    arrangement.splitClip('nope', 'a1', 10);
    arrangement.splitClip('A', 'nope', 10);
    expect(warn).toHaveBeenCalledTimes(6);
    expect(
      warn.mock.calls.every((call: unknown[]) =>
        /\[waveform-playlist\/engine\]/.test(String(call[0]))
      )
    ).toBe(true);
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });

  it('trimClip on the left moves the start, the offset and the tick, and shortens the clip', () => {
    const { arrangement, changes, clipOf } = setup();
    arrangement.trimClip('A', 'a2', 'left', 24000);
    const trimmed = clipOf('A', 'a2');
    expect(trimmed.startSample).toBe(120000);
    expect(trimmed.startTick).toBe(4800);
    expect(trimmed.offsetSamples).toBe(24000);
    expect(trimmed.durationSamples).toBe(24000);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  it('an "update" carries the track object it replaced, for a clip edit and for updateTrack', () => {
    const { arrangement, changes } = setup();
    const first = arrangement.getTracks()[0];
    arrangement.moveClip('A', 'a1', 24000);
    const second = arrangement.getTracks()[0];
    arrangement.updateTrack('A', (current) => ({ ...current, name: 'renamed' }));

    expect(second).not.toBe(first);
    expect(changes).toHaveLength(2);
    expect((changes[0] as { previous: unknown }).previous).toBe(first);
    expect((changes[1] as { previous: unknown }).previous).toBe(second);
  });

  it('trimClip on the right changes the duration only', () => {
    const { arrangement, changes, clipOf } = setup();
    arrangement.trimClip('A', 'a1', 'right', -1000);
    expect(clipOf('A', 'a1').durationSamples).toBe(47000);
    expect(clipOf('A', 'a1').startSample).toBe(0);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  it('trimClip keeps the minimum duration of a tenth of a second at the time base’s rate', () => {
    const { arrangement, clipOf } = setup();
    arrangement.trimClip('A', 'a1', 'right', -48000);
    expect(clipOf('A', 'a1').durationSamples).toBe(4800);
  });

  it('constrainTrimDelta answers without changing anything', () => {
    const { arrangement, changes } = setup();
    expect(arrangement.constrainTrimDelta('A', 'a1', 'right', -48000)).toBe(-43200);
    expect(arrangement.constrainTrimDelta('A', 'nope', 'right', 10)).toBe(0);
    expect(arrangement.constrainTrimDelta('nope', 'a1', 'right', 10)).toBe(0);
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });

  it('getClipBounds returns the four numbers, or null', () => {
    const { arrangement } = setup();
    expect(arrangement.getClipBounds('A', 'a2')).toEqual({
      offsetSamples: 0,
      durationSamples: 48000,
      startSample: 96000,
      sourceDurationSamples: 96000,
    });
    expect(arrangement.getClipBounds('A', 'nope')).toBeNull();
    expect(arrangement.getClipBounds('nope', 'a2')).toBeNull();
  });

  it('splitClip replaces the clip with two, each with a tick, and announces "update"', () => {
    const { arrangement, changes } = setup();
    arrangement.splitClip('A', 'a1', 24000);
    const clips = loaded(arrangement)[0].clips;
    expect(clips.map((c) => [c.startSample, c.durationSamples, c.startTick])).toEqual([
      [0, 24000, 0],
      [24000, 24000, 960],
      [96000, 48000, 3840],
    ]);
    expect(arrangement.canUndo).toBe(true);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  it('splitClip too close to an edge warns and changes nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.splitClip('A', 'a1', 100);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });
});

// The mixer part (getMixer and the four setters) is in arrangementMixer.test.ts.

describe('Arrangement: history', () => {
  it('undo and redo restore the tracks, bump tracksVersion, and announce "restore" with the tracks they replaced', () => {
    const { arrangement, changes, clipOf } = setup();
    arrangement.moveClip('A', 'a1', 10000);
    const moved = arrangement.getTracks();
    const mixer = arrangement.getMixer();
    changes.length = 0;

    arrangement.undo();
    expect(clipOf('A', 'a1').startSample).toBe(0);
    expect(arrangement.tracksVersion).toBe(3);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(true);
    // Rule (#843): a restore also carries the mix from before (`previousMixer`);
    // before, `{ type: 'restore', previous: moved }`.
    expect(changes).toEqual([{ type: 'restore', previous: moved, previousMixer: mixer }]);
    expect(changes[0].type === 'restore' && changes[0].previous).toBe(moved);

    const undone = arrangement.getTracks();
    arrangement.redo();
    expect(clipOf('A', 'a1').startSample).toBe(10000);
    expect(arrangement.tracksVersion).toBe(4);
    expect(arrangement.canUndo).toBe(true);
    expect(arrangement.canRedo).toBe(false);
    expect(changes[1].type === 'restore' && changes[1].previous).toBe(undone);
  });

  it('undo and redo with nothing to do change nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.undo();
    arrangement.redo();
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });

  it('a new edit clears the redo stack', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 10000);
    arrangement.undo();
    expect(arrangement.canRedo).toBe(true);
    arrangement.moveClip('A', 'a1', 5000);
    expect(arrangement.canRedo).toBe(false);
  });

  it.each([
    ['a trim', (a: Arrangement) => a.trimClip('A', 'a1', 'right', -1000)],
    ['a split', (a: Arrangement) => a.splitClip('A', 'a1', 24000)],
    ['an addTrack', (a: Arrangement) => void a.addTrack(track('C', []))],
    ['a removeTrack', (a: Arrangement) => a.removeTrack('A')],
    ['a reorderTrack', (a: Arrangement) => a.reorderTrack('A', 1)],
    ['an updateTrack', (a: Arrangement) => void a.updateTrack('A', track('A', [clip('a3', 0)]))],
  ])('undo of %s gives back the tracks from before; redo the tracks from after', (_, edit) => {
    const { arrangement } = setup();
    const before = structuredClone(arrangement.getTracks());
    edit(arrangement);
    const after = structuredClone(arrangement.getTracks());
    expect(after).not.toEqual(before);

    arrangement.undo();
    expect(arrangement.getTracks()).toEqual(before);
    arrangement.redo();
    expect(arrangement.getTracks()).toEqual(after);
  });

  it('keeps at most undoLimit steps', () => {
    const { arrangement } = setup({ undoLimit: 3 });
    for (let i = 0; i < 5; i++) arrangement.moveClip('A', 'a1', 100);
    let undone = 0;
    while (arrangement.canUndo) {
      arrangement.undo();
      undone++;
    }
    expect(undone).toBe(3);
    expect(arrangement.undoLimit).toBe(3);
  });

  it('undoLimit defaults to 100', () => {
    expect(new Arrangement({ timeBase: timeBase() }).undoLimit).toBe(100);
  });

  // #812: every history change is announced; that clearHistory announces
  // "history" is in arrangementRules.test.ts (this test once said "nothing").
  it('clearHistory empties both stacks', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 10000);
    arrangement.moveClip('A', 'a1', 10000);
    arrangement.undo();
    arrangement.clearHistory();
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
  });
});

describe('Arrangement: transactions', () => {
  it('changes inside one push no step; commit pushes one', () => {
    const { arrangement, changes, clipOf } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.moveClip('A', 'a1', 1000);
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toHaveLength(2);

    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(true);
    // #812: the commit is a history change and is announced (it was silent).
    expect(changes.map((c) => c.type)).toEqual(['update', 'update', 'history']);

    arrangement.undo();
    expect(clipOf('A', 'a1').startSample).toBe(0);
    expect(arrangement.canUndo).toBe(false);
  });

  it('commit clears the redo stack when something changed', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 500);
    arrangement.commitTransaction();
    expect(arrangement.canRedo).toBe(false);
  });

  it('commit with no change pushes no step and keeps the redo stack', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.beginTransaction();
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(true);
  });

  it('commit respects undoLimit', () => {
    const { arrangement } = setup({ undoLimit: 1 });
    arrangement.moveClip('A', 'a1', 100);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 100);
    arrangement.commitTransaction();
    arrangement.undo();
    expect(arrangement.canUndo).toBe(false);
  });

  it('abort restores the tracks from before it and announces "restore"', () => {
    const { arrangement, changes, clipOf } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    const dragged = arrangement.getTracks();
    const mixer = arrangement.getMixer();
    changes.length = 0;

    arrangement.abortTransaction();

    expect(clipOf('A', 'a1').startSample).toBe(0);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
    // Rule (#843): a restore also carries the mix from before (`previousMixer`);
    // before, `{ type: 'restore', previous: dragged }`.
    expect(changes).toEqual([{ type: 'restore', previous: dragged, previousMixer: mixer }]);
  });

  it('abort with no change restores nothing and announces nothing', () => {
    const { arrangement, changes } = setup();
    const tracks = arrangement.getTracks();
    arrangement.beginTransaction();
    arrangement.abortTransaction();
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });

  it('commit or abort without a transaction warns and does nothing', () => {
    const { arrangement } = setup();
    arrangement.commitTransaction();
    arrangement.abortTransaction();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a second beginTransaction warns and takes a new base', () => {
    const { arrangement, clipOf } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.beginTransaction();
    expect(warn).toHaveBeenCalledTimes(1);
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.abortTransaction();
    expect(clipOf('A', 'a1').startSample).toBe(1000);
  });
});

describe('Arrangement: recomputeStartSamples', () => {
  it('derives startSample from startTick through the time base, bumps tracksVersion, announces "recompute"', () => {
    let ticksPerSecond = TICKS_PER_SECOND;
    const arrangement = new Arrangement({
      timeBase: {
        sampleRate: SAMPLE_RATE,
        ppqn: 960,
        secondsToTicks: (seconds) => Math.round(seconds * ticksPerSecond),
        ticksToSeconds: (tick) => tick / ticksPerSecond,
      },
    });
    arrangement.setTracks(fixture());
    const changes: ArrangementChange[] = [];
    arrangement.onChange((change) => changes.push(change));

    ticksPerSecond = TICKS_PER_SECOND / 2; // half the tempo
    arrangement.recomputeStartSamples();

    expect(loaded(arrangement)[0].clips.map((c) => c.startSample)).toEqual([0, 192000]);
    expect(arrangement.tracksVersion).toBe(2);
    expect(arrangement.canUndo).toBe(false);
    expect(changes).toEqual([{ type: 'recompute' }]);
  });

  it('does nothing while no engine is attached (there is no tempo to convert with)', () => {
    const arrangement = new Arrangement({ tracks: fixture() });
    const changes: ArrangementChange[] = [];
    arrangement.onChange((change) => changes.push(change));
    const tracks = arrangement.getTracks();
    expect(() => arrangement.recomputeStartSamples()).not.toThrow();
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(1);
    expect(changes).toEqual([]);
  });

  // #812, immutability: a clip is never written in place, so the earlier test
  // that deleted a clip's startTick to show "left where it is" is gone.
  it('changes nothing in a clip whose start is already right, and keeps the object', () => {
    const { arrangement, clipOf } = setup();
    const a2 = clipOf('A', 'a2');
    const tracks = arrangement.getTracks();
    arrangement.recomputeStartSamples();
    expect(clipOf('A', 'a2')).toBe(a2);
    expect(arrangement.getTracks()[0]).toBe(tracks[0]);
    expect(arrangement.tracksVersion).toBe(2);
  });
});

describe('Arrangement: onChange', () => {
  it('returns a function that stops the listener', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const listener = vi.fn();
    const stop = arrangement.onChange(listener);
    arrangement.setTracks(fixture());
    stop();
    arrangement.setTracks(fixture());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is told after the state has changed', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const seen: number[] = [];
    arrangement.onChange(() =>
      seen.push(arrangement.getTracks().length, arrangement.tracksVersion)
    );
    arrangement.setTracks(fixture());
    expect(seen).toEqual([2, 1]);
  });
});
