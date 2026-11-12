// @vitest-environment jsdom
//
// #769: the MediaElement provider drives its playhead and progress overlay
// from ONE animation loop (a frame-callback registry, as the WebAudio provider
// does), and owns the time selection, so a selection drag renders the
// selection overlay and not the waveform.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

// Counts renders of the waveform channel and of the custom playhead function.
const counts = vi.hoisted(() => ({ channel: 0, scale: 0 }));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.channel++;
      return createElement(actual.SmartChannel, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scale++;
      return createElement(actual.SmartScale, props);
    },
  };
});

// The ids currently registered with the provider's frame-callback registry.
const registered = vi.hoisted(() => new Set<string>());

vi.mock('../providerInternals/useFrameCallbacks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providerInternals/useFrameCallbacks')>();
  const { useMemo } = await import('react');
  return {
    ...actual,
    useFrameCallbacks: () => {
      const real = actual.useFrameCallbacks();
      return useMemo(
        () => ({
          ...real,
          registerFrameCallback: (
            id: string,
            cb: Parameters<typeof real.registerFrameCallback>[1]
          ) => {
            registered.add(id);
            real.registerFrameCallback(id, cb);
          },
          unregisterFrameCallback: (id: string) => {
            registered.delete(id);
            real.unregisterFrameCallback(id);
          },
        }),
        // The object is new per render; its three functions are stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [real.registerFrameCallback, real.unregisterFrameCallback, real.runFrameCallbacks]
      );
    },
  };
});

import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementControls,
  useMediaElementData,
  useMediaElementState,
} from '../MediaElementPlaylistContext';
import { MediaElementPlaylist } from '../components/MediaElementPlaylist';

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SAMPLES_PER_PIXEL = 882; // 50 px per second
const PX_PER_SECOND = SAMPLE_RATE / SAMPLES_PER_PIXEL;
const SECONDS = 8;
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;

const WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: SAMPLE_RATE,
  samples_per_pixel: SOURCE_SCALE,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});

const TRACK = { source: 'test.mp3', waveformData: WAVEFORM_DATA, name: 'Test' };

function createFakePlayout() {
  const fake = {
    time: 0,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    play: vi.fn((_when?: number, offset?: number) => {
      fake.time = offset ?? 0;
    }),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn((time: number) => {
      fake.time = time;
    }),
    setPlaybackRate() {},
    getCurrentTime: () => fake.time,
    dispose() {},
  };
  return fake;
}

let probe: {
  animation: ReturnType<typeof useMediaElementAnimation>;
  controls: ReturnType<typeof useMediaElementControls>;
  data: ReturnType<typeof useMediaElementData>;
  state: ReturnType<typeof useMediaElementState>;
};

const ProbeChild: React.FC = () => {
  probe = {
    animation: useMediaElementAnimation(),
    controls: useMediaElementControls(),
    data: useMediaElementData(),
    state: useMediaElementState(),
  };
  return null;
};

// Manual animation frames: each `runFrame()` runs what was requested since
// the last one, so the test can count requests per frame.
let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  counts.channel = 0;
  counts.scale = 0;
  registered.clear();
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    frames.delete(id);
  };
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  vi.restoreAllMocks();
});

async function runFrame(): Promise<number> {
  const pending = [...frames.values()];
  frames.clear();
  await act(async () => {
    pending.forEach((cb) => cb(0));
  });
  return pending.length;
}

const ANNOTATIONS = [
  { id: 'n1', start: 0, end: 2, lines: ['one'] },
  { id: 'n2', start: 2, end: 4, lines: ['two'] },
];

interface MountOptions {
  automaticScroll?: boolean;
  annotationList?: { annotations: typeof ANNOTATIONS; isContinuousPlay?: boolean };
  strict?: boolean;
  renderPlayhead?: React.ComponentProps<typeof MediaElementPlaylist>['renderPlayhead'];
}

