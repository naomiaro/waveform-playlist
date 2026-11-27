/**
 * `createArrangement()` and an engine built on an arrangement it was given:
 * the arrangement outlives the engine, with its tracks, its mix and its
 * undo history (#812).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipTrack } from '@waveform-playlist/core';
import { PlaylistEngine, createArrangement } from '../index';
import type { Arrangement, EngineState, TrackMixerValues } from '../index';
import { recordingAdapter } from './helpers/recordingAdapter';
import { loaded } from './helpers/loadedTracks';

const SAMPLE_RATE = 48000;

function clip(id: string, startSample: number, sampleRate = SAMPLE_RATE): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: sampleRate,
      offsetSamples: 0,
      sampleRate,
      sourceDurationSamples: sampleRate * 2,
    }),
    id,
  };
}

function track(id: string, clips: AudioClip[], mix: Partial<ClipTrack> = {}): ClipTrack {
  return { ...createTrack({ name: id, clips }), ...mix, id };
}

function fixture(): ClipTrack[] {
  return [
    track('A', [clip('a1', 0), clip('a2', 96000)], { volume: 0.8 }),
    track('B', [clip('b1', 0)]),
  ];
}

const ids = (arrangement: Arrangement) => arrangement.getTracks().map((t) => t.id);
const startOf = (arrangement: Arrangement, trackId: string, clipId: string) =>
  loaded(arrangement)
    .find((t) => t.id === trackId)
    ?.clips.find((c) => c.id === clipId)?.startSample;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('createArrangement', () => {
  it('is empty by default', () => {
    const arrangement = createArrangement();
    expect(arrangement.getTracks()).toEqual([]);
    expect(arrangement.getMixer().size).toBe(0);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);
    expect(arrangement.tracksVersion).toBe(0);
    expect(arrangement.mixerVersion).toBe(0);
  });

  it('takes its first tracks, seeds their mix, and starts with no history', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.8);
    expect(arrangement.canUndo).toBe(false);
  });

  it('refuses first tracks that are not valid', () => {
    expect(() => createArrangement({ tracks: [track('A', []), track('A', [])] })).toThrow(
      /Duplicate track id "A"/
    );
  });

  it('keeps at most undoLimit steps', () => {
    const arrangement = createArrangement({ tracks: fixture(), undoLimit: 2 });
    for (let i = 0; i < 4; i++) arrangement.moveClip('A', 'a1', 100);
    arrangement.undo();
    arrangement.undo();
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('an arrangement with no engine', () => {
  it('every operation works', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(track('C', [clip('c1', 0)]));
    expect(arrangement.moveClip('A', 'a1', 1000)).toBe(1000);
    arrangement.trimClip('A', 'a1', 'right', -1000);
    arrangement.splitClip('A', 'a2', 120000);
    arrangement.reorderTrack('C', 0);
    arrangement.updateTrack('B', track('B', [clip('b9', 0)]));
    arrangement.setTrackVolume('B', 0.25);
    arrangement.removeTrack('C');
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.getTracks()[0].clips).toHaveLength(3);
    expect(arrangement.getMixer().get('B')?.volume).toBe(0.25);
    expect(arrangement.getClipBounds('A', 'a1')?.startSample).toBe(1000);
    expect(arrangement.constrainTrimDelta('A', 'a1', 'right', 100)).toBe(100);
    while (arrangement.canUndo) arrangement.undo();
    expect(arrangement.getTracks()[0].clips).toHaveLength(2);
    expect(startOf(arrangement, 'A', 'a1')).toBe(0);
  });

  it('gives clips no ticks, and keeps a tick a clip came with', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 48000), { ...clip('a2', 144000), startTick: 7 }])],
    });
    arrangement.moveClip('A', 'a1', 1000);
    const [a1, a2] = loaded(arrangement)[0].clips;
    expect(a1.startTick).toBeUndefined();
    expect(a2.startTick).toBe(7);
  });

  it('uses each clip’s own sample rate for the shortest a clip may be', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('slow', 0, 8000)]), track('B', [clip('fast', 0, 96000)])],
    });
    // A tenth of a second: 800 samples at 8 kHz, 9600 at 96 kHz.
    arrangement.trimClip('A', 'slow', 'right', -8000);
    arrangement.trimClip('B', 'fast', 'right', -96000);
    expect(loaded(arrangement)[0].clips[0].durationSamples).toBe(800);
    expect(loaded(arrangement)[1].clips[0].durationSamples).toBe(9600);
    expect(arrangement.constrainTrimDelta('A', 'slow', 'right', -8000)).toBe(0);
  });
});

describe('subscribe', () => {
  it('tells the listener once per change, after the state has changed, and stops when asked', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const seen: number[] = [];
    const stop = arrangement.subscribe(() => seen.push(arrangement.tracksVersion));
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.5);
    arrangement.moveClip('A', 'a1', 0); // nothing changes
    stop();
    arrangement.moveClip('A', 'a1', 1000);
    expect(seen).toEqual([2, 2]);
  });

  it('is told about history changes too', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const listener = vi.fn();
    arrangement.subscribe(listener);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.commitTransaction();
    arrangement.clearHistory();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a subscriber that throws is reported, does not stop the others, and does not fail the edit', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const second = vi.fn();
    arrangement.subscribe(() => {
      throw new Error('save failed');
    });
    arrangement.subscribe(second);

    expect(() => arrangement.moveClip('A', 'a1', 1000)).not.toThrow();

    expect(second).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[waveform-playlist\] /);
    expect(startOf(arrangement, 'A', 'a1')).toBe(1000);
  });

  it('a subscriber that throws does not fail an engine call either, and the adapter is still in step', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    arrangement.subscribe(() => {
      throw new Error('save failed');
    });
    adapter.reset();
    expect(() => engine.moveClip('A', 'a1', 1000)).not.toThrow();
    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
  });

  it('an adapter that throws still fails the call that caused it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    adapter.updateTrack = () => {
      throw new Error('adapter broke');
    };
    expect(() => arrangement.moveClip('A', 'a1', 1000)).toThrow('adapter broke');
  });

  it('the adapter is brought in step before subscribers are told', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    adapter.reset();
    const callsWhenTold: number[] = [];
    // Subscribed before the engine's second run would be: order must not depend on that.
    arrangement.subscribe(() => callsWhenTold.push(adapter.calls.length));
    engine.moveClip('A', 'a1', 1000);
    expect(callsWhenTold).toEqual([1]);
  });
});

describe('updateTrack with a function, and undoable: false', () => {
  it('a function receives the stored track and its result replaces it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const stored = arrangement.getTracks()[0];
    const received: ArrangementTrack[] = [];
    arrangement.updateTrack('A', (current) => {
      received.push(current);
      return { ...current, name: 'renamed', clips: [...current.clips, clip('a3', 240000)] };
    });
    expect(received).toEqual([stored]);
    expect(received[0]).toBe(stored);
    const next = arrangement.getTracks()[0];
    expect(next.name).toBe('renamed');
    expect(next.clips.map((c) => c.id)).toEqual(['a1', 'a2', 'a3']);
    expect(arrangement.canUndo).toBe(true);
  });

  it('a function’s result keeps the clip objects the arrangement already held', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const [a1, a2] = arrangement.getTracks()[0].clips;
    const added = clip('a3', 240000);
    arrangement.updateTrack('A', (current) => ({ ...current, clips: [...current.clips, added] }));
    const clips = arrangement.getTracks()[0].clips;
    expect(clips[0]).toBe(a1);
    expect(clips[1]).toBe(a2);
    expect(clips[2]).not.toBe(added); // what comes from outside is copied
  });

  it('a function that returns the track it was given changes nothing', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const listener = vi.fn();
    arrangement.subscribe(listener);
    arrangement.updateTrack('A', (current) => current);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.tracksVersion).toBe(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a function is not called for an unknown id', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const update = vi.fn((current: ArrangementTrack) => current);
    arrangement.updateTrack('nope', update);
    expect(update).not.toHaveBeenCalled();
  });

  it('a function’s result is checked like any track', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const tracks = arrangement.getTracks();
    expect(() =>
      arrangement.updateTrack('A', (current) => ({
        ...current,
        clips: [...current.clips, clip('a1', 240000)],
      }))
    ).toThrow(/duplicate clip id "a1"/);
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('removeTrack with undoable: false', () => {
  const C = () => track('C', [clip('c1', 0)], { pan: 0.5 });

  it('removes the track with no undo step', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const version = arrangement.tracksVersion;
    arrangement.removeTrack('A', { undoable: false });
    expect(ids(arrangement)).toEqual(['B']);
    expect(arrangement.tracksVersion).toBe(version + 1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('no undo brings the track back: a dropped file that failed, after another edit', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(C()); // the drop
    arrangement.moveClip('A', 'a1', 1000); // an unrelated edit while it loads
    arrangement.removeTrack('C', { undoable: false }); // it failed to decode

    arrangement.undo();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(startOf(arrangement, 'A', 'a1')).toBe(0);
    // The step that added the track changes nothing any more, so it is gone.
    expect(arrangement.canUndo).toBe(false);

    arrangement.redo();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(startOf(arrangement, 'A', 'a1')).toBe(1000);
    expect(arrangement.canRedo).toBe(false);
  });

  it('steps that only changed the removed track are gone; the others stay', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(C());
    arrangement.moveClip('C', 'c1', 1000);
    arrangement.moveClip('B', 'b1', 500);
    arrangement.moveClip('C', 'c1', 1000);

    arrangement.removeTrack('C', { undoable: false });

    let steps = 0;
    while (arrangement.canUndo) {
      arrangement.undo();
      steps++;
      expect(ids(arrangement)).toEqual(['A', 'B']);
    }
    expect(steps).toBe(1);
    expect(startOf(arrangement, 'B', 'b1')).toBe(0);
  });

  it('a track that only the redo stack holds is taken out of it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(C());
    arrangement.undo();
    const tracks = arrangement.getTracks();
    const listener = vi.fn();
    arrangement.subscribe(listener);

    arrangement.removeTrack('C', { undoable: false });

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(3);
    expect(arrangement.canRedo).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1); // the history changed
  });

  it('the redo steps that remain are redone in the order they were made', () => {
    const arrangement = createArrangement({ tracks: [...fixture(), C()] });
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.moveClip('B', 'b1', 500);
    arrangement.undo();
    arrangement.undo();

    arrangement.removeTrack('C', { undoable: false });

    arrangement.redo();
    expect([startOf(arrangement, 'A', 'a1'), startOf(arrangement, 'B', 'b1')]).toEqual([1000, 0]);
    arrangement.redo();
    expect([startOf(arrangement, 'A', 'a1'), startOf(arrangement, 'B', 'b1')]).toEqual([1000, 500]);
    expect(arrangement.canRedo).toBe(false);
    expect(ids(arrangement)).toEqual(['A', 'B']);
  });

  it('a track that only the redo stack holds keeps its mixer entry when another track is purged', () => {
    const arrangement = createArrangement({ tracks: [...fixture(), C()] });
    arrangement.addTrack(track('D', [], { pan: 0.75 }));
    arrangement.undo(); // D is held by the redo stack only
    arrangement.removeTrack('C', { undoable: false });
    // Rule (#843): the redo state holds D's entry in its own Map, and the
    // current Map holds the current tracks only; before, the current Map had
    // D with pan 0.75 here.
    expect(arrangement.getMixer().has('D')).toBe(false);
    arrangement.redo();
    expect(ids(arrangement)).toEqual(['A', 'B', 'D']);
    expect(arrangement.getMixer().get('D')?.pan).toBe(0.75);
  });

  it('a track that only an undo step holds is taken out of it', () => {
    const arrangement = createArrangement({ tracks: [...fixture(), C()] });
    arrangement.removeTrack('C'); // an ordinary, undoable removal
    arrangement.moveClip('A', 'a1', 1000);

    arrangement.removeTrack('C', { undoable: false });

    arrangement.undo();
    arrangement.undo();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.canUndo).toBe(false);
  });

  it('its mixer entry goes with it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(C());
    arrangement.removeTrack('B'); // an ordinary removal: an undo step still holds B
    arrangement.removeTrack('C', { undoable: false });
    // Rule (#843): the current Map holds the current tracks only (the undo
    // step holds B's entry in its own Map); before, `['A', 'B']`.
    expect([...arrangement.getMixer().keys()]).toEqual(['A']);
    // The same id entering again is a new track: its own fields seed its mix.
    arrangement.addTrack(track('C', [], { pan: -1 }));
    expect(arrangement.getMixer().get('C')?.pan).toBe(-1);
  });

  it('inside a transaction: an abort restores the other changes and not the track', () => {
    const arrangement = createArrangement({ tracks: [...fixture(), C()] });
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.removeTrack('C', { undoable: false });
    arrangement.abortTransaction();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(startOf(arrangement, 'A', 'a1')).toBe(0);
  });

  it('inside an otherwise empty transaction: the commit adds no step', () => {
    const arrangement = createArrangement({ tracks: [...fixture(), C()] });
    arrangement.beginTransaction();
    arrangement.removeTrack('C', { undoable: false });
    arrangement.commitTransaction();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.canUndo).toBe(false);
  });

  it('an id that nothing holds changes nothing and tells nobody', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.moveClip('A', 'a1', 1000);
    const listener = vi.fn();
    arrangement.subscribe(listener);
    arrangement.removeTrack('nope', { undoable: false });
    expect(listener).not.toHaveBeenCalled();
    expect(arrangement.canUndo).toBe(true);
  });

  it('the states that never held the track are the same arrays as before', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const first = arrangement.getTracks();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.addTrack(C());
    arrangement.removeTrack('C', { undoable: false });
    arrangement.undo();
    expect(arrangement.getTracks()).toBe(first);
  });

  it('under an engine: the adapter is told once, and a later undo sends no such track', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    arrangement.addTrack(C());
    arrangement.moveClip('A', 'a1', 1000);
    adapter.reset();

    arrangement.removeTrack('C', { undoable: false });
    expect(adapter.calls).toEqual([{ method: 'removeTrack', args: ['C'] }]);

    adapter.reset();
    arrangement.undo();
    expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([['updateTrack', 'A']]);
  });

  it('addTrack and updateTrack take no such option', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    // @ts-expect-error only removeTrack can be made without an undo step
    arrangement.addTrack(track('C', []), { undoable: false });
    // @ts-expect-error only removeTrack can be made without an undo step
    arrangement.updateTrack('A', track('A', []), { undoable: false });
    // Both are ordinary undo steps.
    arrangement.undo();
    arrangement.undo();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('an engine given an arrangement', () => {
  it('without one, an engine makes its own and behaves as before', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.moveClip('A', 'a1', 1000);
    expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks', 'updateTrack']);
    expect(engine.canUndo).toBe(true);
  });

  it('sends the tracks it finds to the adapter once, in the constructor, with their mix', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    const adapter = recordingAdapter();

    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });

    expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks']);
    const sent = adapter.rawCalls[0].args[0] as ClipTrack[];
    expect(sent.map((t) => t.id)).toEqual(['A', 'B']);
    expect(sent[0].volume).toBe(0.3);
    // Rule (review of #930, view fields): the adapter's tracks are the stored
    // ones without their view fields, sharing their clips. (Before: the same array.)
    sent.forEach((t, i) => expect(t.clips).toBe(engine.getState().tracks[i].clips));
    expect(engine.getState().tracksVersion).toBe(arrangement.tracksVersion);
  });

  it('does not call the adapter in the constructor when the arrangement is empty', () => {
    const adapter = recordingAdapter();
    new PlaylistEngine({ adapter, arrangement: createArrangement(), sampleRate: SAMPLE_RATE });
    expect(adapter.calls).toEqual([]);
  });

  it('gives the clips their ticks when it attaches', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const listener = vi.fn();
    arrangement.subscribe(listener);
    expect(loaded(arrangement)[0].clips[1].startTick).toBeUndefined();

    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, bpm: 120, ppqn: 960 });

    expect(loaded(arrangement)[0].clips.map((c) => c.startTick)).toEqual([0, 3840]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('attaching to an arrangement whose clips all have ticks changes nothing', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [{ ...clip('a1', 0), startTick: 0 }])],
    });
    const tracks = arrangement.getTracks();
    const listener = vi.fn();
    arrangement.subscribe(listener);
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    expect(arrangement.getTracks()).toBe(tracks);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a change made on the arrangement directly reaches the adapter and emits statechange', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    const states: EngineState[] = [];
    engine.on('statechange', (state) => states.push(state));
    adapter.reset();

    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackMute('B', true);
    arrangement.addTrack(track('C', []));
    arrangement.undo();

    expect(adapter.calls.map((c) => c.method)).toEqual([
      'updateTrack',
      'setTrackMute',
      'addTrack',
      'setTracks',
    ]);
    expect(states).toHaveLength(4);
    expect(states[0].tracks[0].clips[0].startSample).toBe(1000);
    expect(states[1].tracks[1].muted).toBe(true);
    expect(states[3].canRedo).toBe(true);
  });

  it('after dispose, the arrangement can still be changed: no adapter call, no throw', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    engine.dispose();
    adapter.reset();
    expect(() => {
      arrangement.moveClip('A', 'a1', 1000);
      arrangement.setTrackVolume('A', 0.1);
      arrangement.addTrack(track('C', []));
    }).not.toThrow();
    expect(adapter.calls).toEqual([]);
    expect(startOf(arrangement, 'A', 'a1')).toBe(1000);
  });

  it('a second engine built after the first was disposed has the same tracks, mix and undo history', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const first = new PlaylistEngine({
      adapter: recordingAdapter(),
      arrangement,
      sampleRate: SAMPLE_RATE,
    });
    first.moveClip('A', 'a1', 1000);
    first.setTrackPan('B', -0.5);
    first.dispose();

    const adapter = recordingAdapter();
    const second = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });

    expect(warn).not.toHaveBeenCalled();
    const state = second.getState();
    expect(state.tracks[0].clips[0].startSample).toBe(1000);
    expect(state.tracks[1].pan).toBe(-0.5);
    expect(state.canUndo).toBe(true);
    expect((adapter.rawCalls[0].args[0] as ClipTrack[])[1].pan).toBe(-0.5);

    // Rule (#843): the pan change is an undo step of its own, so the first
    // undo takes it back by its setter and the second the move by a track
    // call. Before #843, one undo took back the move (`[['updateTrack',
    // 'A']]`) and the pan stayed at -0.5.
    adapter.reset();
    second.undo();
    expect(startOf(arrangement, 'A', 'a1')).toBe(1000);
    expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([['setTrackPan', 'B']]);
    expect(second.getState().tracks[1].pan).toBe(0);
    adapter.reset();
    second.undo();
    expect(startOf(arrangement, 'A', 'a1')).toBe(0);
    expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([['updateTrack', 'A']]);
  });

  it('clips added while no engine was attached get their ticks from the next engine', () => {
    const arrangement = createArrangement();
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE }).dispose();
    arrangement.addTrack(track('A', [clip('a1', 48000)]));
    expect(loaded(arrangement)[0].clips[0].startTick).toBeUndefined();
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, bpm: 120, ppqn: 960 });
    expect(loaded(arrangement)[0].clips[0].startTick).toBe(1920);
  });

  it('a second engine attached while the first is alive warns once', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    expect(warn).not.toHaveBeenCalled();
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/\[waveform-playlist\].*one engine/i);
  });

  it('undoLimit on the engine applies when the engine makes the arrangement', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE, undoLimit: 1 });
    engine.setTracks(fixture());
    engine.moveClip('A', 'a1', 100);
    engine.moveClip('A', 'a1', 100);
    engine.undo();
    expect(engine.canUndo).toBe(false);
    expect(engine.undoLimit).toBe(1);
  });

  it('undoLimit on the engine is ignored, with a warning, when an arrangement is given', () => {
    const arrangement = createArrangement({ tracks: fixture(), undoLimit: 5 });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, undoLimit: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/undoLimit/);
    expect(engine.undoLimit).toBe(5);
    engine.moveClip('A', 'a1', 100);
    engine.moveClip('A', 'a1', 100);
    engine.undo();
    expect(engine.canUndo).toBe(true);
  });

  it('refuses something that is not an arrangement made by createArrangement', () => {
    const fake = { getTracks: () => [] } as unknown as Arrangement;
    expect(() => new PlaylistEngine({ arrangement: fake })).toThrow(
      /\[waveform-playlist\].*createArrangement/
    );
  });
});

describe('the public types', () => {
  it('TrackMixerValues is what getMixer() holds', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const values: TrackMixerValues | undefined = arrangement.getMixer().get('A');
    expect(values).toEqual({ volume: 0.8, muted: false, soloed: false, pan: 0 });
  });
});
