// @vitest-environment jsdom
//
// #688, part 1: MediaElementPlaylistProvider plays, stops, seeks and selects
// the way WaveformPlaylistProvider does, so one set of controls can serve
// both. Each case here is a behaviour the maintainer chose (2026-11-11).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  useIsPlaying,
  useCurrentTime,
  usePlaybackRefs,
  usePlaybackControls,
  useMediaElementTrack,
  useActiveAnnotation,
  useSelection,
} from '../contexts/playlistContexts';
import { ComposedMediaElementWaveform } from './testCompositions';

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SAMPLES_PER_PIXEL = 882; // 50 px per second
const PX_PER_SECOND = SAMPLE_RATE / SAMPLES_PER_PIXEL;
const SECONDS = 8;
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;

const waveform = (length: number) =>
  WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: SOURCE_SCALE,
    bits: 8,
    length,
    data: Array.from({ length: length * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
  });

const TRACK = { source: 'test.mp3', waveformData: waveform(LENGTH), name: 'Test' };
const OTHER_TRACK = { source: 'other.mp3', waveformData: waveform(LENGTH), name: 'Other' };

type Listener = (...args: unknown[]) => void;

function createFakePlayout() {
  const listeners = new Map<string, Set<Listener>>();
  const fake = {
    time: 0,
    complete: undefined as (() => void) | undefined,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete(callback: () => void) {
      fake.complete = callback;
    },
    on(event: string, listener: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((listener) => listener(...args));
    },
    play: vi.fn((_when?: number, offset?: number) => {
      fake.time = offset ?? 0;
    }),
    pause: vi.fn(),
    stop: vi.fn(() => {
      fake.time = 0;
    }),
    seekTo: vi.fn((time: number) => {
      fake.time = time;
    }),
    setPlaybackRate() {},
    getCurrentTime: () => fake.time,
    dispose: vi.fn(),
  };
  return fake;
}
type FakePlayout = ReturnType<typeof createFakePlayout>;

// The shared hooks (#688, part 2), grouped as the tests read them.
let probe: {
  animation: {
    isPlaying: boolean;
    currentTime: number;
    currentTimeRef: React.RefObject<number>;
  };
  controls: ReturnType<typeof usePlaybackControls>;
  data: ReturnType<typeof useMediaElementTrack>;
  state: ReturnType<typeof useActiveAnnotation>;
  selection: ReturnType<typeof useSelection>;
};
let firstRender: { duration: number; peaks: number; isReady: boolean } | null;

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
    selection: useSelection(),
  };
  if (firstRender === null) {
    firstRender = {
      duration: probe.data.duration,
      peaks: probe.data.peaksDataArray.length,
      isReady: probe.data.isReady,
    };
  }
  return null;
};

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  firstRender = null;
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
  { id: 'n3', start: 4, end: 6, lines: ['three'] },
];

interface MountOptions {
  automaticScroll?: boolean;
  annotationList?: { annotations: typeof ANNOTATIONS; isContinuousPlay?: boolean };
  onReady?: () => void;
  onError?: (err: Error) => void;
  /** Leave the media "loading": no loadedmetadata until the test emits it. */
  holdMetadata?: boolean;
  /** Hold the player itself back until the test calls `deliver()`. */
  holdPlayer?: boolean;
  playlist?: boolean;
}

async function mount(options: MountOptions = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const playouts: FakePlayout[] = [];
  const gates: Array<() => void> = [];
  // Stable: an inline factory would recreate the player on every render.
  const createPlayout = (() => {
    const playout = createFakePlayout();
    playouts.push(playout);
    if (!options.holdPlayer) return playout;
    return new Promise((resolve) => {
      gates.push(() => resolve(playout));
    });
  }) as unknown as () => MediaElementPlayout;
  const tree = (track = TRACK) => (
    <MediaElementPlaylistProvider
      track={track}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      createPlayout={createPlayout}
      onReady={options.onReady}
      onError={options.onError}
      annotationList={options.annotationList}
      automaticScroll={options.automaticScroll}
    >
      <ProbeChild />
      {options.playlist ? <ComposedMediaElementWaveform /> : null}
    </MediaElementPlaylistProvider>
  );
  const view = render(tree());
  await act(async () => {});
  const latest = () => playouts[playouts.length - 1];
  const loadMetadata = async () => {
    await act(async () => latest().emit('loadedmetadata'));
  };
  if (!options.holdPlayer && !options.holdMetadata) {
    await loadMetadata();
    await waitFor(() => expect(probe.data.isReady).toBe(true));
  }
  return {
    playout: latest,
    loadMetadata,
    /** Hand over the player that was held back. */
    deliver: async () => {
      await act(async () => {
        gates.shift()?.();
      });
      await act(async () => {});
    },
    changeTrack: async (track: typeof TRACK) => {
      view.rerender(tree(track));
      await act(async () => {});
    },
  };
}

