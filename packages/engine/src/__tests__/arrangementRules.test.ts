/**
 * The arrangement's rules about history, validation and delivery, and the
 * engine following the arrangement by subscription (#812).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import type { ArrangementChange } from '../arrangement/Arrangement';
import { PlaylistEngine } from '../PlaylistEngine';
import type { EngineState } from '../types';
import { recordingAdapter } from './helpers/recordingAdapter';
import { loaded } from './helpers/loadedTracks';

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
  return [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 0)])];
}

function setup() {
  const arrangement = new Arrangement({ timeBase: timeBase() });
  arrangement.setTracks(fixture());
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  const startOf = (trackId: string, clipId: string) =>
    loaded(arrangement)
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId)?.startSample;
  return { arrangement, changes, startOf };
}

function setupEngine(options: { incremental?: boolean } = {}) {
  const adapter = recordingAdapter(options);
  const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
  const states: EngineState[] = [];
  engine.on('statechange', (state) => states.push(state));
  engine.setTracks(fixture());
  adapter.reset();
  states.length = 0;
  return { adapter, engine, states };
}

/** Everything a failed call must leave as it was. */
function snapshotOf(arrangement: Arrangement) {
  return {
    tracks: arrangement.getTracks(),
    mixer: arrangement.getMixer(),
    tracksVersion: arrangement.tracksVersion,
    mixerVersion: arrangement.mixerVersion,
    canUndo: arrangement.canUndo,
    canRedo: arrangement.canRedo,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('every history change is announced', () => {
  it('commitTransaction with a change announces "history"', () => {
    const { arrangement, changes } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    changes.length = 0;
    arrangement.commitTransaction();
    expect(changes).toEqual([{ type: 'history' }]);
    expect(arrangement.canUndo).toBe(true);
  });

  it('commitTransaction without a change announces nothing', () => {
    const { arrangement, changes } = setup();
    arrangement.beginTransaction();
    arrangement.commitTransaction();
    expect(changes).toEqual([]);
  });

  it('clearHistory announces "history" when there was any, and nothing when there was none', () => {
    const { arrangement, changes } = setup();
    arrangement.clearHistory();
    expect(changes).toEqual([]);

    arrangement.moveClip('A', 'a1', 1000);
    changes.length = 0;
    arrangement.clearHistory();
    expect(changes).toEqual([{ type: 'history' }]);

    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    changes.length = 0;
    arrangement.clearHistory(); // redo only
    expect(changes).toEqual([{ type: 'history' }]);
  });

  it('a "history" change does not bump either version', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    const { tracksVersion, mixerVersion } = arrangement;
    arrangement.clearHistory();
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
  });

  it('the engine emits statechange with fresh canUndo / canRedo for both', () => {
    const { adapter, engine, states } = setupEngine();
    engine.beginTransaction();
    engine.moveClip('A', 'a1', 1000, true);
    states.length = 0;

    engine.commitTransaction();
    expect(states.map((s) => s.canUndo)).toEqual([true]);

    engine.clearHistory();
    expect(states.map((s) => s.canUndo)).toEqual([true, false]);
    expect(adapter.calls).toEqual([]);
  });
});

describe('updateTrack with an unknown id', () => {
  it('changes nothing and announces nothing', () => {
    const { arrangement, changes } = setup();
    const before = snapshotOf(arrangement);
    arrangement.updateTrack('nope', track('nope', [clip('n1', 0)]));
    expect(snapshotOf(arrangement)).toEqual(before);
    expect(arrangement.getTracks()).toBe(before.tracks);
    expect(changes).toEqual([]);
  });

  it('through the engine: no adapter call, no statechange, no undo step', () => {
    const { adapter, engine, states } = setupEngine();
    engine.updateTrack('nope', track('nope', [clip('n1', 0)]));
    expect(adapter.calls).toEqual([]);
    expect(states).toHaveLength(0);
    expect(engine.canUndo).toBe(false);
  });

  it('still refuses a track of the wrong kind', () => {
    const { arrangement } = setup();
    const bad: ClipTrack = { ...track('nope', [clip('x', 0)]), kind: 'midi' };
    expect(() => arrangement.updateTrack('nope', bad)).toThrow(/\[waveform-playlist\]/);
  });
});

describe('undo and redo with a transaction open abort it first', () => {
  it('undo: the transaction’s changes are dropped, then the step before it is undone', () => {
    const { arrangement, changes, startOf } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 100);
    changes.length = 0;

    arrangement.undo();

    expect(startOf('A', 'a1')).toBe(0);
    expect(changes.map((c) => c.type)).toEqual(['restore', 'restore']);
    expect(arrangement.canRedo).toBe(true);
    // The transaction is over: a commit now has nothing to commit.
    arrangement.commitTransaction();
    expect(console.warn).toHaveBeenCalledTimes(1);
    arrangement.redo();
    expect(startOf('A', 'a1')).toBe(1000);
  });

  it('undo with nothing to undo still aborts the transaction', () => {
    const { arrangement, startOf } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 100);
    arrangement.undo();
    expect(startOf('A', 'a1')).toBe(0);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
  });

  it('redo: the transaction’s changes are dropped, then the step is redone', () => {
    const { arrangement, startOf } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.beginTransaction();
    arrangement.moveClip('B', 'b1', 500);

    arrangement.redo();

    expect(startOf('B', 'b1')).toBe(0);
    expect(startOf('A', 'a1')).toBe(1000);
    expect(arrangement.canUndo).toBe(true);
    // The transaction is over: an abort has nothing to abort and restores nothing.
    arrangement.abortTransaction();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(startOf('A', 'a1')).toBe(1000);
  });

  it('an unchanged open transaction is closed without a restore', () => {
    const { arrangement, changes } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.beginTransaction();
    changes.length = 0;
    arrangement.undo();
    expect(changes.map((c) => c.type)).toEqual(['restore']);
  });
});

