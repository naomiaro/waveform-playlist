/**
 * Loading clips in the arrangement (#812, part 4): a clip whose audio is not
 * loaded yet is held by the arrangement, kept through every operation and
 * every undo step, and left out of what an engine plays and reports.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack, isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipTrack, LoadingClip } from '@waveform-playlist/core';
import { PlaylistEngine, createArrangement } from '../index';
import type { Arrangement } from '../index';
import { isDevelopmentBuild } from '../arrangement/devFreeze';
import { recordingAdapter } from './helpers/recordingAdapter';

const SAMPLE_RATE = 48000;
const SECOND = SAMPLE_RATE;

function clip(id: string, startSample: number): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: SECOND,
      offsetSamples: 0,
      sampleRate: SAMPLE_RATE,
      sourceDurationSamples: 4 * SECOND,
    }),
    id,
  };
}

/** A clip still loading. `start` is in seconds: 1 would be on top of a loaded clip at one second. */
function loading(id: string, start = 1): LoadingClip {
  return { id, src: `/media/${id}.opus`, start, duration: 1 };
}

function track(id: string, clips: ArrangementTrack['clips']): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips };
}

/** Track A: a loaded clip at 0 s, a loading clip at 1 s, a loaded clip at 3 s. Track B: one loaded clip. */
function fixture(): ArrangementTrack[] {
  return [
    track('A', [clip('a1', 0), loading('L'), clip('a2', 3 * SECOND)]),
    track('B', [clip('b1', 0)]),
  ];
}

const clipsOf = (arrangement: Arrangement, trackId: string) =>
  arrangement.getTracks().find((t) => t.id === trackId)!.clips;
const clipIds = (arrangement: Arrangement, trackId: string) =>
  clipsOf(arrangement, trackId).map((c) => c.id);
const heldLoading = (arrangement: Arrangement) =>
  clipsOf(arrangement, 'A').find((c) => c.id === 'L') as LoadingClip;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a loading clip enters the arrangement', () => {
  it('is held as a copy, with its fields, and is given no tick', () => {
    const mine = loading('L');
    const arrangement = createArrangement();
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    arrangement.setTracks([track('A', [clip('a1', 0), mine])]);

    const held = heldLoading(arrangement);
    expect(held).not.toBe(mine);
    expect(held).toEqual(mine);
    expect('startTick' in held).toBe(false);
    expect(isLoadingClip(held)).toBe(true);
    // The loaded clip beside it did get its tick.
    expect((clipsOf(arrangement, 'A')[0] as AudioClip).startTick).toBe(0);
    engine.dispose();
  });

  it('is the same object after an engine attaches', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const before = heldLoading(arrangement);
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    // The attach gave the loaded clips their ticks ...
    expect((clipsOf(arrangement, 'A')[2] as AudioClip).startTick).toBeGreaterThan(0);
    // ... and left the loading clip alone.
    expect(heldLoading(arrangement)).toBe(before);
    expect('startTick' in heldLoading(arrangement)).toBe(false);
    engine.dispose();
  });

  it('a tempo change leaves it as it is, also one that came with a tick from plain JavaScript', () => {
    // LoadingClip has no startTick; an untyped caller can still pass one.
    const withTick = { ...loading('L'), startTick: 960 } as LoadingClip;
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', SECOND), withTick])] });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    const before = heldLoading(arrangement);

    engine.setTempo(60);
    // The loaded clip was moved by the recompute ...
    expect((clipsOf(arrangement, 'A')[0] as AudioClip).startSample).toBe(2 * SECOND);
    // ... the loading clip was not given a sample position.
    expect(heldLoading(arrangement)).toBe(before);
    expect('startSample' in heldLoading(arrangement)).toBe(false);
    engine.dispose();
  });

  it('is frozen with its track outside production builds', () => {
    expect(isDevelopmentBuild()).toBe(true);
    const arrangement = createArrangement({ tracks: fixture() });
    expect(Object.isFrozen(heldLoading(arrangement))).toBe(true);
  });

  it('through addTrack and through both forms of updateTrack', () => {
    const arrangement = createArrangement();
    arrangement.addTrack(track('A', [loading('L')]));
    expect(clipIds(arrangement, 'A')).toEqual(['L']);

    arrangement.updateTrack('A', track('A', [loading('L'), loading('M', 2)]));
    expect(clipIds(arrangement, 'A')).toEqual(['L', 'M']);

    const held = heldLoading(arrangement);
    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: [...current.clips, loading('N', 4)],
    }));
    expect(clipIds(arrangement, 'A')).toEqual(['L', 'M', 'N']);
    // The function form keeps the clip objects the arrangement already held.
    expect(heldLoading(arrangement)).toBe(held);
  });

  it('two clips of one id on a track are refused, also when one of them is loading', () => {
    const arrangement = createArrangement();
    expect(() => arrangement.setTracks([track('A', [clip('x', 0), loading('x')])])).toThrow(
      /duplicate clip id "x"/
    );
    expect(arrangement.getTracks()).toEqual([]);
  });
});

