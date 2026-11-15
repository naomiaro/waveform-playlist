// @vitest-environment jsdom
//
// "Ready" for a provider on an arrangement (#812, QE): `onReady` and the
// `waveform-playlist:ready` event fire ONCE per mount, the first time an engine
// is attached and no source is pending; `isReady` then means "an engine is
// attached", and goes false and true again around each later engine.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(() => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  })),
}));

import { render, act, cleanup } from '@testing-library/react';
import React, { StrictMode, useLayoutEffect, useRef } from 'react';
import { createArrangement } from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';
import { useReadyOnce } from '../providerInternals/useReadyOnce';
import { useArrangementView } from '../providerInternals/useArrangementView';
import {
  adapterFactory,
  clip,
  fakeBuffer,
  fakeLoads,
  flush,
  loading,
  track,
  useLifetimeForTest,
  type LifetimeProps,
} from './helpers/engineHarness';

interface ReadyProps extends LifetimeProps {
  onReady?: () => void;
}

let isReady: boolean;
let readyByRender: boolean[];
/** The engine ref of the latest Probe render, read by an `onReady` under test. */
let probeEngineRef: React.RefObject<unknown> | null = null;

const Probe: React.FC<ReadyProps> = (props) => {
  const { lifetime } = useLifetimeForTest(props);
  probeEngineRef = lifetime.engineRef;
  const onReadyRef = useRef(props.onReady);
  const onErrorRef = useRef(props.onError);
  useLayoutEffect(() => {
    onReadyRef.current = props.onReady;
    onErrorRef.current = props.onError;
  });
  const view = useArrangementView(props.arrangement, {
    samplesPerPixel: 1024,
    mono: false,
    baseScale: 256,
    placeholderSampleRate: lifetime.isSampleRateKnown ? lifetime.sampleRate : null,
  });
  isReady = useReadyOnce({
    isEngineAttached: lifetime.isEngineAttached,
    arrangement: props.arrangement,
    onReadyRef,
    onErrorRef,
    trackCount: view.tracks.length,
    duration: view.duration,
  }).isReady;
  readyByRender.push(isReady);
  return null;
};

const effectsA: EffectsFunction = () => undefined;
const effectsB: EffectsFunction = () => undefined;

let events: Array<{ trackCount: number; duration: number }>;
const onEvent = (event: Event) =>
  events.push((event as CustomEvent<{ trackCount: number; duration: number }>).detail);

beforeEach(() => {
  readyByRender = [];
  events = [];
  window.addEventListener('waveform-playlist:ready', onEvent);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  window.removeEventListener('waveform-playlist:ready', onEvent);
  cleanup();
  vi.restoreAllMocks();
});

