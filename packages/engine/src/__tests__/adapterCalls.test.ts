/**
 * What the adapter is called with, and how often `statechange` is emitted,
 * for every operation that touches tracks (#812).
 *
 * These tests pin the engine as it is. An expectation here changes only
 * when a rule of the arrangement changes it, with a comment naming the rule.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ClipTrack } from '@waveform-playlist/core';
import { PlaylistEngine } from '../PlaylistEngine';
import type { EngineState } from '../types';
import { recordingAdapter } from './helpers/recordingAdapter';
import type {
  AdapterCall,
  RecordingAdapterOptions,
  TrackSummary,
} from './helpers/recordingAdapter';

const SAMPLE_RATE = 48000;

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

/** A: a1 at 0 s and a2 at 2 s, one second each. B: b1 at 0 s. */
function fixture(): ClipTrack[] {
  return [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 0)])];
}

const A: TrackSummary = { id: 'A', clips: ['a1', 'a2'] };
const B: TrackSummary = { id: 'B', clips: ['b1'] };

const setTracksCall = (tracks: TrackSummary[]): AdapterCall => ({
  method: 'setTracks',
  args: [tracks],
});
const updateTrackCall = (summary: TrackSummary): AdapterCall => ({
  method: 'updateTrack',
  args: [summary.id, summary],
});