describe('setTracks with a transaction open', () => {
  it('ends the transaction and clears the history', () => {
    const { arrangement, changes } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 100);
    changes.length = 0;

    arrangement.setTracks([track('C', [clip('c1', 0)])]);

    expect(changes).toEqual([{ type: 'set' }]);
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['C']);
    expect(arrangement.canUndo).toBe(false);
    // No transaction is left: an edit is an undo step again, and abort has nothing to abort.
    arrangement.moveClip('C', 'c1', 100);
    expect(arrangement.canUndo).toBe(true);
    arrangement.abortTransaction();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['C']);
    // The mixer entries of the replaced tracks are gone with the transaction.
    expect([...arrangement.getMixer().keys()]).toEqual(['C']);
  });
});

describe('ids are unique', () => {
  const cases: Array<[string, (a: Arrangement) => void, RegExp]> = [
    [
      'setTracks with two tracks of one id',
      (a) => a.setTracks([track('X', []), track('Y', []), track('X', [])]),
      /Duplicate track id "X"/,
    ],
    [
      'setTracks with two clips of one id in a track',
      (a) => a.setTracks([track('X', [clip('c', 0), clip('c', 96000)])]),
      /Track "X".*duplicate clip id "c"/,
    ],
    [
      'addTrack with an id that is there',
      (a) => a.addTrack(track('A', [])),
      /Duplicate track id "A"/,
    ],
    [
      'addTrack with two clips of one id',
      (a) => a.addTrack(track('C', [clip('c', 0), clip('c', 96000)])),
      /Track "C".*duplicate clip id "c"/,
    ],
    [
      'updateTrack with two clips of one id',
      (a) => a.updateTrack('A', track('A', [clip('c', 0), clip('c', 96000)])),
      /Track "A".*duplicate clip id "c"/,
    ],
    [
      'updateTrack with a track whose id another track has',
      (a) => a.updateTrack('A', track('B', [])),
      /Duplicate track id "B"/,
    ],
  ];

  it.each(cases)(
    '%s throws and leaves tracks, history, mixer and subscribers untouched',
    (_, run, message) => {
      const { arrangement, changes } = setup();
      arrangement.moveClip('A', 'a1', 1000);
      arrangement.setTrackVolume('A', 0.5);
      changes.length = 0;
      const before = snapshotOf(arrangement);

      expect(() => run(arrangement)).toThrow(message);
      expect(() => run(arrangement)).toThrow(/^\[waveform-playlist\] /);

      const after = snapshotOf(arrangement);
      expect(after).toEqual(before);
      expect(after.tracks).toBe(before.tracks);
      expect(after.mixer).toBe(before.mixer);
      expect(changes).toEqual([]);
      // Rule (#843): the volume change is a step of its own, so the history
      // holds two steps (the move and the volume); before, the move's alone.
      arrangement.undo();
      expect(arrangement.canUndo).toBe(true);
      arrangement.undo();
      expect(arrangement.canUndo).toBe(false);
    }
  );

  it('two clips of one id on DIFFERENT tracks are fine', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    expect(() =>
      arrangement.setTracks([track('X', [clip('c', 0)]), track('Y', [clip('c', 0)])])
    ).not.toThrow();
  });

  it('updateTrack may keep its own id, and may change it to a free one', () => {
    const { arrangement } = setup();
    arrangement.updateTrack('A', track('A', []));
    arrangement.updateTrack('A', track('Z', []));
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['Z', 'B']);
  });

  it('through the engine: a track given a new id reaches the adapter as a full set', () => {
    const { adapter, engine } = setupEngine();
    engine.updateTrack('A', track('Z', [clip('z1', 0)]));
    expect(adapter.calls).toEqual([
      {
        method: 'setTracks',
        args: [
          [
            { id: 'Z', clips: ['z1'] },
            { id: 'B', clips: ['b1'] },
          ],
        ],
      },
    ]);
  });

  it('through the engine: the throw reaches the caller, the adapter is not called', () => {
    const { adapter, engine, states } = setupEngine();
    expect(() => engine.addTrack(track('A', []))).toThrow(/Duplicate track id "A"/);
    expect(adapter.calls).toEqual([]);
    expect(states).toHaveLength(0);
  });
});

