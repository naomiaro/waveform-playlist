// @vitest-environment jsdom
//
// #689: the options that only affect how a view draws (`waveHeight`,
// `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `fillViewport`)
// have one home, `<WaveformViewOptions>`, under both providers. The roots
// resolve them and publish them once, in ui-components' `PlaylistInfoContext`.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { WaveformDataObject, ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { usePlaylistInfo } from '@waveform-playlist/ui-components';
import { resetPartWarnings } from '../components/partWarnings';
import * as api from '../index';
import {
  WaveformPlaylistProvider,
  MediaElementPlaylistProvider,
  Waveform,
  MediaElementWaveform,
  WaveformRoot,
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformPlayhead,
  WaveformViewOptions,
  usePlaylistTimeline,
  usePlaylistView,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string): ClipTrack {
  const data: number[] = [];
  for (let i = 0; i < 400; i++) data.push(-(i % 100), i % 100);
  const clip = {
    id: `${id}-clip`,
    startSample: 0,
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
      data,
    }),
  } as AudioClip;
  return {
    id,
    name: id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}
const TRACKS = [makeTrack('t1'), makeTrack('t2')];

function createFakeAdapter() {
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
  };
}

type Info = ReturnType<typeof usePlaylistInfo>;
/** Records what the drawing primitives are told, per `name`. */
const seen: Record<string, Info> = {};
const renders: Record<string, number> = {};
const InfoProbe: React.FC<{ name?: string }> = ({ name = 'view' }) => {
  seen[name] = usePlaylistInfo();
  renders[name] = (renders[name] ?? 0) + 1;
  return null;
};

let ready = false;
let view: ReturnType<typeof usePlaylistView>;
let viewReaderRenders = 0;
const ProviderProbe: React.FC = () => {
  ready = usePlaylistTimeline().isReady;
  return null;
};
/** Reads the provider's view value only, as a `sampleRate` reader does. */
const ViewReader = React.memo(function ViewReader() {
  view = usePlaylistView();
  viewReaderRenders++;
  return null;
});

async function mountMultitrack(
  tree: () => React.ReactElement,
  providerProps: Record<string, unknown> = {}
) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter as unknown as PlayoutAdapter;
  const ui = () => (
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      // One channel per row, so a row is one `waveHeight` tall.
      mono
      {...providerProps}
    >
      <ProviderProbe />
      <ViewReader />
      {tree()}
    </WaveformPlaylistProvider>
  );
  ready = false;
  const result = render(ui());
  await waitFor(() => expect(ready).toBe(true));
  await act(async () => {});
  return { warn, rerender: () => result.rerender(ui()) };
}

const ME_RATE = 44100;
const ME_LENGTH = (8 * ME_RATE) / 441;
const ME_TRACK = {
  source: 'test.mp3',
  name: 'Test',
  waveformData: WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: ME_RATE,
    samples_per_pixel: 441,
    bits: 8,
    length: ME_LENGTH,
    data: Array.from({ length: ME_LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
  }) as unknown as WaveformDataObject,
};

async function mountMediaElement(
  tree: () => React.ReactElement,
  providerProps: Record<string, unknown> = {}
) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fake = {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on() {},
    off() {},
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn(),
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose: vi.fn(),
  };
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  const ui = () => (
    <MediaElementPlaylistProvider
      track={ME_TRACK}
      samplesPerPixel={1000}
      createPlayout={createPlayout}
      {...providerProps}
    >
      <ViewReader />
      {tree()}
    </MediaElementPlaylistProvider>
  );
  const result = render(ui());
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  await act(async () => {});
  return { warn, rerender: () => result.rerender(ui()) };
}

const MOUNTS = [
  ['WaveformPlaylistProvider', mountMultitrack, WaveformRoot],
  ['MediaElementPlaylistProvider', mountMediaElement, MediaElementWaveformRoot],
] as const;

const rowHeights = (within: ParentNode = document) =>
  [...within.querySelectorAll('[data-track-row]')].map(
    // The row positions itself; its first child is as tall as its channels.
    (row) => (row.firstElementChild as HTMLElement).style.height
  );
const playheadWidth = () =>
  (document.querySelector('[data-playhead]') as HTMLElement | null)?.style.width;
