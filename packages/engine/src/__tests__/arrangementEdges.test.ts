/**
 * Edges found by the review of the arrangement's rules (#812): a failed
 * engine constructor, changes that are delivered later than they were made,
 * mixer entries of tracks that are gone, a track that is given a new id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { PlaylistEngine, createArrangement } from '../index';
import type { Arrangement } from '../index';
import { isDevelopmentBuild } from '../arrangement/devFreeze';
import { recordingAdapter } from './helpers/recordingAdapter';
import type { RecordingAdapter } from './helpers/recordingAdapter';

const SAMPLE_RATE = 48000;

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
  return [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 0)])];
}

const ids = (arrangement: Arrangement) => arrangement.getTracks().map((t) => t.id);

/**
 * The track ids an adapter holds, replayed from the calls it received, and
 * every call that named a track the adapter did not have (or already had).
 */
function replay(adapter: RecordingAdapter) {
  let held: string[] = [];
  const faults: string[] = [];
  for (const call of adapter.rawCalls) {
    if (call.method === 'setTracks') {
      held = (call.args[0] as ClipTrack[]).map((t) => t.id);
    } else if (call.method === 'addTrack') {
      const id = (call.args[0] as ClipTrack).id;
      if (held.includes(id)) faults.push(`addTrack(${id}) for a track it already has`);
      held = [...held, id];
    } else if (call.method === 'removeTrack') {
      const id = call.args[0] as string;
      if (!held.includes(id)) faults.push(`removeTrack(${id}) for a track it does not have`);
      held = held.filter((h) => h !== id);
    } else if (call.method === 'updateTrack') {
      const id = call.args[0] as string;
      if (!held.includes(id)) faults.push(`updateTrack(${id}) for a track it does not have`);
    }
  }
  return { held: [...held].sort(), faults };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('an engine constructor that fails', () => {
  it('leaves the arrangement unattached and unfollowed', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const bad = recordingAdapter();
    bad.setTracks = () => {
      throw new Error('boom');
    };
    expect(
      () => new PlaylistEngine({ adapter: bad, arrangement, sampleRate: SAMPLE_RATE })
    ).toThrow('boom');

    const good = recordingAdapter();
    new PlaylistEngine({ adapter: good, arrangement, sampleRate: SAMPLE_RATE });
    expect(warn).not.toHaveBeenCalled(); // no "one engine at a time": the first never attached

    good.reset();
    bad.reset();
    expect(() => arrangement.moveClip('A', 'a1', 1000)).not.toThrow();
    expect(good.calls.map((c) => c.method)).toEqual(['updateTrack']);
    expect(bad.calls).toEqual([]); // the failed engine is not following
  });
});

describe('an engine that cannot attach', () => {
  it('leaves the arrangement exactly as it was, and unattached', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, ppqn: 192 }).dispose();
    arrangement.addTrack(track('C', [clip('c1', 48000)])); // no tick: no engine
    const tracks = arrangement.getTracks();
    const version = arrangement.tracksVersion;
    const listener = vi.fn();
    arrangement.subscribe(listener);

    const broken = recordingAdapter();
    broken.secondsToTicks = () => {
      throw new Error('tempo map broke');
    };
    expect(
      () => new PlaylistEngine({ adapter: broken, arrangement, sampleRate: SAMPLE_RATE })
    ).toThrow('tempo map broke');

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(version);
    expect(listener).not.toHaveBeenCalled();
    expect(arrangement.canUndo).toBe(true);
    // Not attached: an edit needs no tempo map, and the next engine is the first.
    expect(() => arrangement.moveClip('A', 'a1', 1000)).not.toThrow();
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, ppqn: 192 });
    expect(warn).not.toHaveBeenCalled();
    expect(arrangement.getTracks()[2].clips[0].startTick).toBe(384);
  });
});

describe('two engines on one arrangement', () => {
  it('disposing the first after the second attached leaves the second its time base', () => {
    const arrangement = createArrangement();
    const first = new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE });
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, bpm: 120, ppqn: 960 });
    first.dispose();
    arrangement.addTrack(track('A', [clip('a1', 48000)]));
    expect(arrangement.getTracks()[0].clips[0].startTick).toBe(1920);
  });
});

