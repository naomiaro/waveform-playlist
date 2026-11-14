/**
 * The arrangement loads the audio its clips name and switches each loading
 * clip to a loaded one when the audio arrives, in the current tracks and in
 * every state it can return to (#812, part 4).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack, isLoadingClip } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  ClipTrack,
  LoadingClip,
} from '@waveform-playlist/core';
import { PlaylistEngine, attachDecodeContext, createArrangement } from '../index';
import type { Arrangement, ArrangementSourcesValue, LoadSource } from '../index';
import { recordingAdapter } from './helpers/recordingAdapter';

const counts = vi.hoisted(() => ({ setWanted: 0, provide: 0 }));
vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return {
    ...actual,
    // The real loader, with its two write methods counted.
    createSourceLoader: (options: Parameters<typeof actual.createSourceLoader>[0]) => {
      const loader = actual.createSourceLoader(options);
      return {
        ...loader,
        setWanted: (keys: Iterable<unknown>) => {
          counts.setWanted++;
          loader.setWanted(keys);
        },
        provide: (key: unknown, value: unknown) => {
          counts.provide++;
          loader.provide(key, value);
        },
      };
    },
  };
});

const RATE = 48000;
const SECOND = RATE;

const fakeBuffer = (seconds = 4, sampleRate = RATE): AudioBuffer =>
  ({
    sampleRate,
    length: seconds * sampleRate,
    duration: seconds,
    numberOfChannels: 1,
  }) as AudioBuffer;

function clip(id: string, startSample: number, extra: Partial<AudioClip> = {}): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: SECOND,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 4 * SECOND,
    }),
    ...extra,
    id,
  };
}

function loading(id: string, src: ClipSource, start = 0, extra: Partial<LoadingClip> = {}) {
  return { id, src, start, duration: 1, ...extra } as LoadingClip;
}

function track(id: string, clips: ArrangementTrack['clips']) {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

interface PendingLoad {
  src: ClipSource;
  signal: AbortSignal;
  resolve(buffer: AudioBuffer): void;
  reject(error: unknown): void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function fakeLoads() {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src, { signal }) =>
    new Promise<AudioBuffer>((resolve, reject) => {
      calls.push({ src, signal, resolve, reject });
    });
  const of = (src: ClipSource) => calls.filter((call) => call.src === src);
  return { calls, loadSource, of };
}

/** Let promise callbacks run: a load starts, or a settled load is applied. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const CONTEXT = { fake: 'decode context' } as unknown as BaseAudioContext;
/** Give the arrangement a context to decode with, as a host or an engine does. */
const attach = (arrangement: Arrangement) => attachDecodeContext(arrangement, async () => CONTEXT);

async function setup(tracks: ArrangementTrack[], options: { attached?: boolean } = {}) {
  const loads = fakeLoads();
  const arrangement = createArrangement({ tracks, loadSource: loads.loadSource });
  if (options.attached !== false) attach(arrangement);
  await flush();
  return { arrangement, loads };
}

const clipsOf = (arrangement: Arrangement, trackId: string) =>
  arrangement.getTracks().find((t) => t.id === trackId)?.clips ?? [];
const clipOf = (arrangement: Arrangement, trackId: string, clipId: string) =>
  clipsOf(arrangement, trackId).find((c) => c.id === clipId);
const statusOf = (arrangement: Arrangement, src: ClipSource) =>
  arrangement.sources.getSnapshot().sources.get(src)?.status;
const isLoaded = (c: AudioClip | LoadingClip | undefined): c is AudioClip =>
  c !== undefined && !isLoadingClip(c);