describe('useReadyOnce', () => {
  it('not ready while a first source is pending, ready when it settles', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0, 1)]), track('B', [loading('LB', { duration: 3 })])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const onReady = vi.fn();
    render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} onReady={onReady} />
    );
    await act(flush);
    expect(loads.calls).toHaveLength(1);
    expect(isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
    expect(events).toEqual([]);

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(4));
      await flush();
    });
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    // Every track of the arrangement; the loaded audio's length.
    expect(events).toEqual([{ trackCount: 2, duration: 3 }]);
  });

  it('ready with a failed source, and `onError` is not called for it', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('LA')])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const onReady = vi.fn();
    const onError = vi.fn();
    render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        onReady={onReady}
        onError={onError}
      />
    );
    await act(flush);
    expect(isReady).toBe(false);
    await act(async () => {
      loads.calls[0].reject(new Error('404'));
      await flush();
    });
    expect(arrangement.sources.getSnapshot().failedCount).toBe(1);
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(events).toEqual([{ trackCount: 1, duration: 0 }]);
  });

  it('a file added during the first load extends the wait', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('LA')])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const onReady = vi.fn();
    render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} onReady={onReady} />
    );
    await act(flush);
    await act(async () => {
      arrangement.addTrack(track('B', [loading('LB')]));
      await flush();
    });
    await act(async () => {
      loads.of('/LA.opus')[0].resolve(fakeBuffer(2));
      await flush();
    });
    expect(isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    await act(async () => {
      loads.of('/LB.opus')[0].resolve(fakeBuffer(2));
      await flush();
    });
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('after the first ready, a rebuild with a pending source is ready when its engine is attached', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0)])],
      loadSource: loads.loadSource,
    });
    const factory = adapterFactory();
    const view = render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsA} />
    );
    await act(flush);
    expect(isReady).toBe(true);

    // A file is added (pending), then the engine is rebuilt and held open.
    await act(async () => {
      arrangement.addTrack(track('B', [loading('LB')]));
      await flush();
    });
    expect(isReady).toBe(true);
    const held = factory.holdNext();
    view.rerender(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} effects={effectsB} />
    );
    await act(flush);
    expect(isReady).toBe(false);

    await act(async () => {
      held.open();
      await flush();
    });
    expect(arrangement.sources.getSnapshot().pendingCount).toBe(1);
    expect(isReady).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('`onReady` and the event fire once across a rebuild and across an <Activity> hide and reveal', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0, 2)])] });
    const factory = adapterFactory();
    const onReady = vi.fn();
    const ui = (mode: 'visible' | 'hidden', effects: EffectsFunction) => (
      <React.Activity mode={mode}>
        <Probe
          arrangement={arrangement}
          createAdapter={factory.createAdapter}
          effects={effects}
          onReady={onReady}
        />
      </React.Activity>
    );
    const view = render(ui('visible', effectsA));
    await act(flush);
    expect(onReady).toHaveBeenCalledTimes(1);

    view.rerender(ui('visible', effectsB));
    await act(flush);
    view.rerender(ui('hidden', effectsB));
    await act(flush);
    view.rerender(ui('visible', effectsB));
    await act(flush);
    expect(factory.adapters).toHaveLength(3);
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ trackCount: 1, duration: 2 }]);
  });

  // Found by the final review of #812 (probes H10 / H11): the engine of the
  // first load is disposed by the hide, the pending source goes away while
  // hidden, and a hidden render computed "ready" from the attached-state of
  // the disposed engine; the reveal then fired `onReady` before any engine.
  const SOURCE_GOES_AWAY: Array<
    [string, (arrangement: ReturnType<typeof createArrangement>) => void]
  > = [
    ['the tracks are replaced without it', (arrangement) => arrangement.setTracks([])],
    [
      'a clip carrying its buffer is added',
      (arrangement) =>
        arrangement.addTrack(
          track('U', [
            { ...clip('c9', 0, 1), src: '/LA.opus', audioBuffer: fakeBuffer(2) } as never,
          ])
        ),
    ],
  ];
  it.each(SOURCE_GOES_AWAY)(
    'an <Activity> hide during the first load whose pending source goes away while hidden (%s): `onReady` fires only once the revealed engine is attached',
    async (_name, sourceGoesAway) => {
      const loads = fakeLoads();
      const arrangement = createArrangement({
        tracks: [track('A', [loading('LA')])],
        loadSource: loads.loadSource,
      });
      const factory = adapterFactory();
      const engineAtReady: boolean[] = [];
      const onReady = vi.fn(() => engineAtReady.push(probeEngineRef?.current != null));
      const ui = (mode: 'visible' | 'hidden') => (
        <React.Activity mode={mode}>
          <Probe
            arrangement={arrangement}
            createAdapter={factory.createAdapter}
            onReady={onReady}
          />
        </React.Activity>
      );
      const view = render(ui('visible'));
      await act(flush);
      expect(factory.adapters).toHaveLength(1);
      expect(arrangement.sources.getSnapshot().pendingCount).toBe(1);
      expect(isReady).toBe(false);

      view.rerender(ui('hidden'));
      await act(flush);
      await act(async () => {
        sourceGoesAway(arrangement);
        await flush();
      });
      expect(arrangement.sources.getSnapshot().pendingCount).toBe(0);
      // A render while hidden.
      view.rerender(ui('hidden'));
      await act(flush);
      expect(onReady).not.toHaveBeenCalled();

      const held = factory.holdNext();
      view.rerender(ui('visible'));
      await act(flush);
      expect(onReady).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect(isReady).toBe(false);

      await act(async () => {
        held.open();
        await flush();
      });
      expect(factory.adapters).toHaveLength(2);
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(engineAtReady).toEqual([true]);
      expect(isReady).toBe(true);
      expect(events).toHaveLength(1);
    }
  );

  it('under StrictMode `onReady` fires once', async () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const factory = adapterFactory();
    const onReady = vi.fn();
    render(
      <StrictMode>
        <Probe arrangement={arrangement} createAdapter={factory.createAdapter} onReady={onReady} />
      </StrictMode>
    );
    await act(flush);
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });

  it('an empty arrangement is ready when the engine is attached', async () => {
    const arrangement = createArrangement();
    const factory = adapterFactory();
    const held = factory.holdNext();
    const onReady = vi.fn();
    render(
      <Probe arrangement={arrangement} createAdapter={factory.createAdapter} onReady={onReady} />
    );
    await act(flush);
    expect(isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    await act(async () => {
      held.open();
      await flush();
    });
    expect(isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ trackCount: 0, duration: 0 }]);
    // Not ready on any render before the engine was attached.
    expect(readyByRender.indexOf(true)).toBeGreaterThan(0);
  });

  it('an `onReady` that throws is reported through `onError` and the console; still ready', async () => {
    const arrangement = createArrangement();
    const factory = adapterFactory();
    const onError = vi.fn();
    render(
      <Probe
        arrangement={arrangement}
        createAdapter={factory.createAdapter}
        onReady={() => {
          throw new Error('app bug');
        }}
        onError={onError}
      />
    );
    await act(flush);
    expect(isReady).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'app bug' });
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      '[waveform-playlist] The onReady callback threw: app bug'
    );
  });
});