async function playing(playout: FakePlayout, from: number, to: number) {
  await act(async () => {
    await probe.controls.play(from);
  });
  playout.time = to;
  await runFrame();
}

describe('Stop and the ends of playback return the cursor to where playback started', () => {
  it('Stop: the cursor goes back to the play start, and the player is moved there', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.seekTo(3));
    await playing(playout(), 3, 5);

    await act(async () => probe.controls.stop());

    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
    expect(probe.animation.currentTimeRef.current).toBe(3);
    expect(playout().getCurrentTime()).toBe(3);
    expect(frames.size).toBe(0);
  });

  it('Stop after a pause still returns to the play start', async () => {
    const { playout } = await mount();
    await playing(playout(), 1, 4);
    await act(async () => probe.controls.pause());
    expect(probe.animation.currentTime).toBe(4);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(1);
  });

  it('a seek while stopped is the new resting place: Stop does not move it', async () => {
    const { playout } = await mount();
    await playing(playout(), 1, 4);
    await act(async () => probe.controls.stop());
    await act(async () => probe.controls.seekTo(6));

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(6);
    expect(playout().getCurrentTime()).toBe(6);
  });

  it('the audio reaching its end returns the cursor to the play start', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await playing(playout(), 5, 7.9);

    await act(async () => {
      playout().time = SECONDS;
      playout().complete?.();
    });

    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(5);
    expect(probe.animation.currentTimeRef.current).toBe(5);
    expect(playout().getCurrentTime()).toBe(5);
    expect(probe.state.activeAnnotationId).toBeNull();
  });

  it('an annotation that plays to its end, continuous play off: the cursor returns to its start', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
      await probe.controls.play(2);
    });
    playout().time = 3.9;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);

    playout().time = 4;
    await runFrame();

    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2);
    expect(probe.animation.currentTimeRef.current).toBe(2);
    expect(playout().getCurrentTime()).toBe(2);
    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(frames.size).toBe(0);
  });
});

describe('play(start, duration)', () => {
  it('returns a promise', async () => {
    await mount();
    let result: unknown;
    await act(async () => {
      result = probe.controls.play(0);
      await result;
    });
    expect(result).toBeInstanceOf(Promise);
  });

  it('plays the range and stops, leaving the cursor at its end', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 2);

    playout().time = 4.9;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);

    playout().time = 5.01;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(5);
    expect(playout().getCurrentTime()).toBe(5);
    expect(frames.size).toBe(0);

    // The end belongs to that play only: the next one runs on.
    await playing(playout(), 5, 6);
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('a bounded play is not cut at annotation boundaries when it is the selection', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => probe.controls.setSelection(1, 5));
    await act(async () => {
      await probe.controls.play(1, 4);
    });
    playout().time = 2.5;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
    expect(probe.state.activeAnnotationId).toBe('n2');
    playout().time = 4.5;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
  });
});

describe('the selection is played, and setting it moves the cursor', () => {
  it('setSelection moves the cursor and the player to the start', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(2, 5));

    expect(probe.selection).toEqual({ selectionStart: 2, selectionEnd: 5 });
    expect(probe.animation.currentTime).toBe(2);
    expect(probe.animation.currentTimeRef.current).toBe(2);
    expect(playout().getCurrentTime()).toBe(2);
    expect(probe.animation.isPlaying).toBe(false);
  });

  it('playing the selection stops at its end and returns the cursor to its start', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(2, 5));
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    playout().time = 5;
    await runFrame();

    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2);
    expect(playout().getCurrentTime()).toBe(2);
  });

  it('resumed inside the selection, Stop and the end both return to the selection start', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(2, 5));
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    playout().time = 3.5;
    await runFrame();
    await act(async () => probe.controls.pause());
    expect(probe.animation.currentTime).toBe(3.5);

    await act(async () => {
      await probe.controls.play(3.5, 1.5);
    });
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(2);

    await act(async () => {
      await probe.controls.play(3.5, 1.5);
    });
    playout().time = 5;
    await runFrame();
    expect(probe.animation.currentTime).toBe(2);
  });

  it('a range set during playback restarts as selection playback', async () => {
    const { playout } = await mount();
    await playing(playout(), 0, 1);

    await act(async () => probe.controls.setSelection(3, 4));
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 3);
    expect(probe.animation.isPlaying).toBe(true);

    playout().time = 4;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
  });

  it('a collapsed selection during playback carries on open-ended from there', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(1, 2));
    await act(async () => {
      await probe.controls.play(1, 1);
    });

    await act(async () => probe.controls.setSelection(6, 6));
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 6);
    playout().time = 7;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(6);
  });
});