beforeEach(() => {
  counts.setWanted = 0;
  counts.provide = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('which sources are loaded', () => {
  it('each source the current tracks name, once, with the signal and the decode context', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L1', 'a.opus'), loading('L2', 'a.opus', 2)]),
      track('B', [loading('L3', 'b.opus'), clip('b1', 2 * SECOND)]),
    ]);
    expect(loads.calls.map((call) => call.src)).toEqual(['a.opus', 'b.opus']);
    expect(loads.calls[0].signal.aborted).toBe(false);

    const value = arrangement.sources.getSnapshot();
    expect([...value.sources]).toEqual([
      ['a.opus', { status: 'pending' }],
      ['b.opus', { status: 'pending' }],
    ]);
    expect(value).toMatchObject({ pendingCount: 2, failedCount: 0, isLoading: true });
  });

  it('the decode context is the one that was attached', async () => {
    const seen: unknown[] = [];
    const loadSource: LoadSource = (_src, { audioContext }) => {
      seen.push(audioContext);
      return new Promise(() => {});
    };
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'a.opus')])],
      loadSource,
    });
    attach(arrangement);
    await flush();
    expect(seen).toEqual([CONTEXT]);
  });

  it('nothing is fetched before a decode context is attached; the sources are pending meanwhile', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])], {
      attached: false,
    });
    expect(loads.calls).toEqual([]);
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');

    attach(arrangement);
    await flush();
    expect(loads.calls.map((call) => call.src)).toEqual(['a.opus']);
  });

  it('a track removed with a pending clip keeps its load while an undo step names it; clearHistory aborts it', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus')]),
      track('B', [clip('b1', 0)]),
    ]);
    arrangement.removeTrack('A');
    expect(loads.calls[0].signal.aborted).toBe(false);
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');

    arrangement.clearHistory();
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(arrangement.sources.getSnapshot().sources.has('a.opus')).toBe(false);
    expect(arrangement.sources.getSnapshot().isLoading).toBe(false);
  });

  it('the base of an open transaction names its sources too', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    arrangement.beginTransaction();
    arrangement.removeTrack('A');
    expect(loads.calls[0].signal.aborted).toBe(false);

    // Committed: the step holds it now.
    arrangement.commitTransaction();
    expect(loads.calls[0].signal.aborted).toBe(false);
    arrangement.clearHistory();
    expect(loads.calls[0].signal.aborted).toBe(true);
  });

  it('a redo step names its sources; the edit that clears the redo stack lets go of them', async () => {
    const { arrangement, loads } = await setup([track('B', [clip('b1', 0)])]);
    arrangement.addTrack(track('A', [loading('L', 'a.opus')]));
    await flush();
    arrangement.undo();
    expect(clipsOf(arrangement, 'A')).toEqual([]);
    expect(loads.calls[0].signal.aborted).toBe(false);

    arrangement.moveClip('B', 'b1', SECOND);
    arrangement.clearHistory();
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(loads.calls).toHaveLength(1);
  });

  it('one source replaced by another: the first is aborted and the second fetched', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    arrangement.setTracks([track('A', [loading('L', 'b.opus')])]);
    await flush();
    expect(loads.calls.map((call) => call.src)).toEqual(['a.opus', 'b.opus']);
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect([...arrangement.sources.getSnapshot().sources.keys()]).toEqual(['b.opus']);
  });

  it('the wanted set is declared again only when it changed', async () => {
    const { arrangement } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
      track('B', [clip('b1', 0)]),
    ]);
    expect(counts.setWanted).toBeGreaterThan(0);
    counts.setWanted = 0;

    arrangement.setTrackVolume('A', 0.5);
    arrangement.setTrackMute('B', true);
    arrangement.setTrackSolo('A', true);
    arrangement.setTrackPan('B', -1);
    arrangement.moveClip('A', 'a1', SECOND);
    arrangement.trimClip('A', 'a1', 'right', -1000);
    arrangement.splitClip('B', 'b1', SECOND / 2);
    arrangement.reorderTrack('A', 1);
    arrangement.undo();
    arrangement.redo();
    expect(counts.setWanted).toBe(0);

    // The control: a new source is a declaration.
    arrangement.addTrack(track('C', [loading('L9', 'c.opus')]));
    expect(counts.setWanted).toBe(1);
  });
});