describe('changes delivered later than they were made', () => {
  /** Runs `changes` from inside a statechange listener, once, during the delivery of a first change. */
  function fromInsideAListener(changes: (engine: PlaylistEngine) => void, incremental = true) {
    const adapter = recordingAdapter({ incremental });
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    let done = false;
    engine.on('statechange', () => {
      if (done) return;
      done = true;
      changes(engine);
    });
    engine.setTrackVolume('A', 0.5);
    return { adapter, engine };
  }

  const sequences: Array<[string, (engine: PlaylistEngine) => void]> = [
    [
      'setTracks then addTrack',
      (e) => {
        e.setTracks([track('X', [])]);
        e.addTrack(track('Y', []));
      },
    ],
    [
      'an undo that changes the set, then addTrack',
      (e) => {
        e.removeTrack('B');
        e.undo();
        e.addTrack(track('Y', []));
      },
    ],
    [
      'addTrack then removeTrack of it',
      (e) => {
        e.addTrack(track('Y', []));
        e.removeTrack('Y');
      },
    ],
    [
      'updateTrack then removeTrack of it',
      (e) => {
        e.updateTrack('B', track('B', [clip('b9', 0)]));
        e.removeTrack('B');
      },
    ],
    [
      'addTrack then an edit of it then another addTrack',
      (e) => {
        e.addTrack(track('Y', [clip('y1', 0)]));
        e.moveClip('Y', 'y1', 1000);
        e.addTrack(track('Z', []));
      },
    ],
    [
      'addTrack, its undo, and addTrack again',
      (e) => {
        e.addTrack(track('Y', []));
        e.undo();
        e.addTrack(track('Y', []));
      },
    ],
    [
      'removeTrack, its undo, and removeTrack again',
      (e) => {
        e.removeTrack('B');
        e.undo();
        e.removeTrack('B');
      },
    ],
    [
      'removeTrack then addTrack of the same id',
      (e) => {
        e.removeTrack('B');
        e.addTrack(track('B', [clip('b2', 0)]));
      },
    ],
  ];

  it.each(sequences)(
    '%s: the adapter ends with the arrangement’s tracks and is never told about a track twice',
    (_, changes) => {
      const { adapter, engine } = fromInsideAListener(changes);
      const { held, faults } = replay(adapter);
      expect(faults).toEqual([]);
      expect(held).toEqual(
        engine
          .getState()
          .tracks.map((t) => t.id)
          .sort()
      );
    }
  );

  it.each(sequences)('%s: the same with an adapter that has setTracks only', (_, changes) => {
    const { adapter, engine } = fromInsideAListener(changes, false);
    expect(replay(adapter).held).toEqual(
      engine
        .getState()
        .tracks.map((t) => t.id)
        .sort()
    );
  });

  // Once the adapter has been sent every track, the changes from before that
  // moment are already in what it was sent: no second rebuild, no resend.
  it.each([
    [
      'two setTracks',
      (e: PlaylistEngine) => {
        e.setTracks([track('X', [])]);
        e.setTracks([track('Y', [])]);
      },
      ['Y'],
    ],
    [
      'setTracks then an edit',
      (e: PlaylistEngine) => {
        e.setTracks([track('X', [clip('x1', 0)])]);
        e.moveClip('X', 'x1', 1000);
      },
      ['X'],
    ],
    [
      'a track added and removed, then an edit and its undo',
      (e: PlaylistEngine) => {
        e.addTrack(track('Y', []));
        e.removeTrack('Y');
        e.moveClip('A', 'a1', 1000);
        e.undo();
      },
      ['A', 'B'],
    ],
  ] as const)(
    '%s: the adapter is sent every track once, and nothing after',
    (_, changes, expected) => {
      const { adapter } = fromInsideAListener(changes);
      const trackCalls = adapter.calls.filter((c) => c.method !== 'setTrackVolume');
      expect(trackCalls.map((c) => c.method)).toEqual(['setTracks', 'setTracks']);
      // The first is the fixture, from before the listener ran.
      expect((adapter.rawCalls[2].args[0] as ClipTrack[]).map((t) => t.id)).toEqual(expected);
    }
  );

  // Only a change that is followed by ANOTHER track change before it is
  // delivered costs a full send. One edit from inside a listener is still the
  // current state when it is delivered, and goes as the small update.
  const singleEdits: Array<[string, (engine: PlaylistEngine) => void, string[]]> = [
    ['a move', (e: PlaylistEngine) => void e.moveClip('B', 'b1', 500), ['updateTrack']],
    ['an addTrack', (e: PlaylistEngine) => e.addTrack(track('Y', [])), ['addTrack']],
    ['a removeTrack', (e: PlaylistEngine) => e.removeTrack('B'), ['removeTrack']],
    [
      'a move and a fader',
      (e: PlaylistEngine) => {
        e.moveClip('B', 'b1', 500);
        e.setTrackPan('B', 0.5);
      },
      ['updateTrack', 'setTrackPan'],
    ],
  ];

  it.each(singleEdits)(
    'one track edit from inside a listener (%s) is sent as itself, with no full send',
    (_, change, expected) => {
      const { adapter } = fromInsideAListener(change);
      // [setTracks (the fixture), setTrackVolume (the outer change), ...]
      expect(adapter.calls.slice(2).map((c) => c.method)).toEqual(expected);
    }
  );

  it('a full send that fails is not taken as done: the changes after it still reach the adapter', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    const setTracks = adapter.setTracks.bind(adapter);
    let failures = 1;
    adapter.setTracks = (tracks) => {
      if (failures-- > 0) throw new Error('boom');
      setTracks(tracks);
    };
    let done = false;
    engine.on('statechange', () => {
      if (done) return;
      done = true;
      engine.setTracks([track('X', [])]);
      engine.addTrack(track('Y', []));
    });
    expect(() => engine.setTrackVolume('A', 0.5)).toThrow('boom');
    expect(replay(adapter).held).toEqual(['X', 'Y']);
  });

  it('an engine built during a delivery is not told about changes from before it existed', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const late = recordingAdapter();
    let built = false;
    arrangement.subscribe(() => {
      if (built) return;
      built = true;
      arrangement.removeTrack('A');
      arrangement.removeTrack('B');
      arrangement.removeTrack('C');
      new PlaylistEngine({ adapter: late, arrangement, sampleRate: SAMPLE_RATE });
    });
    arrangement.addTrack(track('C', []));
    expect(arrangement.getTracks()).toEqual([]);
    expect(late.calls).toEqual([]);
  });

  it('each of those changes is still one statechange, in order', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    const versions: number[] = [];
    let done = false;
    engine.on('statechange', (state) => {
      versions.push(state.tracksVersion);
      if (done) return;
      done = true;
      engine.setTracks([track('X', [])]);
      engine.addTrack(track('Y', []));
    });
    const start = engine.getState().tracksVersion;
    engine.setTrackVolume('A', 0.5);
    // The state a listener is handed is the engine's state when it is told.
    expect(versions).toEqual([start, start + 2, start + 2]);
  });

  it('a change made in the ordinary way after such a sequence is forwarded as usual', () => {
    const { adapter, engine } = fromInsideAListener((e) => {
      e.setTracks([track('X', [clip('x1', 0)])]);
      e.addTrack(track('Y', []));
    });
    adapter.reset();
    engine.moveClip('X', 'x1', 1000);
    engine.addTrack(track('Z', []));
    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack', 'addTrack']);
  });
});