describe('the drag in the MediaElement view', () => {
  function overlay(): HTMLElement {
    const playhead = document.querySelector('[data-playhead]') as HTMLElement;
    const element = playhead.parentElement!.lastElementChild as HTMLElement;
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: SECONDS * PX_PER_SECOND, height: 100 }) as DOMRect;
    return element;
  }
  const press = (x: number) =>
    act(async () => {
      fireEvent.mouseDown(overlay(), { button: 0, clientX: x, clientY: 5 });
    });
  const moveTo = (x: number) =>
    act(async () => {
      fireEvent.mouseMove(window, { button: 0, buttons: 1, clientX: x, clientY: 5 });
    });
  const release = (x: number) =>
    act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: x, clientY: 5 });
    });

  it('a drag while stopped stores the range in order and puts the cursor at its start', async () => {
    await mount({ playlist: true });
    await press(200);
    await moveTo(100);
    expect(probe.selection).toEqual({ selectionStart: 2, selectionEnd: 4 });
    expect(probe.animation.currentTime).toBe(2);
    await release(100);
    expect(probe.selection).toEqual({ selectionStart: 2, selectionEnd: 4 });
    expect(probe.animation.currentTime).toBe(2);
  });

  it('a drag shorter than a tenth of a second is a click: nothing stays selected', async () => {
    await mount({ playlist: true });
    await press(100);
    await moveTo(102);
    expect(probe.selection).toEqual({ selectionStart: 2, selectionEnd: 2.04 });
    await release(102);
    expect(probe.selection).toEqual({ selectionStart: 2, selectionEnd: 2 });
    expect(probe.animation.currentTime).toBe(2);
  });

  it('while playing: the press changes nothing, the drag is previewed, the release selects the range and plays it', async () => {
    const { playout } = await mount({ playlist: true });
    await playing(playout(), 0, 1);
    const playsBefore = playout().play.mock.calls.length;
    const selectionBefore = probe.selection;
    const highlights = () => document.querySelectorAll('[data-selection]').length;

    await press(250);
    expect(playout().play.mock.calls.length).toBe(playsBefore);
    expect(probe.selection).toEqual(selectionBefore);
    expect(highlights()).toBe(0);

    await moveTo(350);
    // Drawn, and not the selection yet: playback has not been touched.
    expect(highlights()).toBe(1);
    expect(probe.selection).toEqual(selectionBefore);
    expect(playout().play.mock.calls.length).toBe(playsBefore);

    await release(350);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 7 });
    expect(highlights()).toBe(1);
    expect(probe.animation.isPlaying).toBe(true);
    expect(playout().play.mock.calls.length).toBe(playsBefore + 1);
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 5);
  });

  it('while playing: a click moves playback there on the release, not on the press', async () => {
    const { playout } = await mount({ playlist: true });
    await playing(playout(), 0, 1);
    const playsBefore = playout().play.mock.calls.length;

    await press(250);
    expect(playout().play.mock.calls.length).toBe(playsBefore);
    await release(250);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 5 });
    expect(playout().play.mock.calls.length).toBe(playsBefore + 1);
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 5);
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('while playing with automatic scroll on: no range is drawn, and the release seeks once to the press', async () => {
    const { playout } = await mount({ playlist: true, automaticScroll: true });
    await playing(playout(), 0, 1);
    const playsBefore = playout().play.mock.calls.length;

    await press(250);
    await moveTo(350);
    expect(document.querySelectorAll('[data-selection]').length).toBe(0);
    expect(playout().play.mock.calls.length).toBe(playsBefore);

    await release(350);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 5 });
    expect(document.querySelectorAll('[data-selection]').length).toBe(0);
    expect(playout().play.mock.calls.length).toBe(playsBefore + 1);
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 5);
    expect(probe.animation.isPlaying).toBe(true);
  });
});