describe('a clip that already carries its audio', () => {
  it('is not fetched, and a loading clip of that source added later is loaded in the same call', async () => {
    const buffer = fakeBuffer();
    const { arrangement, loads } = await setup([
      track('A', [clip('a1', 0, { src: 'a.opus', audioBuffer: buffer })]),
    ]);
    const told = vi.fn();
    arrangement.subscribe(told);

    arrangement.addTrack(track('B', [loading('L', 'a.opus', 1)]));
    const added = clipOf(arrangement, 'B', 'L');
    expect(isLoaded(added)).toBe(true);
    expect((added as AudioClip).audioBuffer).toBe(buffer);
    expect((added as AudioClip).startSample).toBe(SECOND);
    // One notification, for the addTrack; the clip was loaded when it was sent.
    expect(told).toHaveBeenCalledTimes(1);
    await flush();
    expect(loads.calls).toEqual([]);
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');
    expect(arrangement.sources.getSnapshot().isLoading).toBe(false);
  });

  it('in the same setTracks as a loading clip of its source', async () => {
    const buffer = fakeBuffer();
    const { arrangement, loads } = await setup([
      track('A', [
        clip('a1', 0, { src: 'a.opus', audioBuffer: buffer }),
        loading('L', 'a.opus', 2),
      ]),
    ]);
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    expect(loads.calls).toEqual([]);
  });

  it('ends a load of that source that is in flight', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    expect(loads.calls).toHaveLength(1);
    const told = vi.fn();
    arrangement.subscribe(told);
    const version = arrangement.tracksVersion;
    arrangement.addTrack(track('B', [clip('b1', 0, { src: 'a.opus', audioBuffer: fakeBuffer() })]));
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    // One change, one notification: the addTrack, with the clip loaded in it.
    expect(told).toHaveBeenCalledTimes(1);
    expect(arrangement.tracksVersion).toBe(version + 1);
  });

  it('a loaded clip with a source and no audio (peaks first) is not fetched by the arrangement', async () => {
    const { arrangement, loads } = await setup([track('A', [clip('a1', 0, { src: 'a.opus' })])]);
    expect(loads.calls).toEqual([]);
    expect(arrangement.sources.getSnapshot().sources.size).toBe(0);
  });
});

describe('the switch: audio arrives', () => {
  it('replaces the loading clip in the current tracks: same id, samples at the buffer rate, one notification, no undo step', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus', 1.5, { duration: 2, offset: 0.5, name: 'Kick' })]),
      track('B', [clip('b1', 0)]),
    ]);
    const untouched = arrangement.getTracks()[1];
    const version = arrangement.tracksVersion;
    const told = vi.fn();
    arrangement.subscribe(told);

    const buffer = fakeBuffer(10, 44100);
    loads.calls[0].resolve(buffer);
    await flush();

    const loaded = clipOf(arrangement, 'A', 'L') as AudioClip;
    expect(isLoaded(loaded)).toBe(true);
    expect(loaded).toMatchObject({
      id: 'L',
      name: 'Kick',
      src: 'a.opus',
      sampleRate: 44100,
      startSample: 66150,
      offsetSamples: 22050,
      durationSamples: 88200,
    });
    expect(loaded.audioBuffer).toBe(buffer);
    expect(told).toHaveBeenCalledTimes(1);
    expect(arrangement.tracksVersion).toBe(version + 1);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.getTracks()[1]).toBe(untouched);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');
    expect(arrangement.sources.getSnapshot()).toMatchObject({ pendingCount: 0, isLoading: false });
  });

  it('every clip that names the source, on every track, in one notification', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L1', 'a.opus'), loading('L2', 'a.opus', 2), loading('M', 'b.opus', 3)]),
      track('B', [loading('L3', 'a.opus')]),
    ]);
    const told = vi.fn();
    arrangement.subscribe(told);
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();

    expect(isLoaded(clipOf(arrangement, 'A', 'L1'))).toBe(true);
    expect(isLoaded(clipOf(arrangement, 'A', 'L2'))).toBe(true);
    expect(isLoaded(clipOf(arrangement, 'B', 'L3'))).toBe(true);
    // The clip of the other source is still loading, in its place.
    expect(isLoaded(clipOf(arrangement, 'A', 'M'))).toBe(false);
    expect(clipsOf(arrangement, 'A').map((c) => c.id)).toEqual(['L1', 'L2', 'M']);
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('with an engine attached the loaded clip has its tick', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus', 1)])]);
    const engine = new PlaylistEngine({ arrangement, sampleRate: RATE });
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    // 1 s at 120 bpm is two beats.
    expect((clipOf(arrangement, 'A', 'L') as AudioClip).startTick).toBe(2 * engine.getState().ppqn);
    engine.dispose();
  });

  it('a subscriber of `sources` that is told "loaded" finds the clip loaded', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    const seen: boolean[] = [];
    arrangement.sources.subscribe((value: ArrangementSourcesValue) => {
      if (value.sources.get('a.opus')?.status === 'loaded') {
        seen.push(isLoaded(clipOf(arrangement, 'A', 'L')));
      }
    });
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    expect(seen).toEqual([true]);
  });
});

