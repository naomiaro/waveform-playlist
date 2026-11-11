// @vitest-environment jsdom
//
// Regression tests for #691. The provider splits its value into memoized
// contexts so that a consumer of one is not re-rendered by changes to another.
// That only works while every dependency of each `useMemo` keeps its identity
// across renders in which it did not change. These tests pin the identities
// that were unstable: the controls value (a non-memoized `formatTime`, and
// track setters that closed over `trackStates`), the data value (a default
// `controls` object re-created per render), and the styled-components theme
// (re-merged per render).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { useTheme } from 'styled-components';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistData,
  usePlaybackAnimation,
  usePlaylistState,
  useSelection,
  useCurrentTime,
  useActiveAnnotation,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
  return {
    id,
    name: id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

function createFakeAdapter(): PlayoutAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play: vi.fn(),
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  } as unknown as PlayoutAdapter;
}

type Controls = ReturnType<typeof usePlaylistControls>;
type Data = ReturnType<typeof usePlaylistData>;

type State = ReturnType<typeof usePlaylistState>;
type Selection = ReturnType<typeof useSelection>;

let probe: { controls: Controls; data: Data; theme: unknown; isPlaying: boolean };
let stateProbe: { state: State; renders: number };
let selectionProbe: { selection: Selection; renders: number };

// Reads only the state context, as most consumers do (#733).
const StateProbeChild: React.FC = () => {
  stateProbe = { state: usePlaylistState(), renders: (stateProbe?.renders ?? 0) + 1 };
  return null;
};

const SelectionProbeChild: React.FC = () => {
  selectionProbe = {
    selection: useSelection(),
    renders: (selectionProbe?.renders ?? 0) + 1,
  };
  return null;
};

type Animation = ReturnType<typeof usePlaybackAnimation>;
let animationProbe: { animation: Animation; renders: number };
let currentTimeProbe: { currentTime: number; renders: number };
let activeAnnotationProbe: { activeAnnotationId: string | null; renders: number };

// Reads only the animation context, as a transport button does (#740).
const AnimationProbeChild: React.FC = () => {
  animationProbe = {
    animation: usePlaybackAnimation(),
    renders: (animationProbe?.renders ?? 0) + 1,
  };
  return null;
};

const CurrentTimeProbeChild: React.FC = () => {
  currentTimeProbe = {
    currentTime: useCurrentTime().currentTime,
    renders: (currentTimeProbe?.renders ?? 0) + 1,
  };
  return null;
};

const ActiveAnnotationProbeChild: React.FC = () => {
  activeAnnotationProbe = {
    activeAnnotationId: useActiveAnnotation().activeAnnotationId,
    renders: (activeAnnotationProbe?.renders ?? 0) + 1,
  };
  return null;
};

const ProbeChild: React.FC = () => {
  probe = {
    controls: usePlaylistControls(),
    data: usePlaylistData(),
    theme: useTheme(),
    isPlaying: usePlaybackAnimation().isPlaying,
  };
  return null;
};

const TRACKS = [makeTrack('track-1'), makeTrack('track-2')];