describe('skipAdapter when the arrangement call throws', () => {
  it('leaves no mark behind: the next change is sent to the adapter', () => {
    const adapter = recordingAdapter();
    let fail = false;
    adapter.secondsToTicks = (seconds: number) => {
      if (fail) throw new Error('tempo map broke');
      return Math.round(seconds * 1920);
    };
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    adapter.reset();

    fail = true;
    expect(() => engine.moveClip('A', 'a1', 1000, true)).toThrow('tempo map broke');
    fail = false;

    engine.moveClip('A', 'a1', 1000);
    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
  });
});

describe('mixer entries of tracks that are gone', () => {
  it('an entry is dropped when a new step clears the redo state that was the last to hold its track', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.addTrack(track('C', [], { volume: 0.2 }));
    arrangement.undo(); // only the redo stack holds C
    expect(arrangement.getMixer().has('C')).toBe(true);
    arrangement.moveClip('A', 'a1', 1000); // the redo stack is cleared
    expect(arrangement.getMixer().has('C')).toBe(false);
    arrangement.addTrack(track('C', [], { volume: 0.9 }));
    expect(arrangement.getMixer().get('C')?.volume).toBe(0.9);
  });

  it('an entry is dropped when the undo limit evicts the last step that held its track', () => {
    const arrangement = createArrangement({ tracks: fixture(), undoLimit: 2 });
    arrangement.setTrackVolume('B', 0.2);
    arrangement.removeTrack('B');
    expect(arrangement.getMixer().has('B')).toBe(true);
    arrangement.moveClip('A', 'a1', 100);
    expect(arrangement.getMixer().has('B')).toBe(true); // the removal is still undoable
    arrangement.moveClip('A', 'a1', 100);
    arrangement.moveClip('A', 'a1', 100);
    expect(arrangement.getMixer().has('B')).toBe(false);
  });

  it('a commit that evicts a step drops the entry too', () => {
    const arrangement = createArrangement({ tracks: fixture(), undoLimit: 1 });
    arrangement.removeTrack('B');
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 100);
    arrangement.commitTransaction();
    expect(arrangement.getMixer().has('B')).toBe(false);
  });

  it('an entry is dropped when an aborted transaction was the only thing that held its track', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.beginTransaction();
    arrangement.addTrack(track('C', [], { volume: 0.2 }));
    arrangement.abortTransaction();
    expect(arrangement.getMixer().has('C')).toBe(false);
    arrangement.addTrack(track('C', [], { volume: 0.9 }));
    expect(arrangement.getMixer().get('C')?.volume).toBe(0.9);
  });

  it('an entry is dropped when its track was added and removed inside one transaction', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.beginTransaction();
    arrangement.addTrack(track('C', [], { volume: 0.2 }));
    arrangement.removeTrack('C');
    arrangement.moveClip('A', 'a1', 100);
    arrangement.commitTransaction();
    expect(arrangement.getMixer().has('C')).toBe(false);
  });

  it('with no undo history at all (undoLimit 0), a removed track’s entry goes at once', () => {
    const arrangement = createArrangement({ tracks: fixture(), undoLimit: 0 });
    arrangement.removeTrack('B');
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.getMixer().has('B')).toBe(false);
  });

  it('setTracks keeps the mix of an id that is in the tracks it replaces, and of no other', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    arrangement.setTrackVolume('B', 0.2);
    arrangement.removeTrack('B'); // B is held by the undo history only
    arrangement.setTracks([track('A', [], { volume: 1 }), track('B', [], { volume: 0.9 })]);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.3);
    expect(arrangement.getMixer().get('B')?.volume).toBe(0.9);
  });

  it('a setter for a removed track changes nothing, although its entry is kept for an undo', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('B', 0.2);
    arrangement.removeTrack('B');
    const mixer = arrangement.getMixer();
    const version = arrangement.mixerVersion;
    const listener = vi.fn();
    arrangement.subscribe(listener);

    arrangement.setTrackVolume('B', 0.9);

    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.mixerVersion).toBe(version);
    expect(listener).not.toHaveBeenCalled();
    arrangement.undo();
    expect(arrangement.getMixer().get('B')?.volume).toBe(0.2);
  });

  it('through the engine: a setter for a removed track still reaches the adapter, with no statechange', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.removeTrack('B');
    adapter.reset();
    const listener = vi.fn();
    engine.on('statechange', listener);
    engine.setTrackMute('B', true);
    expect(adapter.calls).toEqual([{ method: 'setTrackMute', args: ['B', true] }]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('a track that is given a new id', () => {
  it('takes its current mix with it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    arrangement.setTrackPan('A', -0.5);
    arrangement.updateTrack('A', (current) => ({ ...current, id: 'Z' }));
    expect(ids(arrangement)).toEqual(['Z', 'B']);
    expect(arrangement.getMixer().get('Z')).toEqual({
      volume: 0.3,
      muted: false,
      soloed: false,
      pan: -0.5,
    });
  });

  it('takes its current mix with it when a track object is given, whatever that object’s fields say', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    arrangement.updateTrack('A', track('Z', [], { volume: 1 }));
    expect(arrangement.getMixer().get('Z')?.volume).toBe(0.3);
  });

  it('takes its mix with it also to an id whose removed track still has an entry', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    arrangement.setTrackVolume('B', 0.2);
    arrangement.removeTrack('B'); // B's entry is kept for an undo
    arrangement.updateTrack('A', (current) => ({ ...current, id: 'B' }));
    expect(arrangement.getMixer().get('B')?.volume).toBe(0.3);
  });

  it('undoing the change gives the old id its mix back', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.setTrackVolume('A', 0.3);
    arrangement.updateTrack('A', (current) => ({ ...current, id: 'Z' }));
    arrangement.undo();
    expect(ids(arrangement)).toEqual(['A', 'B']);
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.3);
  });

  it('through the engine: the selected track id is cleared when it named the old id', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.selectTrack('A');
    engine.updateTrack('A', track('Z', []));
    expect(engine.getState().selectedTrackId).toBeNull();
  });

  it('through the engine: setTracks leaves the selected track id alone, as it always has', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.selectTrack('A');
    // A host empties the tracks and adds them again (the React provider does): the selection stays.
    engine.setTracks([]);
    expect(engine.getState().selectedTrackId).toBe('A');
    engine.addTrack(track('C', []));
    engine.setTempo(90);
    expect(engine.getState().selectedTrackId).toBe('A');
  });

  it('through the engine: the selected track id stays for an ordinary update', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.selectTrack('A');
    engine.updateTrack('A', track('A', []));
    expect(engine.getState().selectedTrackId).toBe('A');
  });
});