function setup(options: RecordingAdapterOptions = {}) {
  const adapter = recordingAdapter(options);
  const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
  const states: EngineState[] = [];
  engine.on('statechange', (state) => states.push(state));
  engine.setTracks(fixture());
  adapter.reset();
  states.length = 0;
  const startOf = (trackId: string, clipId: string): number => {
    const found = engine
      .getState()
      .tracks.find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId);
    if (!found) throw new Error(`no clip ${clipId} on ${trackId}`);
    return found.startSample;
  };
  const summaries = (): TrackSummary[] =>
    engine.getState().tracks.map((t) => ({ id: t.id, clips: t.clips.map((c) => c.id) }));
  return { adapter, engine, states, startOf, summaries };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  { name: 'an adapter with addTrack, removeTrack and updateTrack', incremental: true },
  { name: 'an adapter with setTracks only', incremental: false },
])('adapter calls with $name', ({ incremental }) => {
  /** One track sent to the adapter: `updateTrack`, or every track through `setTracks`. */
  const oneTrack = (summary: TrackSummary, all: TrackSummary[]): AdapterCall[] =>
    incremental ? [updateTrackCall(summary)] : [setTracksCall(all)];
  /** Every track sent one by one, as an undo with the same number of tracks does. */
  const everyTrack = (all: TrackSummary[]): AdapterCall[] =>
    all.flatMap((summary) => oneTrack(summary, all));

  describe('track operations', () => {
    it('setTracks: one setTracks with every track, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.setTracks(fixture());
      expect(adapter.calls).toEqual([setTracksCall([A, B])]);
      expect(states).toHaveLength(1);
    });

    it('addTrack: the new track only, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.addTrack(track('C', [clip('c1', 0)]));
      const C = { id: 'C', clips: ['c1'] };
      expect(adapter.calls).toEqual(
        incremental ? [{ method: 'addTrack', args: [C] }] : [setTracksCall([A, B, C])]
      );
      expect(states).toHaveLength(1);
    });

    it('removeTrack: the id only, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.removeTrack('A');
      expect(adapter.calls).toEqual(
        incremental ? [{ method: 'removeTrack', args: ['A'] }] : [setTracksCall([B])]
      );
      expect(states).toHaveLength(1);
    });

    it('removeTrack of an unknown id: no call, no emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.removeTrack('nope');
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(0);
    });

    it('removeTrack of the selected track: the next state has no selected track', () => {
      const { engine, states } = setup({ incremental });
      engine.selectTrack('A');
      states.length = 0;
      engine.removeTrack('A');
      expect(states).toHaveLength(1);
      expect(states[0].selectedTrackId).toBeNull();
    });

    it('updateTrack(id, track): that track, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.updateTrack('A', track('A', [clip('a3', 0)]));
      const next = { id: 'A', clips: ['a3'] };
      expect(adapter.calls).toEqual(oneTrack(next, [next, B]));
      expect(states).toHaveLength(1);
    });

    it('updateTrack(id): forwards the current track, no emission, no undo step', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.updateTrack('A');
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(0);
      expect(engine.canUndo).toBe(false);
    });

    it('updateTrack(id, track) with an unknown id: an undo step, a version bump, an adapter call and an emission, and no track added', () => {
      const { adapter, engine, states, summaries } = setup({ incremental });
      const before = engine.getState().tracksVersion;
      engine.updateTrack('nope', track('nope', [clip('n1', 0)]));
      expect(adapter.calls).toEqual(oneTrack({ id: 'nope', clips: ['n1'] }, [A, B]));
      expect(states).toHaveLength(1);
      expect(states[0].tracksVersion).toBe(before + 1);
      expect(engine.canUndo).toBe(true);
      expect(summaries()).toEqual([A, B]);
    });

    it('reorderTrack: no adapter call, one emission', () => {
      const { adapter, engine, states, summaries } = setup({ incremental });
      engine.reorderTrack('A', 1);
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(1);
      expect(summaries()).toEqual([B, A]);
    });
  });

  describe('clip operations', () => {
    it('moveClip: the clip’s track, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      expect(engine.moveClip('A', 'a1', 1000)).toBe(1000);
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(1);
    });

    it('moveClip with skipAdapter: no adapter call, one emission', () => {
      const { adapter, engine, states, startOf } = setup({ incremental });
      expect(engine.moveClip('A', 'a1', 1000, true)).toBe(1000);
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(1);
      expect(startOf('A', 'a1')).toBe(1000);
    });

    it('trimClip on the left edge: the clip’s track, one emission', () => {
      const { adapter, engine, states, startOf } = setup({ incremental });
      engine.trimClip('A', 'a2', 'left', 1000);
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(1);
      expect(startOf('A', 'a2')).toBe(97000);
    });

    it('trimClip on the right edge: the clip’s track, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.trimClip('A', 'a1', 'right', -1000);
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(1);
      expect(states[0].tracks[0].clips[0].durationSamples).toBe(47000);
    });

    it('trimClip with skipAdapter: no adapter call, one emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.trimClip('A', 'a1', 'right', -1000, true);
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(1);
      expect(states[0].tracks[0].clips[0].durationSamples).toBe(47000);
    });

    it('splitClip: the clip’s track with both halves, one emission', () => {
      const { adapter, engine, states, summaries } = setup({ incremental });
      engine.splitClip('A', 'a1', 24000);
      const after = summaries();
      expect(after[0].clips).toHaveLength(3);
      expect(after[0].clips[2]).toBe('a2');
      expect(adapter.calls).toEqual(oneTrack(after[0], after));
      expect(states).toHaveLength(1);
    });
  });

  describe('undo and redo', () => {
    // Rule (#812, immutability): a snapshot is a reference, so a track an undo
    // did not touch is the same object before and after and is NOT sent. Only
    // the tracks that differ are. (Before: every track, one by one.)
    it.each([
      ['a move', (engine: PlaylistEngine) => void engine.moveClip('A', 'a1', 1000)],
      ['a trim', (engine: PlaylistEngine) => engine.trimClip('A', 'a1', 'right', -1000)],
      ['a split', (engine: PlaylistEngine) => engine.splitClip('A', 'a1', 24000)],
      [
        'an updateTrack',
        (engine: PlaylistEngine) => engine.updateTrack('A', track('A', [clip('a3', 0)])),
      ],
    ])('of %s: only the track that differs is sent, one emission each way', (_, edit) => {
      const { adapter, engine, states, summaries } = setup({ incremental });
      edit(engine);
      const edited = summaries();
      adapter.reset();
      states.length = 0;

      engine.undo();
      expect(summaries()).toEqual([A, B]);
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(1);

      adapter.reset();
      states.length = 0;
      engine.redo();
      expect(summaries()).toEqual(edited);
      expect(adapter.calls).toEqual(oneTrack(edited[0], edited));
      expect(states).toHaveLength(1);
    });

    // Rule (#812, immutability): the order of tracks is not audible and no
    // track object differs, so nothing is sent. (Before: every track.)
    it('of a reorderTrack: no adapter call, one emission each way', () => {
      const { adapter, engine, states, summaries } = setup({ incremental });
      engine.reorderTrack('A', 1);
      adapter.reset();
      states.length = 0;

      engine.undo();
      expect(summaries()).toEqual([A, B]);
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(1);

      engine.redo();
      expect(summaries()).toEqual([B, A]);
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(2);
    });

    it('of edits on two tracks in one transaction: both tracks are sent, in track order', () => {
      const { adapter, engine } = setup({ incremental });
      engine.beginTransaction();
      engine.moveClip('B', 'b1', 1000);
      engine.moveClip('A', 'a1', 1000);
      engine.commitTransaction();
      adapter.reset();
      engine.undo();
      expect(adapter.calls).toEqual(everyTrack([A, B]));
    });

    // Rule (#812): "the same tracks" is decided by id, not by count.
    it('of a transaction that removed one track and added another: setTracks (same count, other tracks)', () => {
      const { adapter, engine } = setup({ incremental });
      engine.beginTransaction();
      engine.removeTrack('A');
      engine.addTrack(track('D', [clip('d1', 0)]));
      engine.commitTransaction();
      adapter.reset();
      engine.undo();
      expect(adapter.calls).toEqual([setTracksCall([A, B])]);
    });

    it('of an addTrack: setTracks each way (the number of tracks changes)', () => {
      const { adapter, engine, states } = setup({ incremental });
      const C = { id: 'C', clips: ['c1'] };
      engine.addTrack(track('C', [clip('c1', 0)]));
      adapter.reset();
      states.length = 0;

      engine.undo();
      expect(adapter.calls).toEqual([setTracksCall([A, B])]);
      expect(states).toHaveLength(1);

      adapter.reset();
      states.length = 0;
      engine.redo();
      expect(adapter.calls).toEqual([setTracksCall([A, B, C])]);
      expect(states).toHaveLength(1);
    });

    it('of a removeTrack: setTracks each way', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.removeTrack('A');
      adapter.reset();
      states.length = 0;

      engine.undo();
      expect(adapter.calls).toEqual([setTracksCall([A, B])]);
      expect(states).toHaveLength(1);

      adapter.reset();
      states.length = 0;
      engine.redo();
      expect(adapter.calls).toEqual([setTracksCall([B])]);
      expect(states).toHaveLength(1);
    });

    it('undo of an addTrack leaves the selected track id as it was (today)', () => {
      const { engine } = setup({ incremental });
      engine.addTrack(track('C', [clip('c1', 0)]));
      engine.selectTrack('C');
      engine.undo();
      expect(engine.getState().tracks.map((t) => t.id)).toEqual(['A', 'B']);
      expect(engine.getState().selectedTrackId).toBe('C');
    });

    it('undo with nothing to undo: no call, no emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.undo();
      engine.redo();
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(0);
    });
  });

  describe('transactions', () => {
    it('a move drag (begin, three moves with skipAdapter, updateTrack(id), commit): one adapter call, on drop', () => {
      const { adapter, engine, states, startOf } = setup({ incremental });
      engine.beginTransaction();
      engine.moveClip('A', 'a1', 100, true);
      engine.moveClip('A', 'a1', 100, true);
      engine.moveClip('A', 'a1', 100, true);
      expect(adapter.calls).toEqual([]);
      expect(engine.canUndo).toBe(false);

      engine.updateTrack('A');
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));

      engine.commitTransaction();
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(3);
      expect(startOf('A', 'a1')).toBe(300);
      expect(engine.canUndo).toBe(true);

      // One step for the whole drag.
      engine.undo();
      expect(startOf('A', 'a1')).toBe(0);
      expect(engine.canUndo).toBe(false);
    });

    // Rule (#812, immutability): only the dragged clip's track is sent back. (Before: every track.)
    it('the same drag aborted: the dragged track is sent back, one more emission, no undo step', () => {
      const { adapter, engine, states, startOf } = setup({ incremental });
      engine.beginTransaction();
      engine.moveClip('A', 'a1', 100, true);
      engine.moveClip('A', 'a1', 100, true);
      engine.moveClip('A', 'a1', 100, true);
      engine.abortTransaction();

      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(4);
      expect(startOf('A', 'a1')).toBe(0);
      expect(engine.canUndo).toBe(false);
      expect(engine.canRedo).toBe(false);
    });

    it('a transaction with no change, committed: no call, no emission, no undo step', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.beginTransaction();
      engine.commitTransaction();
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(0);
      expect(engine.canUndo).toBe(false);
    });

    it('a transaction with no change, aborted: no call, no emission', () => {
      const { adapter, engine, states } = setup({ incremental });
      engine.beginTransaction();
      engine.abortTransaction();
      expect(adapter.calls).toEqual([]);
      expect(states).toHaveLength(0);
    });

    it('commitTransaction with a change emits nothing itself (today)', () => {
      const { engine, states } = setup({ incremental });
      engine.beginTransaction();
      engine.moveClip('A', 'a1', 100, true);
      states.length = 0;
      engine.commitTransaction();
      expect(states).toHaveLength(0);
      expect(engine.canUndo).toBe(true);
    });

    it('undo while a transaction is open: the undo acts and the transaction stays open (today)', () => {
      const { adapter, engine, states, startOf } = setup({ incremental });
      engine.moveClip('A', 'a1', 1000);
      engine.beginTransaction();
      engine.moveClip('A', 'a1', 100, true);
      adapter.reset();
      states.length = 0;

      engine.undo();
      expect(startOf('A', 'a1')).toBe(0);
      // Rule (#812, immutability): only the track that differs. (Before: every track.)
      expect(adapter.calls).toEqual(oneTrack(A, [A, B]));
      expect(states).toHaveLength(1);
      expect(engine.canRedo).toBe(true);

      // The transaction is still open: its commit pushes the state from when
      // it began (a1 at 1000) and clears the redo stack.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.commitTransaction();
      expect(warn).not.toHaveBeenCalled();
      expect(engine.canUndo).toBe(true);
      expect(engine.canRedo).toBe(false);
      engine.undo();
      expect(startOf('A', 'a1')).toBe(1000);
    });
  });

  describe('mixer setters', () => {
    const setters = [
      [
        'setTrackVolume',
        (engine: PlaylistEngine, id: string) => engine.setTrackVolume(id, 0.5),
        0.5,
      ],
      ['setTrackMute', (engine: PlaylistEngine, id: string) => engine.setTrackMute(id, true), true],
      ['setTrackSolo', (engine: PlaylistEngine, id: string) => engine.setTrackSolo(id, true), true],
      ['setTrackPan', (engine: PlaylistEngine, id: string) => engine.setTrackPan(id, -0.5), -0.5],
    ] as const;

    it.each(setters)(
      '%s for a known track: the adapter call, one emission, mixerVersion only',
      (method, call, value) => {
        const { adapter, engine, states } = setup({ incremental });
        const before = engine.getState();
        call(engine, 'A');
        expect(adapter.calls).toEqual([{ method, args: ['A', value] }]);
        expect(states).toHaveLength(1);
        expect(states[0].mixerVersion).toBe(before.mixerVersion + 1);
        expect(states[0].tracksVersion).toBe(before.tracksVersion);
        expect(engine.canUndo).toBe(false);
      }
    );

    // Rule (#812, the mixer part): a setter for a track the arrangement does
    // not hold changes no state, so nothing is emitted and mixerVersion
    // stays. The adapter is still called (dawcore sets values for a track
    // that is still loading). Before: one emission and a version bump.
    it.each(setters)(
      '%s for an unknown track: the adapter is still called, no emission',
      (method, call, value) => {
        const { adapter, engine, states, summaries } = setup({ incremental });
        const before = engine.getState();
        call(engine, 'still-loading');
        expect(adapter.calls).toEqual([{ method, args: ['still-loading', value] }]);
        expect(states).toHaveLength(0);
        expect(engine.getState().mixerVersion).toBe(before.mixerVersion);
        expect(summaries()).toEqual([A, B]);
      }
    );

    it('a mixer value set on a track reaches the adapter with the track afterwards', () => {
      const { adapter, engine } = setup({ incremental });
      engine.setTrackVolume('A', 0.25);
      adapter.reset();
      engine.updateTrack('A');
      const sent = incremental
        ? (adapter.rawCalls[0].args[1] as ClipTrack)
        : (adapter.rawCalls[0].args[0] as ClipTrack[])[0];
      expect(sent.volume).toBe(0.25);
    });
  });

  describe('setTempo', () => {
    it('refused by the adapter: nothing but the setTempo call, no emission', () => {
      const { adapter, engine, states } = setup({ incremental, setTempoResult: false });
      engine.setTempo(90);
      expect(adapter.calls).toEqual([{ method: 'setTempo', args: [90, undefined] }]);
      expect(states).toHaveLength(0);
      expect(engine.getState().bpm).toBe(120);
    });

    it.each([
      ['true', true as const],
      ['void', 'void' as const],
    ])(
      'accepted (%s): setTempo, then every track one by one, one emission',
      (_, setTempoResult) => {
        const { adapter, engine, states } = setup({ incremental, setTempoResult });
        const before = engine.getState().tracksVersion;
        engine.setTempo(60);
        expect(adapter.calls).toEqual([
          { method: 'setTempo', args: [60, undefined] },
          ...everyTrack([A, B]),
        ]);
        expect(states).toHaveLength(1);
        expect(states[0].bpm).toBe(60);
        expect(states[0].tracksVersion).toBe(before + 1);
        // a2 was at 2 s = 4 beats at 120 bpm; at 60 bpm that is 4 s.
        expect(states[0].tracks[0].clips[1].startSample).toBe(192000);
      }
    );
  });
});

