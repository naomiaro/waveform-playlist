// @vitest-environment jsdom
//
// The engine's lifetime around an arrangement (#812): the arrangement owns the
// tracks, the mix, the history and the loading; the provider builds an engine
// on it, disposes it, builds another, and gives the arrangement the context it
// decodes with. What a play waiting for an engine needs (#675) is kept here.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const recorded = vi.hoisted(() => ({
  built: [] as Array<{ options: Record<string, unknown>; disposed: boolean }>,
}));

vi.mock('@waveform-playlist/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/engine')>();
  // The real engine, with what it was built with and whether it was disposed.
  class RecordedEngine extends actual.PlaylistEngine {
    private readonly _record: { options: Record<string, unknown>; disposed: boolean };
    constructor(options: ConstructorParameters<typeof actual.PlaylistEngine>[0]) {
      super(options);
      this._record = { options: { ...options }, disposed: false };
      recorded.built.push(this._record);
    }
    dispose() {
      this._record.disposed = true;
      super.dispose();
    }
  }
  return { ...actual, PlaylistEngine: RecordedEngine };
});

import { render, act, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { attachDecodeContext, createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, PlaylistEngine } from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';
import {
  adapterFactory,
  clip,
  fakeBuffer,
  fakeLoads,
  flush,
  loading,
  track,
  useLifetimeForTest,
  type LifetimeHarness,
  type LifetimeProps,
} from './helpers/engineHarness';

let harness: LifetimeHarness;
/** The value of each render, in order. */
let renders: LifetimeHarness['lifetime'][];

const Probe: React.FC<LifetimeProps> = (props) => {
  harness = useLifetimeForTest(props);
  renders.push(harness.lifetime);
  return null;
};

const effectsA: EffectsFunction = () => undefined;
const effectsB: EffectsFunction = () => undefined;

const live = () => recorded.built.filter((entry) => !entry.disposed);
const contextWarnings = () =>
  vi
    .mocked(console.warn)
    .mock.calls.filter((args) => /one (audio context|engine) at a time/.test(String(args[0])));

/**
 * Attaching from outside warns while the hook still has a context attached.
 * It takes the context away again, the hook's with it: call it last.
 */
function stillAttached(arrangement: Arrangement): boolean {
  const before = contextWarnings().length;
  const detach = attachDecodeContext(arrangement, async () => ({}) as BaseAudioContext);
  detach();
  return contextWarnings().length > before;
}

beforeEach(() => {
  recorded.built = [];
  renders = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useEngineLifetime', () => {
  it('one engine on mount, built with `attachDecodeContext: false` on the given arrangement', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const factory = adapterFactory();
    const calls: string[] = [];
    const seen = { engineRefDuringCallbacks: [] as unknown[] };
    render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        seedEngine={() => {
          calls.push('seed');
          seen.engineRefDuringCallbacks.push(harness.lifetime.engineRef.current);
        }}
        onEngine={() => calls.push('onEngine')}
      />
    );
    await act(flush);

    expect(recorded.built).toHaveLength(1);
    const { options } = recorded.built[0];
    expect(options.arrangement).toBe(arrangement);
    expect(options.attachDecodeContext).toBe(false);
    expect(options.adapter).toBe(factory.adapters[0]);
    expect(options.samplesPerPixel).toBe(1024);
    // The engine sent the arrangement's tracks itself, in its constructor.
    expect(factory.adapters[0].setTracksCalls).toBe(1);

    const { lifetime } = harness;
    expect(lifetime.engineRef.current).not.toBeNull();
    expect(lifetime.adapterRef.current).toBe(factory.adapters[0]);
    expect(lifetime.engineEpoch).toBe(1);
    expect(lifetime.isEngineAttached).toBe(true);
    expect(lifetime.engineBuildInFlightRef.current).toBe(false);
    // Seeded, subscribed and told its first state before it is assigned.
    expect(calls).toEqual(['seed', 'onEngine']);
    expect(seen.engineRefDuringCallbacks).toEqual([null]);
  });

  it('new callbacks, a new `onError` and an inline `zoomLevels` with the same content build nothing', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const factory = adapterFactory();
    const props = (): LifetimeProps => ({
      arrangement,
      // A new function on every render: read at build time only.
      createAdapter: () => factory.createAdapter(),
      onError: () => {},
      seedEngine: () => {},
      onEngine: () => {},
      resolveTrackEffects: () => undefined,
      zoomLevels: [512, 1024, 2048],
      effects: effectsA,
    });
    const view = render(<Probe {...props()} />);
    await act(flush);
    view.rerender(<Probe {...props()} />);
    view.rerender(<Probe {...props()} />);
    await act(flush);
    expect(recorded.built).toHaveLength(1);
    expect(factory.adapters).toHaveLength(1);
    expect(factory.adapters[0].disposeCalls).toBe(0);
  });

  it('a new `effects` function disposes and builds once, and the arrangement’s tracks, mix and history are the same objects afterwards', async () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0)]), track('B', [clip('b1', 0)])],
    });
    const factory = adapterFactory();
    const stopLoop = vi.fn();
    const view = render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsA}
        stopAnimationFrameLoop={stopLoop}
      />
    );
    await act(flush);
    // As after a first play: the next engine needs its own init().
    harness.lifetime.audioInitializedRef.current = true;
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackVolume('B', 0.25);
    const tracks = arrangement.getTracks();
    const mixer = arrangement.getMixer();
    expect(arrangement.canUndo).toBe(true);

    view.rerender(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsB}
        stopAnimationFrameLoop={stopLoop}
      />
    );
    await act(flush);

    expect(stopLoop).toHaveBeenCalledTimes(1);
    expect(harness.lifetime.audioInitializedRef.current).toBe(false);
    expect(factory.adapters).toHaveLength(2);
    expect(factory.adapters[0].disposeCalls).toBe(1);
    expect(factory.adapters[1].disposeCalls).toBe(0);
    expect(recorded.built).toHaveLength(2);
    expect(live()).toHaveLength(1);
    expect(harness.lifetime.engineEpoch).toBe(2);
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.getMixer()).toBe(mixer);
    expect(arrangement.canUndo).toBe(true);
    // Rule (#843): the volume change is an undo step of its own, so the
    // first undo takes it back and the second the move; before, one undo
    // took back the move.
    arrangement.undo();
    expect(arrangement.getMixer().get('B')?.volume).toBe(1);
    arrangement.undo();
    expect(arrangement.getTracks()[0].clips[0]).toMatchObject({ startSample: 0 });
    expect(contextWarnings()).toEqual([]);
  });

  it('`addTrack`, `removeTrack` and `setTracks([])` on the arrangement build nothing (#798)', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const factory = adapterFactory();
    render(<Probe arrangement={arrangement} createAdapter={factory.createAdapter} />);
    await act(flush);

    await act(async () => {
      arrangement.addTrack(track('B', [clip('b1', 0)]));
      arrangement.addTrack(track('C', [loading('L')]));
      arrangement.removeTrack('A');
      arrangement.setTracks([]);
      await flush();
    });
    expect(recorded.built).toHaveLength(1);
    expect(factory.adapters).toHaveLength(1);
    expect(factory.adapters[0].disposeCalls).toBe(0);
    expect(harness.lifetime.engineEpoch).toBe(1);
  });

  it('a rebuild with other zoom levels builds the new engine with them', async () => {
    const arrangement = createArrangement();
    const factory = adapterFactory();
    const view = render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        zoomLevels={[512, 1024, 2048]}
      />
    );
    await act(flush);
    expect(recorded.built[0].options.zoomLevels).toEqual([512, 1024, 2048]);

    view.rerender(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        zoomLevels={[1024, 2048]}
      />
    );
    await act(flush);
    expect(recorded.built).toHaveLength(2);
    expect(recorded.built[1].options.zoomLevels).toEqual([1024, 2048]);
  });

  it('nothing is fetched until the first adapter exists; a load started between two engines waits and then decodes with the new adapter’s context', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('LA')])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const first = factory.holdNext();
    const view = render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsA} />
    );
    await act(flush);
    expect(loads.calls).toEqual([]);
    expect(arrangement.sources.getSnapshot().pendingCount).toBe(1);

    await act(async () => {
      first.open();
      await flush();
    });
    expect(loads.calls.map((call) => call.src)).toEqual(['/LA.opus']);
    expect(loads.calls[0].audioContext).toBe(factory.adapters[0].audioContext);

    // A rebuild that is held open; a file is added while there is no engine.
    const second = factory.holdNext();
    view.rerender(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsB} />
    );
    await act(async () => {
      arrangement.addTrack(track('B', [loading('LB')]));
      await flush();
    });
    expect(harness.lifetime.engineRef.current).toBeNull();
    expect(loads.of('/LB.opus')).toEqual([]);
    // The load that was running goes on: the decode context is the host's.
    expect(loads.calls[0].signal.aborted).toBe(false);

    await act(async () => {
      second.open();
      await flush();
    });
    expect(loads.of('/LB.opus')).toHaveLength(1);
    expect(loads.of('/LB.opus')[0].audioContext).toBe(factory.adapters[1].audioContext);
  });

  it('a failed adapter build leaves sources pending, calls `onError` once and a later successful build loads them', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('LA')])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    factory.failNext(new Error('no adapter today'));
    const onError = vi.fn();
    const view = render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsA}
        onError={onError}
      />
    );
    await act(flush);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'no adapter today' });
    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
    expect(harness.lifetime.engineRef.current).toBeNull();
    expect(harness.lifetime.isEngineAttached).toBe(false);
    expect(harness.lifetime.engineBuildInFlightRef.current).toBe(false);
    expect(loads.calls).toEqual([]);
    expect(arrangement.sources.getSnapshot()).toMatchObject({ pendingCount: 1, failedCount: 0 });

    view.rerender(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsB}
        onError={onError}
      />
    );
    await act(flush);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(loads.calls).toHaveLength(1);
    expect(loads.calls[0].audioContext).toBe(factory.adapters[0].audioContext);
    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(2));
      await flush();
    });
    expect(arrangement.sources.getSnapshot()).toMatchObject({ pendingCount: 0, failedCount: 0 });
  });

  it('an engine that cannot be built disposes what it made and reports once; the next build is clean', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const factory = adapterFactory();
    const onError = vi.fn();
    let failSeed = true;
    const seedEngine = () => {
      if (failSeed) {
        failSeed = false;
        throw new Error('seed failed');
      }
    };
    const view = render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsA}
        seedEngine={seedEngine}
        onError={onError}
      />
    );
    await act(flush);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'seed failed' });
    // The engine was made but never assigned: disposed, with its adapter.
    expect(recorded.built).toHaveLength(1);
    expect(live()).toHaveLength(0);
    expect(factory.adapters[0].disposeCalls).toBe(1);
    expect(harness.lifetime.adapterRef.current).toBeNull();

    // samplesPerPixel 1024 is not among these levels: the constructor throws.
    view.rerender(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsB}
        seedEngine={seedEngine}
        onError={onError}
        zoomLevels={[256, 512]}
      />
    );
    await act(flush);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(factory.adapters[1].disposeCalls).toBe(1);
    expect(harness.lifetime.adapterRef.current).toBeNull();

    view.rerender(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        effects={effectsB}
        seedEngine={seedEngine}
        onError={onError}
        zoomLevels={[512, 1024]}
      />
    );
    await act(flush);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(live()).toHaveLength(1);
    expect(harness.lifetime.isEngineAttached).toBe(true);
    expect(contextWarnings()).toEqual([]);
  });

  it('a rebuild during playback queues a resume where the engine was, with the playback end', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0, 8)])] });
    const factory = adapterFactory();
    const view = render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsA} />
    );
    await act(flush);
    const engine = harness.lifetime.engineRef.current as PlaylistEngine;
    engine.play(2, 6);
    harness.playbackEndTimeRef.current = 6;

    const held = factory.holdNext();
    view.rerender(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsB} />
    );
    await act(flush);
    const { lifetime } = harness;
    expect(lifetime.engineRef.current).toBeNull();
    expect(lifetime.adapterRef.current).toBeNull();
    expect(lifetime.engineBuildInFlightRef.current).toBe(true);
    expect(lifetime.isEngineAttached).toBe(false);
    expect(lifetime.pendingResumeRef.current).toEqual({ position: 2, endTime: 6 });
    expect(lifetime.engineEpoch).toBe(1);

    await act(async () => {
      held.open();
      await flush();
    });
    // The resume is the provider's to start, on the new epoch.
    expect(harness.lifetime.engineEpoch).toBe(2);
    expect(harness.lifetime.isEngineAttached).toBe(true);
    expect(harness.lifetime.pendingResumeRef.current).toEqual({ position: 2, endTime: 6 });
  });

  it('a failed build drops a queued play and clears the in-flight flag', async () => {
    const arrangement = createArrangement();
    const factory = adapterFactory();
    const view = render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsA} />
    );
    await act(flush);
    const held = factory.holdNext();
    view.rerender(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsB} />
    );
    await act(flush);
    expect(harness.lifetime.engineBuildInFlightRef.current).toBe(true);
    harness.lifetime.pendingResumeRef.current = { position: 1 };

    await act(async () => {
      held.fail(new Error('import failed'));
      await flush();
    });
    expect(harness.lifetime.pendingResumeRef.current).toBeNull();
    expect(harness.lifetime.engineBuildInFlightRef.current).toBe(false);
    expect(harness.lifetime.engineRef.current).toBeNull();
  });

  it('`bumpEngineEpoch` runs again what follows the epoch, with no new engine', async () => {
    const arrangement = createArrangement();
    const factory = adapterFactory();
    // What the provider's resume effect will be: an effect on the epoch that
    // reads the engine of that moment.
    const runs: Array<PlaylistEngine | null> = [];
    const Follower: React.FC<LifetimeProps> = (props) => {
      harness = useLifetimeForTest(props);
      const { engineEpoch, engineRef } = harness.lifetime;
      React.useEffect(() => {
        runs.push(engineRef.current);
      }, [engineEpoch, engineRef]);
      return null;
    };
    render(<Follower arrangement={arrangement} createAdapter={factory.createAdapter} />);
    await act(flush);
    // The mount's run (no engine yet) and the assignment's.
    expect(runs).toHaveLength(2);
    const engine = harness.lifetime.engineRef.current;
    expect(runs[1]).toBe(engine);
    const bump = harness.lifetime.bumpEngineEpoch;

    act(() => bump());
    expect(runs).toHaveLength(3);
    expect(runs[2]).toBe(engine);
    // A stable function, and nothing was rebuilt.
    expect(harness.lifetime.bumpEngineEpoch).toBe(bump);
    expect(recorded.built).toHaveLength(1);
    expect(factory.adapters).toHaveLength(1);
  });

  describe('a failed build is reported only while it is current (C1)', () => {
    it('StrictMode: a createAdapter that throws calls onError once', async () => {
      const arrangement = createArrangement();
      const onError = vi.fn();
      const createAdapter = (): never => {
        throw new Error('no adapter, ever');
      };
      render(
        <StrictMode>
          <Probe arrangement={arrangement} createAdapter={createAdapter} onError={onError} />
        </StrictMode>
      );
      await act(flush);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toMatchObject({ message: 'no adapter, ever' });
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(harness.lifetime.isEngineAttached).toBe(false);
    });

    it('a build that fails after unmount calls nothing', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory();
      const held = factory.holdNext();
      const onError = vi.fn();
      const view = render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} onError={onError} />
      );
      await act(flush);
      view.unmount();
      await act(async () => {
        held.fail(new Error('import failed after unmount'));
        await flush();
      });
      expect(onError).not.toHaveBeenCalled();
      expect(vi.mocked(console.error)).not.toHaveBeenCalled();
    });

    it('a failed build that a newer build superseded is silent; the newer build\u2019s own failure is reported', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory();
      const onError = vi.fn();
      const first = factory.holdNext();
      const view = render(
        <Probe
          arrangement={arrangement}
          createAdapter={factory.createAdapter}
          effects={effectsA}
          onError={onError}
        />
      );
      await act(flush);
      const second = factory.holdNext();
      view.rerender(
        <Probe
          arrangement={arrangement}
          createAdapter={factory.createAdapter}
          effects={effectsB}
          onError={onError}
        />
      );
      await act(flush);
      expect(factory.adapters).toHaveLength(2);

      await act(async () => {
        first.fail(new Error('superseded'));
        await flush();
      });
      expect(onError).not.toHaveBeenCalled();
      expect(vi.mocked(console.error)).not.toHaveBeenCalled();
      // The newer build is still waiting for its adapter.
      expect(harness.lifetime.engineBuildInFlightRef.current).toBe(true);

      await act(async () => {
        second.fail(new Error('current'));
        await flush();
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toMatchObject({ message: 'current' });
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(harness.lifetime.engineBuildInFlightRef.current).toBe(false);
    });
  });

  describe('unmount disposes the engine and detaches the context on every path', () => {
    it('after a build', async () => {
      const loads = fakeLoads();
      const arrangement = createArrangement({
        tracks: [track('A', [loading('LA')])],
        loadSource: loads.loadSource,
      });
      const factory = adapterFactory();
      const view = render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} />
      );
      await act(flush);
      expect(loads.calls).toHaveLength(1);
      expect(loads.calls[0].signal.aborted).toBe(false);

      view.unmount();
      expect(factory.adapters[0].disposeCalls).toBe(1);
      expect(live()).toHaveLength(0);
      expect(loads.calls[0].signal.aborted).toBe(true);
      expect(stillAttached(arrangement)).toBe(false);
    });

    it('while the build is in flight', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory();
      const held = factory.holdNext();
      const view = render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} />
      );
      await act(flush);
      view.unmount();
      expect(stillAttached(arrangement)).toBe(false);

      await act(async () => {
        held.open();
        await flush();
      });
      // The adapter that arrived after the unmount is disposed; no engine is built.
      expect(factory.adapters[0].disposeCalls).toBe(1);
      expect(recorded.built).toHaveLength(0);
    });

    it('after a failed build', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory();
      factory.failNext(new Error('no adapter'));
      const view = render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} />
      );
      await act(flush);
      expect(harness.lifetime.engineRef.current).toBeNull();
      view.unmount();
      expect(stillAttached(arrangement)).toBe(false);
    });
  });

  it('StrictMode: one live engine, one attached context, no “one audio context at a time” warning', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('LA')])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const view = render(
      <StrictMode>
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} />
      </StrictMode>
    );
    await act(flush);
    expect(live()).toHaveLength(1);
    expect(contextWarnings()).toEqual([]);
    // Every adapter but the live engine's was disposed.
    const undisposed = factory.adapters.filter((adapter) => adapter.disposeCalls === 0);
    expect(undisposed).toEqual([harness.lifetime.adapterRef.current]);
    expect(loads.calls.filter((call) => !call.signal.aborted)).toHaveLength(1);
    // The first run was cancelled before its adapter arrived: one engine assigned.
    expect(harness.lifetime.engineEpoch).toBe(1);

    view.unmount();
    expect(live()).toHaveLength(0);
    expect(stillAttached(arrangement)).toBe(false);
  });

  it('an <Activity> hide aborts loads in flight and the reveal starts them again; the history survives', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0), loading('LA', { start: 3 })])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const ui = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} />
      </React.Activity>
    );
    const view = render(ui('visible'));
    await act(flush);
    expect(loads.calls).toHaveLength(1);
    arrangement.moveClip('A', 'a1', 1000);
    const tracks = arrangement.getTracks();

    view.rerender(ui('hidden'));
    await act(flush);
    expect(loads.calls[0].signal.aborted).toBe(true);
    expect(live()).toHaveLength(0);

    view.rerender(ui('visible'));
    await act(flush);
    expect(live()).toHaveLength(1);
    expect(loads.of('/LA.opus')).toHaveLength(2);
    expect(loads.calls[1].signal.aborted).toBe(false);
    expect(loads.calls[1].audioContext).toBe(factory.adapters[1].audioContext);
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.canUndo).toBe(true);
    expect(contextWarnings()).toEqual([]);
  });

  describe('the sample rate', () => {
    it('is a provisional 48000 until the first adapter exists, then the adapter’s', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory(44100);
      const held = factory.holdNext();
      render(<Probe arrangement={arrangement} createAdapter={factory.createAdapter} />);
      await act(flush);
      expect(harness.lifetime.sampleRate).toBe(48000);
      expect(harness.lifetime.isSampleRateKnown).toBe(false);

      await act(async () => {
        held.open();
        await flush();
      });
      expect(harness.lifetime.sampleRate).toBe(44100);
      expect(harness.lifetime.isSampleRateKnown).toBe(true);
    });

    it('with the `sampleRate` prop the rate is known from the first render', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory(44100);
      render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} sampleRate={44100} />
      );
      expect(renders[0].sampleRate).toBe(44100);
      expect(renders[0].isSampleRateKnown).toBe(true);
      await act(flush);
      expect(harness.lifetime.isSampleRateKnown).toBe(true);
    });

    it('stays known after a failed build', async () => {
      const arrangement = createArrangement();
      const factory = adapterFactory(44100);
      const view = render(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsA} />
      );
      await act(flush);
      factory.failNext(new Error('no adapter'));
      view.rerender(
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsB} />
      );
      await act(flush);
      expect(harness.lifetime.engineRef.current).toBeNull();
      expect(harness.lifetime.isSampleRateKnown).toBe(true);
      expect(harness.lifetime.sampleRate).toBe(44100);
    });
  });
});