describe('the switch reaches every state the arrangement can return to', () => {
  it('undo and redo states: the loaded clip is wherever its loading clip was, and shared tracks stay shared', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
      track('B', [clip('b1', 0)]),
    ]);
    arrangement.moveClip('B', 'b1', SECOND); // step 1: A is shared with the current state
    arrangement.moveClip('B', 'b1', SECOND); // step 2
    arrangement.undo(); // one undo state, one redo state, the current one: A in all three

    loads.calls[0].resolve(fakeBuffer());
    await flush();

    const now = arrangement.getTracks()[0];
    const loadedNow = now.clips[0];
    expect(isLoaded(loadedNow)).toBe(true);

    arrangement.undo();
    expect(arrangement.getTracks()[0]).toBe(now);
    arrangement.redo();
    arrangement.redo();
    expect(arrangement.getTracks()[0]).toBe(now);
    expect(arrangement.getTracks()[0].clips[0]).toBe(loadedNow);
  });

  it('an arrival, then abortTransaction: the base it returns to has the loaded clip', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
    ]);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', SECOND);
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);

    arrangement.abortTransaction();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    expect((clipOf(arrangement, 'A', 'a1') as AudioClip).startSample).toBe(2 * SECOND);
    expect(arrangement.canUndo).toBe(false);
  });

  it('an arrival in a transaction, commit, undo: a track the transaction did not touch is the same object', async () => {
    const { arrangement, loads } = await setup([
      track('A', [clip('a1', 2 * SECOND)]),
      track('B', [loading('L', 'b.opus')]),
    ]);
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', SECOND);
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    arrangement.commitTransaction();
    const b = arrangement.getTracks()[1];
    expect(isLoaded(b.clips[0])).toBe(true);

    arrangement.undo();
    expect((clipOf(arrangement, 'A', 'a1') as AudioClip).startSample).toBe(2 * SECOND);
    expect(arrangement.getTracks()[1]).toBe(b);
  });

  it('an arrival, then undo: the earlier state has the loaded clip', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
    ]);
    arrangement.moveClip('A', 'a1', SECOND);
    loads.calls[0].resolve(fakeBuffer());
    await flush();

    const loadedNow = clipOf(arrangement, 'A', 'L');
    arrangement.undo();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    expect((clipOf(arrangement, 'A', 'a1') as AudioClip).startSample).toBe(2 * SECOND);
    // Two track objects held the same loading clip: they hold the same loaded clip.
    expect(clipOf(arrangement, 'A', 'L')).toBe(loadedNow);
  });

  it('a track added with a pending clip, undo, redo, then the arrival', async () => {
    const { arrangement, loads } = await setup([track('B', [clip('b1', 0)])]);
    arrangement.addTrack(track('A', [loading('L', 'a.opus')]));
    await flush();
    arrangement.undo();
    arrangement.redo();
    loads.calls[0].resolve(fakeBuffer());
    await flush();

    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    expect(loads.calls).toHaveLength(1);
    // And the state from before the track existed still does not have it.
    arrangement.undo();
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['B']);
    arrangement.redo();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
  });

  it('an arrival while the clip is only in a redo state: redo brings it back loaded, with no notification at the arrival', async () => {
    const { arrangement, loads } = await setup([track('B', [clip('b1', 0)])]);
    arrangement.addTrack(track('A', [loading('L', 'a.opus')]));
    await flush();
    arrangement.undo();
    const told = vi.fn();
    arrangement.subscribe(told);
    const version = arrangement.tracksVersion;

    loads.calls[0].resolve(fakeBuffer());
    await flush();
    // The current tracks did not change.
    expect(told).not.toHaveBeenCalled();
    expect(arrangement.tracksVersion).toBe(version);

    arrangement.redo();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
  });

  it('a state from before the clip existed does not gain it', async () => {
    const { arrangement, loads } = await setup([track('A', [clip('a1', 2 * SECOND)])]);
    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: [...current.clips, loading('L', 'a.opus')],
    }));
    await flush();
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    expect(clipsOf(arrangement, 'A').map((c) => c.id)).toEqual(['a1', 'L']);

    arrangement.undo();
    expect(clipsOf(arrangement, 'A').map((c) => c.id)).toEqual(['a1']);
  });

  it('by loading-clip OBJECT, not by id: a clip that was replaced is loaded as each state had it', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus', 1)])]);
    // The same id, another object, at another time.
    arrangement.updateTrack('A', (current) => ({ ...current, clips: [loading('L', 'a.opus', 2)] }));
    loads.calls[0].resolve(fakeBuffer());
    await flush();

    expect((clipOf(arrangement, 'A', 'L') as AudioClip).startSample).toBe(2 * SECOND);
    arrangement.undo();
    expect((clipOf(arrangement, 'A', 'L') as AudioClip).startSample).toBe(1 * SECOND);
  });

  it('a patched state is frozen like any other', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
    ]);
    arrangement.moveClip('A', 'a1', SECOND);
    loads.calls[0].resolve(fakeBuffer());
    await flush();
    arrangement.undo();
    const restored = arrangement.getTracks();
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored[0])).toBe(true);
    expect(Object.isFrozen(restored[0].clips[0])).toBe(true);
  });
});

