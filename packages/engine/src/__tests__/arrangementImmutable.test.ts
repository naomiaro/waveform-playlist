/**
 * The arrangement never writes into an object it has handed out: a change
 * replaces the tracks array and only the track and clip objects that
 * changed, and a snapshot is a reference to an earlier array (#812).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import { PlaylistEngine } from '../PlaylistEngine';
import { pushStep, undoStep, redoStep, beginBase, EMPTY_HISTORY } from '../arrangement/history';
import { recordingAdapter } from './helpers/recordingAdapter';

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
  return [
    track('A', [clip('a1', 0), clip('a2', 96000)]),
    track('B', [clip('b1', 0)]),
    track('C', [clip('c1', 0)]),
  ];
}

/** Freezes the array, every track, every clips array and every clip. */
function deepFreeze(tracks: readonly ClipTrack[]): void {
  Object.freeze(tracks);
  for (const t of tracks) {
    Object.freeze(t);
    Object.freeze(t.clips);
    t.clips.forEach((c) => Object.freeze(c));
  }
}

function setup() {
  const arrangement = new Arrangement({ timeBase: timeBase() });
  arrangement.setTracks(fixture());
  const trackOf = (id: string) => {
    const found = arrangement.getTracks().find((t) => t.id === id);
    if (!found) throw new Error(`no track ${id}`);
    return found;
  };
  const clipOf = (trackId: string, clipId: string) => {
    const found = trackOf(trackId).clips.find((c) => c.id === clipId);
    if (!found) throw new Error(`no clip ${clipId}`);
    return found;
  };
  return { arrangement, trackOf, clipOf };
}

type Edit = [name: string, run: (a: Arrangement) => void];

/** Every operation that changes track A only. */
const EDITS_OF_A: Edit[] = [
  ['moveClip', (a) => void a.moveClip('A', 'a1', 1000)],
  ['trimClip left', (a) => a.trimClip('A', 'a1', 'left', 1000)],
  ['trimClip right', (a) => a.trimClip('A', 'a1', 'right', -1000)],
  ['splitClip', (a) => a.splitClip('A', 'a1', 24000)],
  ['updateTrack', (a) => void a.updateTrack('A', track('A', [clip('a9', 0)]))],
];

/** The mixer setters: they change the mixer part and no track (arrangementMixer.test.ts). */
const MIXER_EDITS: Edit[] = [
  ['setTrackVolume', (a) => a.setTrackVolume('A', 0.5)],
  ['setTrackMute', (a) => a.setTrackMute('A', true)],
  ['setTrackSolo', (a) => a.setTrackSolo('A', true)],
  ['setTrackPan', (a) => a.setTrackPan('A', -0.5)],
];

/** Every operation that changes which tracks there are, or their order. */
const EDITS_OF_THE_SET: Edit[] = [
  ['addTrack', (a) => void a.addTrack(track('D', [clip('d1', 0)]))],
  ['removeTrack', (a) => a.removeTrack('A')],
  ['reorderTrack', (a) => a.reorderTrack('A', 2)],
];

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a change replaces only what changed', () => {
  it.each(EDITS_OF_A)(
    '%s on track A: a new array, a new track A, the other tracks the same objects',
    (_, edit) => {
      const { arrangement, trackOf } = setup();
      const before = arrangement.getTracks();
      const [a, b, c] = before;

      edit(arrangement);

      expect(arrangement.getTracks()).not.toBe(before);
      expect(trackOf('A')).not.toBe(a);
      expect(trackOf('B')).toBe(b);
      expect(trackOf('C')).toBe(c);
    }
  );

  it.each([
    ['moveClip', (a: Arrangement) => void a.moveClip('A', 'a1', 1000)],
    ['trimClip', (a: Arrangement) => a.trimClip('A', 'a1', 'right', -1000)],
    ['splitClip', (a: Arrangement) => a.splitClip('A', 'a1', 24000)],
  ])('%s on clip a1: the clip beside it is the same object', (_, edit) => {
    const { arrangement, clipOf } = setup();
    const a2 = clipOf('A', 'a2');
    edit(arrangement);
    expect(clipOf('A', 'a2')).toBe(a2);
  });

  it.each(EDITS_OF_THE_SET)(
    '%s: a new array; every track that stays is the same object',
    (_, edit) => {
      const { arrangement } = setup();
      const before = arrangement.getTracks();
      edit(arrangement);
      const after = arrangement.getTracks();
      expect(after).not.toBe(before);
      for (const kept of after.filter((t) => before.some((old) => old.id === t.id))) {
        expect(kept).toBe(before.find((old) => old.id === kept.id));
      }
    }
  );

  it('getTracks() is the same array until something changes', () => {
    const { arrangement } = setup();
    const tracks = arrangement.getTracks();
    arrangement.moveClip('A', 'a1', 0); // cannot move: nothing changes
    arrangement.removeTrack('nope');
    arrangement.reorderTrack('A', 0);
    MIXER_EDITS.forEach(([, run]) => run(arrangement));
    arrangement.beginTransaction();
    arrangement.commitTransaction();
    arrangement.clearHistory();
    expect(arrangement.getTracks()).toBe(tracks);
  });

  it.each([
    ['setTracks', (a: Arrangement, given: ClipTrack) => a.setTracks([given])],
    ['addTrack', (a: Arrangement, given: ClipTrack) => void a.addTrack(given)],
    [
      'updateTrack',
      (a: Arrangement, given: ClipTrack) => {
        a.setTracks([track('A', [])]);
        a.updateTrack('A', given);
      },
    ],
  ])(
    '%s copies the track and its clips on the way in: writing to what was given changes nothing',
    (_, run) => {
      const arrangement = new Arrangement({ timeBase: timeBase() });
      const ticked = { ...clip('t1', 48000), startTick: 1920 };
      const given = track('A', [ticked]);

      run(arrangement, given);

      const stored = arrangement.getTracks()[0];
      expect(stored).not.toBe(given);
      expect(stored.clips).not.toBe(given.clips);
      expect(stored.clips[0]).not.toBe(ticked);

      given.name = 'changed by the caller';
      given.clips.push(clip('late', 0));
      ticked.startSample = 7;
      expect(stored.name).toBe('A');
      expect(stored.clips.map((c) => [c.id, c.startSample])).toEqual([['t1', 48000]]);
    }
  );
});

