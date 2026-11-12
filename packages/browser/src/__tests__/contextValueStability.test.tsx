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
  usePlaylistView,
  usePlaylistTimeline,
  usePlaylistMixer,
  usePlaybackRefs,
  useIsPlaying,
  useLoop,
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

function makeTrack(id: string, seconds = 1): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: seconds * SAMPLE_RATE,
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
    getCurrentTime: () => adapterTime,
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

// What the fake adapter reports as the playback position.
let adapterTime = 0;

type Controls = ReturnType<typeof usePlaylistControls>;
type View = ReturnType<typeof usePlaylistView>;
type Timeline = ReturnType<typeof usePlaylistTimeline>;
type Mixer = ReturnType<typeof usePlaylistMixer>;

// The loop value stands for "state that is not the selection, the cursor or
// the active annotation": each of those got its own context so that a reader
// of anything else is left alone (#733, #740).
type State = ReturnType<typeof useLoop>;
type Selection = ReturnType<typeof useSelection>;

let probe: {
  controls: Controls;
  view: View;
  timeline: Timeline;
  mixer: Mixer;
  theme: unknown;
  isPlaying: boolean;
};
let stateProbe: { state: State; renders: number };
let selectionProbe: { selection: Selection; renders: number };

// Reads only the loop context (#733, #768).
const StateProbeChild: React.FC = () => {
  stateProbe = { state: useLoop(), renders: (stateProbe?.renders ?? 0) + 1 };
  return null;
};

const SelectionProbeChild: React.FC = () => {
  selectionProbe = {
    selection: useSelection(),
    renders: (selectionProbe?.renders ?? 0) + 1,
  };
  return null;
};

type Animation = ReturnType<typeof useIsPlaying>;
type Refs = ReturnType<typeof usePlaybackRefs>;
let animationProbe: { animation: Animation; refs: Refs; renders: number };
let currentTimeProbe: { currentTime: number; renders: number };
let activeAnnotationProbe: { activeAnnotationId: string | null; renders: number };

// Reads isPlaying and the refs, as a transport button does (#740, #768).
const AnimationProbeChild: React.FC = () => {
  animationProbe = {
    animation: useIsPlaying(),
    refs: usePlaybackRefs(),
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
    view: usePlaylistView(),
    timeline: usePlaylistTimeline(),
    mixer: usePlaylistMixer(),
    theme: useTheme(),
    isPlaying: useIsPlaying().isPlaying,
  };
  return null;
};

// Calls actions only, as a transport button or a custom control does (#767).
let controlsProbe: { renders: number };
const ControlsProbeChild: React.FC = () => {
  usePlaylistControls();
  controlsProbe = { renders: (controlsProbe?.renders ?? 0) + 1 };
  return null;
};

// When set, the child below seeks there from a layout effect of the commit in
// which `duration` changes: before the provider's own effects have run.
let seekFromLayoutEffect: { target: number } | null = null;
const LayoutSeekChild: React.FC = () => {
  const { seekTo } = usePlaylistControls();
  const { duration } = usePlaylistTimeline();
  React.useLayoutEffect(() => {
    if (seekFromLayoutEffect && duration === 2) seekTo(seekFromLayoutEffect.target);
  }, [duration, seekTo]);
  return null;
};

const TRACKS = [makeTrack('track-1'), makeTrack('track-2')];

// One set of elements for every render of the wrapper, as when a parent passes
// `children` through: a probe then renders only when a context it reads
// changes, not because the wrapper rendered.
const CHILDREN = (
  <>
    <ProbeChild />
    <StateProbeChild />
    <SelectionProbeChild />
    <AnimationProbeChild />
    <CurrentTimeProbeChild />
    <ActiveAnnotationProbeChild />
    <ControlsProbeChild />
    <LayoutSeekChild />
  </>
);