describe('seekTo', () => {
  it('while playing restarts playback at the position, so fades are scheduled again', async () => {
    const { playout } = await mount();
    await playing(playout(), 0, 1);
    playout().play.mockClear();
    playout().seekTo.mockClear();

    await act(async () => probe.controls.seekTo(6));

    expect(playout().play).toHaveBeenCalledTimes(1);
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 6);
    expect(playout().seekTo).not.toHaveBeenCalled();
    expect(probe.animation.isPlaying).toBe(true);
    expect(probe.animation.currentTime).toBe(6);

    // It is a new play: Stop returns here, and the old end is gone.
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(6);
  });

  it('while playing a range, a seek carries on open-ended', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(1, 1);
    });
    await act(async () => probe.controls.seekTo(4));
    playout().time = 7;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('while stopped only moves the player', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.seekTo(6));
    expect(playout().play).not.toHaveBeenCalled();
    expect(playout().seekTo).toHaveBeenLastCalledWith(6);
  });
});

describe('duration and peaks come from the track; readiness is its own flag', () => {
  it('the first render already has the duration and the peaks, and is not ready', async () => {
    await mount({ holdMetadata: true });
    expect(firstRender).toEqual({ duration: SECONDS, peaks: 1, isReady: false });
  });

  it('draws the waveform before the player exists', async () => {
    await mount({ holdPlayer: true, playlist: true });
    expect(document.querySelector('[data-playhead]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Loading waveform');
  });

  it('isReady and onReady follow the loadedmetadata event, not the creation of the player', async () => {
    const onReady = vi.fn();
    const { playout, loadMetadata } = await mount({ holdMetadata: true, onReady });
    expect(playout().addTrack).toHaveBeenCalledTimes(1);
    expect(probe.data.playoutRef.current).not.toBeNull();
    expect(probe.data.isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    await loadMetadata();
    expect(probe.data.isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('a replaced player is not ready until its own metadata has loaded', async () => {
    const onReady = vi.fn();
    const { changeTrack, loadMetadata } = await mount({ onReady });
    expect(onReady).toHaveBeenCalledTimes(1);

    await changeTrack(OTHER_TRACK);
    expect(probe.data.isReady).toBe(false);
    await loadMetadata();
    expect(probe.data.isReady).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it('the metadata of a player that was already replaced is ignored', async () => {
    const onReady = vi.fn();
    const { playout, changeTrack } = await mount({ holdMetadata: true, onReady });
    const first = playout();
    await changeTrack(OTHER_TRACK);
    await act(async () => first.emit('loadedmetadata'));
    expect(probe.data.isReady).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('a media error reaches onError and the player never becomes ready', async () => {
    const onError = vi.fn();
    const { playout } = await mount({ holdMetadata: true, onError });
    await act(async () => playout().emit('error', { code: 4, message: 'not supported' }));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    // The code and the browser's text, and NOT the URL (it may carry a token).
    expect(String(onError.mock.calls[0][0].message)).toBe(
      'Media failed to load (code 4: not supported)'
    );
    expect(probe.data.isReady).toBe(false);
  });
});

describe('Play before the player exists is queued', () => {
  it('starts when the player arrives; isPlaying stays false until then', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(3);
    });
    expect(probe.animation.isPlaying).toBe(false);
    expect(playout().play).not.toHaveBeenCalled();

    await deliver();
    expect(playout().play).toHaveBeenCalledTimes(1);
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 3);
    expect(probe.animation.isPlaying).toBe(true);
    expect(frames.size).toBe(1);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(3);
  });

  it('a queued range keeps its end', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(1, 2);
    });
    await deliver();
    playout().time = 3;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
  });

  it.each(['stop', 'pause'] as const)('%s cancels it', async (action) => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(3);
    });
    await act(async () => probe.controls[action]());
    // The cancelled play had moved the cursor to its start: the state shows
    // it, and agrees with the ref the next Play starts from.
    expect(probe.animation.currentTimeRef.current).toBe(3);
    expect(probe.animation.currentTime).toBe(3);
    await deliver();
    expect(playout().play).not.toHaveBeenCalled();
    expect(probe.animation.isPlaying).toBe(false);
  });

  it('new audio drops it', async () => {
    const { playout, deliver, changeTrack } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(3);
    });
    await changeTrack(OTHER_TRACK);
    await deliver();
    await deliver();
    expect(playout().play).not.toHaveBeenCalled();
    expect(probe.animation.isPlaying).toBe(false);
  });

  it('is not queued when the player failed to arrive', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();
    const createPlayout = (() => {
      throw new Error('no engine');
    }) as unknown as () => MediaElementPlayout;
    render(
      <MediaElementPlaylistProvider track={TRACK} createPlayout={createPlayout} onError={onError}>
        <ProbeChild />
      </MediaElementPlaylistProvider>
    );
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await act(async () => {
      await probe.controls.play(3);
    });
    // Nothing will ever start it: the cursor is left alone.
    expect(probe.animation.currentTimeRef.current).toBe(0);
    expect(probe.animation.isPlaying).toBe(false);
  });
});

