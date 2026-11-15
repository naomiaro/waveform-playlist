// @vitest-environment jsdom
//
// The three arrangement hooks, without a provider: one arrangement per
// component, and two views of it that re-render only when their value changes.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipSource, LoadingClip } from '@waveform-playlist/core';
import { attachDecodeContext, createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, LoadSource } from '@waveform-playlist/engine';
import { useCreateArrangement } from '../hooks/useCreateArrangement';
import { useArrangementTracks } from '../hooks/useArrangementTracks';
import { useArrangementSources } from '../hooks/useArrangementSources';

interface PendingLoad {
  src: ClipSource;
  resolve(buffer: AudioBuffer): void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function fakeLoads() {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src) =>
    new Promise<AudioBuffer>((resolve) => {
      calls.push({ src, resolve });
    });
  return { calls, loadSource };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const fakeBuffer = { sampleRate: 48000, length: 48000, duration: 1, numberOfChannels: 1 };

function loading(id: string, src: ClipSource): LoadingClip {
  return { id, src, start: 0, duration: 1 } as LoadingClip;
}

function track(id: string, clips: ArrangementTrack['clips'] = []): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useCreateArrangement', () => {
  it('returns the same arrangement on every render and after a parent re-render with a new init function', () => {
    const seen: Arrangement[] = [];
    const Probe: React.FC<{ init: () => ArrangementTrack[] }> = ({ init }) => {
      seen.push(useCreateArrangement(init));
      return null;
    };
    const { rerender } = render(<Probe init={() => [track('A')]} />);
    rerender(<Probe init={() => [track('B')]} />);
    rerender(<Probe init={() => []} />);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0].getTracks().map((t) => t.id)).toEqual(['A']);
  });

  it('an initializer that throws (two tracks with one id) throws out of the render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let caught: unknown;
    class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: unknown) {
        caught = error;
      }
      render() {
        return this.state.failed ? 'failed' : this.props.children;
      }
    }
    const Probe: React.FC = () => {
      useCreateArrangement(() => [track('A'), track('A')]);
      return null;
    };
    const { container } = render(
      <Boundary>
        <Probe />
      </Boundary>
    );
    expect(container.textContent).toBe('failed');
    expect(caught).toBeInstanceOf(Error);
  });

  it('under StrictMode no source is fetched by either of the two arrangements the initializer makes', async () => {
    const loads = fakeLoads();
    const loadSource = vi.fn(loads.loadSource);
    let initCalls = 0;
    const Probe: React.FC = () => {
      useCreateArrangement(
        () => {
          initCalls++;
          return [track('A', [loading('L', 'a.opus')])];
        },
        { loadSource }
      );
      return null;
    };
    render(
      <StrictMode>
        <Probe />
      </StrictMode>
    );
    await act(flush);
    expect(initCalls).toBeGreaterThanOrEqual(2);
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('the loadSource option loads the arrangement\u2019s sources once a decode context is attached', async () => {
    const loads = fakeLoads();
    const loadSource = vi.fn(loads.loadSource);
    let arrangement: Arrangement | undefined;
    const Probe: React.FC = () => {
      arrangement = useCreateArrangement(() => [track('A', [loading('L', 'a.opus')])], {
        loadSource,
      });
      return null;
    };
    render(<Probe />);
    const detach = attachDecodeContext(
      arrangement!,
      async () => ({}) as unknown as BaseAudioContext
    );
    try {
      await act(flush);
      expect(loadSource).toHaveBeenCalledTimes(1);
      expect(loadSource.mock.calls[0][0]).toBe('a.opus');
    } finally {
      detach();
    }
  });

  it('the undoLimit option limits the history', () => {
    let arrangement: Arrangement | undefined;
    const Probe: React.FC = () => {
      arrangement = useCreateArrangement(() => [], { undoLimit: 1 });
      return null;
    };
    render(<Probe />);
    arrangement!.addTrack(track('A'));
    arrangement!.addTrack(track('B'));
    arrangement!.undo();
    expect(arrangement!.canUndo).toBe(false);
    expect(arrangement!.getTracks().map((t) => t.id)).toEqual(['A']);
  });
});

describe('useArrangementTracks', () => {
  it('re-renders on addTrack and not on setTrackVolume', () => {
    const arrangement = createArrangement({ tracks: [track('A')] });
    let renders = 0;
    let latest: readonly ArrangementTrack[] = [];
    const Probe: React.FC = () => {
      renders++;
      latest = useArrangementTracks(arrangement);
      return null;
    };
    render(<Probe />);
    const base = renders;
    expect(latest.map((t) => t.id)).toEqual(['A']);

    act(() => arrangement.setTrackVolume('A', 0.5));
    expect(renders).toBe(base);

    act(() => arrangement.addTrack(track('B')));
    expect(renders).toBe(base + 1);
    expect(latest.map((t) => t.id)).toEqual(['A', 'B']);
  });
});

describe('useArrangementSources', () => {
  it('re-renders when a source settles and returns the same object in between', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L', 'a.opus')])],
      loadSource: loads.loadSource,
    });
    const seen: unknown[] = [];
    const Probe: React.FC = () => {
      seen.push(useArrangementSources(arrangement));
      return null;
    };
    const { rerender } = render(<Probe />);
    attachDecodeContext(arrangement, async () => ({}) as unknown as BaseAudioContext);
    await act(flush);
    expect(loads.calls.map((call) => call.src)).toEqual(['a.opus']);

    rerender(<Probe />);
    const pending = seen[seen.length - 1] as ReturnType<Arrangement['sources']['getSnapshot']>;
    expect(seen[seen.length - 2]).toBe(pending);
    expect(pending.isLoading).toBe(true);
    const before = seen.length;

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer as unknown as AudioBuffer);
      await flush();
    });
    expect(seen.length).toBeGreaterThan(before);
    const settled = seen[seen.length - 1] as typeof pending;
    expect(settled).not.toBe(pending);
    expect(settled.isLoading).toBe(false);
  });
});

describe('a different arrangement on a later render', () => {
  it('both hooks follow a different arrangement passed on a later render', () => {
    const first = createArrangement({ tracks: [track('A')] });
    const second = createArrangement({
      tracks: [track('X'), track('Y')],
      loadSource: fakeLoads().loadSource,
    });
    let tracks: readonly ArrangementTrack[] = [];
    let sources: unknown;
    const Probe: React.FC<{ arrangement: Arrangement }> = ({ arrangement }) => {
      tracks = useArrangementTracks(arrangement);
      sources = useArrangementSources(arrangement);
      return null;
    };
    const { rerender } = render(<Probe arrangement={first} />);
    expect(tracks.map((t) => t.id)).toEqual(['A']);
    expect(sources).toBe(first.sources.getSnapshot());

    rerender(<Probe arrangement={second} />);
    expect(tracks.map((t) => t.id)).toEqual(['X', 'Y']);
    expect(sources).toBe(second.sources.getSnapshot());

    act(() => second.addTrack(track('Z')));
    expect(tracks.map((t) => t.id)).toEqual(['X', 'Y', 'Z']);
    act(() => first.addTrack(track('Q')));
    expect(tracks.map((t) => t.id)).toEqual(['X', 'Y', 'Z']);
  });
});