async function mount(options: MountOptions = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const playout = createFakePlayout();
  const createPlayout = () => playout as unknown as MediaElementPlayout;
  const Wrapper = options.strict ? React.StrictMode : React.Fragment;
  const tree = (showPlaylist: boolean, playlists = 1, track = TRACK) => (
    <Wrapper>
      <MediaElementPlaylistProvider
        track={track}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={createPlayout}
        automaticScroll={options.automaticScroll}
        annotationList={options.annotationList}
        timescale
      >
        <ProbeChild />
        {showPlaylist
          ? Array.from({ length: playlists }, (_, i) => (
              <MediaElementPlaylist key={i} renderPlayhead={options.renderPlayhead} />
            ))
          : null}
      </MediaElementPlaylistProvider>
    </Wrapper>
  );
  const view = render(tree(true));
  await waitFor(() => expect(probe.data.duration).toBe(SECONDS));
  await waitFor(() => expect(document.querySelector('[data-playhead]')).not.toBeNull());
  await act(async () => {});
  return {
    playout,
    show: (showPlaylist: boolean, playlists = 1) => view.rerender(tree(showPlaylist, playlists)),
    /** The same audio under another source URL: the player is created again. */
    changeSource: (source: string) => view.rerender(tree(true, 1, { ...TRACK, source })),
  };
}

/** The click overlay is the last child of the tracks container. */
function clickOverlay(index = 0): HTMLElement {
  const playhead = document.querySelectorAll('[data-playhead]')[index] as HTMLElement;
  const overlay = playhead.parentElement!.lastElementChild as HTMLElement;
  // jsdom lays nothing out; give the overlay the width of the timeline.
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: SECONDS * PX_PER_SECOND, height: 100 }) as DOMRect;
  return overlay;
}

const selections = () => Array.from(document.querySelectorAll<HTMLElement>('[data-selection]'));
const playhead = () => document.querySelector('[data-playhead]') as HTMLElement;
const seconds = (px: number) => px / PX_PER_SECOND;
/** The progress overlay is the one element positioned with scaleX. */
const progressOverlay = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-container] div')).find((el) =>
    el.style.transform.startsWith('scaleX')
  ) as HTMLElement;

async function press(overlay: HTMLElement, x: number) {
  await act(async () => {
    fireEvent.mouseDown(overlay, { button: 0, clientX: x, clientY: 5 });
  });
}
async function moveTo(x: number) {
  await act(async () => {
    fireEvent.mouseMove(window, { button: 0, buttons: 1, clientX: x, clientY: 5 });
  });
}
async function release(x: number) {
  await act(async () => {
    fireEvent.mouseUp(window, { button: 0, clientX: x, clientY: 5 });
  });
}

describe('MediaElement selection lives in the provider', () => {
  it('a drag shows the selection and does not render the waveform per move', async () => {
    await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(120);
    expect(selections()).toHaveLength(1);

    const channelBefore = counts.channel;
    const scaleBefore = counts.scale;
    for (let x = 130; x <= 200; x += 10) await moveTo(x);
    expect(counts.channel - channelBefore).toBe(0);
    expect(counts.scale - scaleBefore).toBe(0);

    const selection = selections()[0];
    expect(selection.style.left).toBe('100px');
    expect(selection.style.width).toBe('100px');

    await release(200);
    expect(selections()).toHaveLength(1);
    expect(selections()[0].style.width).toBe('100px');
  });

  it('a leftward drag selects from the pointer to the press', async () => {
    await mount();
    const overlay = clickOverlay();
    await press(overlay, 200);
    await moveTo(150);
    await moveTo(60);
    expect(selections()[0].style.left).toBe('60px');
    expect(selections()[0].style.width).toBe('140px');
    await release(60);
    expect(selections()[0].style.left).toBe('60px');
    expect(selections()[0].style.width).toBe('140px');
  });

  it('a click collapses the selection and seeks; a drag does not seek', async () => {
    const { playout } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(200);
    await release(200);
    expect(playout.seekTo).not.toHaveBeenCalled();
    expect(probe.animation.currentTime).toBe(0);

    await press(overlay, 150);
    await release(150);
    expect(selections()).toHaveLength(0);
    expect(playout.seekTo).toHaveBeenCalledExactlyOnceWith(seconds(150));
    expect(probe.animation.currentTime).toBe(seconds(150));
  });

  it('the selection survives a remount of MediaElementPlaylist', async () => {
    const { show } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(200);
    await release(200);
    expect(selections()).toHaveLength(1);

    await act(async () => show(false));
    expect(selections()).toHaveLength(0);
    await act(async () => show(true));
    expect(selections()).toHaveLength(1);
    expect(selections()[0].style.left).toBe('100px');
    expect(selections()[0].style.width).toBe('100px');
  });

  it('two playlists under one provider show the same selection', async () => {
    const { show } = await mount();
    await act(async () => show(true, 2));
    await waitFor(() => expect(document.querySelectorAll('[data-playhead]')).toHaveLength(2));
    const overlay = clickOverlay(1);
    await press(overlay, 50);
    await moveTo(150);
    await release(150);
    expect(selections()).toHaveLength(2);
    expect(selections().map((s) => s.style.left)).toEqual(['50px', '50px']);

    // A press on the other one (a click to seek) replaces the range in both.
    const first = clickOverlay(0);
    await press(first, 300);
    await release(300);
    expect(selections()).toHaveLength(0);
  });

  it('two playlists each register their playhead and progress, and both move', async () => {
    const { playout, show } = await mount();
    await act(async () => show(true, 2));
    await waitFor(() => expect(document.querySelectorAll('[data-playhead]')).toHaveLength(2));
    await act(async () => probe.controls.play());
    expect(registered.size).toBe(4);

    playout.time = 3;
    expect(await runFrame()).toBe(1);
    const playheads = Array.from(document.querySelectorAll<HTMLElement>('[data-playhead]'));
    expect(playheads.map((el) => el.style.transform)).toEqual([
      `translate3d(${3 * PX_PER_SECOND}px, 0, 0)`,
      `translate3d(${3 * PX_PER_SECOND}px, 0, 0)`,
    ]);
    await act(async () => probe.controls.stop());
    expect(registered.size).toBe(0);
  });

  it('a custom playhead function is not called per move of a drag', async () => {
    const renderPlayhead = vi.fn(() => <div data-playhead />);
    await mount({ renderPlayhead });
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(110);
    const before = renderPlayhead.mock.calls.length;
    for (let x = 120; x <= 200; x += 10) await moveTo(x);
    expect(renderPlayhead.mock.calls.length - before).toBe(0);
    await release(200);
  });

  it('playing ignores the selection, and a press during playback restarts there', async () => {
    const { playout } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(200);
    await release(200);

    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, 0);

    await press(overlay, 250);
    await release(300);
    expect(playout.stop).toHaveBeenCalledTimes(1);
    expect(playout.play).toHaveBeenLastCalledWith(undefined, seconds(250));
    expect(selections()).toHaveLength(0);
    await act(async () => probe.controls.stop());
  });
});