describe('a clip that cannot be made, and a source that fails', () => {
  it('an unusable clip stays a loading clip everywhere; its source is shown as failed with the reason', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus', 0, { offset: 60 }), clip('a1', 2 * SECOND)]),
    ]);
    arrangement.moveClip('A', 'a1', SECOND);
    const held = clipOf(arrangement, 'A', 'L');
    const told = vi.fn();
    arrangement.subscribe(told);

    loads.calls[0].resolve(fakeBuffer(4));
    await flush();

    expect(clipOf(arrangement, 'A', 'L')).toBe(held);
    expect(told).not.toHaveBeenCalled();
    const state = arrangement.sources.getSnapshot().sources.get('a.opus');
    expect(state?.status).toBe('failed');
    expect(state?.error?.message).toBe('clip "L": offset is at or past the end of the audio');
    expect(arrangement.sources.getSnapshot()).toMatchObject({ failedCount: 1, pendingCount: 0 });
    // An edit that changes no status leaves the value, and its error, as they are.
    const value = arrangement.sources.getSnapshot();
    arrangement.moveClip('A', 'a1', 1000);
    expect(arrangement.sources.getSnapshot()).toBe(value);
    arrangement.undo();
    arrangement.undo();
    expect(clipOf(arrangement, 'A', 'L')).toBe(held);
  });

  it('a source with a usable and an unusable clip: the usable one is loaded, the source is failed', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('ok', 'a.opus'), loading('bad', 'a.opus', 2, { offset: 60 })]),
    ]);
    loads.calls[0].resolve(fakeBuffer(4));
    await flush();
    expect(isLoaded(clipOf(arrangement, 'A', 'ok'))).toBe(true);
    expect(isLoaded(clipOf(arrangement, 'A', 'bad'))).toBe(false);
    expect(statusOf(arrangement, 'a.opus')).toBe('failed');

    // When the unusable clip is gone from the CURRENT tracks, so is the failure:
    // an undo step that still holds the clip does not count.
    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: current.clips.filter((c) => c.id !== 'bad'),
    }));
    expect(arrangement.canUndo).toBe(true);
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');
    expect(arrangement.sources.getSnapshot().failedCount).toBe(0);

    // The undo brings the clip back, and its failure with it.
    arrangement.undo();
    expect(isLoaded(clipOf(arrangement, 'A', 'bad'))).toBe(false);
    expect(statusOf(arrangement, 'a.opus')).toBe('failed');
    arrangement.redo();
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');
  });

  it('a clip that cannot be made and is only in a stored state does not fail its source', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('ok', 'a.opus')]),
      track('B', [loading('bad', 'a.opus', 0, { offset: 60 })]),
    ]);
    arrangement.removeTrack('B');
    loads.calls[0].resolve(fakeBuffer(4));
    await flush();
    expect(statusOf(arrangement, 'a.opus')).toBe('loaded');

    arrangement.undo();
    expect(statusOf(arrangement, 'a.opus')).toBe('failed');
    expect(arrangement.sources.getSnapshot().sources.get('a.opus')?.error?.message).toBe(
      'clip "bad": offset is at or past the end of the audio'
    );
  });

  it('a failure whose reason changes is a new value', async () => {
    const { arrangement, loads } = await setup([
      track('A', [
        loading('bad1', 'a.opus', 0, { offset: 60 }),
        loading('bad2', 'a.opus', 0, { duration: -1 }),
      ]),
    ]);
    loads.calls[0].resolve(fakeBuffer(4));
    await flush();
    const first = arrangement.sources.getSnapshot();
    expect(first.sources.get('a.opus')?.error?.message).toMatch(/^clip "bad1"/);

    arrangement.setTracks([track('A', [loading('bad2', 'a.opus', 0, { duration: -1 })])]);
    const second = arrangement.sources.getSnapshot();
    expect(second.sources.get('a.opus')?.error?.message).toMatch(/^clip "bad2"/);
    expect(second).not.toBe(first);
  });

  it('a failed source changes no track; retry starts it again and the clip is loaded', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    const tracks = arrangement.getTracks();
    const failure = new Error('Failed to fetch a.opus: 503 Service Unavailable');
    loads.calls[0].reject(failure);
    await flush();

    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.sources.getSnapshot().sources.get('a.opus')).toEqual({
      status: 'failed',
      error: failure,
    });
    expect(arrangement.sources.getSnapshot()).toMatchObject({ failedCount: 1, isLoading: false });
    // Nothing starts it again by itself.
    arrangement.setTrackVolume('A', 0.5);
    await flush();
    expect(loads.calls).toHaveLength(1);

    arrangement.retry('a.opus');
    expect(statusOf(arrangement, 'a.opus')).toBe('pending');
    await flush();
    expect(loads.calls).toHaveLength(2);
    loads.calls[1].resolve(fakeBuffer());
    await flush();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
  });

  it('retry of a source that is not failed, or not known, does nothing', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    arrangement.retry('a.opus');
    arrangement.retry('nope.opus');
    await flush();
    expect(loads.calls).toHaveLength(1);
  });
});

