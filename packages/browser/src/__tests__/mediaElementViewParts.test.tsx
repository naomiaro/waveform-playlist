// @vitest-environment jsdom
//
// #685, part 2. The MediaElement view is a root with the same parts as the
// multitrack view: the tracks part, the timescale part, the shared overlays.
// What that changes for a consumer is asserted here: the rows of the upgrade
// guide's table about markup, fades, the controls column and the failure case,
// and the two call-frequency rows (for `renderPlayhead` the press and its
// release only).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { WaveformDataObject } from '@waveform-playlist/core';

const counts = vi.hoisted(() => ({ clip: 0, channel: 0, track: 0, frame: 0, scale: 0, layout: 0 }));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clip++;
      return createElement(actual.Clip, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.channel++;
      return createElement(actual.SmartChannel, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      counts.track++;
      return createElement(actual.Track, props);
    },
    Playlist: (props: React.ComponentProps<typeof actual.Playlist>) => {
      counts.frame++;
      return createElement(actual.Playlist, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scale++;
      return createElement(actual.SmartScale, props);
    },
  };
});

const dragOptions = vi.hoisted(() => ({ durations: [] as number[] }));

vi.mock('../hooks/useAnnotationDragHandlers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAnnotationDragHandlers')>();
  return {
    ...actual,
    useAnnotationDragHandlers: (
      options: Parameters<typeof actual.useAnnotationDragHandlers>[0]
    ) => {
      dragOptions.durations.push(options.duration);
      return actual.useAnnotationDragHandlers(options);
    },
  };
});

vi.mock('../components/visualizationLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/visualizationLayout')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    // Rendered once per render of the tracks part.
    TracksLayout: (props: React.ComponentProps<typeof actual.TracksLayout>) => {
      counts.layout++;
      return createElement(actual.TracksLayout, props);
    },
  };
});

import {
  MediaElementPlaylistProvider,
  type MediaElementPlaylistProviderProps,
  type MediaElementTrackConfig,
} from '../MediaElementPlaylistContext';
import { WaveformViewOptions } from '../components/WaveformViewOptions';
import { ComposedMediaElementWaveform } from './testCompositions';
import { usePlaybackControls, useMediaElementTrack } from '../contexts/playlistContexts';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
} from '../AnnotationIntegrationContext';
import type { PlayheadProps } from '@waveform-playlist/ui-components';

const INTEGRATION = {
  AnnotationBox: ({ label }: { label: string }) => <span data-box>{label}</span>,
  AnnotationBoxesWrapper: ({ children, width }: { children?: React.ReactNode; width?: number }) => (
    <div data-boxes-width={width}>{children}</div>
  ),
  AnnotationText: () => null,
} as unknown as AnnotationIntegration;

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
// 44.1 px per second, and a clip that does not end on a pixel: 8 s is 352.8 px,
// so the clip is 352 px wide and its peaks are one longer.
const SAMPLES_PER_PIXEL = 1000;
const SECONDS = 8;
const CLIP_WIDTH = Math.floor((SECONDS * SAMPLE_RATE) / SAMPLES_PER_PIXEL);
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;
const TRACK: MediaElementTrackConfig = {
  source: 'test.mp3',
  name: 'Test',
  waveformData: WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: SOURCE_SCALE,
    bits: 8,
    length: LENGTH,
    data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
  }) as unknown as WaveformDataObject,
};

function createFakePlayout() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const fake = {
    time: 0,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on(event: string, listener: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off() {},
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((listener) => listener(...args));
    },
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
    dispose: vi.fn(),
  };
  return fake;
}

let controls: ReturnType<typeof usePlaybackControls>;
let trackValue: ReturnType<typeof useMediaElementTrack>;
const Probe: React.FC = () => {
  controls = usePlaybackControls();
  trackValue = useMediaElementTrack();
  return null;
};