describe('MediaElement playback runs one animation loop', () => {
  it('requests one frame per frame, and that loop moves the playhead and the progress', async () => {
    const { playout } = await mount();
    expect(frames.size).toBe(0);

    await act(async () => probe.controls.play());
    expect(probe.animation.isPlaying).toBe(true);

    playout.time = 1;
    expect(await runFrame()).toBe(1);
    expect(playhead().style.transform).toBe(`translate3d(${PX_PER_SECOND}px, 0, 0)`);
    const progress = progressOverlay();
    expect(progress.style.transform).toBe('scaleX(0.125)');
    expect(probe.animation.currentTimeRef.current).toBe(1);

    playout.time = 2;
    expect(await runFrame()).toBe(1);
    expect(playhead().style.transform).toBe(`translate3d(${2 * PX_PER_SECOND}px, 0, 0)`);
    expect(progress.style.transform).toBe('scaleX(0.25)');

    // Playhead and progress overlay, and nothing else.
    expect(registered.size).toBe(2);

    await act(async () => probe.controls.pause());
    expect(frames.size).toBe(0);
    expect(registered.size).toBe(0);
  });

  it('under StrictMode the callbacks end up registered once each, and are removed on pause', async () => {
    await mount({ strict: true });
    await act(async () => probe.controls.play());
    expect(registered.size).toBe(2);
    expect(await runFrame()).toBe(1);
    await act(async () => probe.controls.pause());
    expect(registered.size).toBe(0);
    expect(frames.size).toBe(0);
  });

  it('a new source during playback stops playback: nothing stays registered, and a seek moves the playhead', async () => {
    const { playout, changeSource } = await mount();
    await act(async () => probe.controls.play());
    playout.time = 2;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);

    // The provider disposes the player and creates another for the new source.
    await act(async () => changeSource('other.mp3'));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.isPlaying).toBe(false);
    expect(registered.size).toBe(0);
    expect(frames.size).toBe(0);

    // Not playing, so the resting position is drawn: a seek moves the playhead.
    await act(async () => probe.controls.seekTo(3));
    expect(playhead().style.transform).toBe(`translate3d(${3 * PX_PER_SECOND}px, 0, 0)`);
    expect(progressOverlay().style.transform).toBe('scaleX(0.375)');
  });

  it('a playlist that unmounts during playback leaves nothing registered', async () => {
    const { show } = await mount();
    await act(async () => probe.controls.play());
    expect(registered.size).toBe(2);
    await act(async () => show(false));
    expect(registered.size).toBe(0);
    // The loop keeps running for whatever else is under the provider.
    expect(await runFrame()).toBe(1);
    await act(async () => probe.controls.stop());
  });

  it('shows the resting position after a seek while stopped, with no frame requested', async () => {
    await mount();
    await act(async () => probe.controls.seekTo(4));
    expect(frames.size).toBe(0);
    expect(playhead().style.transform).toBe(`translate3d(${4 * PX_PER_SECOND}px, 0, 0)`);
    const progress = progressOverlay();
    expect(progress.style.transform).toBe('scaleX(0.5)');
  });

  it('automatic scroll keeps the playhead centred in whole pixels', async () => {
    const { playout } = await mount({ automaticScroll: true });
    const container = document.querySelector('[data-scroll-container]') as HTMLElement;
    Object.defineProperty(container, 'clientWidth', { value: 101, configurable: true });

    await act(async () => probe.controls.play());
    playout.time = 4.013; // 200.65 px; minus 50.5 = 150.15
    await runFrame();
    expect(container.scrollLeft).toBe(150);
    await act(async () => probe.controls.stop());
  });
});

