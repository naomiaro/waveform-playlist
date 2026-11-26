/**
 * Attaching to an arrangement (#812, part 4): a context to decode with, and
 * an engine's time base. Both go through versioned `Symbol.for` keys, so an
 * arrangement made by one copy of this package can be played by an engine of
 * another copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack, isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipSource, LoadingClip } from '@waveform-playlist/core';
import { PlaylistEngine, attachDecodeContext, createArrangement } from '../index';
import type { Arrangement, LoadSource } from '../index';
import { ARRANGEMENT_ATTACH_DECODE, ARRANGEMENT_ATTACH_TIME_BASE } from '../arrangement/attach';
import { recordingAdapter } from './helpers/recordingAdapter';

const RATE = 48000;
const SECOND = RATE;

const fakeBuffer = (seconds = 4): AudioBuffer =>
  ({
    sampleRate: RATE,
    length: seconds * RATE,
    duration: seconds,
    numberOfChannels: 1,
  }) as AudioBuffer;

function clip(id: string, startSample: number): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: SECOND,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 4 * SECOND,
    }),
    id,
  };
}
const loading = (id: string, src: ClipSource, start = 0): LoadingClip => ({
  id,
  src,
  start,
  duration: 1,
});
const track = (id: string, clips: ArrangementTrack['clips']): ArrangementTrack => ({
  ...createTrack({ name: id, clips: [] }),
  id,
  clips,
});

interface PendingLoad {
  src: ClipSource;
  signal: AbortSignal;
  audioContext: BaseAudioContext;
  resolve(buffer: AudioBuffer): void;
}
function fakeLoads() {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src, { signal, audioContext }) =>
    new Promise<AudioBuffer>((resolve) => {
      calls.push({ src, signal, audioContext, resolve });
    });
  return { calls, loadSource, of: (src: ClipSource) => calls.filter((c) => c.src === src) };
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const context = (name: string) => ({ name }) as unknown as BaseAudioContext;
const statusOf = (arrangement: Arrangement, src: ClipSource) =>
  arrangement.sources.getSnapshot().sources.get(src)?.status;
const clipOf = (arrangement: Arrangement, trackId: string, clipId: string) =>
  arrangement
    .getTracks()
    .find((t) => t.id === trackId)
    ?.clips.find((c) => c.id === clipId);
const isLoaded = (c: AudioClip | LoadingClip | undefined) => c !== undefined && !isLoadingClip(c);

const twoSources = () => [
  track('A', [loading('L1', 'a.opus'), clip('a1', 2 * SECOND)]),
  track('B', [loading('L2', 'b.opus')]),
];

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('attachDecodeContext', () => {
  it('starts the loads that were waiting, with the context it was given', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    await flush();
    expect(loads.calls).toEqual([]);

    const ctx = context('one');
    const getContext = vi.fn(async () => ctx);
    attachDecodeContext(arrangement, getContext);
    await flush();
    expect(loads.calls.map((c) => c.src)).toEqual(['a.opus', 'b.opus']);
    expect(loads.calls.map((c) => c.audioContext)).toEqual([ctx, ctx]);
  });

  it('detach aborts the loads in flight, keeps what is loaded, and the sources stay pending', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'A', 'L1'))).toBe(true);

    detach();
    expect(loads.of('b.opus')[0].signal.aborted).toBe(true);
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');
    expect(statusOf(arrangement, 'b.opus')).toBe('pending');
    expect(isLoaded(clipOf(arrangement, 'A', 'L1'))).toBe(true);

    // What the aborted load delivers late is ignored.
    loads.of('b.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'B', 'L2'))).toBe(false);
    expect(statusOf(arrangement, 'b.opus')).toBe('pending');
  });

  it('a source named while nothing is attached waits, and nothing is fetched', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    detach();
    arrangement.addTrack(track('C', [loading('L3', 'c.opus')]));
    await flush();
    expect(loads.of('c.opus')).toEqual([]);
    expect(statusOf(arrangement, 'c.opus')).toBe('pending');
  });

  it('attaching again starts the aborted loads once, with the new context, and not the loaded ones', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();
    detach();

    const second = context('two');
    attachDecodeContext(arrangement, async () => second);
    await flush();
    expect(loads.of('a.opus')).toHaveLength(1);
    expect(loads.of('b.opus')).toHaveLength(2);
    expect(loads.of('b.opus')[1].audioContext).toBe(second);
    expect(loads.of('b.opus')[1].signal.aborted).toBe(false);

    loads.of('b.opus')[1].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'B', 'L2'))).toBe(true);
  });

  it('a source that was dropped before any context was attached is never fetched', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    await flush();
    arrangement.removeTrack('B', { undoable: false });
    const getContext = vi.fn(async () => context('one'));
    attachDecodeContext(arrangement, getContext);
    await flush();
    expect(loads.calls.map((c) => c.src)).toEqual(['a.opus']);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('a detach before the context has arrived: nothing is fetched', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    detach();
    await flush();
    expect(loads.calls).toEqual([]);
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');
  });

  it('a detach while the context is still being fetched: nothing is loaded with it', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    let deliver: (ctx: BaseAudioContext) => void = () => {};
    const slow = new Promise<BaseAudioContext>((resolve) => {
      deliver = resolve;
    });
    const detach = attachDecodeContext(arrangement, () => slow);
    await flush();
    detach();
    deliver(context('late'));
    await flush();
    expect(loads.calls).toEqual([]);
  });

  it('a detach called twice, or after another attach, does nothing', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    detach();
    attachDecodeContext(arrangement, async () => context('two'));
    await flush();
    detach();
    expect(loads.of('b.opus')[1].signal.aborted).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a second attach while one is attached warns and replaces it', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const detachFirst = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    expect(warn).not.toHaveBeenCalled();

    const second = context('two');
    attachDecodeContext(arrangement, async () => second);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(
      /\[waveform-playlist\] An arrangement decodes with one audio context at a time/
    );
    // The loads in flight go on; a source named from now on uses the second context.
    expect(loads.calls.every((c) => !c.signal.aborted)).toBe(true);
    arrangement.addTrack(track('C', [loading('L3', 'c.opus')]));
    await flush();
    expect(loads.of('c.opus')[0].audioContext).toBe(second);

    // The first attach's detach no longer has anything to take away.
    detachFirst();
    expect(loads.of('c.opus')[0].signal.aborted).toBe(false);
  });

  it('a context that cannot be had fails the source with that error; retry asks again', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'a.opus')])],
      loadSource: loads.loadSource,
    });
    const refused = new Error('The AudioContext could not be started');
    const getContext = vi
      .fn<() => Promise<BaseAudioContext>>()
      .mockRejectedValueOnce(refused)
      .mockResolvedValue(context('one'));
    attachDecodeContext(arrangement, getContext);
    await flush();
    expect(arrangement.sources.getSnapshot().sources.get('a.opus')).toEqual({
      status: 'failed',
      error: refused,
    });
    expect(loads.calls).toEqual([]);

    arrangement.retry('a.opus');
    await flush();
    expect(loads.calls).toHaveLength(1);
  });

  it('refuses something that is not an arrangement', () => {
    const refusal =
      /\[waveform-playlist\] attachDecodeContext: the first argument must be an arrangement made by createArrangement\(\)/;
    const getContext = async () => context('one');
    for (const notOne of [{}, null, undefined, 'arrangement', 7]) {
      expect(() => attachDecodeContext(notOne as unknown as Arrangement, getContext)).toThrow(
        refusal
      );
    }
  });
});

describe("an engine attaches its adapter's audio context", () => {
  const setup = (options: { attachDecodeContext?: boolean; adapter?: boolean } = {}) => {
    const loads = fakeLoads();
    const arrangement = createArrangement({ tracks: twoSources(), loadSource: loads.loadSource });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({
      adapter: options.adapter === false ? undefined : adapter,
      arrangement,
      sampleRate: RATE,
      attachDecodeContext: options.attachDecodeContext,
    });
    return { loads, arrangement, adapter, engine };
  };

  it('by default: the sources load with it, and the loaded clips reach the adapter', async () => {
    const { loads, arrangement, adapter, engine } = setup();
    await flush();
    expect(loads.calls.map((c) => c.src)).toEqual(['a.opus', 'b.opus']);
    expect(loads.calls[0].audioContext).toBe(adapter.audioContext);
    expect(warn).not.toHaveBeenCalled();

    adapter.reset();
    loads.of('b.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'B', 'L2'))).toBe(true);
    expect(adapter.calls).toEqual([
      { method: 'updateTrack', args: ['B', { id: 'B', clips: ['L2'] }] },
    ]);
    engine.dispose();
  });

  it('dispose detaches: the loads in flight are aborted, and the next engine starts them again', async () => {
    const { loads, arrangement, engine } = setup();
    await flush();
    engine.dispose();
    expect(loads.calls.every((c) => c.signal.aborted)).toBe(true);
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');

    const next = new PlaylistEngine({
      adapter: recordingAdapter(),
      arrangement,
      sampleRate: RATE,
    });
    await flush();
    expect(loads.of('a.opus')).toHaveLength(2);
    expect(loads.of('b.opus')).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled();
    next.dispose();
  });

  it('with attachDecodeContext: false it attaches nothing', async () => {
    const { loads, arrangement, engine } = setup({ attachDecodeContext: false });
    await flush();
    expect(loads.calls).toEqual([]);

    // Whoever owns the context attaches it; the engine's dispose leaves it alone.
    attachDecodeContext(arrangement, async () => context('mine'));
    await flush();
    engine.dispose();
    expect(loads.calls).toHaveLength(2);
    expect(loads.calls.every((c) => !c.signal.aborted)).toBe(true);
  });

  it('an engine without an adapter has no context to attach', async () => {
    const { loads, arrangement, engine } = setup({ adapter: false });
    await flush();
    expect(loads.calls).toEqual([]);
    // Waiting, not failed.
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');
    engine.dispose();
  });

  it('an engine whose constructor fails leaves no context attached', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'a.opus'), clip('a1', 0)])],
      loadSource: loads.loadSource,
    });
    const bad = recordingAdapter();
    bad.setTracks = () => {
      throw new Error('adapter refuses');
    };
    expect(() => new PlaylistEngine({ adapter: bad, arrangement, sampleRate: RATE })).toThrow(
      'adapter refuses'
    );
    await flush();
    expect(loads.calls).toEqual([]);
  });
});

describe('an arrangement made by another copy of the package', () => {
  // An app whose own engine version differs from the one a library pins has
  // two copies installed: `instanceof` is false across them.
  const secondCopy = async () => {
    vi.resetModules();
    return (await import('../index')) as typeof import('../index');
  };

  it("is played by this copy's engine: time base, adapter calls, edits and undo", async () => {
    const other = await secondCopy();
    expect(other.createArrangement).not.toBe(createArrangement);
    const arrangement = other.createArrangement({
      tracks: [track('A', [clip('a1', SECOND)])],
    });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: RATE });

    // The time base arrived: the clip has its tick (1 s at 120 bpm is two beats).
    expect((clipOf(arrangement, 'A', 'a1') as AudioClip).startTick).toBe(
      2 * engine.getState().ppqn
    );
    expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks']);

    adapter.reset();
    expect(engine.moveClip('A', 'a1', SECOND)).toBe(SECOND);
    engine.setTrackVolume('A', 0.5);
    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack', 'setTrackVolume']);
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(2 * SECOND);
    expect(engine.getState().tracks[0].volume).toBe(0.5);
    // Rule (#843): the fader move is an undo step of its own, so the first
    // undo takes it back and the second the move; before, one undo took back
    // the move and the volume stayed.
    engine.undo();
    expect(engine.getState().tracks[0].volume).toBe(1);
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(2 * SECOND);
    engine.undo();
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(SECOND);
    engine.dispose();
  });

  it("is given a decode context by this copy's helper and by this copy's engine", async () => {
    const other = await secondCopy();
    const loads = fakeLoads();
    const arrangement = other.createArrangement({
      tracks: [track('A', [loading('L', 'a.opus')])],
      loadSource: loads.loadSource,
    });
    const detach = attachDecodeContext(arrangement, async () => context('one'));
    await flush();
    expect(loads.calls).toHaveLength(1);
    detach();

    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: RATE });
    await flush();
    expect(loads.calls).toHaveLength(2);
    expect(loads.calls[1].audioContext).toBe(adapter.audioContext);
    loads.calls[1].resolve(fakeBuffer());
    await flush();
    expect(engine.getState().tracks[0].clips.map((c) => c.id)).toEqual(['L']);
    engine.dispose();
  });

  // #843 moved the keys to v2 (the history holds the mix, the setters take
  // options, the take's mute); #848 to v3 (addTrack takes an index), so the
  // interface reached by name changed again.
  it('the key strings end in /v3', () => {
    expect(ARRANGEMENT_ATTACH_DECODE.description).toBe(
      '@waveform-playlist/engine/arrangement/attach-decode/v3'
    );
    expect(ARRANGEMENT_ATTACH_TIME_BASE.description).toBe(
      '@waveform-playlist/engine/arrangement/time-base/v3'
    );
  });

  it('an arrangement of the v2 keys is refused by the engine', () => {
    const v2 = {
      [Symbol.for('@waveform-playlist/engine/arrangement/time-base/v2')]: () => () => {},
      [Symbol.for('@waveform-playlist/engine/arrangement/attach-decode/v2')]: () => () => {},
    };
    expect(() => new PlaylistEngine({ arrangement: v2 as unknown as Arrangement })).toThrow(
      /the `arrangement` option must be an arrangement made by createArrangement\(\)/
    );
  });

  it('an arrangement of the earlier version (v1 keys) is refused by the engine', () => {
    const v1 = {
      [Symbol.for('@waveform-playlist/engine/arrangement/time-base/v1')]: () => () => {},
      [Symbol.for('@waveform-playlist/engine/arrangement/attach-decode/v1')]: () => () => {},
    };
    expect(() => new PlaylistEngine({ arrangement: v1 as unknown as Arrangement })).toThrow(
      /the `arrangement` option must be an arrangement made by createArrangement\(\)/
    );
  });

  it('an object that is not an arrangement is still refused by the engine', () => {
    const lookalike = { getTracks: () => [], subscribe: () => () => {} };
    expect(() => new PlaylistEngine({ arrangement: lookalike as unknown as Arrangement })).toThrow(
      /the `arrangement` option must be an arrangement made by createArrangement\(\)/
    );
  });
});