const resetCounts = () => {
  counts.clip = 0;
  counts.channel = 0;
  counts.track = 0;
  counts.frame = 0;
  counts.scale = 0;
  counts.layout = 0;
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

interface MountOptions {
  playlist?: React.ReactElement;
  provider?: Partial<MediaElementPlaylistProviderProps>;
  /** Leave the player without its metadata. */
  notReady?: boolean;
}

async function mount({ playlist, provider, notReady = false }: MountOptions = {}) {
  const fake = createFakePlayout();
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  const view = render(
    <AnnotationIntegrationContext value={INTEGRATION}>
      <MediaElementPlaylistProvider
        track={TRACK}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={createPlayout}
        {...provider}
      >
        {playlist ?? <ComposedMediaElementWaveform />}
        <Probe />
      </MediaElementPlaylistProvider>
    </AnnotationIntegrationContext>
  );
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  if (!notReady) {
    await act(async () => {
      fake.emit('loadedmetadata');
    });
  }
  resetCounts();
  return { fake, view };
}

const root = () => document.querySelector('[data-playlist-state]') as HTMLElement | null;
const scrollArea = () => document.querySelector('[data-scroll-container]') as HTMLElement;

/** The click overlay: the last, childless child of the tracks container. */
function clickOverlay(): HTMLElement {
  const playhead = document.querySelector('[data-playhead]') as HTMLElement;
  const element = playhead.parentElement!.lastElementChild as HTMLElement;
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: CLIP_WIDTH, height: 100 }) as DOMRect;
  return element;
}

describe('the MediaElement view is a root over the frame of the multitrack view', () => {
  it('className is on the element with data-playlist-state, which holds the scroll area', async () => {
    await mount({ playlist: <ComposedMediaElementWaveform className="mine" /> });
    expect(root()).not.toBeNull();
    expect(root()!.classList.contains('mine')).toBe(true);
    expect(root()!.contains(scrollArea())).toBe(true);
  });

  it('data-playlist-state is "ready" from the first render: the waveform does not wait for the player', async () => {
    const { fake } = await mount({ notReady: true });
    expect(trackValue.isReady).toBe(false);
    expect(root()!.getAttribute('data-playlist-state')).toBe('ready');
    expect(document.querySelectorAll('[data-clip-container]').length).toBe(1);
    await act(async () => {
      fake.emit('loadedmetadata');
    });
    expect(trackValue.isReady).toBe(true);
    expect(root()!.getAttribute('data-playlist-state')).toBe('ready');
  });

  it('theme.playlistBackgroundColor is the background, when set', async () => {
    await mount({ provider: { theme: { playlistBackgroundColor: 'rgb(1, 2, 3)' } } });
    const inner = scrollArea().firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).background).toContain('rgb(1, 2, 3)');
  });

  it('without it the background is the wave outline colour, as before', async () => {
    await mount({ provider: { theme: { waveOutlineColor: 'rgb(9, 8, 7)' } } });
    const inner = scrollArea().firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).background).toContain('rgb(9, 8, 7)');
  });

  it('the one track is a row, marked as an audio track and as selected', async () => {
    await mount();
    const rows = document.querySelectorAll('[data-track-row]');
    expect(rows.length).toBe(1);
    const row = rows[0] as HTMLElement;
    expect(row.getAttribute('data-track-id')).toBe('media-element-track-0');
    expect(row.getAttribute('data-track-kind')).toBe('audio');
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(row.hasAttribute('data-track-drag-source')).toBe(false);
    // As tall as one channel: no clip header is drawn.
    expect((row.parentElement as HTMLElement).style.height).toBe('80px');
    // The clip keeps the id it had.
    const clip = row.querySelector('[data-clip-container]') as HTMLElement;
    expect(clip.getAttribute('data-track-id')).toBe('media-element-track-0');
  });

  it('no controls column: the scroll area is the only child', async () => {
    await mount();
    expect(root()!.children.length).toBe(1);
    expect(root()!.firstElementChild).toBe(scrollArea());
  });

  it('the timeline is as long as the audio, with a timescale when its part is rendered', async () => {
    counts.scale = 0;
    await mount();
    const inner = scrollArea().firstElementChild as HTMLElement;
    expect(inner.style.width).toBe(`${CLIP_WIDTH}px`);
    expect(counts.scale).toBe(0);
    cleanup();
    render(
      <MediaElementPlaylistProvider
        track={TRACK}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={() => createFakePlayout() as unknown as MediaElementPlayout}
      >
        <ComposedMediaElementWaveform />
      </MediaElementPlaylistProvider>
    );
    expect(counts.scale).toBeGreaterThan(0);
  });

  it('no timescale is drawn without its part', async () => {
    counts.scale = 0;
    render(
      <MediaElementPlaylistProvider
        track={TRACK}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={() => createFakePlayout() as unknown as MediaElementPlayout}
      >
        <ComposedMediaElementWaveform noTimescale />
      </MediaElementPlaylistProvider>
    );
    expect(counts.scale).toBe(0);
  });
});