const tracksWidth = () =>
  (document.querySelector('[data-scroll-container]')?.firstElementChild as HTMLElement).style.width;

const DRAWN = ['waveHeight', 'barWidth', 'barGap', 'roundedBars', 'progressBarWidth'] as const;
const drawn = (info: Info) => Object.fromEntries(DRAWN.map((key) => [key, info[key]]));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetPartWarnings();
  for (const key of Object.keys(seen)) delete seen[key];
  for (const key of Object.keys(renders)) delete renders[key];
  viewReaderRenders = 0;
});

describe('WaveformViewOptions (#689)', () => {
  it('is exported', () => {
    expect(typeof api.WaveformViewOptions).toBe('function');
  });

  describe.each(MOUNTS)('under %s', (_name, mount, Root) => {
    it('with no options the view is drawn with the defaults, the same under both providers', async () => {
      await mount(() => (
        <Root>
          <WaveformTracks />
          <WaveformPlayhead />
          <InfoProbe />
        </Root>
      ));
      expect(drawn(seen.view)).toEqual({
        waveHeight: 80,
        barWidth: 1,
        barGap: 0,
        roundedBars: false,
        progressBarWidth: 1,
      });
      expect(new Set(rowHeights())).toEqual(new Set(['80px']));
      expect(playheadWidth()).toBe('1px');
    });

    it('the options above a root reach what is drawn in it', async () => {
      await mount(() => (
        <WaveformViewOptions
          waveHeight={64}
          barWidth={4}
          barGap={2}
          roundedBars
          progressBarWidth={3}
        >
          <Root>
            <WaveformTracks />
            <WaveformPlayhead />
            <InfoProbe />
          </Root>
        </WaveformViewOptions>
      ));
      expect(drawn(seen.view)).toEqual({
        waveHeight: 64,
        barWidth: 4,
        barGap: 2,
        roundedBars: true,
        progressBarWidth: 3,
      });
      expect(new Set(rowHeights())).toEqual(new Set(['64px']));
      expect(playheadWidth()).toBe('3px');
    });

    it('the playhead is as wide as a bar and its gap unless a width is given', async () => {
      await mount(() => (
        <WaveformViewOptions barWidth={3} barGap={2}>
          <Root>
            <WaveformPlayhead />
            <InfoProbe />
          </Root>
        </WaveformViewOptions>
      ));
      expect(seen.view.progressBarWidth).toBe(5);
      expect(playheadWidth()).toBe('5px');
    });

    it('a prop left out is taken from the options above; one given wins, also `false` and 0', async () => {
      await mount(() => (
        <WaveformViewOptions waveHeight={50} barWidth={4} barGap={2} roundedBars>
          <WaveformViewOptions barGap={0} roundedBars={false}>
            <Root>
              <InfoProbe />
            </Root>
          </WaveformViewOptions>
        </WaveformViewOptions>
      ));
      expect(drawn(seen.view)).toEqual({
        waveHeight: 50,
        barWidth: 4,
        barGap: 0,
        roundedBars: false,
        progressBarWidth: 4,
      });
    });

    it('two views under one provider are drawn with their own options', async () => {
      await mount(() => (
        <>
          <div data-view="small">
            <WaveformViewOptions waveHeight={24}>
              <Root>
                <WaveformTracks />
                <InfoProbe name="small" />
              </Root>
            </WaveformViewOptions>
          </div>
          <div data-view="large">
            <WaveformViewOptions waveHeight={120} barWidth={4}>
              <Root>
                <WaveformTracks />
                <InfoProbe name="large" />
              </Root>
            </WaveformViewOptions>
          </div>
        </>
      ));
      expect([seen.small.waveHeight, seen.small.barWidth]).toEqual([24, 1]);
      expect([seen.large.waveHeight, seen.large.barWidth]).toEqual([120, 4]);
      const small = document.querySelector('[data-view="small"]') as HTMLElement;
      const large = document.querySelector('[data-view="large"]') as HTMLElement;
      expect(new Set(rowHeights(small))).toEqual(new Set(['24px']));
      expect(new Set(rowHeights(large))).toEqual(new Set(['120px']));
    });

    it('options above the provider apply too', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <WaveformViewOptions waveHeight={33}>
          <NestedProvider Root={Root} />
        </WaveformViewOptions>
      );
      await waitFor(() => expect(seen.view?.waveHeight).toBe(33));
      await act(async () => {});
    });

    it('the six option props left on the provider are ignored, and the view value does not carry them', async () => {
      await mount(
        () => (
          <Root>
            <WaveformTracks />
            <WaveformPlayhead />
            <InfoProbe />
          </Root>
        ),
        {
          waveHeight: 200,
          barWidth: 9,
          barGap: 9,
          roundedBars: true,
          progressBarWidth: 9,
          fillViewport: true,
        }
      );
      expect(drawn(seen.view)).toEqual({
        waveHeight: 80,
        barWidth: 1,
        barGap: 0,
        roundedBars: false,
        progressBarWidth: 1,
      });
      expect(Object.keys(view).sort()).toEqual(['indefinitePlayback', 'mono', 'sampleRate']);
    });

    it('a changed option renders the view and not a reader of the provider value', async () => {
      let height = 80;
      const { rerender } = await mount(() => (
        <WaveformViewOptions waveHeight={height}>
          <Root>
            <WaveformTracks />
            <InfoProbe />
          </Root>
        </WaveformViewOptions>
      ));
      const before = viewReaderRenders;
      height = 90;
      await act(async () => rerender());
      expect(seen.view.waveHeight).toBe(90);
      expect(new Set(rowHeights())).toEqual(new Set(['90px']));
      expect(viewReaderRenders).toBe(before);
    });

    it('the same options again publish the same value: a parent render does not render a reader', async () => {
      const INFO = <InfoProbe />;
      const { rerender } = await mount(() => (
        <WaveformViewOptions waveHeight={70} barWidth={2}>
          <Root>{INFO}</Root>
        </WaveformViewOptions>
      ));
      const value = seen.view;
      const count = renders.view;
      await act(async () => rerender());
      expect(seen.view).toBe(value);
      expect(renders.view).toBe(count);
    });

    it('bars that cannot be drawn are corrected, with one warning each', async () => {
      const { warn } = await mount(() => (
        <>
          <WaveformViewOptions barWidth={0} barGap={0}>
            <Root>
              <InfoProbe name="zero" />
            </Root>
          </WaveformViewOptions>
          <WaveformViewOptions barWidth={2} barGap={-5}>
            <Root>
              <InfoProbe name="negative" />
            </Root>
          </WaveformViewOptions>
          <WaveformViewOptions waveHeight={0}>
            <Root>
              <InfoProbe name="flat" />
            </Root>
          </WaveformViewOptions>
        </>
      ));
      // A bar is at least as wide as nothing can be: the default.
      expect([seen.zero.barWidth, seen.zero.barGap]).toEqual([1, 0]);
      // The step from one bar to the next is at least one pixel.
      expect([seen.negative.barWidth, seen.negative.barGap]).toEqual([2, -1]);
      expect(seen.flat.waveHeight).toBe(80);
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('barWidth')).length).toBe(1);
      expect(messages.filter((m) => m.includes('barGap')).length).toBe(1);
      expect(messages.filter((m) => m.includes('waveHeight')).length).toBe(1);
    });
  });

  it('the ready-made views take their options from above too', async () => {
    await mountMultitrack(() => (
      <WaveformViewOptions waveHeight={44}>
        <Waveform />
      </WaveformViewOptions>
    ));
    expect(new Set(rowHeights())).toEqual(new Set(['44px']));
    cleanup();
    await mountMediaElement(() => (
      <WaveformViewOptions waveHeight={45}>
        <MediaElementWaveform />
      </WaveformViewOptions>
    ));
    expect(new Set(rowHeights())).toEqual(new Set(['45px']));
  });

  it('`fillViewport` extends the multitrack timeline to its container; the MediaElement root ignores it', async () => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-scroll-container') ? 1200 : 0;
      });
    await mountMultitrack(() => (
      <WaveformViewOptions fillViewport>
        <WaveformRoot>
          <WaveformTracks />
        </WaveformRoot>
      </WaveformViewOptions>
    ));
    // One second of audio at 1024 samples per pixel is 46 px; the container is 1200.
    expect(tracksWidth()).toBe('1200px');
    cleanup();
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(tracksWidth()).toBe('46px');
    cleanup();
    await mountMediaElement(() => (
      <WaveformViewOptions fillViewport>
        <MediaElementWaveformRoot>
          <WaveformTracks />
        </MediaElementWaveformRoot>
      </WaveformViewOptions>
    ));
    // Eight seconds at 44100 Hz and 1000 samples per pixel.
    expect(tracksWidth()).toBe('352px');
    width.mockRestore();
  });

  it('`indefinitePlayback` on the provider still implies the filled layout', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.hasAttribute('data-scroll-container') ? 1200 : 0;
    });
    await mountMultitrack(
      () => (
        <WaveformRoot>
          <WaveformTracks />
        </WaveformRoot>
      ),
      { indefinitePlayback: true }
    );
    expect(tracksWidth()).toBe('1200px');
    expect(view.indefinitePlayback).toBe(true);
  });
});

