// @vitest-environment jsdom
//
// #828. MediaElementPlaylistProvider has no zoom control, so its
// `samplesPerPixel` prop is the one place the zoom level is set, and the
// provider follows it: a new value redraws the waveform at it, on the same
// player. `automaticScroll` is different: the provider owns the setting
// (`setAutomaticScroll`), the prop is its initial value only, and a later
// change of the prop is not followed.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const engine = vi.hoisted(() => ({ created: 0 }));

vi.mock('../playout/resolveMediaElementPlayout', () => ({
  resolveMediaElementPlayout: async () => {
    engine.created += 1;
    return {
      addTrack: vi.fn(),
      getTrack: () => undefined,
      setOnPlaybackComplete() {},
      on() {},
      off() {},
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seekTo: vi.fn(),
      setPlaybackRate: vi.fn(),
      getCurrentTime: () => 0,
      dispose: vi.fn(),
    };
  },
}));

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  useMediaElementTrack,
  usePlaylistSettings,
  usePlaylistZoom,
} from '../contexts/playlistContexts';

const LENGTH = 800;
const WAVEFORM_SPP = 441;
const waveformData = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: 44100,
  samples_per_pixel: WAVEFORM_SPP,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});
const TRACK = { source: 'test.mp3', waveformData, name: 'Test' };

const seen = {
  zoom: null as ReturnType<typeof usePlaylistZoom> | null,
  track: null as ReturnType<typeof useMediaElementTrack> | null,
  settings: null as ReturnType<typeof usePlaylistSettings> | null,
};
const Probe: React.FC = () => {
  seen.zoom = usePlaylistZoom();
  seen.track = useMediaElementTrack();
  seen.settings = usePlaylistSettings();
  return null;
};

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  engine.created = 0;
  vi.restoreAllMocks();
});

const ui = (props: { samplesPerPixel?: number; automaticScroll?: boolean }) => (
  <MediaElementPlaylistProvider track={TRACK} {...props}>
    <Probe />
  </MediaElementPlaylistProvider>
);

const drawnLength = () => seen.track!.peaksDataArray[0][0].peaks.length;

describe('MediaElementPlaylistProvider follows its samplesPerPixel prop', () => {
  it('a new value is the zoom level and redraws the peaks at it, on the same player', async () => {
    const view = render(ui({ samplesPerPixel: WAVEFORM_SPP }));
    await waitFor(() => expect(engine.created).toBe(1));
    expect(seen.zoom!.samplesPerPixel).toBe(WAVEFORM_SPP);
    expect(drawnLength()).toBe(LENGTH);

    view.rerender(ui({ samplesPerPixel: WAVEFORM_SPP * 2 }));
    expect(seen.zoom!.samplesPerPixel).toBe(WAVEFORM_SPP * 2);
    expect(drawnLength()).toBe(LENGTH / 2);
    expect(seen.zoom!.canZoomIn).toBe(false);
    expect(seen.zoom!.canZoomOut).toBe(false);
    expect(engine.created).toBe(1);
  });

  it('leaving the prop out is 1024', async () => {
    render(ui({}));
    await waitFor(() => expect(engine.created).toBe(1));
    expect(seen.zoom!.samplesPerPixel).toBe(1024);
  });
});

describe('automaticScroll is the initial value only', () => {
  it('a later change of the prop is not followed', async () => {
    const view = render(ui({ automaticScroll: false }));
    await waitFor(() => expect(engine.created).toBe(1));
    expect(seen.settings!.isAutomaticScroll).toBe(false);
    view.rerender(ui({ automaticScroll: true }));
    expect(seen.settings!.isAutomaticScroll).toBe(false);
  });
});
