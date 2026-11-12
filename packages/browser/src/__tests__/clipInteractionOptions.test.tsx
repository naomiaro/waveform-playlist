// @vitest-environment jsdom
//
// #690: whether clips are interactive, and whether their trim handles are
// widened for touch, has ONE source: a context that each clip reads.
// `ClipInteractionProvider` sets it; `ClipInteractionOptions` sets it for a
// consumer with their own DragDropProvider. `<Waveform>` and
// `<PlaylistVisualization>` take neither as a prop.
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
import { PlaylistVisualization } from '../components/PlaylistVisualization';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import {
  ClipInteractionOptions,
  useClipInteractionEnabled,
} from '../contexts/ClipInteractionContext';
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

describe('clip interaction options have one source, the context (#690)', () => {
  it('ClipInteractionProvider with touchOptimized: interactive clips, wide trim handles', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: true, disableHeaderDrag: false });
    expect(seen.props['clip-b']).toEqual({ touchOptimized: true, disableHeaderDrag: false });
    expect(enabledSeen).toBe(true);
    const widths = handleWidths(container);
    expect(widths).toHaveLength(4);
    expect(new Set(widths)).toEqual(new Set([CLIP_BOUNDARY_WIDTH_TOUCH]));
  });

  it('ClipInteractionProvider without the flag: interactive clips, normal trim handles', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: false, disableHeaderDrag: false });
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH]));
  });

  it('with nothing above, clips are not interactive and have no trim handles', async () => {
    const { container } = await mount((probe) => (
      <>
        {probe}
        <Waveform showClipHeaders />
      </>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: false, disableHeaderDrag: true });
    expect(enabledSeen).toBe(false);
    expect(handleWidths(container)).toEqual([]);
  });

  it('ClipInteractionOptions alone turns both on, for a custom drag setup', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionOptions enabled touchOptimized>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionOptions>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: true, disableHeaderDrag: false });
    expect(enabledSeen).toBe(true);
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH_TOUCH]));
  });

  it('ClipInteractionOptions with enabled only: interactive, normal trim handles', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionOptions enabled>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionOptions>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: false, disableHeaderDrag: false });
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH]));
  });

  it('a nested ClipInteractionOptions overrides only what it sets', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        <ClipInteractionOptions touchOptimized={false}>
          {probe}
          <Waveform showClipHeaders />
        </ClipInteractionOptions>
      </ClipInteractionProvider>
    ));

    // `enabled` is inherited from the provider; only the handle width changed.
    expect(seen.props['clip-a']).toEqual({ touchOptimized: false, disableHeaderDrag: false });
    expect(enabledSeen).toBe(true);
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH]));
  });

  it('a nested ClipInteractionOptions can switch interaction off under the provider', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        <ClipInteractionOptions enabled={false}>
          {probe}
          <Waveform showClipHeaders />
        </ClipInteractionOptions>
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: true, disableHeaderDrag: true });
    expect(enabledSeen).toBe(false);
    expect(handleWidths(container)).toEqual([]);
  });

  it('PlaylistVisualization used directly reads the same context', async () => {
    const { container } = await mount((probe) => (
      <ClipInteractionProvider touchOptimized>
        {probe}
        <PlaylistVisualization showClipHeaders />
      </ClipInteractionProvider>
    ));

    expect(seen.props['clip-a']).toEqual({ touchOptimized: true, disableHeaderDrag: false });
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH_TOUCH]));
  });

  it('turning the flag on later widens the handles of clips already on the page', async () => {
    let touch = false;
    const { container, rerender } = await mount((probe) => (
      <ClipInteractionOptions enabled touchOptimized={touch}>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionOptions>
    ));
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH]));

    touch = true;
    await act(async () => {
      rerender();
    });

    expect(seen.props['clip-a'].touchOptimized).toBe(true);
    expect(new Set(handleWidths(container))).toEqual(new Set([CLIP_BOUNDARY_WIDTH_TOUCH]));
  });

  it('a re-render of ClipInteractionProvider with the same flag does not re-render the clips', async () => {
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

  it('a re-render of ClipInteractionOptions with the same props does not re-render the clips', async () => {
    const { rerender } = await mount((probe) => (
      <ClipInteractionOptions enabled touchOptimized>
        {probe}
        <Waveform showClipHeaders />
      </ClipInteractionOptions>
    ));
    await act(async () => {});
    const before = { ...seen.renders };

    await act(async () => {
      rerender();
    });

    expect(seen.renders).toEqual(before);
  });
});