// `inlineProps` passes fresh `controls` and `theme` object literals on every
// render of the wrapper, which is how most consumers write them.
async function mount({ inlineProps = false } = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  adapterTime = 0;
  seekFromLayoutEffect = null;
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  let tracks = TRACKS;
  const Wrapper: React.FC = () => (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      {...(inlineProps
        ? { controls: { show: true, width: 200 }, theme: { playheadColor: 'red' } }
        : {})}
    >
      {CHILDREN}
    </WaveformPlaylistProvider>
  );
  const utils = render(<Wrapper />);
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
  return {
    adapter,
    rerender: () => utils.rerender(<Wrapper />),
    // Replaces the `tracks` prop, as a parent does after an edit.
    setTracks: (next: ClipTrack[]) => {
      tracks = next;
      utils.rerender(<Wrapper />);
    },
  };
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

    expect(probe.mixer.trackStates[0].volume).toBe(0.4);
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

  it('view and timeline values and theme survive a parent re-render with unchanged props', async () => {
    const { rerender } = await mount();
    const dataBefore = probe.view;
    const timelineBefore = probe.timeline;
    const themeBefore = probe.theme;

    await act(async () => {
      rerender();
    });

    expect(probe.view).toBe(dataBefore);
    expect(probe.timeline).toBe(timelineBefore);
    expect(probe.theme).toBe(themeBefore);
  });

  it('view and timeline values and theme survive a parent re-render that passes equal inline objects', async () => {
    const { rerender } = await mount({ inlineProps: true });
    const dataBefore = probe.view;
    const timelineBefore = probe.timeline;
    const themeBefore = probe.theme;
    expect(probe.view.controls).toEqual({ show: true, width: 200 });

    await act(async () => {
      rerender();
    });

    expect(probe.view).toBe(dataBefore);
    expect(probe.timeline).toBe(timelineBefore);
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

    expect(probe.mixer.trackStates[0]).toMatchObject({ muted: true, volume: 0.3 });
    expect(probe.mixer.trackStates[1]).toMatchObject({ pan: -0.5, soloed: true });
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
    expect(animationProbe.refs.currentTimeRef.current).toBe(0.5);
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
    const { adapter } = await mount();
    const animationRendersBefore = animationProbe.renders;

    await act(async () => {
      await probe.controls.play(0.25);
    });
    expect(animationProbe.animation.isPlaying).toBe(true);
    expect(animationProbe.renders).toBeGreaterThan(animationRendersBefore);

    // The engine reports where playback got to; pause must publish it.
    (adapter as unknown as { getCurrentTime: () => number }).getCurrentTime = () => 0.6;
    await act(async () => {
      probe.controls.pause();
    });
    expect(animationProbe.animation.isPlaying).toBe(false);
    expect(animationProbe.refs.currentTimeRef.current).toBe(0.6);
    expect(currentTimeProbe.currentTime).toBe(0.6);
  });

  it('stop puts the resting position back where playback started', async () => {
    const { adapter } = await mount();
    await act(async () => {
      probe.controls.seekTo(0.25);
    });
    expect(currentTimeProbe.currentTime).toBe(0.25);
    // Starting from another position moves the ref only; the state keeps 0.25
    // until playback stops.
    await act(async () => {
      await probe.controls.play(0.6);
    });
    expect(animationProbe.animation.isPlaying).toBe(true);
    expect(currentTimeProbe.currentTime).toBe(0.25);
    // Relies on the fake adapter ignoring seek: the engine keeps reporting 1.5,
    // so only stop() itself can produce the 0.6 asserted below.
    (adapter as unknown as { getCurrentTime: () => number }).getCurrentTime = () => 1.5;

    await act(async () => {
      probe.controls.stop();
    });

    expect(animationProbe.animation.isPlaying).toBe(false);
    expect(animationProbe.refs.currentTimeRef.current).toBe(0.6);
    expect(currentTimeProbe.currentTime).toBe(0.6);
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

// 2 seconds instead of 1: the timeline end moves, as it does on every pointer
// move while the last clip's right edge is trimmed.
const LONGER_TRACKS = [makeTrack('track-1', 2), makeTrack('track-2')];

describe('the controls value does not follow the timeline length or the time format (#767)', () => {
  it('controls value survives a change of duration', async () => {
    const { setTracks } = await mount();
    const before = probe.controls;
    expect(probe.timeline.duration).toBe(1);

    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));

    expect(probe.controls).toBe(before);
  });

  it('a component that only calls actions does not render when the duration changes', async () => {
    const { setTracks } = await mount();
    const rendersBefore = controlsProbe.renders;

    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));

    expect(controlsProbe.renders).toBe(rendersBefore);
  });

  it('a component that only calls actions does not render when the time format changes', async () => {
    await mount();
    const rendersBefore = controlsProbe.renders;

    await act(async () => {
      probe.controls.setTimeFormat('seconds');
    });
    expect(probe.view.timeFormat).toBe('seconds');

    expect(controlsProbe.renders).toBe(rendersBefore);
  });

  it('controls value survives a time-format change', async () => {
    await mount();
    const before = probe.controls;

    await act(async () => {
      probe.controls.setTimeFormat('seconds');
    });

    expect(probe.view.timeFormat).toBe('seconds');
    expect(probe.controls).toBe(before);
  });

  it('a seekTo captured before the timeline grew clamps to the new end', async () => {
    const { setTracks } = await mount();
    const { seekTo } = probe.controls;

    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));

    await act(async () => {
      seekTo(1.5);
    });
    expect(currentTimeProbe.currentTime).toBe(1.5);

    await act(async () => {
      seekTo(5);
    });
    expect(currentTimeProbe.currentTime).toBe(2);
  });

  it('a seekTo captured before the timeline shrank clamps to the new end', async () => {
    const { setTracks } = await mount();
    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));
    const { seekTo } = probe.controls;

    await act(async () => {
      setTracks(TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(1));

    await act(async () => {
      seekTo(1.5);
    });
    expect(currentTimeProbe.currentTime).toBe(1);
  });

  it('a seekTo called from a layout effect of the commit that brings the new duration clamps to it', async () => {
    const { setTracks } = await mount();
    seekFromLayoutEffect = { target: 1.5 };

    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));

    expect(currentTimeProbe.currentTime).toBe(1.5);
  });

  it('playback keeps running to the new end when a longer track is appended (no rebuild, no loop restart)', async () => {
    const { adapter, setTracks } = await mount();
    const addTrack = vi.spyOn(adapter, 'addTrack');
    const setTracksOnAdapter = vi.spyOn(adapter, 'setTracks');
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);
    const playCalls = (adapter.play as ReturnType<typeof vi.fn>).mock.calls.length;

    // The same two track objects plus one: an incremental add.
    await act(async () => {
      setTracks([...TRACKS, makeTrack('track-3', 2)]);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));
    expect(addTrack).toHaveBeenCalledTimes(1);
    expect(setTracksOnAdapter).not.toHaveBeenCalled();
    expect((adapter.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(playCalls);

    adapterTime = 1.5;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(probe.isPlaying).toBe(true);

    adapterTime = 2.1;
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('playback that is running when the timeline grows stops at the new end, not the old one', async () => {
    const { setTracks } = await mount();
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    await act(async () => {
      setTracks(LONGER_TRACKS);
    });
    await waitFor(() => expect(probe.timeline.duration).toBe(2));
    await waitFor(() => expect(probe.isPlaying).toBe(true));

    // Past the old end (1 s), before the new one (2 s): several frames pass
    // and playback is still running.
    adapterTime = 1.5;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(probe.isPlaying).toBe(true);

    adapterTime = 2.1;
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });
});