describe('a source that settles late (Review Focus 5)', () => {
  it('after its clip was removed and the removal undone: the clip is loaded, and nothing was fetched twice', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
    ]);
    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: current.clips.filter((c) => c.id !== 'L'),
    }));
    arrangement.undo();
    await flush();
    loads.calls[0].resolve(fakeBuffer());
    await flush();

    expect(loads.calls).toHaveLength(1);
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    // The redo state (the clip removed) did not gain it.
    arrangement.redo();
    expect(clipsOf(arrangement, 'A').map((c) => c.id)).toEqual(['a1']);
  });

  it('after setTracks replaced everything: the load was aborted and its late result changes nothing', async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    arrangement.setTracks([track('B', [clip('b1', 0)])]);
    expect(loads.calls[0].signal.aborted).toBe(true);
    const tracks = arrangement.getTracks();
    const value = arrangement.sources.getSnapshot();
    const told = vi.fn();
    arrangement.subscribe(told);

    loads.calls[0].resolve(fakeBuffer());
    await flush();
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.sources.getSnapshot()).toBe(value);
    expect(value.sources.size).toBe(0);
    expect(told).not.toHaveBeenCalled();
  });

  it("a source dropped and named again is fetched again, and the first load's late result is ignored", async () => {
    const { arrangement, loads } = await setup([track('A', [loading('L', 'a.opus')])]);
    arrangement.setTracks([]);
    arrangement.setTracks([track('A', [loading('L', 'a.opus', 1)])]);
    await flush();
    expect(loads.calls).toHaveLength(2);

    loads.calls[0].resolve(fakeBuffer(4, 44100));
    await flush();
    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(false);

    const second = fakeBuffer();
    loads.calls[1].resolve(second);
    await flush();
    expect((clipOf(arrangement, 'A', 'L') as AudioClip).audioBuffer).toBe(second);
  });
});

