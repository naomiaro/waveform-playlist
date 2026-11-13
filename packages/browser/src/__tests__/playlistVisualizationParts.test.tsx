// @vitest-environment jsdom
//
// #685, step 1: `PlaylistVisualization` is the default composition of the
// view's parts. Each of its props must reach the part it configures, and a
// part that is switched off must not be drawn. `recordingState` is not here:
// recordingPreviewSubscription.test.tsx mounts the view with it.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const seen = vi.hoisted(() => ({
  scale: 0,
  fades: [] as string[],
  gains: [] as number[],
  rails: 0,
  headers: 0,
  loopMax: [] as number[],
  boxRowWidth: [] as number[],
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      seen.scale++;
      return createElement(actual.SmartScale, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      seen.gains.push((props as { gain?: number }).gain ?? 1);
      return createElement(actual.SmartChannel, props);
    },
    TimescaleLoopRegion: (props: React.ComponentProps<typeof actual.TimescaleLoopRegion>) => {
      seen.loopMax.push(props.maxPosition as number);
      return createElement(actual.TimescaleLoopRegion, props);
    },
    ReorderRail: (props: React.ComponentProps<typeof actual.ReorderRail>) => {
      seen.rails++;
      return createElement(actual.ReorderRail, props);
    },
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      if (props.showHeader) seen.headers++;
      if (props.showFades) seen.fades.push(props.clipId);
      return createElement(actual.Clip, props);
    },
  };
});

import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  usePlaylistTimeline,
  usePlaylistZoom,
  useEditorControls,
} from '../contexts/playlistContexts';
import { PlaylistVisualization } from '../components/PlaylistVisualization';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationBoxIntegrationProps,
} from '../AnnotationIntegrationContext';
import type { PlaylistVisualizationProps } from '../components/PlaylistVisualization';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeWaveformData(bins: number): WaveformData {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    data.push(-(i % 100), i % 100);
  }
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  });
}

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: `${id}-clip`,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 0.25,
    fadeIn: { duration: 0.2, type: 'linear' },
    waveformData: makeWaveformData(400),
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

// The boxes are drawn through the annotation integration; a stand-in is enough.
const INTEGRATION = {
  AnnotationBox: (props: AnnotationBoxIntegrationProps) => (
    <span data-box={props.annotationId}>{props.label}</span>
  ),
  AnnotationBoxesWrapper: ({ children, width }: { children?: React.ReactNode; width: number }) => {
    seen.boxRowWidth.push(width);
    return <div>{children}</div>;
  },
} as unknown as AnnotationIntegration;

let isReady = false;
let samplesPerPixel = 0;
let editor: ReturnType<typeof useEditorControls>;
const ProbeChild: React.FC = () => {
  isReady = usePlaylistTimeline().isReady;
  samplesPerPixel = usePlaylistZoom().samplesPerPixel;
  editor = useEditorControls();
  return null;
};

const CONTROLS = { show: true, width: 200 };
// A width, so that only `show` hides the column (a width of 0 hides it by itself).
const NO_CONTROLS = { show: false, width: 200 };
const ANNOTATION_LIST = { annotations: [{ id: 'n1', start: 0, end: 0.5, lines: ['one'] }] };
const TRACKS = [makeTrack('t1'), makeTrack('t2')];

