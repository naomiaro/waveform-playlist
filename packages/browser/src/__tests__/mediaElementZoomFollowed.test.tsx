// @vitest-environment jsdom
//
// #828. MediaElementPlaylistProvider has no zoom control, so its
// `samplesPerPixel` prop is the one place the zoom level is set, and the
// provider follows it: a new value redraws the waveform at it, on the same
// player, no finer than the waveform data. `automaticScroll` is different: the provider owns the setting
// (`setAutomaticScroll`), the prop is its initial value only, and a later
// change of the prop is not followed.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { Suspense, startTransition, useState } from 'react';
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
  usePlaybackControls,
  usePlaybackRefs,
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

  it("a value finer than the waveform data is drawn at the data's resolution", async () => {
    const view = render(ui({ samplesPerPixel: WAVEFORM_SPP }));
    await waitFor(() => expect(engine.created).toBe(1));
    view.rerender(ui({ samplesPerPixel: 220 }));
    expect(seen.zoom!.samplesPerPixel).toBe(WAVEFORM_SPP);
    expect(drawnLength()).toBe(LENGTH);
  });

  it("a starting value finer than the data is drawn at the data's resolution too", async () => {
    render(ui({ samplesPerPixel: 100 }));
    await waitFor(() => expect(engine.created).toBe(1));
    expect(seen.zoom!.samplesPerPixel).toBe(WAVEFORM_SPP);
    expect(drawnLength()).toBe(LENGTH);
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

// Found by the review of #932: the animation loop's zoom was written during
// render, so a render React threw away (a transition that suspended) reached
// the loop's frame data while the view still showed the committed zoom.
describe('the animation loop uses the committed zoom', () => {
  it('a suspended transition does not reach the frame data', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = globalThis.requestAnimationFrame;
    const caf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    const flushFrame = () => frames.splice(0).forEach((cb) => cb(0));
    try {
      const frameSpp: number[] = [];
      let play: ((t: number) => Promise<void> | void) | null = null;
      let committedZoom = 0;
      const Loop: React.FC = () => {
        const { registerFrameCallback } = usePlaybackRefs();
        play = usePlaybackControls().play;
        React.useEffect(() => {
          registerFrameCallback('probe', (d) => frameSpp.push(d.samplesPerPixel));
        }, [registerFrameCallback]);
        return null;
      };
      const Committed: React.FC = () => {
        const z = usePlaylistZoom().samplesPerPixel;
        React.useLayoutEffect(() => {
          committedZoom = z;
        });
        return null;
      };
      const never = new Promise<never>(() => {});
      const Suspender: React.FC<{ spp: number }> = ({ spp }) => {
        if (spp === WAVEFORM_SPP * 2) throw never;
        return null;
      };
      let setSpp: (n: number) => void = () => {};
      const App: React.FC = () => {
        const [spp, set] = useState(WAVEFORM_SPP);
        setSpp = set;
        return (
          <MediaElementPlaylistProvider track={TRACK} samplesPerPixel={spp}>
            <Loop />
            <Committed />
            <Suspense fallback={null}>
              <Suspender spp={spp} />
            </Suspense>
          </MediaElementPlaylistProvider>
        );
      };
      render(<App />);
      await waitFor(() => expect(engine.created).toBe(1));
      await act(async () => {
        await play!(0);
      });
      flushFrame();
      expect(frameSpp[frameSpp.length - 1]).toBe(WAVEFORM_SPP);
      await act(async () => {
        startTransition(() => setSpp(WAVEFORM_SPP * 2));
      });
      flushFrame();
      expect(committedZoom).toBe(WAVEFORM_SPP);
      expect(frameSpp[frameSpp.length - 1]).toBe(WAVEFORM_SPP);
    } finally {
      globalThis.requestAnimationFrame = raf;
      globalThis.cancelAnimationFrame = caf;
    }
  });
});