describe('when the peaks cannot be extracted', () => {
  const BROKEN: MediaElementTrackConfig = {
    source: 'test.mp3',
    waveformData: new Proxy(
      {},
      {
        get(_target, key) {
          if (key === 'sample_rate') return SAMPLE_RATE;
          if (key === 'duration') return SECONDS;
          throw new Error('broken waveform data');
        },
      }
    ) as unknown as WaveformDataObject,
  };

  it('an empty row as tall as the wave height is drawn, not the text "Loading waveform..."', async () => {
    await mount({
      playlist: <ComposedMediaElementWaveform className="mine" />,
      provider: { track: BROKEN },
    });
    expect(document.body.textContent).not.toContain('Loading waveform');
    expect(root()!.classList.contains('mine')).toBe(true);
    // The row is there, as tall as one channel and as long as the audio, with
    // no clip in it.
    const rows = document.querySelectorAll('[data-track-row]');
    expect(rows.length).toBe(1);
    expect((rows[0].parentElement as HTMLElement).style.height).toBe('80px');
    expect(rows[0].querySelectorAll('[data-clip-container]').length).toBe(0);
    const inner = scrollArea().firstElementChild as HTMLElement;
    expect(inner.style.width).toBe(`${CLIP_WIDTH}px`);
    // The provider's own value is unchanged: no peaks.
    expect(trackValue.peaksDataArray).toEqual([]);
  });

  it('a click on the empty row still moves the cursor there', async () => {
    await mount({ provider: { track: BROKEN } });
    const overlay = clickOverlay();
    await act(async () => {
      fireEvent.mouseDown(overlay, { button: 0, clientX: 100, clientY: 5 });
    });
    await act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: 100, clientY: 5 });
    });
    const playhead = document.querySelector('[data-playhead]') as HTMLElement;
    expect(playhead.style.transform).toBe('translate3d(100px, 0, 0)');
  });

  it('the wave height of the view options is the height of the empty row', async () => {
    await mount({
      provider: { track: BROKEN },
      playlist: (
        <WaveformViewOptions waveHeight={64}>
          <ComposedMediaElementWaveform />
        </WaveformViewOptions>
      ),
    });
    const row = document.querySelector('[data-track-row]') as HTMLElement;
    expect((row.parentElement as HTMLElement).style.height).toBe('64px');
  });
});

