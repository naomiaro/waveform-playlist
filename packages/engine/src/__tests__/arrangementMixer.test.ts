/**
 * The mixer part: volume, mute, solo and pan live in the arrangement by
 * track id, apart from the tracks. A fader move replaces no track object
 * (#812). A saved state holds the mix with the tracks, so undo, redo and
 * abort restore both (#843; arrangementMixerHistory.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import type { ArrangementChange } from '../arrangement/Arrangement';
import { withMixerValues } from '../arrangement/mixer';
import { PlaylistEngine } from '../PlaylistEngine';
import type { EngineState } from '../types';
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

function track(id: string, clips: AudioClip[], mix: Partial<ClipTrack> = {}): ClipTrack {
  return { ...createTrack({ name: id, clips }), ...mix, id };
}

function fixture(): ClipTrack[] {
  return [
    track('A', [clip('a1', 0), clip('a2', 96000)], { volume: 0.8, pan: -0.25 }),
    track('B', [clip('b1', 0)], { muted: true }),
  ];
}

const DEFAULT_MIX = { volume: 1, muted: false, soloed: false, pan: 0 };

function setup() {
  const arrangement = new Arrangement({ timeBase: timeBase() });
  arrangement.setTracks(fixture());
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  return { arrangement, changes };
}

function setupEngine(options: { incremental?: boolean } = {}) {
  const adapter = recordingAdapter(options);
  const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
  const states: EngineState[] = [];
  engine.on('statechange', (state) => states.push(state));
  engine.setTracks(fixture());
  adapter.reset();
  states.length = 0;
  const stateTrack = (id: string) => {
    const found = engine.getState().tracks.find((t) => t.id === id);
    if (!found) throw new Error(`no track ${id}`);
    return found;
  };
  return { adapter, engine, states, stateTrack };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('seeding', () => {
  it('a track entering through setTracks seeds its entry from its own fields', () => {
    const { arrangement } = setup();
    expect(arrangement.getMixer().get('A')).toEqual({ ...DEFAULT_MIX, volume: 0.8, pan: -0.25 });
    expect(arrangement.getMixer().get('B')).toEqual({ ...DEFAULT_MIX, muted: true });
    expect(arrangement.getMixer().size).toBe(2);
  });

  it('a track entering through addTrack seeds its entry', () => {
    const { arrangement } = setup();
    arrangement.addTrack(track('C', [], { soloed: true }));
    expect(arrangement.getMixer().get('C')).toEqual({ ...DEFAULT_MIX, soloed: true });
  });

  it('a track without mixer fields (plain JS) gets the defaults', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const bare = { id: 'X', name: 'X', kind: 'audio', clips: [] } as unknown as ClipTrack;
    arrangement.setTracks([bare]);
    expect(arrangement.getMixer().get('X')).toEqual(DEFAULT_MIX);
  });

  it('an id that already has an entry keeps it: setTracks again with other fields', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.setTracks([track('A', [], { volume: 1, pan: 1 }), track('C', [], { pan: 0.5 })]);
    expect(arrangement.getMixer().get('A')).toEqual({ ...DEFAULT_MIX, volume: 0.3, pan: -0.25 });
    expect(arrangement.getMixer().get('C')).toEqual({ ...DEFAULT_MIX, pan: 0.5 });
  });

  it('addTrack of a removed track whose removal can be undone is seeded from its own fields', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.removeTrack('A');
    arrangement.addTrack(track('A', [], { volume: 1 }));
    // Rule (#843): the current Map holds the current tracks only, so the id
    // has no entry to find again; before, 0.3 (the kept entry).
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
  });

  it('updateTrack does not change the entry', () => {
    const { arrangement, changes } = setup();
    const mixer = arrangement.getMixer();
    arrangement.updateTrack('A', track('A', [clip('a9', 0)], { volume: 0.1, muted: true }));
    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.getMixer().get('A')).toEqual({ ...DEFAULT_MIX, volume: 0.8, pan: -0.25 });
    expect(arrangement.mixerVersion).toBe(0);
    expect(changes).toEqual([
      { type: 'update', trackId: 'A', previous: expect.objectContaining({ id: 'A' }) },
    ]);
  });

  it('updateTrack with an unknown id seeds nothing', () => {
    const { arrangement } = setup();
    arrangement.updateTrack('nope', track('nope', []));
    expect(arrangement.getMixer().has('nope')).toBe(false);
  });

  it('the Map stays the same object when no track needs an entry', () => {
    const { arrangement } = setup();
    const mixer = arrangement.getMixer();
    arrangement.setTracks(fixture());
    expect(arrangement.getMixer()).toBe(mixer);
    // Rule (#843): a removal drops the entry from the current Map and the
    // add seeds a new one, so the Map is another object; before, the same
    // Map after `removeTrack('A')` and `addTrack(A)`.
    arrangement.removeTrack('A');
    expect(arrangement.getMixer()).not.toBe(mixer);
  });

  it('seeding does not count as a mixer change', () => {
    const { arrangement, changes } = setup();
    arrangement.addTrack(track('C', []));
    expect(arrangement.mixerVersion).toBe(0);
    expect(changes).toEqual([{ type: 'add', trackId: 'C' }]);
  });
});

describe('setters', () => {
  const setters = [
    ['setTrackVolume', (a: Arrangement, id: string) => a.setTrackVolume(id, 0.5), { volume: 0.5 }],
    ['setTrackMute', (a: Arrangement, id: string) => a.setTrackMute(id, true), { muted: true }],
    ['setTrackSolo', (a: Arrangement, id: string) => a.setTrackSolo(id, true), { soloed: true }],
    ['setTrackPan', (a: Arrangement, id: string) => a.setTrackPan(id, 0.75), { pan: 0.75 }],
  ] as const;

  it.each(setters)(
    '%s replaces the Map and that entry only; no track object and no tracksVersion change',
    (_, run, patch) => {
      const { arrangement, changes } = setup();
      const tracks = arrangement.getTracks();
      const trackA = tracks[0];
      const mixer = arrangement.getMixer();
      const entryA = mixer.get('A');
      const entryB = mixer.get('B');

      run(arrangement, 'A');

      expect(arrangement.getMixer()).not.toBe(mixer);
      expect(arrangement.getMixer().get('A')).toEqual({ ...entryA, ...patch });
      expect(arrangement.getMixer().get('A')).not.toBe(entryA);
      expect(arrangement.getMixer().get('B')).toBe(entryB);
      expect(mixer.get('A')).toBe(entryA); // the earlier Map still holds what it held
      expect(arrangement.getTracks()).toBe(tracks);
      expect(arrangement.getTracks()[0]).toBe(trackA);
      expect(trackA.volume).toBe(0.8); // the value the track entered with
      expect(arrangement.tracksVersion).toBe(1);
      expect(arrangement.mixerVersion).toBe(1);
      // Rule (#843): a setter call is an undo step; before, it was none (`false`).
      expect(arrangement.canUndo).toBe(true);
      expect(changes).toEqual([{ type: 'mixer', trackId: 'A', values: patch }]);
    }
  );

  it.each(setters)('%s for an id the arrangement does not hold does nothing', (_, run) => {
    const { arrangement, changes } = setup();
    const mixer = arrangement.getMixer();
    run(arrangement, 'still-loading');
    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.mixerVersion).toBe(0);
    expect(changes).toEqual([]);
  });

  it('getMixer() is the same Map until a value changes', () => {
    const { arrangement } = setup();
    const mixer = arrangement.getMixer();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.reorderTrack('A', 1);
    arrangement.undo();
    arrangement.updateTrack('A', track('A', []));
    expect(arrangement.getMixer()).toBe(mixer);
  });
});

describe('undo restores the tracks and the mix of the state it returns to', () => {
  it('a volume change after a move is a step of its own: the first undo takes it back, the second the move', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    const moved = arrangement.getTracks();
    arrangement.setTrackVolume('A', 0.2);
    const mixer = arrangement.getMixer();
    arrangement.undo();
    // Rule (#843): the volume change is an undo step, and the move's step
    // holds the mix from before it. Before #843, one undo took back the move
    // and kept the same Map, with 0.2.
    expect(arrangement.getMixer()).not.toBe(mixer);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.8);
    expect(arrangement.getTracks()).toBe(moved);
    arrangement.undo();
    expect(arrangement.getTracks()).not.toBe(moved);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.8);
    arrangement.redo();
    arrangement.redo();
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.2);
  });

  it('undo of removeTrack brings the track back with the mix it had when removed', () => {
    const { arrangement } = setup();
    arrangement.setTrackPan('A', 0.9);
    arrangement.setTrackMute('A', true);
    arrangement.removeTrack('A');
    // Rule (#843): the current Map holds the current tracks only; the undo
    // step holds A's entry. Before, the current Map still had A's entry here.
    expect(arrangement.getMixer().has('A')).toBe(false);
    arrangement.undo();
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')).toEqual({
      volume: 0.8,
      muted: true,
      soloed: false,
      pan: 0.9,
    });
  });

  it('abortTransaction takes back a mixer change made during the transaction', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('A', 0.2);
    arrangement.abortTransaction();
    // Rule (#843): the base holds the mix; before, 0.2 (the change survived the abort).
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.8);
  });

  it('a mixer change is an undo step and clears redo', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.setTrackVolume('A', 0.2);
    // Rule (#843): a setter call is an undo step like any other edit; before,
    // it was none and left the redo state (`canUndo` false, `canRedo` true).
    expect(arrangement.canUndo).toBe(true);
    expect(arrangement.canRedo).toBe(false);
  });
});

describe('the current Map holds the current tracks', () => {
  it('the entry of a removed track leaves the current Map; the undo step keeps it', () => {
    const { arrangement } = setup();
    arrangement.removeTrack('A');
    // Rule (#843): the saved state holds A's entry; before, the current Map kept it (`true`).
    expect(arrangement.getMixer().has('A')).toBe(false);
  });

  it('clearHistory leaves only the entries of the current tracks', () => {
    const { arrangement, changes } = setup();
    arrangement.removeTrack('A');
    const version = arrangement.mixerVersion;
    changes.length = 0;
    arrangement.clearHistory();
    expect([...arrangement.getMixer().keys()]).toEqual(['B']);
    // Dropping the entry of a track that is gone is not a mixer change.
    expect(arrangement.mixerVersion).toBe(version);
    expect(changes).toEqual([{ type: 'history' }]);
  });

  it('clearHistory keeps the Map when there is nothing to drop', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    const mixer = arrangement.getMixer();
    arrangement.clearHistory();
    expect(arrangement.getMixer()).toBe(mixer);
  });

  it('setTracks drops the entries of tracks that are not in the new set', () => {
    const { arrangement } = setup();
    arrangement.removeTrack('A'); // A is now held by the history only
    arrangement.setTracks([track('C', [])]);
    expect([...arrangement.getMixer().keys()]).toEqual(['C']);
  });

  it('an open transaction’s base keeps the entry of a track it holds', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.3);
    arrangement.beginTransaction();
    arrangement.removeTrack('A');
    arrangement.clearHistory();
    // Rule (#843): the base holds A's entry in its own Map; before, the
    // current Map kept it (`true`).
    expect(arrangement.getMixer().has('A')).toBe(false);
    arrangement.abortTransaction();
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.3);
  });

  it('a redo state keeps its tracks’ entries', () => {
    const { arrangement } = setup();
    arrangement.addTrack(track('C', [], { pan: 0.5 }));
    arrangement.setTrackPan('C', -1);
    // Rule (#843): the pan change is a step of its own, so two undos (the
    // pan, then the add) leave C to the redo stack; before, one.
    arrangement.undo();
    arrangement.undo(); // C is now held by the redo stack only
    // Rule (#843): the redo state holds C's entry in its own Map; before, the
    // current Map kept it (pan -1).
    expect(arrangement.getMixer().has('C')).toBe(false);
    arrangement.redo();
    expect(arrangement.getMixer().get('C')?.pan).toBe(0.5);
    arrangement.redo();
    expect(arrangement.getMixer().get('C')?.pan).toBe(-1);
  });
});

describe('the engine’s projection: tracks with the current mix', () => {
  it('getState().tracks carries the current value, and the arrangement’s track is not replaced', () => {
    const { engine, stateTrack } = setupEngine();
    engine.setTrackVolume('A', 0.4);
    engine.setTrackMute('A', true);
    expect(stateTrack('A').volume).toBe(0.4);
    expect(stateTrack('A').muted).toBe(true);
    expect(stateTrack('A').pan).toBe(-0.25);
  });

  it('getState().tracks is the same array until tracks or mix change', () => {
    const { engine } = setupEngine();
    const first = engine.getState().tracks;
    engine.setSelection(0, 1);
    engine.zoomIn();
    expect(engine.getState().tracks).toBe(first);

    engine.setTrackPan('A', 0.1);
    const second = engine.getState().tracks;
    expect(second).not.toBe(first);
    expect(engine.getState().tracks).toBe(second);
    expect(second[1]).toBe(first[1]); // B: neither its structure nor its mix changed
    expect(first[0].pan).toBe(-0.25); // an earlier state is never written to

    engine.moveClip('B', 'b1', 1000);
    const third = engine.getState().tracks;
    expect(third).not.toBe(second);
    expect(third[0]).toBe(second[0]); // A unchanged since
  });

  it('a mixer setter emits one statechange with mixerVersion + 1 and the same tracksVersion', () => {
    const { adapter, engine, states } = setupEngine();
    const before = engine.getState();
    engine.setTrackSolo('B', true);
    expect(adapter.calls).toEqual([{ method: 'setTrackSolo', args: ['B', true] }]);
    expect(states).toHaveLength(1);
    expect(states[0].mixerVersion).toBe(before.mixerVersion + 1);
    expect(states[0].tracksVersion).toBe(before.tracksVersion);
    expect(states[0].tracks[1].soloed).toBe(true);
  });

  // Review Focus 4: dawcore sets values for a track that is still loading.
  it.each([
    ['setTrackVolume', (e: PlaylistEngine) => e.setTrackVolume('still-loading', 0.5), 0.5],
    ['setTrackMute', (e: PlaylistEngine) => e.setTrackMute('still-loading', true), true],
    ['setTrackSolo', (e: PlaylistEngine) => e.setTrackSolo('still-loading', true), true],
    ['setTrackPan', (e: PlaylistEngine) => e.setTrackPan('still-loading', 0.5), 0.5],
  ] as const)(
    '%s for a track the arrangement does not hold: the adapter is called, nothing changes, no statechange, no throw',
    (method, run, value) => {
      const { adapter, engine, states } = setupEngine();
      const before = engine.getState();
      expect(() => run(engine)).not.toThrow();
      expect(adapter.calls).toEqual([{ method, args: ['still-loading', value] }]);
      expect(states).toHaveLength(0);
      expect(engine.getState().mixerVersion).toBe(before.mixerVersion);
      expect(engine.getState().tracks).toBe(before.tracks);
    }
  );

  describe.each([{ incremental: true }, { incremental: false }])(
    'what the adapter is given (incremental: $incremental)',
    ({ incremental }) => {
      const firstTrackOf = (call: { method: string; args: unknown[] }): ClipTrack => {
        if (call.method === 'setTracks') return (call.args[0] as ClipTrack[])[0];
        if (call.method === 'addTrack') return call.args[0] as ClipTrack;
        return call.args[1] as ClipTrack;
      };

      it('a clip edit after a fader move sends the track with the current mix', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.setTrackVolume('A', 0.4);
        adapter.reset();
        engine.moveClip('A', 'a1', 1000);
        expect(firstTrackOf(adapter.rawCalls[0]).volume).toBe(0.4);
        expect(firstTrackOf(adapter.rawCalls[0]).clips[0].startSample).toBe(1000);
      });

      it('updateTrack(id, track) sends the current mix, not the fields of the track it was given', () => {
        const { adapter, engine, stateTrack } = setupEngine({ incremental });
        engine.setTrackVolume('A', 0.4);
        adapter.reset();
        engine.updateTrack('A', track('A', [clip('a9', 0)], { volume: 0.1, muted: true }));
        const sent = firstTrackOf(adapter.rawCalls[0]);
        expect(sent.volume).toBe(0.4);
        expect(sent.muted).toBe(false);
        expect(sent.clips.map((c) => c.id)).toEqual(['a9']);
        expect(stateTrack('A').volume).toBe(0.4);
      });

      it('updateTrack(id) sends the current mix', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.setTrackPan('A', 0.6);
        adapter.reset();
        engine.updateTrack('A');
        expect(firstTrackOf(adapter.rawCalls[0]).pan).toBe(0.6);
      });

      it('addTrack sends the track with the mix it was seeded with', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.addTrack(track('C', [], { volume: 0.7 }));
        const call = adapter.rawCalls[0];
        const sent =
          call.method === 'setTracks'
            ? (call.args[0] as ClipTrack[])[2]
            : (call.args[0] as ClipTrack);
        expect(sent.volume).toBe(0.7);
      });

      it('addTrack of the id of a removed track sends the mix seeded from the given fields', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.setTrackVolume('A', 0.4);
        engine.removeTrack('A');
        adapter.reset();
        engine.addTrack(track('A', [], { volume: 1 }));
        const call = adapter.rawCalls[0];
        const sent =
          call.method === 'setTracks'
            ? (call.args[0] as ClipTrack[]).find((t) => t.id === 'A')
            : (call.args[0] as ClipTrack);
        // Rule (#843): the removed track's entry is not kept in the current
        // Map; before, 0.4 (the kept entry).
        expect(sent?.volume).toBe(1);
      });

      it('setTracks sends an id that was already there with the mix it has, not the given fields', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.setTrackVolume('A', 0.4);
        adapter.reset();
        engine.setTracks([track('A', [], { volume: 1 })]);
        expect((adapter.rawCalls[0].args[0] as ClipTrack[])[0].volume).toBe(0.4);
      });

      it('undo of a move and a fader move in one step: the track is sent with the mix from before, and the setter is called', () => {
        const { adapter, engine, stateTrack } = setupEngine({ incremental });
        // Rule (#843): a fader move is a step of its own, so the two are one
        // step only inside a transaction. Before #843 they were two calls
        // with no transaction, and the undo of the move sent volume 0.4 (in
        // the state too) and called no mixer setter.
        engine.beginTransaction();
        engine.moveClip('A', 'a1', 1000);
        engine.setTrackVolume('A', 0.4);
        engine.commitTransaction();
        adapter.reset();
        engine.undo();
        const sent = firstTrackOf(adapter.rawCalls[0]);
        expect(sent.clips[0].startSample).toBe(0);
        // The step holds the mix from before. A track call does not carry
        // the mix to every adapter, so the setter follows.
        expect(sent.volume).toBe(0.8);
        expect(stateTrack('A').volume).toBe(0.8);
        expect(
          adapter.calls.filter((c) => c.method.startsWith('setTrack') && c.method !== 'setTracks')
        ).toEqual([{ method: 'setTrackVolume', args: ['A', 0.8] }]);
      });

      // Review Focus 3: an undo that changes the number of tracks.
      it('undo of removeTrack: setTracks, with the returning track carrying the mix it had', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.setTrackPan('A', 0.9);
        engine.removeTrack('A');
        adapter.reset();
        engine.undo();
        expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks']);
        const sent = adapter.rawCalls[0].args[0] as ClipTrack[];
        expect(sent.map((t) => t.id)).toEqual(['A', 'B']);
        expect(sent[0].pan).toBe(0.9);
      });

      it('undo of addTrack: setTracks without the track', () => {
        const { adapter, engine } = setupEngine({ incremental });
        engine.addTrack(track('C', []));
        adapter.reset();
        engine.undo();
        expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks']);
        expect((adapter.rawCalls[0].args[0] as ClipTrack[]).map((t) => t.id)).toEqual(['A', 'B']);
      });

      it('an undo of a move with a fader move on another track in one step sends that track its setter, no track call', () => {
        const { adapter, engine } = setupEngine({ incremental });
        // Rule (#843): a fader move is a step of its own, so the two are one
        // step only inside a transaction (before #843: two calls, no
        // transaction).
        engine.beginTransaction();
        engine.moveClip('A', 'a1', 1000);
        engine.setTrackVolume('B', 0.4);
        engine.commitTransaction();
        adapter.reset();
        engine.undo();
        // Rule (#843): the undo step holds B's volume from before (1), so the
        // setter follows the track call. Before: the track call only.
        if (incremental) {
          expect(adapter.calls.map((c) => [c.method, c.args[0]])).toEqual([
            ['updateTrack', 'A'],
            ['setTrackVolume', 'B'],
          ]);
        } else {
          expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks', 'setTrackVolume']);
        }
      });
    }
  );
});

describe('withMixerValues', () => {
  const values = { volume: 0.5, muted: true, soloed: false, pan: 0.25 };

  it('returns the track itself when its fields already hold the values, or there are none', () => {
    const same = track('A', [], values);
    expect(withMixerValues(same, { ...values })).toBe(same);
    expect(withMixerValues(same, undefined)).toBe(same);
  });

  it.each([
    ['volume', { volume: 0.6 }],
    ['muted', { muted: false }],
    ['soloed', { soloed: true }],
    ['pan', { pan: -1 }],
  ] as const)(
    'returns a copy with the values when %s differs, and leaves the track as it was',
    (_, patch) => {
      const given = track('A', [], values);
      const merged = withMixerValues(given, { ...values, ...patch });
      expect(merged).not.toBe(given);
      expect(merged).toEqual({ ...given, ...values, ...patch });
      expect(merged.clips).toBe(given.clips);
      expect(given).toEqual(track('A', [], values));
    }
  );
});