describe('a snapshot is a reference and is never written to', () => {
  /** A deep copy for comparison, without the audio (structuredClone cannot copy an AudioBuffer). */
  const copyOf = (tracks: readonly ClipTrack[]) =>
    structuredClone(
      tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, audioBuffer: undefined })) }))
    );

  it.each([...EDITS_OF_A, ...MIXER_EDITS, ...EDITS_OF_THE_SET])(
    'the array from before %s still holds what it held',
    (_, edit) => {
      const { arrangement } = setup();
      const before = arrangement.getTracks();
      const asItWas = copyOf(before);

      edit(arrangement);
      arrangement.setTrackVolume('B', 0.1);
      arrangement.moveClip('C', 'c1', 500);
      arrangement.recomputeStartSamples();

      expect(copyOf(before)).toEqual(asItWas);
    }
  );

  it('undo returns the very array from before the change; redo the very array from after', () => {
    const { arrangement } = setup();
    const before = arrangement.getTracks();
    arrangement.moveClip('A', 'a1', 1000);
    const after = arrangement.getTracks();

    arrangement.undo();
    expect(arrangement.getTracks()).toBe(before);
    arrangement.redo();
    expect(arrangement.getTracks()).toBe(after);
  });

  it('after undo and redo the tracks the change did not touch are the objects they always were', () => {
    const { arrangement, trackOf } = setup();
    const b = trackOf('B');
    const c = trackOf('C');
    arrangement.moveClip('A', 'a1', 1000);
    const movedA = trackOf('A');

    arrangement.undo();
    expect(trackOf('B')).toBe(b);
    expect(trackOf('C')).toBe(c);
    expect(trackOf('A')).not.toBe(movedA);

    arrangement.redo();
    expect(trackOf('A')).toBe(movedA);
    expect(trackOf('B')).toBe(b);
  });

  it('abortTransaction returns the very array from when it began', () => {
    const { arrangement } = setup();
    const before = arrangement.getTracks();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.abortTransaction();
    expect(arrangement.getTracks()).toBe(before);
  });
});

