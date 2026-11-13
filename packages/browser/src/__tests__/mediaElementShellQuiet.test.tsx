// @vitest-environment jsdom
//
// #688, part 2. Under MediaElementPlaylistProvider the resting cursor has its
// own context, so a seek, a stop and a leftward selection drag render the
// playhead and the progress overlay, not the waveform shell around them. The
// playhead and the overlay must still MOVE on each of those.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

const counts = vi.hoisted(() => ({ clip: 0, channel: 0, track: 0, selection: 0 }));

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
    Selection: (props: React.ComponentProps<typeof actual.Selection>) => {
      counts.selection++;
      return createElement(actual.Selection, props);
    },
  };
});

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { MediaElementPlaylist } from '../components/MediaElementPlaylist';
import { usePlaybackControls } from '../contexts/playlistContexts';
import type { PlayheadProps } from '@waveform-playlist/ui-components';

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SAMPLES_PER_PIXEL = 882; // 50 px per second
const SECONDS = 8;
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;
const TRACK = {
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
  }),
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
const Probe: React.FC = () => {
  controls = usePlaybackControls();
  return null;
};

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;
const runFrame = () =>
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(performance.now());
  });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  frames = new Map();
  nextFrameId = 1;
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

async function mount(playlist: React.ReactElement = <MediaElementPlaylist />) {
  const fake = createFakePlayout();
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  const view = render(
    <MediaElementPlaylistProvider
      track={TRACK}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      createPlayout={createPlayout}
    >
      {playlist}
      <Probe />
    </MediaElementPlaylistProvider>
  );
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  await act(async () => {
    fake.emit('loadedmetadata');
  });
  const playhead = () => view.container.querySelector('[data-playhead]') as HTMLElement;
  // wrapper > [background, overlay, channel container]
  const overlay = () =>
    view.container
      .querySelector('[data-playhead]')!
      .ownerDocument.querySelector('[style*="scaleX"]') as HTMLElement;
  const reset = () => {
    counts.clip = 0;
    counts.channel = 0;
    counts.track = 0;
    counts.selection = 0;
  };
  reset();
  return { fake, view, playhead, overlay, reset };
}

const PX_PER_SECOND = SAMPLE_RATE / SAMPLES_PER_PIXEL;
const WIDTH = SECONDS * PX_PER_SECOND;
const playheadAt = (seconds: number) => `translate3d(${seconds * PX_PER_SECOND}px, 0, 0)`;
const overlayAt = (seconds: number) => `scaleX(${(seconds * PX_PER_SECOND) / WIDTH})`;

describe('the MediaElement waveform shell does not follow the cursor', () => {
  it('a seek while stopped moves the playhead and the progress overlay and renders no clip, channel or track', async () => {
    const { playhead, overlay, reset } = await mount();
    expect(playhead().style.transform).toBe(playheadAt(0));
    reset();
    act(() => controls.seekTo(2));
    expect(playhead().style.transform).toBe(playheadAt(2));
    expect(overlay().style.transform).toBe(overlayAt(2));
    expect(counts).toMatchObject({ clip: 0, channel: 0, track: 0 });
  });

  it('a leftward selection drag (the start moves on each move) moves the overlay and renders none of them', async () => {
    const { view, playhead, reset } = await mount();
    // wrapper > [background, overlay, channel container]; the playhead is
    // hidden at rest while a range is highlighted (#688, part 3), so the
    // overlay is found on its own.
    const overlay = () => view.container.querySelector('[style*="scaleX"]') as HTMLElement;
    act(() => controls.setSelection(4, 6));
    reset();
    for (const start of [3.5, 3, 2.5]) {
      act(() => controls.setSelection(start, 6));
      expect(playhead()).toBeNull();
      expect(overlay().style.transform).toBe(overlayAt(start));
    }
    expect(counts).toMatchObject({ clip: 0, channel: 0, track: 0 });
  });

  it('a pause and a stop leave both at the resting cursor', async () => {
    const { fake, playhead, overlay } = await mount();
    act(() => controls.seekTo(1));
    await act(async () => {
      await controls.play();
    });
    fake.time = 3;
    await runFrame();
    expect(playhead().style.transform).toBe(playheadAt(3));
    act(() => controls.pause());
    expect(playhead().style.transform).toBe(playheadAt(3));
    expect(overlay().style.transform).toBe(overlayAt(3));

    await act(async () => {
      await controls.play();
    });
    fake.time = 5;
    await runFrame();
    act(() => controls.stop());
    // Back where that play started.
    expect(playhead().style.transform).toBe(playheadAt(3));
    expect(overlay().style.transform).toBe(overlayAt(3));
  });

  it('a custom playhead is given the new position on a seek while stopped', async () => {
    const positions: number[] = [];
    const renderPlayhead = (props: PlayheadProps) => {
      positions.push(props.position);
      return <div data-custom-playhead />;
    };
    await mount(<MediaElementPlaylist renderPlayhead={renderPlayhead} />);
    act(() => controls.seekTo(2));
    expect(positions[positions.length - 1]).toBe(2 * PX_PER_SECOND);
  });

  it('the one track is drawn in the selected colours', async () => {
    const { view } = await mount();
    // wrapper > [background, overlay, channel container]
    const background = view.container.querySelector('[style*="scaleX"]')!
      .previousElementSibling as HTMLElement;
    expect(background.style.background).toBe('rgb(0, 180, 216)'); // defaultTheme.selectedWaveFillColor
  });

  it('a collapsed selection renders no highlight at all', async () => {
    const { reset } = await mount();
    reset();
    act(() => controls.setSelection(3, 3));
    act(() => controls.seekTo(1));
    expect(counts.selection).toBe(0);
    act(() => controls.setSelection(3, 4));
    expect(counts.selection).toBe(1);
  });

  it('an automatic-scroll toggle renders no track, clip or channel (the drag reads the setting through a ref)', async () => {
    const { reset } = await mount();
    reset();
    act(() => controls.setAutomaticScroll(true));
    act(() => controls.setAutomaticScroll(false));
    expect(counts.track).toBe(0);
    expect(counts.clip).toBe(0);
    expect(counts.channel).toBe(0);
  });

  it('play and pause render neither the track nor the selection highlight', async () => {
    const { reset } = await mount();
    act(() => controls.setSelection(2, 4));
    expect(counts.selection).toBeGreaterThan(0);
    reset();
    await act(async () => {
      await controls.play(2, 2);
    });
    act(() => controls.pause());
    // The root rendered alone (its drag handlers read isPlaying): the row is
    // not its concern (#685)...
    expect(counts.track).toBe(0);
    // ...and neither is the memoized highlight.
    expect(counts.selection).toBe(0);
  });
});