describe('a loading clip survives every operation on its track', () => {
  it('as the same object, in its place, through clip edits, a reorder and a mixer change', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const held = heldLoading(arrangement);

    expect(arrangement.moveClip('A', 'a2', SECOND)).toBe(SECOND);
    arrangement.trimClip('A', 'a2', 'right', -SECOND / 2);
    arrangement.reorderTrack('A', 1);
    arrangement.setTrackVolume('A', 0.5);
    expect(heldLoading(arrangement)).toBe(held);
    expect(clipIds(arrangement, 'A')).toEqual(['a1', 'L', 'a2']);

    arrangement.splitClip('A', 'a1', SECOND / 2);
    expect(heldLoading(arrangement)).toBe(held);
    const ids = clipIds(arrangement, 'A');
    // The two halves stand where a1 stood; the loading clip is still after them.
    expect(ids).toHaveLength(4);
    expect(ids[2]).toBe('L');
    expect(ids[3]).toBe('a2');
  });

  it('and is in the undo steps: undo and redo bring back states that hold it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const held = heldLoading(arrangement);

    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: current.clips.filter((c) => c.id !== 'L'),
    }));
    expect(clipIds(arrangement, 'A')).toEqual(['a1', 'a2']);

    arrangement.undo();
    expect(clipIds(arrangement, 'A')).toEqual(['a1', 'L', 'a2']);
    expect(heldLoading(arrangement)).toBe(held);

    arrangement.redo();
    expect(clipIds(arrangement, 'A')).toEqual(['a1', 'a2']);
  });
});

describe('a loading clip cannot be edited', () => {
  it('moveClip, trimClip and splitClip warn and change nothing', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const tracks = arrangement.getTracks();
    const version = arrangement.tracksVersion;

    expect(arrangement.moveClip('A', 'L', SECOND)).toBe(0);
    arrangement.trimClip('A', 'L', 'right', -1000);
    arrangement.splitClip('A', 'L', SECOND + 1000);

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(version);
    expect(arrangement.canUndo).toBe(false);
    const messages = warn.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatch(/moveClip: clip "L" in track "A" is still loading/);
    expect(messages[1]).toMatch(/trimClip: clip "L" in track "A" is still loading/);
    expect(messages[2]).toMatch(/splitClip: clip "L" in track "A" is still loading/);
  });

  it('getClipBounds is null and constrainTrimDelta is 0, as for a clip that is not there', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    expect(arrangement.getClipBounds('A', 'L')).toBeNull();
    expect(arrangement.constrainTrimDelta('A', 'L', 'right', -1000)).toBe(0);
    // The control: a loaded clip on the same track has both.
    expect(arrangement.getClipBounds('A', 'a2')).toEqual({
      offsetSamples: 0,
      durationSamples: SECOND,
      startSample: 3 * SECOND,
      sourceDurationSamples: 4 * SECOND,
    });
    expect(arrangement.constrainTrimDelta('A', 'a2', 'right', -1000)).toBe(-1000);
  });

  it('through the engine too', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    const events = vi.fn();
    engine.on('statechange', events);

    expect(engine.moveClip('A', 'L', SECOND)).toBe(0);
    engine.trimClip('A', 'L', 'right', -1000);
    engine.splitClip('A', 'L', SECOND + 1000);
    expect(engine.getClipBounds('A', 'L')).toBeNull();
    expect(engine.constrainTrimDelta('A', 'L', 'right', -1000)).toBe(0);
    expect(events).not.toHaveBeenCalled();
    engine.dispose();
  });
});

