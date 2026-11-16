// @vitest-environment jsdom
//
// #812: while a trim is dragged, the view draws the clip from the trim preview
// before the tracks have it. A spectrogram provider draws a canvas for the
// range of the audio the canvas registered with, so the dragged clip's
// spectrogram canvases register with the previewed range, and with the
// committed one again after Escape.
//
// The real provider and view with a fake adapter and a fake spectrogram
// integration that records the registrations; the drag handlers are captured
// from the real DragDropProvider and called as dnd-kit calls them.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { startTransition, useState } from 'react';
import type { ClipTrack, SpectrogramCanvasRegistration } from '@waveform-playlist/core';

const captured = vi.hoisted(() => ({
  dnd: {} as Record<string, unknown>,
  registered: [] as Array<{
    clipId: string;
    offsetSamples: number | undefined;
    durationSamples: number | undefined;
  }>,
}));

vi.mock('@dnd-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    DragDropProvider: (props: React.ComponentProps<typeof actual.DragDropProvider>) => {
      captured.dnd = props as unknown as Record<string, unknown>;
      return createElement(actual.DragDropProvider, props);
    },
  };
});
vi.mock('../hooks/useDragSensors', () => ({ useDragSensors: () => [] }));

import { TestProvider } from './helpers/arrangementProvider';
import {
  SpectrogramIntegrationContext,
  type SpectrogramIntegration,
} from '../SpectrogramIntegrationContext';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { ComposedWaveform } from './testCompositions';
import {
  SAMPLE_RATE,
  SPP,
  makeClip,
  makeTrack,
  singleAdapter,
  trimEvent,
  type Boundary,
} from './trimPreviewFixtures';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const INTEGRATION: SpectrogramIntegration = {
  trackSpectrogramOverrides: new Map(),
  setTrackRenderMode: () => {},
  setTrackSpectrogramConfig: () => {},
  registerSpectrogramCanvas: (reg: SpectrogramCanvasRegistration) => {
    captured.registered.push({
      clipId: reg.clipId,
      offsetSamples: reg.offsetSamples,
      durationSamples: reg.durationSamples,
    });
  },
  unregisterSpectrogramCanvas: () => {},
  getColorMap: () => new Uint8Array(256 * 3),
  getFrequencyScale: () => (f: number) => f,
};

// Both tracks are drawn as spectrograms. t1: a (0..1 s), b (2..3 s, from 1 s
// into its file). t2: c (0..1 s).
function spectrogramTracks(): ClipTrack[] {
  return [
    { ...makeTrack('t1', [makeClip('a', 0, 1), makeClip('b', 2, 1)]), renderMode: 'spectrogram' },
    { ...makeTrack('t2', [makeClip('c', 0, 1)]), renderMode: 'spectrogram' },
  ];
}

const App: React.FC = () => {
  const [tracks] = useState(spectrogramTracks);
  return (
    <TestProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SPP}
      zoomLevels={[SPP]}
      createAdapter={singleAdapter()}
    >
      <SpectrogramIntegrationContext value={INTEGRATION}>
        <ClipInteractionProvider>
          <ComposedWaveform showClipHeaders noControls />
        </ClipInteractionProvider>
      </SpectrogramIntegrationContext>
    </TestProvider>
  );
};

type Prototype = { transferControlToOffscreen?: () => unknown };

async function mount() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(<App />);
  // Every clip's canvases have registered once.
  await waitFor(() =>
    expect(new Set(captured.registered.map((r) => r.clipId))).toEqual(new Set(['a', 'b', 'c']))
  );
  await act(async () => {});
}

type HandlerName = 'onDragStart' | 'onDragMove' | 'onDragEnd';

/** As dnd-kit 0.5.0 calls the handlers: move and end inside `startTransition`. */
function dispatch(name: HandlerName, event: never) {
  const handler = captured.dnd[name] as (event: never) => void;
  act(() => {
    if (name === 'onDragStart') handler(event);
    else startTransition(() => handler(event));
  });
}

/** The ranges clip `clipId` registered with since the list was last cleared. */
function rangesOf(clipId: string) {
  return captured.registered
    .filter((r) => r.clipId === clipId)
    .map(({ offsetSamples, durationSamples }) => ({ offsetSamples, durationSamples }));
}

const COMMITTED_B = { offsetSamples: SAMPLE_RATE, durationSamples: SAMPLE_RATE };

beforeEach(() => {
  (HTMLCanvasElement.prototype as unknown as Prototype).transferControlToOffscreen = () => ({});
  captured.registered = [];
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  delete (HTMLCanvasElement.prototype as unknown as Prototype).transferControlToOffscreen;
});

describe("a trim preview reaches the dragged clip's spectrogram canvases (#812)", () => {
  it.each(['left', 'right'] as Boundary[])(
    "a trim move registers the dragged clip's spectrogram canvases with the previewed geometry (%s)",
    async (boundary) => {
      await mount();
      expect(rangesOf('b')).toEqual([COMMITTED_B]);
      dispatch('onDragStart', trimEvent(0, boundary));

      for (const dx of [10, 25]) {
        captured.registered = [];
        dispatch('onDragMove', trimEvent(dx, boundary));
        const previewed =
          boundary === 'left'
            ? { offsetSamples: SAMPLE_RATE + dx * SPP, durationSamples: SAMPLE_RATE - dx * SPP }
            : { offsetSamples: SAMPLE_RATE, durationSamples: SAMPLE_RATE + dx * SPP };
        expect(rangesOf('b')).toEqual([previewed]);
      }
    }
  );

  it('Escape registers them with the committed geometry again', async () => {
    await mount();
    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(30));
    captured.registered = [];

    dispatch('onDragEnd', trimEvent(30, 'left', { canceled: true }));

    expect(rangesOf('b')).toEqual([COMMITTED_B]);
  });

  it('the release registers nothing: the canvases were drawn for the range it commits', async () => {
    await mount();
    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(30));
    captured.registered = [];

    dispatch('onDragEnd', trimEvent(30));
    await act(async () => {});

    expect(captured.registered).toEqual([]);
  });

  it("no other clip's canvases re-register on a move", async () => {
    await mount();
    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(10));
    captured.registered = [];

    dispatch('onDragMove', trimEvent(20));

    expect(captured.registered.map((r) => r.clipId)).toEqual(['b']);
  });
});