describe('found by the review of part 4', () => {
  // A buffer that arrives ON a clip (src + audioBuffer) switches the loading
  // clips of that source inside the same change. The adapter must hear of
  // every track that gained a clip, not only of the track the change names.
  const carriedSetup = async (incremental: boolean) => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'x.opus')]), track('B', [clip('b1', 0)])],
      loadSource: loads.loadSource,
    });
    const adapter = recordingAdapter({ incremental });
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: RATE });
    const events = vi.fn();
    engine.on('statechange', events);
    await flush();
    adapter.reset();
    return { arrangement, adapter, engine, events };
  };
  /** The clip ids per track an adapter holds, replayed from the calls it received. */
  const held = (adapter: ReturnType<typeof recordingAdapter>, before: Record<string, string[]>) => {
    const tracks: Record<string, string[]> = { ...before };
    for (const call of adapter.calls) {
      if (call.method === 'setTracks') {
        for (const key of Object.keys(tracks)) delete tracks[key];
        for (const sent of call.args[0] as { id: string; clips: string[] }[]) {
          tracks[sent.id] = sent.clips;
        }
      } else if (call.method === 'addTrack') {
        const sent = call.args[0] as { id: string; clips: string[] };
        tracks[sent.id] = sent.clips;
      } else if (call.method === 'updateTrack') {
        tracks[call.args[0] as string] = (call.args[1] as { clips: string[] }).clips;
      }
    }
    return tracks;
  };

  for (const incremental of [true, false]) {
    const kind = incremental ? 'an incremental adapter' : 'an adapter with setTracks only';

    it(`${kind}: addTrack of a clip that carries a pending source's audio also sends the track that was waiting`, async () => {
      const { arrangement, adapter, engine, events } = await carriedSetup(incremental);
      arrangement.addTrack(
        track('C', [clip('c1', 0, { src: 'x.opus', audioBuffer: fakeBuffer() })])
      );

      expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
      expect(held(adapter, { A: [], B: ['b1'] })).toEqual({ A: ['L'], B: ['b1'], C: ['c1'] });
      expect(engine.getState().tracks.map((t) => t.clips.map((c) => c.id))).toEqual([
        ['L'],
        ['b1'],
        ['c1'],
      ]);
      // Still one change: one statechange.
      expect(events).toHaveBeenCalledTimes(1);
      // An adapter that was sent everything is not sent the waiting track again.
      if (!incremental) expect(adapter.calls).toHaveLength(1);
      if (incremental) {
        expect(
          adapter.calls.map((call) => [call.method, call.args.length > 1 ? call.args[0] : 'C'])
        ).toEqual([
          ['addTrack', 'C'],
          ['updateTrack', 'A'],
        ]);
      }
      engine.dispose();
    });

    it(`${kind}: updateTrack that puts such a clip on another track also sends the track that was waiting`, async () => {
      const { arrangement, adapter, engine, events } = await carriedSetup(incremental);
      arrangement.updateTrack('B', (current) => ({
        ...current,
        clips: [
          ...current.clips,
          clip('b2', 2 * SECOND, { src: 'x.opus', audioBuffer: fakeBuffer() }),
        ],
      }));

      expect(held(adapter, { A: [], B: ['b1'] })).toEqual({ A: ['L'], B: ['b1', 'b2'] });
      expect(events).toHaveBeenCalledTimes(1);
      engine.dispose();
    });
  }

  it('an adapter that throws when loaded audio is applied: the error is reported, the statechange is emitted, the next change sends every track', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'x.opus')]), track('B', [clip('b1', 0)])],
      loadSource: loads.loadSource,
    });
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: RATE });
    const events = vi.fn();
    engine.on('statechange', events);
    await flush();
    const boom = new Error('adapter boom');
    const updateTrack = adapter.updateTrack;
    adapter.updateTrack = () => {
      throw boom;
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warned = vi.mocked(console.warn);
    warned.mockClear();

    loads.calls[0].resolve(fakeBuffer());
    await flush();

    expect(isLoaded(clipOf(arrangement, 'A', 'L'))).toBe(true);
    expect(events).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(
      /\[waveform-playlist\] The playout adapter failed while loaded audio was applied/
    );
    expect(error.mock.calls[0][1]).toBe(boom);
    // Not left to the loader's own catch-all.
    expect(warned).not.toHaveBeenCalled();
    expect(arrangement.sources.getSnapshot().sources.get('x.opus')).toEqual({ status: 'loaded' });

    // What the adapter holds is not known now: the next track change sends every track.
    adapter.updateTrack = updateTrack;
    adapter.reset();
    arrangement.moveClip('B', 'b1', SECOND);
    expect(adapter.calls.map((call) => call.method)).toEqual(['setTracks']);
    engine.dispose();
  });

  it("a track taken out for good while only an open transaction's base held it: its source is let go at once", async () => {
    const { arrangement, loads } = await setup([
      track('T', [loading('L', 't.opus')]),
      track('B', [clip('b1', 0)]),
    ]);
    arrangement.beginTransaction();
    arrangement.removeTrack('T');
    expect(loads.calls[0].signal.aborted).toBe(false);

    arrangement.removeTrack('T', { undoable: false });
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(arrangement.sources.getSnapshot().sources.has('t.opus')).toBe(false);
  });

  it('beginTransaction over an open transaction lets go of what only the old base named', async () => {
    const { arrangement, loads } = await setup([
      track('T', [loading('L', 't.opus')]),
      track('B', [clip('b1', 0)]),
    ]);
    arrangement.beginTransaction();
    arrangement.removeTrack('T');
    arrangement.beginTransaction();
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(arrangement.sources.getSnapshot().sources.has('t.opus')).toBe(false);
  });
});