describe('loaded clips take no notice of a loading clip beside them', () => {
  // a1 is at 0 to 1 s and the loading clip says it starts at 1 s: if it
  // counted as a neighbour, a1 could neither move right nor grow.
  it('a move is constrained by loaded neighbours only', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    expect(arrangement.moveClip('A', 'a1', SECOND)).toBe(SECOND);
    // The loaded neighbour (a2 at 3 s) still stops it: a1 is at 1 to 2 s now.
    expect(arrangement.moveClip('A', 'a1', 5 * SECOND)).toBe(SECOND);
  });

  it('a trim is constrained by loaded neighbours only', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    expect(arrangement.constrainTrimDelta('A', 'a1', 'right', SECOND)).toBe(SECOND);
    arrangement.trimClip('A', 'a1', 'right', SECOND);
    expect((clipsOf(arrangement, 'A')[0] as AudioClip).durationSamples).toBe(2 * SECOND);
    // a2 at 3 s is the limit.
    expect(arrangement.constrainTrimDelta('A', 'a1', 'right', 5 * SECOND)).toBe(SECOND);
  });
});

describe('a loading clip and the kind of its track', () => {
  const midiClip = (id: string): AudioClip => ({
    ...clip(id, 0),
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
  });
  const midiTrack = (id: string, clips: ArrangementTrack['clips']): ArrangementTrack => ({
    ...track(id, clips),
    kind: 'midi',
  });

  it('a MIDI track that holds a loading clip is accepted by every way in', () => {
    const mixed = () => midiTrack('M', [midiClip('m1'), loading('L')]);
    expect(createArrangement({ tracks: [mixed()] }).getTracks()[0].clips).toHaveLength(2);

    const arrangement = createArrangement();
    arrangement.setTracks([mixed()]);
    arrangement.addTrack({ ...mixed(), id: 'M2' });
    arrangement.updateTrack('M', { ...mixed(), name: 'renamed' });
    arrangement.updateTrack('M2', (current) => ({ ...current, name: 'renamed too' }));
    expect(arrangement.getTracks().map((t) => t.clips.map((c) => c.id))).toEqual([
      ['m1', 'L'],
      ['m1', 'L'],
    ]);
  });

  it('the loaded clips are still checked: an audio clip on that MIDI track is refused', () => {
    const arrangement = createArrangement();
    expect(() => arrangement.setTracks([midiTrack('M', [loading('L'), clip('a1', 0)])])).toThrow(
      /is an? midi track but its clip "a1" is an audio clip/
    );
    expect(arrangement.getTracks()).toEqual([]);
  });

  it('a MIDI clip beside a loading clip on an audio track is refused', () => {
    const arrangement = createArrangement();
    expect(() => arrangement.setTracks([track('A', [loading('L'), midiClip('m1')])])).toThrow(
      /is an audio track but its clip "m1" is a midi clip/
    );
  });
});