describe('what the adapter is handed, and when', () => {
  /** The track of an `updateTrack` call, as the object that was passed. */
  const sentTrack = (call: AdapterCall): ClipTrack => call.args[1] as ClipTrack;

  it('a move sends the track with the clip already moved', () => {
    const { adapter, engine } = setup();
    engine.moveClip('A', 'a1', 1000);
    expect(sentTrack(adapter.rawCalls[0]).clips[0].startSample).toBe(1000);
  });

  // Rule (#812, immutability): nothing is written into a track after it was
  // sent, so "the stored object" is shown by identity with getState().tracks.
  // (Before: by a later in-place mixer write landing on the sent object.)
  it('an undo sends the restored track, and it is the stored object', () => {
    const { adapter, engine } = setup();
    engine.moveClip('A', 'a1', 1000);
    adapter.reset();
    engine.undo();
    const sent = sentTrack(adapter.rawCalls[0]);
    expect(sent.clips[0].startSample).toBe(0);
    expect(sent).toBe(engine.getState().tracks[0]);
  });

  it('a mixer write leaves the object the adapter was sent as it was; the next state has a new one', () => {
    const { adapter, engine } = setup();
    engine.updateTrack('A');
    const sent = sentTrack(adapter.rawCalls[0]);
    engine.setTrackVolume('A', 0.3);
    expect(sent.volume).toBe(1);
    expect(engine.getState().tracks[0].volume).toBe(0.3);
  });

  it('addTrack and updateTrack(id, track) send a track whose clips have ticks, and it is the stored object', () => {
    const { adapter, engine } = setup();
    engine.addTrack(track('C', [clip('c1', 48000)]));
    engine.updateTrack('A', track('A', [clip('a3', 48000)]));
    const added = adapter.rawCalls[0].args[0] as ClipTrack;
    const updated = sentTrack(adapter.rawCalls[1]);
    expect(added.clips[0].startTick).toBe(1920);
    expect(updated.clips[0].startTick).toBe(1920);
    expect(added).toBe(engine.getState().tracks[2]);
    expect(updated).toBe(engine.getState().tracks[0]);
  });

  it('setTracks sends the stored array', () => {
    const { adapter, engine } = setup();
    engine.setTracks(fixture());
    expect(adapter.rawCalls[0].args[0]).toBe(engine.getState().tracks);
  });

  it.each([
    ['moveClip', (engine: PlaylistEngine) => void engine.moveClip('A', 'a1', 1000)],
    ['trimClip', (engine: PlaylistEngine) => engine.trimClip('A', 'a1', 'right', -1000)],
    ['splitClip', (engine: PlaylistEngine) => engine.splitClip('A', 'a1', 24000)],
    ['addTrack', (engine: PlaylistEngine) => engine.addTrack(track('C', []))],
    ['removeTrack', (engine: PlaylistEngine) => engine.removeTrack('A')],
    ['updateTrack', (engine: PlaylistEngine) => engine.updateTrack('A', track('A', []))],
    ['setTracks', (engine: PlaylistEngine) => engine.setTracks(fixture())],
    ['setTrackVolume', (engine: PlaylistEngine) => engine.setTrackVolume('A', 0.5)],
    ['undo', (engine: PlaylistEngine) => engine.undo()],
  ])('%s: the adapter is called before statechange is emitted', (_, run) => {
    const { adapter, engine } = setup();
    engine.moveClip('A', 'a2', 1000); // something for the undo case to undo
    adapter.reset();
    const callsAtEmission: number[] = [];
    engine.on('statechange', () => callsAtEmission.push(adapter.calls.length));
    run(engine);
    expect(adapter.calls.length).toBeGreaterThan(0);
    expect(callsAtEmission).toEqual([adapter.calls.length]);
  });
});

describe('a statechange listener that calls back into the engine', () => {
  it('gets both emissions in order, each with its own tracksVersion, and no third call', () => {
    const { engine, summaries } = setup();
    const start = engine.getState().tracksVersion;
    const seen: number[] = [];
    let reentered = false;
    engine.on('statechange', (state) => {
      seen.push(state.tracksVersion);
      if (!reentered) {
        reentered = true;
        engine.reorderTrack('A', 1);
      }
    });

    engine.moveClip('A', 'a1', 1000);

    expect(seen).toEqual([start + 1, start + 2]);
    expect(summaries()).toEqual([B, A]);
  });

  // Today's delivery is nested: the re-entrant change is emitted from inside
  // the first listener's call, so a listener registered AFTER it is told about
  // the second change before the first. Recorded as it is; the arrangement's
  // ordered delivery (#812, "a listener that writes gets its own change
  // delivered after the one it is handling") changes this expectation.
  it('a later listener is told about the re-entrant change first (today)', () => {
    const { engine } = setup();
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

    expect(later).toEqual([start + 2, start + 1]);
  });
});