describe('the timescale strip has a height option (#689)', () => {
  const stripHeight = () => seen.view.timeScaleHeight;
  const spacerHeight = () =>
    (
      document.querySelector('[data-scroll-container]')?.previousElementSibling
        ?.firstElementChild as HTMLElement | null
    )?.style.height;

  it('30 px by default, also for a strip that holds only the loop region', async () => {
    let timescale = true;
    const { rerender } = await mountMultitrack(() => (
      <WaveformRoot>
        {timescale ? <WaveformTimescale /> : null}
        <WaveformLoopRegion />
        <WaveformTrackControls />
        <WaveformTracks />
        <InfoProbe />
      </WaveformRoot>
    ));
    expect(stripHeight()).toBe(30);
    expect(spacerHeight()).toBe('31px');
    timescale = false;
    await act(async () => rerender());
    expect(stripHeight()).toBe(30);
  });

  it('`height` on the timescale part sets the strip, and the gap beside it, under both roots', async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTimescale height={44} />
        <WaveformTrackControls />
        <WaveformTracks />
        <InfoProbe />
      </WaveformRoot>
    ));
    expect(stripHeight()).toBe(44);
    expect(spacerHeight()).toBe('45px');
    cleanup();
    await mountMediaElement(() => (
      <MediaElementWaveformRoot>
        <WaveformTimescale height={20} />
        <WaveformTracks />
        <InfoProbe />
      </MediaElementWaveformRoot>
    ));
    expect(stripHeight()).toBe(20);
  });

  it('a height that is not a positive number warns once and draws the default strip', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTimescale height={0} />
        <WaveformTracks />
        <InfoProbe />
      </WaveformRoot>
    ));
    expect(stripHeight()).toBe(30);
    expect(
      warn.mock.calls.filter((call) => String(call[0]).includes('<WaveformTimescale height>'))
        .length
    ).toBe(1);
  });

  it('no strip without a timescale part', async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
        <InfoProbe />
      </WaveformRoot>
    ));
    expect(stripHeight()).toBe(0);
  });
});