describe('`sources` is the same object until a status changes', () => {
  it('across edits of tracks and mix; a new object when a source is added, settles or is dropped', async () => {
    const { arrangement, loads } = await setup([
      track('A', [loading('L', 'a.opus'), clip('a1', 2 * SECOND)]),
    ]);
    const first = arrangement.sources.getSnapshot();
    const told = vi.fn();
    arrangement.sources.subscribe(told);

    arrangement.moveClip('A', 'a1', SECOND);
    arrangement.setTrackVolume('A', 0.2);
    arrangement.undo();
    expect(arrangement.sources.getSnapshot()).toBe(first);
    expect(told).not.toHaveBeenCalled();

    arrangement.addTrack(track('B', [loading('L2', 'b.opus')]));
    const second = arrangement.sources.getSnapshot();
    expect(second).not.toBe(first);
    expect(told).toHaveBeenCalledTimes(1);

    loads.calls[0].resolve(fakeBuffer());
    await flush();
    const third = arrangement.sources.getSnapshot();
    expect(third).not.toBe(second);
    expect(third.sources.get('a.opus')).toEqual({ status: 'loaded' });
    expect(told).toHaveBeenCalledTimes(2);
  });

  it('an arrangement without loading clips has an empty, idle value', () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    expect(arrangement.sources.getSnapshot()).toEqual({
      sources: new Map(),
      pendingCount: 0,
      failedCount: 0,
      isLoading: false,
    });
  });
});

describe('an engine playing the arrangement', () => {
  const engineSetup = async (incremental: boolean) => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [
        track('A', [loading('L1', 'a.opus'), clip('a1', 2 * SECOND)]),
        track('B', [loading('L2', 'a.opus', 1)]),
        track('C', [clip('c1', 0), loading('other', 'c.opus', 2)]),
      ],
      loadSource: loads.loadSource,
    });
    attach(arrangement);
    const adapter = recordingAdapter({ incremental });
    const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: RATE });
    const events = vi.fn();
    engine.on('statechange', events);
    await flush();
    adapter.reset();
    return { loads, arrangement, adapter, engine, events };
  };

  it('a switch reaches the adapter as updateTrack for each track that gained a clip, and one statechange', async () => {
    const { loads, adapter, engine, events } = await engineSetup(true);
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();

    expect(adapter.calls).toEqual([
      { method: 'updateTrack', args: ['A', { id: 'A', clips: ['L1', 'a1'] }] },
      { method: 'updateTrack', args: ['B', { id: 'B', clips: ['L2'] }] },
    ]);
    expect(events).toHaveBeenCalledTimes(1);
    const state = engine.getState();
    expect(state.tracks.map((t) => t.clips.map((c) => c.id))).toEqual([
      ['L1', 'a1'],
      ['L2'],
      ['c1'],
    ]);
    // a1 ends at 3 s; the loaded L2 is at 1 to 2 s.
    expect(state.duration).toBe(3);
    engine.dispose();
  });

  it('an adapter without updateTrack is sent the tracks with setTracks', async () => {
    const { loads, adapter, engine } = await engineSetup(false);
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();

    expect(adapter.calls.length).toBeGreaterThan(0);
    expect(new Set(adapter.calls.map((call) => call.method))).toEqual(new Set(['setTracks']));
    const last = adapter.rawCalls[adapter.rawCalls.length - 1].args[0] as ClipTrack[];
    expect(last.map((t) => t.clips.map((c) => c.id))).toEqual([['L1', 'a1'], ['L2'], ['c1']]);
    engine.dispose();
  });

  it('also while a transaction is open', async () => {
    const { loads, arrangement, adapter, engine } = await engineSetup(true);
    arrangement.beginTransaction();
    engine.moveClip('A', 'a1', SECOND, true);
    adapter.reset();

    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(adapter.calls.map((call) => [call.method, call.args[0]])).toEqual([
      ['updateTrack', 'A'],
      ['updateTrack', 'B'],
    ]);
    arrangement.commitTransaction();
    // One step: the move. The arrival was not one.
    arrangement.undo();
    expect(arrangement.canUndo).toBe(false);
    expect(isLoaded(clipOf(arrangement, 'A', 'L1'))).toBe(true);
    engine.dispose();
  });

  it('a source that fails, and a switch in a stored state only, send the adapter nothing', async () => {
    const { loads, arrangement, adapter, engine, events } = await engineSetup(true);
    loads.of('c.opus')[0].reject(new Error('nope'));
    await flush();
    expect(adapter.calls).toEqual([]);
    expect(events).not.toHaveBeenCalled();

    arrangement.removeTrack('B');
    arrangement.updateTrack('A', (current) => ({
      ...current,
      clips: current.clips.filter((c) => c.id !== 'L1'),
    }));
    adapter.reset();
    events.mockClear();
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(adapter.calls).toEqual([]);
    expect(events).not.toHaveBeenCalled();
    engine.dispose();
  });
});
