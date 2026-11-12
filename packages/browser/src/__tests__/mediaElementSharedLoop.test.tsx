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

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  useIsPlaying,
  useCurrentTime,
  usePlaybackRefs,
  usePlaybackControls,
  useMediaElementTrack,
  useActiveAnnotation,
} from '../contexts/playlistContexts';
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
// A file twice as long.
const LONG_LENGTH = LENGTH * 2;
const LONG_WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: SAMPLE_RATE,
  samples_per_pixel: SOURCE_SCALE,
  bits: 8,
  length: LONG_LENGTH,
  data: Array.from({ length: LONG_LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});
// Other peaks of the same length: new audio behind the same source URL.
const OTHER_WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: SAMPLE_RATE,
  samples_per_pixel: SOURCE_SCALE,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -20 : 20)),
});

function createFakePlayout() {
  const fake = {
    time: 0,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    // Reports its metadata as soon as it is asked: "ready" right after creation.
    on(event: string, listener: () => void) {
      if (event === 'loadedmetadata') queueMicrotask(listener);
    },
    off() {},
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

// The shared hooks (#688), grouped as the tests read them.
let probe: {
  animation: {
    isPlaying: boolean;
    currentTime: number;
    currentTimeRef: React.RefObject<number>;
  };
  controls: ReturnType<typeof usePlaybackControls>;
  data: ReturnType<typeof useMediaElementTrack>;
  state: ReturnType<typeof useActiveAnnotation>;
};

const ProbeChild: React.FC = () => {
  probe = {
    animation: {
      isPlaying: useIsPlaying().isPlaying,
      currentTime: useCurrentTime().currentTime,
      currentTimeRef: usePlaybackRefs().currentTimeRef,
    },
    controls: usePlaybackControls(),
    data: useMediaElementTrack(),
    state: useActiveAnnotation(),
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

/**
 * A consumer that puts the listener back where they were in each file: its
 * own effect, keyed on the source, as an app with a list of files would have.
 */
const SAVED: Record<string, { time: number; annotationId: string }> = {
  'other.mp3': { time: 5, annotationId: 'n2' },
  // Past the end of the 8 second file, inside the 16 second one.
  'long.mp3': { time: 12, annotationId: 'n2' },
};
const RestoreOnSource: React.FC<{ source: string }> = ({ source }) => {
  const { seekTo, setActiveAnnotationId } = usePlaybackControls();
  React.useEffect(() => {
    const saved = SAVED[source];
    if (!saved) return;
    seekTo(saved.time);
    setActiveAnnotationId(saved.annotationId);
  }, [source, seekTo, setActiveAnnotationId]);
  return null;
};

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
  restoreOnSource?: boolean;
  onReady?: () => void;
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
        onReady={options.onReady}
        automaticScroll={options.automaticScroll}
        annotationList={options.annotationList}
        timescale
      >
        <ProbeChild />
        {options.restoreOnSource ? <RestoreOnSource source={track.source} /> : null}
        {showPlaylist
          ? Array.from({ length: playlists }, (_, i) => (
              <MediaElementPlaylist key={i} renderPlayhead={options.renderPlayhead} />
            ))
          : null}
      </MediaElementPlaylistProvider>
    </Wrapper>
  );
  const view = render(tree(true));
  await waitFor(() => expect(probe.data.isReady).toBe(true));
  await waitFor(() => expect(document.querySelector('[data-playhead]')).not.toBeNull());
  await act(async () => {});
  return {
    playout,
    show: (showPlaylist: boolean, playlists = 1) => view.rerender(tree(showPlaylist, playlists)),
    /** Another track object: the provider creates its player again. */
    changeTrack: (change: Partial<typeof TRACK>) =>
      view.rerender(tree(true, 1, { ...TRACK, ...change })),
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

  it('a drag puts the cursor at its start and seeks once; a click collapses the selection and seeks', async () => {
    const { playout } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    expect(playout.seekTo).toHaveBeenCalledExactlyOnceWith(seconds(100));
    // A rightward drag keeps its start: the media element is not seeked per move.
    await moveTo(150);
    await moveTo(200);
    await release(200);
    expect(playout.seekTo).toHaveBeenCalledTimes(1);
    expect(probe.animation.currentTime).toBe(seconds(100));
    playout.seekTo.mockClear();

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

  it('controls.play() alone plays on from the cursor, and a press during playback restarts there', async () => {
    const { playout } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(200);
    await release(200);

    // The drag left the cursor at the selection's start. Without a duration
    // this is an open-ended play: playing the selection is the caller's
    // choice (`play(start, end - start)`), as under the WebAudio provider.
    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, seconds(100));
    playout.time = seconds(250);
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);

    await press(overlay, 250);
    expect(playout.play).toHaveBeenLastCalledWith(undefined, seconds(250));
    await release(300);
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

  it('new audio during playback: playback stops, and the cursor and the active annotation are reset', async () => {
    const { playout, changeTrack } = await mount({
      annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
    });
    await act(async () => probe.controls.seekTo(1));
    expect(probe.animation.currentTime).toBe(1);
    await act(async () => probe.controls.play());
    playout.time = 2.5;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
    expect(probe.state.activeAnnotationId).toBe('n2');

    // The provider disposes the player and creates another for the new source.
    await act(async () => changeTrack({ source: 'other.mp3' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.isPlaying).toBe(false);
    expect(registered.size).toBe(0);
    expect(frames.size).toBe(0);
    // The old position means nothing in the new audio.
    expect(probe.animation.currentTime).toBe(0);
    expect(probe.animation.currentTimeRef.current).toBe(0);
    expect(probe.state.activeAnnotationId).toBeNull();
    expect(playhead().style.transform).toBe('translate3d(0px, 0, 0)');
    expect(progressOverlay().style.transform).toBe('scaleX(0)');

    // Not playing, so the resting position is drawn: a seek moves the playhead.
    await act(async () => probe.controls.seekTo(3));
    expect(playhead().style.transform).toBe(`translate3d(${3 * PX_PER_SECOND}px, 0, 0)`);
    expect(progressOverlay().style.transform).toBe('scaleX(0.375)');
  });

  it('new audio while stopped after a seek also resets the cursor; the next play starts at 0', async () => {
    const { playout, changeTrack } = await mount();
    await act(async () => probe.controls.seekTo(3));
    expect(probe.animation.currentTime).toBe(3);

    await act(async () => changeTrack({ waveformData: OTHER_WAVEFORM_DATA }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.currentTime).toBe(0);
    expect(probe.animation.currentTimeRef.current).toBe(0);
    expect(playhead().style.transform).toBe('translate3d(0px, 0, 0)');

    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, 0);
    await act(async () => probe.controls.stop());
  });

  it('the same audio in a new player keeps the cursor and the active annotation', async () => {
    const { playout, changeTrack } = await mount({
      annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
    });
    await act(async () => probe.controls.play());
    playout.time = 2.5;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n2');

    // A new name: same source and peaks, but the player is created again.
    await act(async () => changeTrack({ name: 'Renamed' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTimeRef.current).toBe(2.5);
    // The resting position as state, for a consumer that shows it.
    expect(probe.animation.currentTime).toBe(2.5);
    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(playhead().style.transform).toBe(`translate3d(${2.5 * PX_PER_SECOND}px, 0, 0)`);

    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, 2.5);
    await act(async () => probe.controls.stop());
  });

  it("a child's own effect that restores a position for the new audio wins over the reset", async () => {
    const { playout, changeTrack } = await mount({
      annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
      restoreOnSource: true,
    });
    await act(async () => probe.controls.play());
    playout.time = 1;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n1');

    await act(async () => changeTrack({ source: 'other.mp3' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(5);
    expect(probe.animation.currentTimeRef.current).toBe(5);
    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(playhead().style.transform).toBe(`translate3d(${5 * PX_PER_SECOND}px, 0, 0)`);

    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, 5);
    await act(async () => probe.controls.stop());
  });

  it("a restore into a longer file is not capped at the old file's length", async () => {
    const { playout, changeTrack } = await mount({ restoreOnSource: true });
    await act(async () => changeTrack({ source: 'long.mp3', waveformData: LONG_WAVEFORM_DATA }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(probe.animation.currentTime).toBe(12);
    expect(probe.animation.currentTimeRef.current).toBe(12);
    await waitFor(() => expect(probe.data.duration).toBe(2 * SECONDS));
    // The position was stored while there was no player; the new player is
    // moved to it when it arrives, not only when Play is pressed.
    expect(playout.seekTo).toHaveBeenLastCalledWith(12);
    // So a pause() while stopped, which reads the player's time, keeps it.
    await act(async () => probe.controls.pause());
    expect(probe.animation.currentTime).toBe(12);

    await act(async () => probe.controls.play());
    expect(playout.play).toHaveBeenLastCalledWith(undefined, 12);
    await act(async () => probe.controls.stop());
  });

  it('a restore from onReady is not capped either, for the first file or a longer one', async () => {
    const targets = [3, 12];
    const onReady = vi.fn(() => probe.controls.seekTo(targets.shift() ?? 0));
    const { playout, changeTrack } = await mount({ onReady });
    // First file: the duration state is still 0 while onReady runs.
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(probe.animation.currentTime).toBe(3);

    await act(async () => changeTrack({ source: 'long.mp3', waveformData: LONG_WAVEFORM_DATA }));
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(probe.animation.currentTime).toBe(12);
    expect(playout.seekTo).toHaveBeenLastCalledWith(12);
  });

  it('a player that arrives with the cursor at 0 is not seeked', async () => {
    const { playout, changeTrack } = await mount();
    expect(playout.seekTo).not.toHaveBeenCalled();
    await act(async () => probe.controls.seekTo(3));
    playout.seekTo.mockClear();
    // New audio: the cursor is reset to 0, and the new player starts there.
    await act(async () => changeTrack({ source: 'other.mp3' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(playout.seekTo).not.toHaveBeenCalled();
  });

  it('the same audio in a new player: the new player is moved to the kept position', async () => {
    const { playout, changeTrack } = await mount();
    await act(async () => probe.controls.seekTo(3));
    playout.seekTo.mockClear();
    await act(async () => changeTrack({ name: 'Renamed' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(playout.seekTo).toHaveBeenCalledExactlyOnceWith(3));
    expect(probe.animation.currentTime).toBe(3);
  });

  it('a seek is still clamped to the length of the current file', async () => {
    const { playout, changeTrack } = await mount();
    await act(async () => probe.controls.seekTo(99));
    expect(probe.animation.currentTime).toBe(SECONDS);

    await act(async () => changeTrack({ source: 'long.mp3', waveformData: LONG_WAVEFORM_DATA }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    await act(async () => probe.controls.seekTo(99));
    expect(probe.animation.currentTime).toBe(2 * SECONDS);
    await act(async () => probe.controls.seekTo(-1));
    expect(probe.animation.currentTime).toBe(0);
  });

  it('the selection is kept across new audio', async () => {
    const { playout, changeTrack } = await mount();
    const overlay = clickOverlay();
    await press(overlay, 100);
    await moveTo(200);
    await release(200);
    await act(async () => changeTrack({ source: 'other.mp3' }));
    await waitFor(() => expect(playout.addTrack).toHaveBeenCalledTimes(2));
    expect(selections()).toHaveLength(1);
    expect(selections()[0].style.left).toBe('100px');
  });

  it('unmounting the provider during playback resets nothing and throws nothing', async () => {
    await mount();
    await act(async () => probe.controls.seekTo(2));
    await act(async () => probe.controls.play());
    const before = probe.animation.currentTimeRef.current;
    await act(async () => {
      cleanup();
    });
    expect(probe.animation.currentTimeRef.current).toBe(before);
    expect(frames.size).toBe(0);
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
    // Paused and moved back to where playback started, not rewound to 0 by
    // the engine's stop() (#688).
    expect(playout.pause).toHaveBeenCalledTimes(1);
    expect(playout.stop).not.toHaveBeenCalled();
    expect(playout.seekTo).toHaveBeenLastCalledWith(0);
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

describe('what #769 shares between the providers stays internal', () => {
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
    // The entry is the real one: a hook it does export is there.
    expect(entry.useMediaElementTrack).toBeDefined();
  });

  // The fields of each hook under this provider are pinned in
  // sharedPlaybackInterface.test.tsx ("each returns exactly its documented
  // fields", "the MediaElement-only hooks return exactly their documented fields").
});
