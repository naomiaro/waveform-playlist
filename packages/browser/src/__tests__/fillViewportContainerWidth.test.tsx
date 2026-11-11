// @vitest-environment jsdom
//
// With `fillViewport` (or `indefinitePlayback`) the timeline is at least as wide
// as the scroll container. The container width is tracked with a ResizeObserver:
// it is known before the first paint and follows a container resize, instead of
// being read from the DOM during render.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { Waveform } from '../components/Waveform';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 1000;

// One second of audio: 48 px at 1000 samples per pixel.
const TRACKS: ClipTrack[] = [
  {
    id: 'track-1',
    name: 'track-1',
    clips: [
      {
        id: 'clip-1',
        startSample: 0,
        durationSamples: SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack,
];

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

// The scroll container's width, as jsdom would report it if it did layout.
let containerWidth = 0;
let clientWidthReads = 0;
const observers = new Set<ControllableResizeObserver>();

class ControllableResizeObserver {
  readonly targets = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    observers.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    observers.delete(this);
  }
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const isScrollContainer = (el: Element) => el.getAttribute('data-scroll-container') === 'true';

function resizeContainerTo(width: number) {
  containerWidth = width;
  act(() => {
    for (const observer of [...observers]) {
      if ([...observer.targets].some(isScrollContainer)) observer.fire();
    }
  });
}

let originalResizeObserver: typeof ResizeObserver;
let originalClientWidth: PropertyDescriptor | undefined;

beforeEach(() => {
  containerWidth = 0;
  clientWidthReads = 0;
  observers.clear();
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = ControllableResizeObserver as unknown as typeof ResizeObserver;
  originalClientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      if (!isScrollContainer(this)) return 0;
      clientWidthReads++;
      return containerWidth;
    },
  });
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  globalThis.ResizeObserver = originalResizeObserver;
  if (originalClientWidth) {
    Object.defineProperty(Element.prototype, 'clientWidth', originalClientWidth);
  }
  vi.restoreAllMocks();
});

const adapter = createFakeAdapter();
const createAdapter = () => adapter;

const App: React.FC<{ fillViewport?: boolean; indefinitePlayback?: boolean; tick?: number }> = ({
  fillViewport = false,
  indefinitePlayback = false,
}) => (
  <WaveformPlaylistProvider
    tracks={TRACKS}
    sampleRate={SAMPLE_RATE}
    samplesPerPixel={SAMPLES_PER_PIXEL}
    createAdapter={createAdapter}
    fillViewport={fillViewport}
    indefinitePlayback={indefinitePlayback}
  >
    <Waveform />
  </WaveformPlaylistProvider>
);

/** Width of the tracks area: the first descendant of the scroll container that sets one. */
function tracksWidth(container: HTMLElement): string {
  const scroll = container.querySelector('[data-scroll-container]') as HTMLElement;
  const sized = [...scroll.querySelectorAll<HTMLElement>('*')].find((el) => el.style.width);
  return sized?.style.width ?? '';
}

describe.each([
  ['fillViewport', { fillViewport: true }],
  ['indefinitePlayback', { indefinitePlayback: true }],
] as const)('timeline width with %s', (_name, flags) => {
  it('fills the container on the first commit and follows a container resize', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    containerWidth = 800;
    const { container } = render(<App {...flags} />);
    // No waiting: the width is applied in a layout effect, before the first paint.
    expect(tracksWidth(container)).toBe('800px');

    resizeContainerTo(1200);
    expect(tracksWidth(container)).toBe('1200px');

    // Narrower than the audio: the audio's own width wins.
    resizeContainerTo(20);
    expect(tracksWidth(container)).toBe('48px');
    await waitFor(() => expect(container.querySelector('[data-playlist-state]')).not.toBeNull());
  });

  it('does not read the container width while rendering', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    containerWidth = 800;
    const { rerender } = render(<App {...flags} />);
    const readsAfterMount = clientWidthReads;
    for (let tick = 0; tick < 5; tick++) rerender(<App {...flags} tick={tick} />);
    expect(clientWidthReads).toBe(readsAfterMount);
  });
});

describe('timeline width without fillViewport', () => {
  it('is the audio width and does not observe the container for it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    containerWidth = 800;
    const { container } = render(<App />);
    expect(tracksWidth(container)).toBe('48px');
    resizeContainerTo(1200);
    expect(tracksWidth(container)).toBe('48px');
  });
});