describe('a transaction that ends where it began', () => {
  it('adds no step: a track added and then removed for good inside it', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.beginTransaction();
    arrangement.addTrack(track('C', []));
    arrangement.removeTrack('C', { undoable: false });
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(false);
  });

  it('still adds a step when the tracks are in another order', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.beginTransaction();
    arrangement.reorderTrack('A', 1);
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(true);
  });
});

describe('an engine with another tick resolution (ppqn) takes over', () => {
  const tickOf = (arrangement: Arrangement, trackId: string, clipId: string) =>
    arrangement
      .getTracks()
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId)?.startTick;
  const sampleOf = (arrangement: Arrangement, trackId: string, clipId: string) =>
    arrangement
      .getTracks()
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId)?.startSample;
  const engineAt = (arrangement: Arrangement, ppqn: number) =>
    new PlaylistEngine({ arrangement, sampleRate: SAMPLE_RATE, bpm: 120, ppqn });

  it('the ticks are converted, so a tempo change puts no clip somewhere else', () => {
    const arrangement = createArrangement({ tracks: fixture() }); // a2 at 2 s
    engineAt(arrangement, 192).dispose();
    expect(tickOf(arrangement, 'A', 'a2')).toBe(768);

    const second = engineAt(arrangement, 960);
    expect(tickOf(arrangement, 'A', 'a2')).toBe(3840);
    expect(sampleOf(arrangement, 'A', 'a2')).toBe(96000);

    second.setTempo(121);
    second.setTempo(120);
    expect(sampleOf(arrangement, 'A', 'a2')).toBe(96000);

    second.setTempo(60); // half the tempo: twice as late
    expect(sampleOf(arrangement, 'A', 'a2')).toBe(192000);
  });

  it('the undo and redo states are converted too', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const first = engineAt(arrangement, 192);
    first.moveClip('A', 'a2', 48000); // undo state: a2 at 2 s
    first.moveClip('B', 'b1', 48000);
    first.undo(); // redo state: b1 at 1 s
    first.dispose();

    const second = engineAt(arrangement, 960);
    second.redo();
    expect(tickOf(arrangement, 'B', 'b1')).toBe(1920);
    second.undo();
    second.undo();
    expect(tickOf(arrangement, 'A', 'a2')).toBe(3840);
    second.setTempo(60);
    expect(sampleOf(arrangement, 'A', 'a2')).toBe(192000);
  });

  it('an open transaction’s base is converted too', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    const first = engineAt(arrangement, 192);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a2', 48000);
    first.dispose();
    engineAt(arrangement, 960);
    arrangement.abortTransaction();
    expect(tickOf(arrangement, 'A', 'a2')).toBe(3840);
  });

  it('states go on sharing the tracks they shared', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 48000)])],
    });
    const first = engineAt(arrangement, 192);
    first.moveClip('A', 'a2', 48000);
    first.dispose();
    const before = arrangement.getTracks()[1];
    engineAt(arrangement, 960);
    const trackB = arrangement.getTracks()[1];
    expect(trackB).not.toBe(before); // its tick was converted
    arrangement.undo();
    expect(arrangement.getTracks()[1]).toBe(trackB); // one object in both states, as before
  });

  it('tracks whose ticks come out the same are left as they are, and nobody is told', () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] }); // tick 0
    engineAt(arrangement, 192).dispose();
    const tracks = arrangement.getTracks();
    const listener = vi.fn();
    arrangement.subscribe(listener);
    engineAt(arrangement, 960);
    expect(arrangement.getTracks()).toBe(tracks);
    expect(listener).not.toHaveBeenCalled();
  });

  it('clips without a tick get one in the undo states too, not only in the current tracks', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    arrangement.moveClip('A', 'a2', 48000); // no engine: the undo state holds a2 at 2 s, no tick
    const second = engineAt(arrangement, 960);
    second.undo();
    expect(tickOf(arrangement, 'A', 'a2')).toBe(3840);
    second.setTempo(60);
    expect(sampleOf(arrangement, 'A', 'a2')).toBe(192000);
  });

  it('subscribers are told once, and it is not an undo step', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    engineAt(arrangement, 192).dispose();
    const listener = vi.fn();
    arrangement.subscribe(listener);
    const version = arrangement.tracksVersion;
    engineAt(arrangement, 960);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(arrangement.tracksVersion).toBe(version + 1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('an engine with the same ppqn changes nothing', () => {
    const arrangement = createArrangement({ tracks: fixture() });
    engineAt(arrangement, 960).dispose();
    const tracks = arrangement.getTracks();
    const listener = vi.fn();
    arrangement.subscribe(listener);
    engineAt(arrangement, 960);
    expect(arrangement.getTracks()).toBe(tracks);
    expect(listener).not.toHaveBeenCalled();
  });

  it('going to a coarser resolution rounds to its nearest tick', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [{ ...clip('a1', 0), startTick: 7 }])],
    });
    engineAt(arrangement, 960).dispose();
    engineAt(arrangement, 192).dispose(); // 7 / 5 = 1.4
    expect(tickOf(arrangement, 'A', 'a1')).toBe(1);
    engineAt(arrangement, 960); // and back: 5, not 7
    expect(tickOf(arrangement, 'A', 'a1')).toBe(5);
  });

  it('a tick a clip came with before any engine is read in the first engine’s ppqn', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [{ ...clip('a1', 48000), startTick: 384 }])],
    });
    engineAt(arrangement, 192).dispose();
    expect(tickOf(arrangement, 'A', 'a1')).toBe(384);
    engineAt(arrangement, 960);
    expect(tickOf(arrangement, 'A', 'a1')).toBe(1920);
  });
});

describe('isDevelopmentBuild', () => {
  it('is true under the test runner', () => {
    expect(isDevelopmentBuild()).toBe(true);
  });

  it('is false, and does not throw, where there is no `process` at all', () => {
    vi.stubGlobal('process', undefined);
    expect(isDevelopmentBuild()).toBe(false);
  });
});

describe('a disposed engine', () => {
  it('does not ask its adapter for a tempo change', () => {
    const adapter = recordingAdapter({ setTempoResult: true });
    const arrangement = createArrangement({ tracks: fixture() });
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
    engine.dispose();
    adapter.reset();
    engine.setTempo(90);
    engine.moveClip('A', 'a1', 1000, true);
    expect(adapter.calls).toEqual([]);
    expect(engine.getState().bpm).toBe(120);
  });
});