describe('frozen tracks', () => {
  it('every operation works on tracks that are frozen after each step', () => {
    const { arrangement } = setup();
    const steps: Array<(a: Arrangement) => void> = [
      ...EDITS_OF_A.map(([, run]) => run),
      ...MIXER_EDITS.map(([, run]) => run),
      (a) => void a.addTrack(track('D', [clip('d1', 0)])),
      (a) => a.reorderTrack('D', 0),
      (a) => a.removeTrack('B'),
      (a) => a.recomputeStartSamples(),
      (a) => a.undo(),
      (a) => a.undo(),
      (a) => a.redo(),
      (a) => {
        a.beginTransaction();
        a.moveClip('C', 'c1', 100);
        a.setTrackPan('C', 0.25);
        a.abortTransaction();
      },
      (a) => {
        a.beginTransaction();
        a.moveClip('C', 'c1', 100);
        a.commitTransaction();
      },
      (a) => a.undo(),
    ];

    deepFreeze(arrangement.getTracks());
    for (const step of steps) {
      expect(() => step(arrangement)).not.toThrow();
      deepFreeze(arrangement.getTracks());
    }
  });

  it('frozen input is accepted by setTracks, addTrack and updateTrack', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const tracks = fixture();
    deepFreeze(tracks);
    arrangement.setTracks(tracks);
    const d = track('D', [clip('d1', 0)]);
    deepFreeze([d]);
    arrangement.addTrack(d);
    const a = track('A', [clip('a9', 0)]);
    deepFreeze([a]);
    arrangement.updateTrack('A', a);
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('the engine hands out the arrangement’s array', () => {
  it('getState().tracks is the same array across calls and across selection, zoom, loop and playback changes', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    const tracks = engine.getState().tracks;

    engine.setSelection(1, 2);
    engine.zoomIn();
    engine.setLoopRegion(0, 1);
    engine.setLoopEnabled(true);
    engine.setMasterVolume(0.5);
    engine.selectTrack('A');
    engine.seek(1);

    expect(engine.getState().tracks).toBe(tracks);
  });

  it('getState().tracks is a new array after a track change, with untouched tracks the same objects', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    const before = engine.getState().tracks;
    engine.moveClip('A', 'a1', 1000);
    const after = engine.getState().tracks;
    expect(after).not.toBe(before);
    expect(after[1]).toBe(before[1]);
    expect(before[0].clips[0].startSample).toBe(0);
  });

  it('a state handed to a listener keeps its tracks when the engine changes afterwards', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    const states: Array<{ tracks: readonly ClipTrack[] }> = [];
    engine.on('statechange', (state) => states.push(state));
    engine.setTracks(fixture());
    engine.setTrackVolume('A', 0.3);
    engine.moveClip('A', 'a1', 1000);
    expect(states[0].tracks[0].volume).toBe(1);
    expect(states[1].tracks[0].volume).toBe(0.3);
    expect(states[1].tracks[0].clips[0].startSample).toBe(0);
    expect(states[2].tracks[0].clips[0].startSample).toBe(1000);
  });

  it('an undo sends the adapter only the tracks that differ', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.moveClip('B', 'b1', 1000);
    adapter.reset();
    engine.undo();
    expect(adapter.calls.map((call) => [call.method, call.args[0]])).toEqual([
      ['updateTrack', 'B'],
    ]);
  });
});

describe('history helpers', () => {
  const one: readonly ClipTrack[] = [track('A', [])];
  const two: readonly ClipTrack[] = [track('A', []), track('B', [])];
  const three: readonly ClipTrack[] = [];

  it('pushStep adds a step, clears redo, drops the oldest past the limit, and returns a new history', () => {
    const first = pushStep(EMPTY_HISTORY, one, 2);
    expect(first).not.toBe(EMPTY_HISTORY);
    expect(EMPTY_HISTORY.undo).toHaveLength(0);
    expect(first.undo).toEqual([one]);

    const withRedo = { undo: first.undo, redo: [three] };
    const second = pushStep(withRedo, two, 2);
    expect(second.undo[1]).toBe(two);
    expect(second.redo).toHaveLength(0);
    expect(withRedo.redo).toHaveLength(1);

    const third = pushStep(second, three, 2);
    expect(third.undo).toHaveLength(2);
    expect(third.undo[0]).toBe(two);
    expect(third.undo[1]).toBe(three);
  });

  it('undoStep moves the current tracks to redo and returns the step; null when there is none', () => {
    expect(undoStep(EMPTY_HISTORY, one)).toBeNull();
    const history = pushStep(EMPTY_HISTORY, one, 10);
    const result = undoStep(history, two);
    expect(result?.tracks).toBe(one);
    expect(result?.history.undo).toHaveLength(0);
    expect(result?.history.redo[0]).toBe(two);
    expect(history.undo).toHaveLength(1);
  });

  it('redoStep moves the current tracks to undo and returns the step; null when there is none', () => {
    expect(redoStep(EMPTY_HISTORY, one)).toBeNull();
    const undone = undoStep(pushStep(EMPTY_HISTORY, one, 10), two)!;
    const result = redoStep(undone.history, one);
    expect(result?.tracks).toBe(two);
    expect(result?.history.undo[0]).toBe(one);
    expect(result?.history.redo).toHaveLength(0);
  });

  it('beginBase holds the tracks a transaction started from, unchanged so far', () => {
    expect(beginBase(one)).toEqual({ tracks: one, changed: false });
    expect(beginBase(one).tracks).toBe(one);
  });
});