describe('delivery is ordered', () => {
  it('a listener that writes gets its own change after the one it is handling; every listener sees every change once, in order', () => {
    const { arrangement } = setup();
    const first: string[] = [];
    const second: string[] = [];
    let wrote = false;
    arrangement.onChange((change) => {
      first.push(`${change.type}@${arrangement.tracksVersion}`);
      if (!wrote) {
        wrote = true;
        arrangement.reorderTrack('A', 1);
        // The write has happened; its announcement has not reached anyone yet.
        expect(arrangement.getTracks().map((t) => t.id)).toEqual(['B', 'A']);
        expect(first).toHaveLength(1);
      }
    });
    arrangement.onChange((change) => second.push(change.type));

    arrangement.moveClip('A', 'a1', 1000);

    expect(first.map((entry) => entry.split('@')[0])).toEqual(['update', 'reorder']);
    expect(second).toEqual(['update', 'reorder']);
  });

  it('each listener is told the versions the arrangement had right after that change', () => {
    const { arrangement } = setup();
    const seen: Array<[string, number, number]> = [];
    let wrote = false;
    arrangement.onChange((change, at) => {
      seen.push([change.type, at.tracksVersion, at.mixerVersion]);
      if (!wrote) {
        wrote = true;
        arrangement.setTrackVolume('A', 0.5);
        arrangement.reorderTrack('A', 1);
      }
    });
    arrangement.moveClip('A', 'a1', 1000);
    expect(seen).toEqual([
      ['update', 2, 0],
      ['mixer', 2, 1],
      ['reorder', 3, 1],
    ]);
  });

  it('a listener that writes on each of five changes is told about all six, one after the other', () => {
    const { arrangement } = setup();
    let writes = 0;
    let told = 0;
    arrangement.onChange(() => {
      told++;
      if (writes < 5) {
        writes++;
        arrangement.reorderTrack('A', arrangement.getTracks()[0].id === 'A' ? 1 : 0);
      }
    });
    arrangement.reorderTrack('A', 1);
    expect(writes).toBe(5);
    expect(told).toBe(6);
  });

  it('a listener that throws does not stop the others; the error reaches the caller after everyone was told', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const second = vi.fn();
    arrangement.onChange(() => {
      throw new Error('boom');
    });
    arrangement.onChange(second);
    expect(() => arrangement.setTracks(fixture())).toThrow('boom');
    expect(second).toHaveBeenCalledTimes(1);
    // The arrangement is not left "delivering": the next change is told at once.
    expect(() => arrangement.setTracks(fixture())).toThrow('boom');
    expect(second).toHaveBeenCalledTimes(2);
    expect(arrangement.tracksVersion).toBe(2);
  });

  it('through the engine: a later statechange listener is told in order (was: the newer state first)', () => {
    const { engine } = setupEngine();
    const start = engine.getState().tracksVersion;
    let reentered = false;
    engine.on('statechange', () => {
      if (!reentered) {
        reentered = true;
        engine.reorderTrack('A', 1);
      }
    });
    const later: number[] = [];
    engine.on('statechange', (state) => later.push(state.tracksVersion));
    engine.moveClip('A', 'a1', 1000);
    expect(later).toEqual([start + 1, start + 2]);
  });
});