describe('what an engine plays and reports leaves loading clips out', () => {
  const trackArgs = (calls: { method: string; args: unknown[] }[]): ClipTrack[] =>
    calls.flatMap((call) => {
      if (call.method === 'setTracks') return call.args[0] as ClipTrack[];
      if (call.method === 'addTrack') return [call.args[0] as ClipTrack];
      if (call.method === 'updateTrack') return [call.args[1] as ClipTrack];
      return [];
    });

  it('the adapter never receives one, whatever path a track takes to it', () => {
    for (const incremental of [true, false]) {
      const adapter = recordingAdapter({ incremental });
      const arrangement = createArrangement({ tracks: fixture() });
      const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });

      arrangement.addTrack(track('C', [loading('L2'), clip('c1', 0)]));
      arrangement.updateTrack('B', track('B', [clip('b1', 0), loading('L3', 2)]));
      arrangement.moveClip('A', 'a2', SECOND);
      arrangement.reorderTrack('C', 0);
      arrangement.removeTrack('B');
      arrangement.undo();
      arrangement.redo();
      arrangement.beginTransaction();
      arrangement.splitClip('A', 'a1', SECOND / 2);
      arrangement.abortTransaction();
      engine.setTempo(90);
      engine.updateTrack('A');
      arrangement.setTracks(fixture());

      const sent = trackArgs(adapter.rawCalls);
      // Every kind of call was made (with incremental: false they are all setTracks).
      const methods = new Set(adapter.rawCalls.map((call) => call.method));
      expect(methods.has('setTracks')).toBe(true);
      if (incremental) {
        expect(methods.has('addTrack')).toBe(true);
        expect(methods.has('updateTrack')).toBe(true);
      }
      expect(sent.length).toBeGreaterThan(8);
      const loadingSent = sent.flatMap((t) => t.clips).filter((c) => isLoadingClip(c));
      expect(loadingSent).toEqual([]);
      // What it was sent for A is A's loaded clips, in order.
      const lastA = [...sent].reverse().find((t) => t.id === 'A')!;
      expect(lastA.clips.map((c) => c.id)).toEqual(['a1', 'a2']);
      engine.dispose();
    }
  });

  it('getState().tracks has the loaded clips only; the arrangement has all of them', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });

    const state = engine.getState();
    expect(state.tracks.map((t) => t.clips.map((c) => c.id))).toEqual([['a1', 'a2'], ['b1']]);
    expect(clipIds(arrangement, 'A')).toEqual(['a1', 'L', 'a2']);
    // The loaded clip objects are the arrangement's own.
    expect(state.tracks[0].clips[1]).toBe(clipsOf(arrangement, 'A')[2]);
    // A track without a loading clip is the arrangement's own object, as before.
    expect(state.tracks[1]).toBe(arrangement.getTracks()[1]);
    engine.dispose();
  });

  it('the track without its loading clips is the same object until that track changes', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });

    const first = engine.getState().tracks[0];
    arrangement.moveClip('B', 'b1', SECOND);
    expect(engine.getState().tracks[0]).toBe(first);
    arrangement.moveClip('A', 'a2', SECOND);
    expect(engine.getState().tracks[0]).not.toBe(first);
    engine.dispose();
  });

  it('a track that holds only loading clips is played as an empty track', () => {
    const adapter = recordingAdapter();
    const arrangement = createArrangement();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    arrangement.addTrack(track('A', [loading('L')]));

    expect(adapter.calls).toEqual([{ method: 'addTrack', args: [{ id: 'A', clips: [] }] }]);
    expect(engine.getState().tracks.map((t) => t.clips)).toEqual([[]]);
    engine.dispose();
  });

  it('the duration is that of the loaded clips', () => {
    // The loading clip says 10 to 11 s; the loaded clips end at 4 s.
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0), loading('L', 10), clip('a2', 3 * SECOND)])],
    });
    const engine = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    expect(engine.getState().duration).toBe(4);

    arrangement.setTracks([track('A', [loading('L', 10)])]);
    expect(engine.getState().duration).toBe(0);
    engine.dispose();
  });
});
