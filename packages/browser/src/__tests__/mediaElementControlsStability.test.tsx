// @vitest-environment jsdom
//
// #767: the MediaElement controls value must not change when the duration
// arrives (0 until the playout has loaded the track), and a `seekTo` captured
// before that must clamp to the loaded duration.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementControls,
  useMediaElementData,
  useMediaElementState,
} from '../MediaElementPlaylistContext';

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SECONDS = 4;
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
  return {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    play: vi.fn(),
    pause() {},
    stop() {},
    seekTo: vi.fn(),
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose() {},
  };
}

type Controls = ReturnType<typeof useMediaElementControls>;

let probe: {
  controls: Controls;
  duration: number;
  currentTime: number;
  isAutomaticScroll: boolean;
};
// Every controls value the consumer has been given, in order.
let controlsSeen: Controls[] = [];

const ProbeChild: React.FC = () => {
  const controls = useMediaElementControls();
  probe = {
    controls,
    duration: useMediaElementData().duration,
    currentTime: useMediaElementAnimation().currentTime,
    isAutomaticScroll: useMediaElementState().isAutomaticScroll,
  };
  if (controlsSeen[controlsSeen.length - 1] !== controls) controlsSeen.push(controls);
  return null;
};

async function mount() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  controlsSeen = [];
  const playout = createFakePlayout();
  const createPlayout = () => playout as unknown as MediaElementPlayout;
  render(
    <MediaElementPlaylistProvider track={TRACK} samplesPerPixel={882} createPlayout={createPlayout}>
      <ProbeChild />
    </MediaElementPlaylistProvider>
  );
  // The first render is before the playout has loaded.
  expect(probe.duration).toBe(0);
  const first = probe.controls;
  await waitFor(() => expect(probe.duration).toBe(SECONDS));
  await act(async () => {});
  return { playout, first };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('MediaElement controls value (#767)', () => {
  it('is the same object before and after the duration loads', async () => {
    const { first } = await mount();

    expect(probe.controls).toBe(first);
    expect(controlsSeen).toHaveLength(1);
  });

  it('a seekTo captured before the duration loaded clamps to the loaded duration', async () => {
    const { playout, first } = await mount();

    await act(async () => {
      first.seekTo(2.5);
    });
    expect(probe.currentTime).toBe(2.5);
    expect(playout.seekTo).toHaveBeenLastCalledWith(2.5);

    await act(async () => {
      first.seekTo(99);
    });
    expect(probe.currentTime).toBe(SECONDS);
    expect(playout.seekTo).toHaveBeenLastCalledWith(SECONDS);
  });

  // The setter was never unstable by itself (it was an arrow inside the memo);
  // this pins that it still works after being pulled out.
  it('setAutomaticScroll from the first controls value still applies', async () => {
    const { first } = await mount();
    const { setAutomaticScroll } = first;

    expect(probe.isAutomaticScroll).toBe(false);

    await act(async () => {
      setAutomaticScroll(true);
    });

    expect(probe.isAutomaticScroll).toBe(true);
    expect(probe.controls.setAutomaticScroll).toBe(setAutomaticScroll);
  });
});