describe('fades are the clip’s', () => {
  const FADED: MediaElementTrackConfig = {
    ...TRACK,
    fadeIn: { duration: 1, type: 'linear' },
    fadeOut: { duration: 2, type: 'sCurve' },
  };
  const fadeBoxes = () =>
    [...document.querySelectorAll('[data-clip-container] svg')].map(
      (svg) => svg.parentElement as HTMLElement
    );

  it('the provider puts the track’s fades on its one clip', async () => {
    await mount({ provider: { track: FADED } });
    const clip = trackValue.peaksDataArray[0][0];
    expect(clip.fadeIn).toEqual({ duration: 1, type: 'linear' });
    expect(clip.fadeOut).toEqual({ duration: 2, type: 'sCurve' });
    // Still the provider's fields.
    expect(trackValue.fadeIn).toEqual({ duration: 1, type: 'linear' });
  });

  it('no fade is drawn without showFades', async () => {
    await mount({ provider: { track: FADED } });
    expect(fadeBoxes().length).toBe(0);
  });

  it('with showFades the fade-out ends where the clip ends', async () => {
    await mount({
      playlist: <ComposedMediaElementWaveform showFades />,
      provider: { track: FADED },
    });
    const boxes = fadeBoxes();
    expect(boxes.length).toBe(2);
    const fadeInWidth = Math.floor((1 * SAMPLE_RATE) / SAMPLES_PER_PIXEL);
    const fadeOutWidth = Math.floor((2 * SAMPLE_RATE) / SAMPLES_PER_PIXEL);
    expect(boxes[0].style.left).toBe('0px');
    expect(boxes[0].style.width).toBe(`${fadeInWidth}px`);
    // From the clip width (352), not from the peaks length (353).
    expect(trackValue.peaksDataArray[0][0].peaks.length).toBe(CLIP_WIDTH + 1);
    expect(boxes[1].style.left).toBe(`${CLIP_WIDTH - fadeOutWidth}px`);
    expect(boxes[1].style.width).toBe(`${fadeOutWidth}px`);
  });

  it('a change of the fades alone does not extract the peaks again', async () => {
    const fake = createFakePlayout();
    const ui = (track: MediaElementTrackConfig) => (
      <MediaElementPlaylistProvider
        track={track}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={() => fake as unknown as MediaElementPlayout}
      >
        <ComposedMediaElementWaveform showFades />
        <Probe />
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(FADED));
    const before = trackValue.peaksDataArray[0][0];
    await act(async () => {
      view.rerender(ui({ ...FADED, fadeIn: { duration: 3, type: 'linear' } }));
    });
    const after = trackValue.peaksDataArray[0][0];
    expect(after.fadeIn).toEqual({ duration: 3, type: 'linear' });
    expect(after).not.toBe(before);
    expect(after.peaks).toBe(before.peaks);
  });

  it('fades written inline are compared by value: an equal new object builds neither a new clip nor a new player', async () => {
    const fake = createFakePlayout();
    const created = vi.fn(() => fake as unknown as MediaElementPlayout);
    // A new track object with new, equal fade objects on every call: what an
    // unmemoized `track` with inline fades is on every render of its parent.
    const inline = (): MediaElementTrackConfig => ({
      ...TRACK,
      fadeIn: { duration: 1, type: 'linear' },
      fadeOut: { duration: 2, type: 'sCurve' },
    });
    const ui = (track: MediaElementTrackConfig) => (
      <MediaElementPlaylistProvider
        track={track}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={created}
      >
        <ComposedMediaElementWaveform showFades />
        <Probe />
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(inline()));
    await waitFor(() => expect(fake.addTrack).toHaveBeenCalledTimes(1));
    // The player is given the fades.
    expect(fake.addTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        fadeIn: { duration: 1, type: 'linear' },
        fadeOut: { duration: 2, type: 'sCurve' },
      })
    );
    const clipBefore = trackValue.peaksDataArray[0][0];
    const arrayBefore = trackValue.peaksDataArray;
    const fadeInBefore = trackValue.fadeIn;
    const valueBefore = trackValue;

    await act(async () => {
      view.rerender(ui(inline()));
    });
    await act(async () => {});
    expect(trackValue.peaksDataArray).toBe(arrayBefore);
    // The hook's value does not change either, and hands out the first objects.
    expect(trackValue.fadeIn).toBe(fadeInBefore);
    expect(trackValue).toBe(valueBefore);
    expect(trackValue.peaksDataArray[0][0]).toBe(clipBefore);
    expect(created).toHaveBeenCalledTimes(1);
    expect(fake.dispose).not.toHaveBeenCalled();
  });

  it('a fade with another value still builds a new player', async () => {
    const fake = createFakePlayout();
    const created = vi.fn(() => fake as unknown as MediaElementPlayout);
    const ui = (track: MediaElementTrackConfig) => (
      <MediaElementPlaylistProvider
        track={track}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={created}
      >
        <ComposedMediaElementWaveform showFades />
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(FADED));
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    await act(async () => {
      view.rerender(ui({ ...FADED, fadeOut: { duration: 4, type: 'sCurve' } }));
    });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(2));
  });
});