describe('a custom playout must report its events', () => {
  it('one without on() is reported through onError', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();
    const bare = { ...createFakePlayout(), on: undefined };
    const createPlayout = (() => bare) as unknown as () => MediaElementPlayout;
    render(
      <MediaElementPlaylistProvider track={TRACK} createPlayout={createPlayout} onError={onError}>
        <ProbeChild />
      </MediaElementPlaylistProvider>
    );
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(probe.data.isReady).toBe(false);
  });
});

// Annotations that cover the audio to its end.
const TO_THE_END = [...ANNOTATIONS, { id: 'n4', start: 6, end: 8, lines: ['four'] }];

describe('ends of playback, the cases a mutation run found untested', () => {
  it('the audio ending clears the active annotation', async () => {
    const { playout } = await mount({
      annotationList: { annotations: TO_THE_END, isContinuousPlay: true },
    });
    await playing(playout(), 5, 7.9);
    expect(probe.state.activeAnnotationId).toBe('n4');

    await act(async () => playout().complete?.());
    expect(probe.state.activeAnnotationId).toBeNull();
    expect(probe.animation.currentTime).toBe(5);
  });

  it('a range that runs past the end of the audio rests at the end of the audio', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(6, 5);
    });
    playout().time = 7.9;
    await runFrame();

    await act(async () => playout().complete?.());
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(SECONDS);
  });

  it('Stop clears the active annotation', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
      await probe.controls.play(0);
    });
    playout().time = 1;
    await runFrame();
    await act(async () => probe.controls.stop());
    expect(probe.state.activeAnnotationId).toBeNull();
  });

  it('new audio: Stop no longer returns to a position in the old audio', async () => {
    const { playout, changeTrack, loadMetadata } = await mount();
    await playing(playout(), 3, 4);
    await changeTrack(OTHER_TRACK);
    await loadMetadata();
    expect(probe.animation.currentTime).toBe(0);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(0);
  });

  it('the selection ending on an annotation boundary keeps the highlight on the annotation that played', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => probe.controls.setSelection(1, 2));
    await act(async () => {
      await probe.controls.play(1, 1);
    });
    playout().time = 1.5;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n1');

    // 2 is the end of n1 and the start of n2.
    playout().time = 2;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.state.activeAnnotationId).toBe('n1');
  });
});

describe('what counts as playing the selection', () => {
  // The selection is 2 to 5. Only a play that starts inside it and ends at
  // its end returns the cursor to its start; any other range rests at its end.
  it.each([
    { name: 'starts before the selection', start: 1, duration: 4, restsAt: 5 },
    { name: 'starts at the end of the selection', start: 5, duration: 0, restsAt: 5 },
    { name: 'ends inside the selection', start: 3, duration: 1, restsAt: 4 },
    { name: 'starts inside and ends at its end', start: 3, duration: 2, restsAt: 2 },
  ])('a play that $name rests at $restsAt', async ({ start, duration, restsAt }) => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(2, 5));
    await act(async () => {
      await probe.controls.play(start, duration);
    });
    playout().time = start + duration;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(restsAt);
  });

  it('a seek during selection playback ends it: annotation ends stop playback again', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => probe.controls.setSelection(1, 5));
    await act(async () => {
      await probe.controls.play(1, 4);
    });
    await act(async () => probe.controls.seekTo(2.5));
    playout().time = 2.6;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n2');

    playout().time = 4;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2.5);
  });
});

describe('setSelection, the remaining cases', () => {
  it('while stopped it is the new resting place: Stop does not go back to an old play start', async () => {
    const { playout } = await mount();
    await playing(playout(), 1, 2);
    await act(async () => probe.controls.stop());
    await act(async () => probe.controls.setSelection(4, 4));

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(4);
  });

  it('during an annotation play it replaces that play: the old annotation does not stop it', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
      await probe.controls.play(0);
    });
    playout().time = 1;
    await runFrame();

    await act(async () => probe.controls.setSelection(5, 5));
    expect(probe.state.activeAnnotationId).toBeNull();
    playout().time = 5.1;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
  });
});

