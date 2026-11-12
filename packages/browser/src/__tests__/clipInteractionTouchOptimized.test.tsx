// @vitest-environment jsdom
//
// #690: `<ClipInteractionProvider touchOptimized>` is enough by itself. The
// provider publishes the flag and each clip reads it, so the trim handles are
// widened without a second `touchOptimized` on `<Waveform>`. The `<Waveform>`
// prop still works alone, for a consumer with their own DragDropProvider.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

// The props each clip was last rendered with, and how often it rendered.
const seen = vi.hoisted(() => ({
  props: {} as Record<string, { touchOptimized?: boolean; disableHeaderDrag?: boolean }>,
  renders: {} as Record<string, number>,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      seen.props[props.clipId] = {
        touchOptimized: props.touchOptimized,
        disableHeaderDrag: props.disableHeaderDrag,
      };
      seen.renders[props.clipId] = (seen.renders[props.clipId] ?? 0) + 1;
      return createElement(actual.Clip, props);
    },
  };
});

import { WaveformPlaylistProvider, usePlaylistData } from '../WaveformPlaylistContext';
import { Waveform } from '../components/Waveform';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { useClipInteractionEnabled } from '../contexts/ClipInteractionContext';
import { CLIP_BOUNDARY_WIDTH, CLIP_BOUNDARY_WIDTH_TOUCH } from '@waveform-playlist/ui-components';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(id: string, startSample: number): AudioClip {
  return {
    id,
    startSample,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: WaveformData.create({
      version: 2,
      channels: 1,
      sample_rate: SAMPLE_RATE,
      samples_per_pixel: 256,
      bits: 16,
      length: 400,
      data: Array.from({ length: 800 }, (_, i) => (i % 2 === 0 ? -50 : 50)),
    }),
  } as AudioClip;
}

const TRACKS: ClipTrack[] = [
  {
    id: 'track-1',
    name: 'track-1',
    clips: [makeClip('clip-a', 0), makeClip('clip-b', SAMPLE_RATE * 2)],
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

let isReady = false;
let enabledSeen: boolean | null = null;
const ReadyProbe: React.FC = () => {
  isReady = usePlaylistData().isReady;
  enabledSeen = useClipInteractionEnabled();
  return null;
};

async function mount(tree: (probe: React.ReactNode) => React.ReactNode) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  seen.props = {};
  seen.renders = {};
  isReady = false;
  enabledSeen = null;
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const Wrapper: React.FC = () => (
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      {tree(<ReadyProbe />)}
    </WaveformPlaylistProvider>
  );
  const utils = render(<Wrapper />);
  await waitFor(() => expect(isReady).toBe(true));
  await waitFor(() => expect(Object.keys(seen.props).sort()).toEqual(['clip-a', 'clip-b']));
  return { ...utils, rerender: () => utils.rerender(<Wrapper />) };
}

/** Width in px of every trim handle on the page. */
function handleWidths(container: HTMLElement): number[] {
  const handles = Array.from(container.querySelectorAll<HTMLElement>('[data-boundary-edge]'));
  return handles.map((el) => parseFloat(getComputedStyle(el).width));
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('touchOptimized has one source for ClipInteractionProvider users (#690)', () => {
  it('the provider flag alone widens the trim handles', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a'].touchOptimized).toBe(true);
    expect(seen.props['clip-b'].touchOptimized).toBe(true);
    const widths = handleWidths(container);
    expect(widths).toHaveLength(4);
    expect(new Set(widths)).toEqual(new Set([CLIP_BOUNDARY_WIDTH_TOUCH]));
  });

  it('without the flag the trim handles keep the normal width, and clips are interactive', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a'].touchOptimized).toBe(false);
    expect(seen.props['clip-a'].disableHeaderDrag).toBe(false);
    expect(enabledSeen).toBe(true);
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH]));
  });

  it('the Waveform props alone still work, with no ClipInteractionProvider', async () => {
    await mount((probe) => (
      <>
        {probe}
        <Waveform showClipHeaders interactiveClips touchOptimized />
      </>
    ));

    expect(enabledSeen).toBe(false);
    expect(seen.props['clip-a']).toEqual({ touchOptimized: true, disableHeaderDrag: false });
  });

  it('with neither a provider nor the props, clips are not interactive and handles are not widened', async () => {
    await mount((probe) => (
      <>
        {probe}
        <Waveform showClipHeaders />
      </>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: false, disableHeaderDrag: true });
  });

  it('a re-render of the provider with the same flag does not re-render the clips', async () => {
    const { rerender } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    ));
    await act(async () => {});
    const before = { ...seen.renders };

    await act(async () => {
      rerender();
    });

    expect(seen.renders).toEqual(before);
  });
});