async function mount(
  props: PlaylistVisualizationProps = {},
  { timescale = true, controls = CONTROLS, dragProvider = false } = {}
) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  seen.scale = 0;
  seen.fades = [];
  seen.gains = [];
  seen.rails = 0;
  seen.headers = 0;
  seen.loopMax = [];
  seen.boxRowWidth = [];
  isReady = false;
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const view = <PlaylistVisualization {...props} />;
  render(
    <AnnotationIntegrationContext.Provider value={INTEGRATION}>
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        annotationList={ANNOTATION_LIST}
        controls={controls}
        timescale={timescale}
      >
        <ProbeChild />
        {dragProvider ? <ClipInteractionProvider>{view}</ClipInteractionProvider> : view}
      </WaveformPlaylistProvider>
    </AnnotationIntegrationContext.Provider>
  );
  await waitFor(() => expect(isReady).toBe(true));
  await act(async () => {});
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('PlaylistVisualization hands each prop to its part (#685)', () => {
  it('with no props: rows, panels and a timescale; no headers, fades, gain scaling, close buttons or reorder rails', async () => {
    await mount();
    expect(document.querySelectorAll('[data-track-row]').length).toBe(2);
    expect(document.querySelectorAll('input[aria-label="Volume"]').length).toBe(2);
    expect(seen.scale).toBeGreaterThan(0);
    expect(seen.headers).toBe(0);
    expect(seen.fades).toEqual([]);
    expect(seen.gains.length).toBeGreaterThan(0);
    expect(seen.gains.every((gain) => gain === 1)).toBe(true);
    expect(document.querySelectorAll('[title="Remove track"]').length).toBe(0);
    expect(seen.rails).toBe(0);
    // The default box label is the annotation's id.
    expect(document.querySelector('[data-box="n1"]')?.textContent).toBe('n1');
  });

  it('className lands on the outermost element, beside the loading state', async () => {
    await mount({ className: 'my-view' });
    const root = document.querySelector('[data-playlist-state]');
    expect(root?.classList.contains('my-view')).toBe(true);
  });

  it('the timescale and the loop region are not drawn when the provider has no timescale', async () => {
    await mount({}, { timescale: false });
    await act(async () => {
      editor.setLoopRegion(0.2, 0.6);
      editor.setLoopEnabled(true);
    });
    expect(seen.scale).toBe(0);
    expect(seen.loopMax).toEqual([]);
    expect(document.querySelectorAll('[data-track-row]').length).toBe(2);
  });

  it('the controls are not drawn when the provider hides them', async () => {
    await mount(
      { renderTrackControls: () => <i data-custom-panel="" /> },
      { controls: NO_CONTROLS }
    );
    expect(document.querySelectorAll('[data-custom-panel]').length).toBe(0);
    expect(document.querySelectorAll('input[aria-label="Volume"]').length).toBe(0);
  });

  it('showClipHeaders gives every clip a header', async () => {
    await mount({ showClipHeaders: true });
    expect(seen.headers).toBeGreaterThanOrEqual(2);
  });

  it('showFades reaches every clip', async () => {
    await mount({ showFades: true });
    expect(new Set(seen.fades)).toEqual(new Set(['t1-clip', 't2-clip']));
  });

  it("gainScaledWaveforms draws each channel at its clip's gain", async () => {
    await mount({ gainScaledWaveforms: true });
    expect(seen.gains.length).toBeGreaterThan(0);
    expect(seen.gains.every((gain) => gain === 0.25)).toBe(true);
  });

  it('renderTrackControls replaces the default panel of each track', async () => {
    await mount({ renderTrackControls: (index) => <i data-custom-panel={index} /> });
    expect(
      Array.from(document.querySelectorAll('[data-custom-panel]')).map((el) =>
        el.getAttribute('data-custom-panel')
      )
    ).toEqual(['0', '1']);
    expect(document.querySelectorAll('input[aria-label="Volume"]').length).toBe(0);
  });

  it('onRemoveTrack draws a close button per track and is called with the index', async () => {
    const onRemoveTrack = vi.fn();
    await mount({ onRemoveTrack });
    const buttons = document.querySelectorAll('[title="Remove track"]');
    expect(buttons.length).toBe(2);
    await act(async () => {
      fireEvent.click(buttons[1]);
    });
    expect(onRemoveTrack).toHaveBeenCalledWith(1);
  });

  it('trackReordering draws a reorder rail per track', async () => {
    await mount({ trackReordering: true }, { dragProvider: true });
    expect(seen.rails).toBeGreaterThanOrEqual(2);
  });

  it('getAnnotationBoxLabel labels the annotation boxes', async () => {
    await mount({ getAnnotationBoxLabel: (annotation) => `label-${annotation.id}` });
    expect(document.querySelector('[data-box="n1"]')?.textContent).toBe('label-n1');
  });

  it('the loop region and the annotation row are as wide as the timeline', async () => {
    await mount();
    // One second of audio: the timeline is that long, in pixels at this zoom.
    const timelineWidth = Math.floor(SAMPLE_RATE / samplesPerPixel);
    expect(timelineWidth).toBeGreaterThan(0);
    expect(seen.boxRowWidth[seen.boxRowWidth.length - 1]).toBe(timelineWidth);

    expect(seen.loopMax).toEqual([]);
    await act(async () => {
      editor.setLoopRegion(0.2, 0.6);
      editor.setLoopEnabled(true);
    });
    expect(seen.loopMax.length).toBeGreaterThan(0);
    expect(seen.loopMax[seen.loopMax.length - 1]).toBe(timelineWidth);
  });

  it('the row of the track being dragged to a new place is marked', async () => {
    await mount();
    const marked = () =>
      Array.from(document.querySelectorAll('[data-track-row][data-track-drag-source="true"]')).map(
        (row) => row.getAttribute('data-track-id')
      );
    expect(marked()).toEqual([]);
    await act(async () => {
      editor.setTrackDragPreview({ trackId: 't2', toIndex: 0 });
    });
    expect(marked()).toEqual(['t2']);
  });

  it('renderTick draws the tick labels of the timescale', async () => {
    await mount({ renderTick: (label) => <i data-custom-tick={label} /> });
    expect(document.querySelectorAll('[data-custom-tick]').length).toBeGreaterThan(0);
  });

  it('renderPlayhead is not called for a track selection or a reorder preview (#685)', async () => {
    const renderPlayhead = vi.fn(() => <i data-custom-playhead="" />);
    await mount({ renderPlayhead });
    const calls = renderPlayhead.mock.calls.length;
    expect(calls).toBeGreaterThan(0);

    await act(async () => {
      editor.setSelectedTrackId('t2');
    });
    await act(async () => {
      editor.setTrackDragPreview({ trackId: 't2', toIndex: 0 });
    });

    // Both took effect in the view.
    expect(document.querySelector('[data-track-row][data-selected="true"]')).not.toBeNull();
    expect(
      document.querySelector('[data-track-row][data-track-drag-source="true"]')
    ).not.toBeNull();
    expect(renderPlayhead.mock.calls.length).toBe(calls);
  });

  it('renderPlayhead draws the custom playhead', async () => {
    await mount({ renderPlayhead: () => <i data-custom-playhead="" /> });
    expect(document.querySelectorAll('[data-custom-playhead]').length).toBe(1);
  });
});