// `inlineProps` passes fresh `controls` and `theme` object literals on every
// render of the wrapper, which is how most consumers write them.
async function mount({ inlineProps = false } = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const Wrapper: React.FC = () => (
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      {...(inlineProps
        ? { controls: { show: true, width: 200 }, theme: { playheadColor: 'red' } }
        : {})}
    >
      <ProbeChild />
      <StateProbeChild />
      <SelectionProbeChild />
      <AnimationProbeChild />
      <CurrentTimeProbeChild />
      <ActiveAnnotationProbeChild />
    </WaveformPlaylistProvider>
  );
  const utils = render(<Wrapper />);
  await waitFor(() => expect(probe.data.isReady).toBe(true));
  return { adapter, rerender: () => utils.rerender(<Wrapper />) };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('provider context values keep their identity (#691)', () => {
  it('controls value survives a provider re-render caused by a track-state change', async () => {
    await mount();
    const before = probe.controls;

    await act(async () => {
      probe.controls.setTrackVolume(0, 0.4);
    });

    expect(probe.data.trackStates[0].volume).toBe(0.4);
    expect(probe.controls).toBe(before);
  });

  it('controls value survives a selection change', async () => {
    await mount();
    const before = probe.controls;

    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });

    expect(probe.controls).toBe(before);
  });

  it('data value and theme survive a parent re-render with unchanged props', async () => {
    const { rerender } = await mount();
    const dataBefore = probe.data;
    const themeBefore = probe.theme;

    await act(async () => {
      rerender();
    });

    expect(probe.data).toBe(dataBefore);
    expect(probe.theme).toBe(themeBefore);
  });

  it('data value and theme survive a parent re-render that passes equal inline objects', async () => {
    const { rerender } = await mount({ inlineProps: true });
    const dataBefore = probe.data;
    const themeBefore = probe.theme;
    expect(probe.data.controls).toEqual({ show: true, width: 200 });

    await act(async () => {
      rerender();
    });

    expect(probe.data).toBe(dataBefore);
    expect(probe.theme).toBe(themeBefore);
  });

  it('controls value survives play and pause', async () => {
    await mount();
    const before = probe.controls;

    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);
    expect(probe.controls).toBe(before);

    await act(async () => {
      probe.controls.pause();
    });
    expect(probe.isPlaying).toBe(false);
    expect(probe.controls).toBe(before);
  });

  it('seekTo and setSelection captured before play still restart playback while playing', async () => {
    const { adapter } = await mount();
    const play = adapter.play as ReturnType<typeof vi.fn>;
    // Captured while stopped: these must read the live playing state, not the
    // value from the render they were created in.
    const { seekTo, setSelection } = probe.controls;

    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);
    const callsAfterPlay = play.mock.calls.length;

    await act(async () => {
      seekTo(0.5);
    });
    expect(play.mock.calls.length).toBeGreaterThan(callsAfterPlay);
    const callsAfterSeek = play.mock.calls.length;

    await act(async () => {
      setSelection(0.25, 0.75);
    });
    expect(play.mock.calls.length).toBeGreaterThan(callsAfterSeek);
    expect(probe.isPlaying).toBe(true);
  });

  it('two track setters called in one batch both apply', async () => {
    await mount();

    await act(async () => {
      probe.controls.setTrackMute(0, true);
      probe.controls.setTrackVolume(0, 0.3);
      probe.controls.setTrackPan(1, -0.5);
      probe.controls.setTrackSolo(1, true);
    });

    expect(probe.data.trackStates[0]).toMatchObject({ muted: true, volume: 0.3 });
    expect(probe.data.trackStates[1]).toMatchObject({ pan: -0.5, soloed: true });
  });
});

describe('selection lives in its own context (#733)', () => {
  it('a selection change leaves the state value and its consumers alone', async () => {
    await mount();
    const stateBefore = stateProbe.state;
    const stateRendersBefore = stateProbe.renders;
    const selectionRendersBefore = selectionProbe.renders;

    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });

    expect(selectionProbe.selection).toEqual({ selectionStart: 0.1, selectionEnd: 0.5 });
    expect(selectionProbe.renders).toBeGreaterThan(selectionRendersBefore);
    expect(stateProbe.state).toBe(stateBefore);
    expect(stateProbe.renders).toBe(stateRendersBefore);
    expect(stateProbe.state).not.toHaveProperty('selectionStart');
    expect(stateProbe.state).not.toHaveProperty('selectionEnd');
  });

  it('selection value survives a state change that is not a selection change', async () => {
    await mount();
    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });
    const selectionBefore = selectionProbe.selection;
    const selectionRendersBefore = selectionProbe.renders;

    await act(async () => {
      probe.controls.setLoopRegion(0.2, 0.4);
    });

    expect(stateProbe.state.loopStart).toBe(0.2);
    expect(selectionProbe.selection).toBe(selectionBefore);
    expect(selectionProbe.renders).toBe(selectionRendersBefore);
  });

  it('useSelection throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SelectionProbeChild />)).toThrow(
      'useSelection must be used within WaveformPlaylistProvider'
    );
  });
});

