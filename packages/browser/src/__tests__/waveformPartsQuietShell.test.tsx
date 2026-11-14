// @vitest-environment jsdom
//
// #685, step 1: the multitrack view is a root with parts as its children. A
// render of the root alone (a press, a release) hands the parts the same
// elements as before, so React skips them; each part follows only the
// contexts it reads. A selected track does not render the root at all: the
// tracks part and the controls part read it.
//
// Also here: two `AudioPosition`s under one provider each keep their own
// frame callback (they used to share the id 'audio-position').
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const counts = vi.hoisted(() => ({
  shell: 0,
  scale: 0,
  boxes: 0,
  controls: 0,
  track: 0,
  // `TracksLayout` is rendered once by the tracks part and once by the
  // track-controls part: their own renders, whatever the rows below do.
  layout: 0,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Playlist: (props: React.ComponentProps<typeof actual.Playlist>) => {
      counts.shell++;
      return createElement(actual.Playlist, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scale++;
      return createElement(actual.SmartScale, props);
    },
    // The pieces of a panel (two sliders each) stand for "this panel rendered":
    // its frame takes no props and does not render again (#687).
    Slider: (props: React.ComponentProps<typeof actual.Slider>) => {
      counts.controls++;
      return createElement(actual.Slider, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      counts.track++;
      return createElement(actual.Track, props);
    },
  };
});

vi.mock('../components/visualizationLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/visualizationLayout')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    TracksLayout: (props: React.ComponentProps<typeof actual.TracksLayout>) => {
      counts.layout++;
      return createElement(actual.TracksLayout, props);
    },
  };
});

vi.mock('../components/AnnotationBoxes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/AnnotationBoxes')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    AnnotationBoxes: (props: React.ComponentProps<typeof actual.AnnotationBoxes>) => {
      counts.boxes++;
      return createElement(actual.AnnotationBoxes, props);
    },
  };
});

import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
} from '../AnnotationIntegrationContext';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEditorControls,
  usePlaylistTimeline,
  useSelectedTrackId,
  IsPlayingContext,
  PlaybackRefsContext,
  CurrentTimeContext,
  PlaylistSettingsContext,
  type PlaybackRefsContextValue,
} from '../contexts/playlistContexts';
import { useTrack } from '../components/trackContext';
import { ComposedWaveform } from './testCompositions';
import { AudioPosition } from '../components/ContextualControls';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeWaveformData(bins: number): WaveformData {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    data.push(-(i % 100), i % 100);
  }
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  });
}

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: `${id}-clip`,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: makeWaveformData(400),
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
    play() {},
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

let probe: {
  editor: ReturnType<typeof useEditorControls>;
  isReady: boolean;
  selectedTrackId: string | null;
};

const ProbeChild: React.FC = () => {
  probe = {
    editor: useEditorControls(),
    isReady: usePlaylistTimeline().isReady,
    selectedTrackId: useSelectedTrackId().selectedTrackId,
  };
  return null;
};

const ANNOTATION_LIST = {
  annotations: [
    { id: 'n1', start: 0, end: 0.5, lines: ['one'] },
    { id: 'n2', start: 0.5, end: 1, lines: ['two'] },
  ],
};
const TRACKS = [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')];

function resetCounts() {
  counts.shell = 0;
  counts.scale = 0;
  counts.boxes = 0;
  counts.controls = 0;
  counts.track = 0;
  counts.layout = 0;
}

const INTEGRATION = {
  AnnotationBox: () => null,
  AnnotationBoxesWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
} as unknown as AnnotationIntegration;

async function mount(reset = true) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  // A new `<ComposedWaveform />` element on every call, with the same
  // (no) props: what a parent's re-render hands it.
  const ui = () => (
    // The annotation components: without them the box part draws nothing
    // (#686), and "the boxes did not render" below would say nothing.
    <AnnotationIntegrationContext value={INTEGRATION}>
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        annotationList={ANNOTATION_LIST}
      >
        <ProbeChild />
        <ComposedWaveform />
      </WaveformPlaylistProvider>
    </AnnotationIntegrationContext>
  );
  const utils = render(ui());
  await waitFor(() => expect(probe.isReady).toBe(true));
  await act(async () => {});
  if (reset) resetCounts();
  return { rerenderSame: () => utils.rerender(ui()) };
}