describe('the engine follows the arrangement by subscription', () => {
  it('an adapter that throws: the error reaches the caller of the engine method, and no statechange is emitted', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    const states: EngineState[] = [];
    engine.on('statechange', (state) => states.push(state));
    adapter.setTracks = () => {
      throw new Error('cannot connect');
    };
    expect(() => engine.setTracks(fixture())).toThrow('cannot connect');
    expect(states).toHaveLength(0);
    // The arrangement did change, as the engine's own tracks did before.
    expect(engine.getState().tracks).toHaveLength(2);
  });

  it('skipAdapter on a move made from inside a statechange listener still skips the adapter', () => {
    const { adapter, engine } = setupEngine();
    let reentered = false;
    engine.on('statechange', () => {
      if (!reentered) {
        reentered = true;
        // Delivered after this notification; the flag must still apply to it.
        engine.moveClip('B', 'b1', 500, true);
      }
    });
    engine.moveClip('A', 'a1', 1000);
    expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([['updateTrack', 'A']]);
    // And the change after a skipped one is forwarded again.
    engine.moveClip('B', 'b1', 500);
    expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([
      ['updateTrack', 'A'],
      ['updateTrack', 'B'],
    ]);
  });

  it('skipAdapter on a trim that changes nothing leaves no mark behind', () => {
    const { adapter, engine } = setupEngine();
    engine.trimClip('A', 'a1', 'right', 0, true);
    engine.moveClip('A', 'a1', 0, true);
    engine.moveClip('A', 'a1', 1000);
    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
  });

  it('a disposed engine no longer follows the arrangement: a track method reaches no adapter and does not throw', () => {
    const { adapter, engine } = setupEngine();
    engine.dispose();
    adapter.reset();
    expect(() => {
      engine.setTracks(fixture());
      engine.moveClip('A', 'a1', 1000);
      engine.setTrackVolume('A', 0.5);
      engine.setTrackVolume('not-a-track', 0.5);
      engine.updateTrack('A');
      engine.undo();
    }).not.toThrow();
    expect(adapter.calls).toEqual([]);
  });

  it('every arrangement change is one statechange', () => {
    const { engine, states } = setupEngine();
    const steps: Array<() => void> = [
      () => engine.addTrack(track('C', [])),
      () => engine.updateTrack('C', track('C', [clip('c1', 0)])),
      () => void engine.moveClip('A', 'a1', 1000),
      () => engine.trimClip('A', 'a1', 'right', -1000),
      () => engine.splitClip('A', 'a2', 120000),
      () => engine.reorderTrack('A', 2),
      () => engine.setTrackVolume('A', 0.5),
      () => engine.removeTrack('B'),
      () => engine.undo(),
      () => engine.redo(),
      () => engine.clearHistory(),
      () => engine.setTracks(fixture()),
    ];
    for (const step of steps) {
      states.length = 0;
      step();
      expect(states).toHaveLength(1);
    }
  });
});

describe('what a subscriber is told', () => {
  it('each change comes with its type, and nothing else', () => {
    const arrangement = new Arrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const seen: unknown[] = [];
    arrangement.subscribe((change) => seen.push(change));

    arrangement.addTrack(track('B', []));
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.5);
    arrangement.removeTrack('B');
    arrangement.undo();
    arrangement.setTracks([]);

    expect(seen).toEqual([
      { type: 'add' },
      { type: 'update' },
      { type: 'mixer' },
      { type: 'remove' },
      { type: 'restore' },
      { type: 'set' },
    ]);
  });

  it('a listener that takes no argument still works', () => {
    const arrangement = new Arrangement({ tracks: [] });
    const listener = vi.fn(() => {});
    arrangement.subscribe(listener);
    arrangement.addTrack(track('A', []));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the selected track', () => {
  it('is cleared when its track is removed', () => {
    const { engine, states } = setupEngine();
    engine.selectTrack('A');
    states.length = 0;
    engine.removeTrack('A');
    expect(states).toHaveLength(1);
    expect(states[0].selectedTrackId).toBeNull();
  });

  it('is cleared when an undo takes its track away (undo of an addTrack)', () => {
    const { engine, states } = setupEngine();
    engine.addTrack(track('C', []));
    engine.selectTrack('C');
    states.length = 0;
    engine.undo();
    expect(states).toHaveLength(1);
    expect(states[0].selectedTrackId).toBeNull();
  });

  it('is cleared when a redo takes its track away (redo of a removeTrack)', () => {
    const { engine } = setupEngine();
    engine.removeTrack('A');
    engine.undo();
    engine.selectTrack('A');
    engine.redo();
    expect(engine.getState().selectedTrackId).toBeNull();
  });

  it('is kept when a restore keeps its track', () => {
    const { engine } = setupEngine();
    engine.selectTrack('A');
    engine.moveClip('A', 'a1', 1000);
    engine.undo();
    expect(engine.getState().selectedTrackId).toBe('A');
  });
});