describe('the resting cursor position lives in its own context (#740)', () => {
  it('a seek while stopped leaves the animation value and its consumers alone', async () => {
    await mount();
    const animationBefore = animationProbe.animation;
    const animationRendersBefore = animationProbe.renders;
    const currentTimeRendersBefore = currentTimeProbe.renders;

    await act(async () => {
      probe.controls.seekTo(0.5);
    });

    expect(currentTimeProbe.currentTime).toBe(0.5);
    expect(currentTimeProbe.renders).toBeGreaterThan(currentTimeRendersBefore);
    expect(animationProbe.animation.currentTimeRef.current).toBe(0.5);
    expect(animationProbe.animation).toBe(animationBefore);
    expect(animationProbe.renders).toBe(animationRendersBefore);
    expect(animationProbe.animation).not.toHaveProperty('currentTime');
  });

  it('a selection whose start moves (a leftward drag) leaves the animation value alone', async () => {
    await mount();
    await act(async () => {
      probe.controls.setSelection(0.4, 0.6);
    });
    const animationBefore = animationProbe.animation;
    const animationRendersBefore = animationProbe.renders;

    await act(async () => {
      probe.controls.setSelection(0.3, 0.6);
    });
    await act(async () => {
      probe.controls.setSelection(0.2, 0.6);
    });

    expect(currentTimeProbe.currentTime).toBe(0.2);
    expect(animationProbe.animation).toBe(animationBefore);
    expect(animationProbe.renders).toBe(animationRendersBefore);
  });

  it('setCurrentTime reaches useCurrentTime consumers', async () => {
    await mount();

    await act(async () => {
      probe.controls.setCurrentTime(0.75);
    });

    expect(currentTimeProbe.currentTime).toBe(0.75);
  });

  it('play and pause still reach animation consumers, and pause sets the resting position', async () => {
    await mount();
    const animationRendersBefore = animationProbe.renders;

    await act(async () => {
      await probe.controls.play(0.25);
    });
    expect(animationProbe.animation.isPlaying).toBe(true);
    expect(animationProbe.renders).toBeGreaterThan(animationRendersBefore);

    await act(async () => {
      probe.controls.pause();
    });
    expect(animationProbe.animation.isPlaying).toBe(false);
    expect(currentTimeProbe.currentTime).toBe(animationProbe.animation.currentTimeRef.current);
  });

  it('useCurrentTime throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CurrentTimeProbeChild />)).toThrow(
      'useCurrentTime must be used within WaveformPlaylistProvider'
    );
  });
});

describe('the active annotation lives in its own context (#740)', () => {
  it('an active-annotation change leaves the state value and its consumers alone', async () => {
    await mount();
    const stateBefore = stateProbe.state;
    const stateRendersBefore = stateProbe.renders;
    const activeRendersBefore = activeAnnotationProbe.renders;
    expect(activeAnnotationProbe.activeAnnotationId).toBeNull();

    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });

    expect(activeAnnotationProbe.activeAnnotationId).toBe('n1');
    expect(activeAnnotationProbe.renders).toBeGreaterThan(activeRendersBefore);
    expect(stateProbe.state).toBe(stateBefore);
    expect(stateProbe.renders).toBe(stateRendersBefore);
    expect(stateProbe.state).not.toHaveProperty('activeAnnotationId');
  });

  it('a state change that is not the active annotation leaves its consumers alone', async () => {
    await mount();
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });
    const activeRendersBefore = activeAnnotationProbe.renders;

    await act(async () => {
      probe.controls.setLoopRegion(0.2, 0.4);
    });
    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });

    expect(stateProbe.state.loopStart).toBe(0.2);
    expect(activeAnnotationProbe.activeAnnotationId).toBe('n1');
    expect(activeAnnotationProbe.renders).toBe(activeRendersBefore);
  });

  it('useActiveAnnotation throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ActiveAnnotationProbeChild />)).toThrow(
      'useActiveAnnotation must be used within WaveformPlaylistProvider'
    );
  });
});