/** The click overlay: the last, childless sibling above the track rows. */
function clickOverlay(): HTMLElement {
  let element: Element | null = document.querySelector('[data-track-row]');
  while (element && element.parentElement) {
    const last = element.parentElement.lastElementChild;
    if (last && last !== element && !last.contains(element) && last.childElementCount === 0) {
      return last as HTMLElement;
    }
    element = element.parentElement;
  }
  throw new Error('click overlay not found');
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('the root renders alone (#685)', () => {
  it('the counters work: everything is mounted', async () => {
    resetCounts();
    await mount(false);
    expect(document.querySelectorAll('[data-track-row]').length).toBe(3);
    expect(counts.shell).toBeGreaterThan(0);
    expect(counts.scale).toBeGreaterThan(0);
    expect(counts.boxes).toBeGreaterThan(0);
    expect(counts.controls).toBeGreaterThanOrEqual(3);
    expect(counts.track).toBeGreaterThanOrEqual(3);
  });

  it('selecting a track from code renders at most the two rows involved, no control panel and not the root', async () => {
    await mount();

    await act(async () => {
      probe.editor.setSelectedTrackId('t2');
    });

    expect(probe.selectedTrackId).toBe('t2');
    expect(counts.track).toBeGreaterThan(0);
    expect(counts.track).toBeLessThanOrEqual(2);
    // The slot's background follows the selection, and so does `isSelected`
    // in the track's context (#687): the pieces of the panel that becomes
    // selected render (two sliders each), and of the one that stops being so.
    expect(counts.controls).toBeLessThanOrEqual(4);
    expect(counts.controls).toBeGreaterThan(0);
    expect(counts.shell).toBe(0);
    expect(counts.scale).toBe(0);
    expect(counts.boxes).toBe(0);
  });

  it('a press and its release render the root, and neither the timescale nor the annotation row', async () => {
    await mount();
    // The first row is already under the pointer's track after this.
    await act(async () => {
      probe.editor.setSelectedTrackId('t1');
    });
    resetCounts();

    const overlay = clickOverlay();
    await act(async () => {
      fireEvent.mouseDown(overlay, { button: 0, clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    });

    // The root follows its own "a drag is in progress" state.
    expect(counts.shell).toBeGreaterThan(0);
    expect(counts.scale).toBe(0);
    expect(counts.boxes).toBe(0);
    expect(counts.track).toBe(0);
    expect(counts.controls).toBe(0);
    // Not even the tracks part or the track-controls part themselves.
    expect(counts.layout).toBe(0);
  });

  it('a render of the composing component with the same props renders the root and the tracks part, and no memoized part or row', async () => {
    const { rerenderSame } = await mount();

    await act(async () => {
      rerenderSame();
    });

    // The root gets new children and the tracks part has children of its own,
    // so neither can be skipped (nor the playhead, which is not memoized);
    // the timescale, the annotation row and the track controls are memoized
    // and are.
    expect(counts.shell).toBe(1);
    expect(counts.layout).toBe(1);
    expect(counts.scale).toBe(0);
    expect(counts.boxes).toBe(0);
    expect(counts.controls).toBe(0);
    expect(counts.track).toBe(0);
  });
});

describe('only the root reads the timeline (#685)', () => {
  it('a timeline value that changes for onTracksChange renders the root; neither the tracks part nor the track controls follow', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter;
    let panelRenders = 0;
    const Panel: React.FC = () => {
      panelRenders++;
      return <i data-custom-panel={useTrack().id} />;
    };
    // One element for the whole test: the component that composes the view
    // does not render, only the provider gets a new function.
    const view = <ComposedWaveform trackControls={<Panel />} />;
    const ui = (onTracksChange?: () => void) => (
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        onTracksChange={onTracksChange}
      >
        <ProbeChild />
        {view}
      </WaveformPlaylistProvider>
    );
    // Mounted WITHOUT the callback: the timeline value publishes `undefined`.
    const utils = render(ui());
    await waitFor(() => expect(probe.isReady).toBe(true));
    await act(async () => {});
    expect(document.querySelectorAll('[data-custom-panel]').length).toBe(3);
    resetCounts();
    const calls = panelRenders;

    // The app starts passing one: the published function goes from undefined
    // to the provider's own (#812), and nothing else in the value changes.
    await act(async () => {
      utils.rerender(ui(() => {}));
    });

    // The timeline value is a new object (it carries the function), so its
    // one reader renders.
    expect(counts.shell).toBeGreaterThan(0);
    // Reading the timeline value themselves, both parts rendered with every
    // one of the root's renders here.
    expect(counts.layout).toBe(0);
    expect(panelRenders - calls).toBe(0);
    expect(counts.track).toBe(0);
    expect(counts.scale).toBe(0);

    // Since #812 the published function is the provider's own and stable: a
    // new inline callback on a later render changes nothing in the value (and
    // the provider does not load again), so not even the root renders.
    resetCounts();
    await act(async () => {
      utils.rerender(ui(() => {}));
    });
    expect(counts.shell).toBe(0);
    expect(counts.layout).toBe(0);
    expect(panelRenders - calls).toBe(0);
  });
});

describe('AudioPosition registers under its own id (#685)', () => {
  it('two readouts under one provider keep one frame callback each', () => {
    const registered = new Map<string, unknown>();
    const refs: PlaybackRefsContextValue = {
      currentTimeRef: { current: 0 },
      visualTimeRef: { current: 0 },
      registerFrameCallback: (id, cb) => {
        registered.set(id, cb);
      },
      unregisterFrameCallback: (id) => {
        registered.delete(id);
      },
    };

    render(
      <PlaybackRefsContext value={refs}>
        <IsPlayingContext value={{ isPlaying: true }}>
          <CurrentTimeContext value={{ currentTime: 0 }}>
            <PlaylistSettingsContext
              value={{ timeFormat: 'hh:mm:ss.uuu', isAutomaticScroll: false }}
            >
              <AudioPosition />
              <AudioPosition />
            </PlaylistSettingsContext>
          </CurrentTimeContext>
        </IsPlayingContext>
      </PlaybackRefsContext>
    );

    expect(registered.size).toBe(2);
  });
});