describe('a queued play follows what happens before the player arrives', () => {
  it('a seek re-points it and drops its end', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(1, 2);
    });
    await act(async () => probe.controls.seekTo(4));
    await deliver();
    expect(playout().play).toHaveBeenCalledExactlyOnceWith(undefined, 4);
    playout().time = 7;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('a selection re-points it and gives it the selection end', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(1);
    });
    await act(async () => probe.controls.setSelection(3, 4));
    await deliver();
    expect(playout().play).toHaveBeenCalledExactlyOnceWith(undefined, 3);
    playout().time = 4;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
  });

  it('once started it is no longer queued: a seek restarts the running play', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(1);
    });
    await deliver();
    await act(async () => probe.controls.seekTo(5));
    expect(playout().play).toHaveBeenLastCalledWith(undefined, 5);
  });
});

describe('a hidden tab: no animation frames, the media element still reports its time', () => {
  it('a range ends from the timeupdate event alone', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    await act(async () => playout().emit('timeupdate', 4.9));
    expect(probe.animation.isPlaying).toBe(true);
    expect(probe.animation.currentTimeRef.current).toBe(4.9);

    await act(async () => playout().emit('timeupdate', 5.2));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(5);
    expect(playout().getCurrentTime()).toBe(5);
    expect(frames.size).toBe(0);
  });

  it('the selection ends from the timeupdate event and returns to its start', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.setSelection(2, 5));
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    await act(async () => playout().emit('timeupdate', 5.1));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2);
  });

  it('an annotation ends from the timeupdate event, continuous play off', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
      await probe.controls.play(2);
    });
    await act(async () => playout().emit('timeupdate', 4.1));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2);
  });

  it('with continuous play on the highlight follows from the timeupdate event', async () => {
    const { playout } = await mount({
      annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
    });
    await act(async () => {
      await probe.controls.play(0);
    });
    await act(async () => playout().emit('timeupdate', 2.5));
    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('while not playing it only keeps the cursor ref current', async () => {
    const { playout } = await mount({ annotationList: { annotations: ANNOTATIONS } });
    await act(async () => playout().emit('timeupdate', 2.5));
    expect(probe.animation.currentTimeRef.current).toBe(2.5);
    expect(probe.state.activeAnnotationId).toBeNull();
    expect(playout().pause).not.toHaveBeenCalled();
  });

  it('a report from a player that was replaced is ignored', async () => {
    const { playout, changeTrack } = await mount();
    const first = playout();
    await changeTrack(OTHER_TRACK);
    await act(async () => first.emit('timeupdate', 6));
    expect(probe.animation.currentTimeRef.current).toBe(0);
  });
});

describe('players that are gone', () => {
  it('a play queued for a player that failed to arrive does not start on a later one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onError = vi.fn();
    let fail: (reason: Error) => void = () => {};
    const later = createFakePlayout();
    let calls = 0;
    const createPlayout = (() => {
      calls++;
      if (calls > 1) return later;
      return new Promise((_resolve, reject) => {
        fail = reject;
      });
    }) as unknown as () => MediaElementPlayout;
    const tree = (track: typeof TRACK) => (
      <MediaElementPlaylistProvider track={track} createPlayout={createPlayout} onError={onError}>
        <ProbeChild />
      </MediaElementPlaylistProvider>
    );
    const view = render(tree(TRACK));
    await act(async () => {});
    await act(async () => {
      await probe.controls.play(3);
    });
    await act(async () => fail(new Error('no engine')));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    // The play that will never start had moved the cursor: ref and state agree.
    expect(probe.animation.currentTimeRef.current).toBe(3);
    expect(probe.animation.currentTime).toBe(3);

    // The same audio in a new player (only the name differs): the cursor is
    // kept, and the play that failed must not come back to life.
    view.rerender(tree({ ...TRACK, name: 'Renamed' }));
    await act(async () => {});
    expect(probe.data.playoutRef.current).toBe(later);
    expect(later.play).not.toHaveBeenCalled();
    expect(probe.animation.isPlaying).toBe(false);
  });

  it('the end-of-audio report of a replaced player does not touch the new one', async () => {
    const { playout, changeTrack } = await mount();
    const first = playout();
    await playing(first, 3, 4);
    await changeTrack(OTHER_TRACK);
    const second = playout();
    expect(second).not.toBe(first);

    await act(async () => first.complete?.());
    expect(second.pause).not.toHaveBeenCalled();
    expect(second.seekTo).not.toHaveBeenCalled();

    // Nor while the new player is playing: its play is not ended by it.
    await playing(second, 1, 2);
    await act(async () => first.complete?.());
    expect(probe.animation.isPlaying).toBe(true);
    expect(second.pause).not.toHaveBeenCalled();
  });
});