/** A provider of the kind `Root` belongs to, for a tree that starts above it. */
function NestedProvider({ Root }: { Root: typeof WaveformRoot | typeof MediaElementWaveformRoot }) {
  const adapter = React.useMemo(() => createFakeAdapter(), []);
  const createAdapter = React.useCallback(() => adapter as unknown as PlayoutAdapter, [adapter]);
  const playout = React.useMemo(
    () => ({
      addTrack() {},
      getTrack: () => undefined,
      setOnPlaybackComplete() {},
      on() {},
      off() {},
      play() {},
      pause() {},
      stop() {},
      seekTo() {},
      setPlaybackRate() {},
      getCurrentTime: () => 0,
      dispose() {},
    }),
    []
  );
  const createPlayout = React.useCallback(
    () => playout as unknown as MediaElementPlayout,
    [playout]
  );
  const tree = (
    <Root>
      <WaveformTracks />
      <InfoProbe />
    </Root>
  );
  return Root === WaveformRoot ? (
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      {tree}
    </WaveformPlaylistProvider>
  ) : (
    <MediaElementPlaylistProvider
      track={ME_TRACK}
      samplesPerPixel={1000}
      createPlayout={createPlayout}
    >
      {tree}
    </MediaElementPlaylistProvider>
  );
}