describe('MediaElement annotation playback goes through the shared loop step', () => {
  it('continuous play off: playback stops at the end of the active annotation', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
      probe.controls.play(0);
    });

    playout.time = 1.9;
    expect(await runFrame()).toBe(1);
    expect(probe.animation.isPlaying).toBe(true);
    expect(playout.stop).not.toHaveBeenCalled();

    playout.time = 2;
    await runFrame();
    expect(playout.stop).toHaveBeenCalledTimes(1);
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.state.activeAnnotationId).toBe('n1');
    // The loop ended with the playback: no further frame is requested.
    expect(frames.size).toBe(0);
  });

  it('continuous play on: the highlight follows and playback continues', async () => {
    const { playout } = await mount({
      annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
    });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
      probe.controls.play(0);
    });

    playout.time = 2.5;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(playout.stop).not.toHaveBeenCalled();

    playout.time = 5; // past every annotation
    await runFrame();
    expect(probe.state.activeAnnotationId).toBeNull();
    expect(probe.animation.isPlaying).toBe(true);
    expect(frames.size).toBe(1);
    await act(async () => probe.controls.stop());
  });

  it('continuous play off, nothing active: the annotation under the playhead becomes active', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => probe.controls.play(0));
    playout.time = 0.5;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n1');
    expect(probe.animation.isPlaying).toBe(true);
    await act(async () => probe.controls.stop());
  });
});

describe('MediaElement public hook values are unchanged by #769', () => {
  it('the package entry does not export the internal hooks or contexts', async () => {
    const entry = (await import('../index')) as Record<string, unknown>;
    for (const name of [
      'useMediaElementInternals',
      'useMediaElementSelection',
      'MediaElementInternalsContext',
      'MediaElementSelectionContext',
      'useFrameCallbacks',
      'useAnnotationState',
      'useScrollFollow',
      'useViewDefaults',
      'useRequiredContext',
      'followAnnotations',
      'centrePlayhead',
    ]) {
      expect(entry[name], name).toBeUndefined();
    }
    expect(entry.useMediaElementAnimation).toBeDefined();
  });

  it('have exactly the documented fields', async () => {
    await mount();
    expect(Object.keys(probe.animation).sort()).toEqual(
      ['currentTime', 'currentTimeRef', 'isPlaying'].sort()
    );
    expect(Object.keys(probe.state).sort()).toEqual(
      [
        'activeAnnotationId',
        'annotations',
        'continuousPlay',
        'isAutomaticScroll',
        'playbackRate',
      ].sort()
    );
    expect(Object.keys(probe.controls).sort()).toEqual(
      [
        'annotationPreview',
        'pause',
        'play',
        'scrollContainerRef',
        'seekTo',
        'setActiveAnnotationId',
        'setAnnotations',
        'setAutomaticScroll',
        'setContinuousPlay',
        'setPlaybackRate',
        'setScrollContainer',
        'stop',
      ].sort()
    );
    expect(Object.keys(probe.data).sort()).toEqual(
      [
        'barGap',
        'barWidth',
        'controls',
        'duration',
        'fadeIn',
        'fadeOut',
        'peaksDataArray',
        'playoutRef',
        'progressBarWidth',
        'roundedBars',
        'sampleRate',
        'samplesPerPixel',
        'timeScaleHeight',
        'waveHeight',
      ].sort()
    );
  });
});