describe('the root renders alone', () => {
  const pressAndRelease = async (x: number) => {
    const overlay = clickOverlay();
    await act(async () => {
      fireEvent.mouseDown(overlay, { button: 0, clientX: x, clientY: 5 });
    });
    await act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: x, clientY: 5 });
    });
  };

  it('the counters work: a mount renders the frame, the row, the clip and the channel', async () => {
    resetCounts();
    render(
      <MediaElementPlaylistProvider
        track={TRACK}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={() => createFakePlayout() as unknown as MediaElementPlayout}
      >
        <ComposedMediaElementWaveform />
      </MediaElementPlaylistProvider>
    );
    expect(counts.frame).toBeGreaterThan(0);
    expect(counts.track).toBeGreaterThan(0);
    expect(counts.clip).toBeGreaterThan(0);
    expect(counts.channel).toBeGreaterThan(0);
  });

  it('a press and its release render the frame and no track, clip or channel', async () => {
    await mount();
    await pressAndRelease(100);
    expect(counts.frame).toBeGreaterThan(0);
    // Not even the tracks part: the rows value kept its identity.
    expect(counts).toMatchObject({ track: 0, clip: 0, channel: 0, layout: 0 });
    // The click did its work: the cursor is where the press landed.
    const playhead = document.querySelector('[data-playhead]') as HTMLElement;
    expect(playhead.style.transform).toBe('translate3d(100px, 0, 0)');
  });

  it('play, pause and stop render the frame and no track, clip or channel', async () => {
    await mount();
    await act(async () => {
      await controls.play();
    });
    act(() => controls.pause());
    await act(async () => {
      await controls.play();
    });
    act(() => controls.stop());
    expect(counts.frame).toBeGreaterThan(0);
    expect(counts).toMatchObject({ track: 0, clip: 0, channel: 0 });
  });

  it('the player becoming ready renders no track, clip or channel', async () => {
    const { fake } = await mount({ notReady: true });
    await act(async () => {
      fake.emit('loadedmetadata');
    });
    expect(trackValue.isReady).toBe(true);
    expect(counts).toMatchObject({ track: 0, clip: 0, channel: 0, layout: 0 });
  });

  it('an automatic-scroll toggle does not render the frame', async () => {
    await mount();
    act(() => controls.setAutomaticScroll(true));
    act(() => controls.setAutomaticScroll(false));
    expect(counts.frame).toBe(0);
    expect(counts.layout).toBe(0);
  });

  it('a seek and a selection change do not render the frame', async () => {
    await mount();
    act(() => controls.seekTo(2));
    act(() => controls.setSelection(3, 4));
    expect(counts.frame).toBe(0);
    expect(counts.layout).toBe(0);
  });

  it('a custom playhead is not called for a press and its release at the cursor', async () => {
    let calls = 0;
    const renderPlayhead = (_props: PlayheadProps) => {
      calls++;
      return <div data-playhead />;
    };
    await mount({ playlist: <ComposedMediaElementWaveform renderPlayhead={renderPlayhead} /> });
    // The cursor is at 0 and stays there: nothing the playhead follows changes.
    calls = 0;
    await pressAndRelease(0);
    expect(calls).toBe(0);
  });

  it('getLabel is not called for a press and its release', async () => {
    let calls = 0;
    const label = () => {
      calls++;
      return 'x';
    };
    await mount({
      playlist: <ComposedMediaElementWaveform getLabel={label} />,
      provider: {
        annotationList: {
          annotations: [{ id: 'a', start: 1, end: 2, lines: ['a'] }],
        },
      },
    });
    // The box is drawn with the label, in a row as wide as the root's timeline.
    expect(calls).toBeGreaterThan(0);
    expect(document.querySelector('[data-box]')!.textContent).toBe('x');
    expect(document.querySelector('[data-boxes-width]')!.getAttribute('data-boxes-width')).toBe(
      String(CLIP_WIDTH)
    );
    calls = 0;
    await pressAndRelease(0);
    expect(calls).toBe(0);
  });

  it('the annotation drag handlers are given the length of the audio as their bound', async () => {
    dragOptions.durations = [];
    await mount({
      provider: {
        annotationList: {
          annotations: [{ id: 'a', start: 1, end: 2, lines: ['a'] }],
        },
      },
    });
    expect(dragOptions.durations.length).toBeGreaterThan(0);
    expect(new Set(dragOptions.durations)).toEqual(new Set([SECONDS]));
  });

  it('getLabel is not called when the player becomes ready, nor on play, pause and stop', async () => {
    let calls = 0;
    const label = () => {
      calls++;
      return 'x';
    };
    // The annotation lies after the positions played here, so it never
    // becomes the active one (that would render the boxes, rightly).
    const { fake } = await mount({
      playlist: <ComposedMediaElementWaveform getLabel={label} />,
      provider: {
        annotationList: {
          annotations: [{ id: 'a', start: 6, end: 7, lines: ['a'] }],
        },
      },
      notReady: true,
    });
    expect(calls).toBeGreaterThan(0);
    calls = 0;
    await act(async () => {
      fake.emit('loadedmetadata');
    });
    expect(trackValue.isReady).toBe(true);
    expect(calls).toBe(0);
    await act(async () => {
      await controls.play();
    });
    act(() => controls.pause());
    await act(async () => {
      await controls.play();
    });
    act(() => controls.stop());
    expect(calls).toBe(0);
  });
});

describe('the selected row is the nearest provider\u2019s', () => {
  it('a MediaElement player inside a multitrack provider draws its own row as selected', async () => {
    const { WaveformPlaylistProvider } = await import('../WaveformPlaylistContext');
    const fake = createFakePlayout();
    render(
      <WaveformPlaylistProvider tracks={[]}>
        <MediaElementPlaylistProvider
          track={TRACK}
          samplesPerPixel={SAMPLES_PER_PIXEL}
          createPlayout={() => fake as unknown as MediaElementPlayout}
        >
          <ComposedMediaElementWaveform />
        </MediaElementPlaylistProvider>
      </WaveformPlaylistProvider>
    );
    await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
    const row = document.querySelector('[data-track-row]') as HTMLElement;
    expect(row.getAttribute('data-selected')).toBe('true');
  });
});