describe('review round 1 (#782)', () => {
  // Children's effects run before the provider's: the play arrives before the
  // provider has started creating its player.
  const PlayOnMount: React.FC<{ source: string }> = ({ source }) => {
    const { play } = usePlaybackControls();
    React.useEffect(() => {
      void play(2);
    }, [play, source]);
    return null;
  };

  it("a play() from a child's mount effect is queued and starts when the player arrives", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playout = createFakePlayout();
    const createPlayout = (() => playout) as unknown as () => MediaElementPlayout;
    render(
      <MediaElementPlaylistProvider track={TRACK} createPlayout={createPlayout}>
        <ProbeChild />
        <PlayOnMount source={TRACK.source} />
      </MediaElementPlaylistProvider>
    );
    await act(async () => {});
    expect(playout.play).toHaveBeenCalledExactlyOnceWith(undefined, 2);
    expect(probe.animation.isPlaying).toBe(true);
  });

  it("after a failed init, a play() from a child's effect on the next track is queued too", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const second = createFakePlayout();
    let calls = 0;
    const createPlayout = (() => {
      calls++;
      if (calls === 1) throw new Error('no engine');
      return second;
    }) as unknown as () => MediaElementPlayout;
    const onError = vi.fn();
    const tree = (track: typeof TRACK, playOnMount: boolean) => (
      <MediaElementPlaylistProvider track={track} createPlayout={createPlayout} onError={onError}>
        <ProbeChild />
        {playOnMount ? <PlayOnMount source={track.source} /> : null}
      </MediaElementPlaylistProvider>
    );
    const view = render(tree(TRACK, false));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    view.rerender(tree(OTHER_TRACK, true));
    await act(async () => {});
    expect(second.play).toHaveBeenCalledExactlyOnceWith(undefined, 2);
  });

  it('a range that ends at the end of the audio rests at its end: the ended event after it changes nothing', async () => {
    const { playout } = await mount({
      annotationList: { annotations: TO_THE_END, isContinuousPlay: true },
    });
    await act(async () => {
      await probe.controls.play(6, 2);
    });
    playout().time = 7;
    await runFrame();
    expect(probe.state.activeAnnotationId).toBe('n4');

    // The media element reports its last position, then that it has ended.
    await act(async () => {
      playout().time = SECONDS;
      playout().emit('timeupdate', SECONDS);
    });
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(SECONDS);
    await act(async () => playout().complete?.());

    expect(probe.animation.currentTime).toBe(SECONDS);
    expect(probe.animation.currentTimeRef.current).toBe(SECONDS);
    expect(probe.state.activeAnnotationId).toBe('n4');
  });

  it('Stop pressed while stopped does not go back to the start of a range that played out', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    playout().time = 5;
    await runFrame();
    expect(probe.animation.currentTime).toBe(5);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(5);
    expect(playout().getCurrentTime()).toBe(5);
  });

  it('Stop after a pause still returns to the play start (a pause is not a rest)', async () => {
    const { playout } = await mount();
    await act(async () => {
      await probe.controls.play(2, 3);
    });
    playout().time = 4;
    await runFrame();
    await act(async () => probe.controls.pause());
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(2);
  });

  it('the same audio in a new player during playback: a Stop afterwards leaves the cursor where the listener was', async () => {
    const { playout, changeTrack } = await mount();
    await playing(playout(), 1, 4);
    await changeTrack({ ...TRACK, name: 'Renamed' });
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(4);

    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(4);
  });

  it('a media error during playback ends playback where it was and reports it', async () => {
    const onError = vi.fn();
    const { playout } = await mount({ onError });
    await playing(playout(), 1, 3);

    await act(async () => playout().emit('error', { code: 2, message: 'network' }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
    expect(frames.size).toBe(0);
  });

  it('a media error while stopped does not touch the cursor or the player', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.seekTo(3));
    playout().pause.mockClear();
    await act(async () => playout().emit('error', null));
    expect(playout().pause).not.toHaveBeenCalled();
    expect(probe.animation.currentTime).toBe(3);
  });

  it('a play the browser refuses does not leave isPlaying true', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(3);
    });
    await deliver();
    expect(probe.animation.isPlaying).toBe(true);

    await act(async () => playout().emit('playrejected', new Error('NotAllowedError')));
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(3);
    expect(frames.size).toBe(0);
  });

  it('a refusal reported by a player that was replaced is ignored', async () => {
    const { playout, changeTrack } = await mount();
    const first = playout();
    await changeTrack(OTHER_TRACK);
    await playing(playout(), 1, 2);
    await act(async () => first.emit('playrejected', new Error('late')));
    await act(async () => first.emit('error', null));
    expect(probe.animation.isPlaying).toBe(true);
  });
});

describe('review round 2 (#782)', () => {
  it('under StrictMode a play() from a mount effect starts once, on the player that is kept', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playouts: FakePlayout[] = [];
    // A factory: each init gets its own player, as with the bundled engine.
    const createPlayout = (() => {
      const playout = createFakePlayout();
      playouts.push(playout);
      return playout;
    }) as unknown as () => MediaElementPlayout;
    const PlayOnMount: React.FC = () => {
      const { play } = usePlaybackControls();
      React.useEffect(() => {
        void play(2);
      }, [play]);
      return null;
    };
    render(
      <React.StrictMode>
        <MediaElementPlaylistProvider track={TRACK} createPlayout={createPlayout}>
          <ProbeChild />
          <PlayOnMount />
        </MediaElementPlaylistProvider>
      </React.StrictMode>
    );
    await act(async () => {});

    const started = playouts.filter((playout) => playout.play.mock.calls.length > 0);
    expect(started).toHaveLength(1);
    expect(started[0].play).toHaveBeenCalledExactlyOnceWith(undefined, 2);
    expect(started[0].dispose).not.toHaveBeenCalled();
    expect(probe.data.playoutRef.current).toBe(started[0]);
    expect(probe.animation.isPlaying).toBe(true);
  });

  it('a refusal reported while stopped or paused changes nothing', async () => {
    const { playout } = await mount();
    await act(async () => probe.controls.seekTo(3));
    playout().pause.mockClear();
    playout().seekTo.mockClear();
    await act(async () => playout().emit('playrejected', new Error('late')));
    expect(playout().pause).not.toHaveBeenCalled();
    expect(playout().seekTo).not.toHaveBeenCalled();

    await playing(playout(), 3, 4);
    await act(async () => probe.controls.pause());
    playout().seekTo.mockClear();
    await act(async () => playout().emit('playrejected', new Error('late')));
    expect(playout().seekTo).not.toHaveBeenCalled();
    // Still paused, not rested: Stop returns to the play start.
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(3);
  });

  it('a media error with no details still has a message', async () => {
    const onError = vi.fn();
    const { playout } = await mount({ holdMetadata: true, onError });
    await act(async () => playout().emit('error', null));
    expect(String(onError.mock.calls[0][0].message)).toBe('Media failed to load');
  });

  it('a queued selection resume keeps the selection start across a same-audio replacement', async () => {
    const { playout, deliver, changeTrack } = await mount({ holdPlayer: true });
    await act(async () => probe.controls.setSelection(2, 5));
    // Resume part-way: the cursor is at 3.5, the selection starts at 2.
    await act(async () => {
      await probe.controls.play(3.5, 1.5);
    });
    await changeTrack({ ...TRACK, name: 'Renamed' });
    await deliver();
    await deliver();
    expect(playout().play).toHaveBeenCalledExactlyOnceWith(undefined, 3.5);

    playout().time = 5;
    await runFrame();
    expect(probe.animation.isPlaying).toBe(false);
    expect(probe.animation.currentTime).toBe(2);
  });

  it('Stop while a play is queued cancels it and leaves cursor and state at its start', async () => {
    const { playout, deliver } = await mount({ holdPlayer: true });
    await act(async () => {
      await probe.controls.play(3);
    });
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(3);
    expect(probe.animation.currentTimeRef.current).toBe(3);
    await deliver();
    expect(playout().play).not.toHaveBeenCalled();
    // The player that arrives is moved to the cursor.
    expect(playout().getCurrentTime()).toBe(3);
  });

  it('a pause, then the same audio in a new player: Stop leaves the cursor at the paused position', async () => {
    const { playout, changeTrack } = await mount();
    await playing(playout(), 1, 4);
    await act(async () => probe.controls.pause());
    await changeTrack({ ...TRACK, name: 'Renamed' });
    await act(async () => probe.controls.stop());
    expect(probe.animation.currentTime).toBe(4);
  });
});
