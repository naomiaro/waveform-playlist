// @vitest-environment jsdom
//
// #685, step 1: the multitrack view is a root with parts as its children. A
// render of the root alone (a press, a release, a selected track) hands the
// parts the same elements as before, so React skips them; each part follows
// only the contexts it reads.
//
// Also here: two `AudioPosition`s under one provider each keep their own
// frame callback (they used to share the id 'audio-position').
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const counts = vi.hoisted(() => ({
  shell: 0,
  scale: 0,
  boxes: 0,
  controls: 0,
  track: 0,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Playlist: (props: React.ComponentProps<typeof actual.Playlist>) => {
      counts.shell++;
      return createElement(actual.Playlist, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scale++;
      return createElement(actual.SmartScale, props);
    },
    Controls: (props: React.ComponentProps<typeof actual.Controls>) => {
      counts.controls++;
      return createElement(actual.Controls, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      counts.track++;
      return createElement(actual.Track, props);
    },
  };
});

vi.mock('../components/AnnotationBoxes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/AnnotationBoxes')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    AnnotationBoxes: (props: React.ComponentProps<typeof actual.AnnotationBoxes>) => {
      counts.boxes++;
      return createElement(actual.AnnotationBoxes, props);
    },
  };
});

import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEditorControls,
  usePlaylistTimeline,
  useSelectedTrackId,
  IsPlayingContext,
  PlaybackRefsContext,
  CurrentTimeContext,
  PlaylistSettingsContext,
  type PlaybackRefsContextValue,
} from '../contexts/playlistContexts';
import { PlaylistVisualization } from '../components/PlaylistVisualization';
import { AudioPosition } from '../components/ContextualControls';
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
    gain: 1,
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

let probe: {
  editor: ReturnType<typeof useEditorControls>;
  isReady: boolean;
  selectedTrackId: string | null;
};

const ProbeChild: React.FC = () => {
  probe = {
    editor: useEditorControls(),
    isReady: usePlaylistTimeline().isReady,
    selectedTrackId: useSelectedTrackId().selectedTrackId,
  };
  return null;
};

const CONTROLS = { show: true, width: 200 };
const ANNOTATION_LIST = {
  annotations: [
    { id: 'n1', start: 0, end: 0.5, lines: ['one'] },
    { id: 'n2', start: 0.5, end: 1, lines: ['two'] },
  ],
};
const TRACKS = [makeTrack('t1'), makeTrack('t2'), makeTrack('t3')];

function resetCounts() {
  counts.shell = 0;
  counts.scale = 0;
  counts.boxes = 0;
  counts.controls = 0;
  counts.track = 0;
}

async function mount(reset = true) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  render(
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      annotationList={ANNOTATION_LIST}
      controls={CONTROLS}
      timescale
    >
      <ProbeChild />
      <PlaylistVisualization />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => expect(probe.isReady).toBe(true));
  await act(async () => {});
  if (reset) resetCounts();
}

/** The click overlay: the last, childless sibling above the track rows. */
function clickOverlay(): HTMLElement {
  let element: Element | null = document.querySelector('[data-track-row]');
  while (element && element.parentElement) {
    const last = element.parentElement.lastElementChild;
    if (last && last !== element && !last.contains(element) && last.childElementCount === 0) {
      return last as HTMLElement;
    }
    element = element.parentElement;
  }
  throw new Error('click overlay not found');
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('the root renders alone (#685)', () => {
  it('the counters work: everything is mounted', async () => {
    resetCounts();
    await mount(false);
    expect(document.querySelectorAll('[data-track-row]').length).toBe(3);
    expect(counts.shell).toBeGreaterThan(0);
    expect(counts.scale).toBeGreaterThan(0);
    expect(counts.boxes).toBeGreaterThan(0);
    expect(counts.controls).toBeGreaterThanOrEqual(3);
    expect(counts.track).toBeGreaterThanOrEqual(3);
  });

  it('selecting a track from code renders the two rows and panels involved, not the root', async () => {
    await mount();

    await act(async () => {
      probe.editor.setSelectedTrackId('t2');
    });

    expect(probe.selectedTrackId).toBe('t2');
    expect(counts.track).toBeGreaterThan(0);
    expect(counts.track).toBeLessThanOrEqual(2);
    expect(counts.shell).toBe(0);
    expect(counts.scale).toBe(0);
    expect(counts.boxes).toBe(0);
  });

  it('a press and its release render the root, and neither the timescale nor the annotation row', async () => {
    await mount();
    // The first row is already under the pointer's track after this.
    await act(async () => {
      probe.editor.setSelectedTrackId('t1');
    });
    resetCounts();

    const overlay = clickOverlay();
    await act(async () => {
      fireEvent.mouseDown(overlay, { button: 0, clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: 10 });
    });

    // The root follows its own "a drag is in progress" state.
    expect(counts.shell).toBeGreaterThan(0);
    expect(counts.scale).toBe(0);
    expect(counts.boxes).toBe(0);
    expect(counts.track).toBe(0);
    expect(counts.controls).toBe(0);
  });
});

describe('AudioPosition registers under its own id (#685)', () => {
  it('two readouts under one provider keep one frame callback each', () => {
    const registered = new Map<string, unknown>();
    const refs: PlaybackRefsContextValue = {
      currentTimeRef: { current: 0 },
      visualTimeRef: { current: 0 },
      registerFrameCallback: (id, cb) => {
        registered.set(id, cb);
      },
      unregisterFrameCallback: (id) => {
        registered.delete(id);
      },
    };

    render(
      <PlaybackRefsContext.Provider value={refs}>
        <IsPlayingContext.Provider value={{ isPlaying: true }}>
          <CurrentTimeContext.Provider value={{ currentTime: 0 }}>
            <PlaylistSettingsContext.Provider
              value={{ timeFormat: 'hh:mm:ss.uuu', isAutomaticScroll: false }}
            >
              <AudioPosition />
              <AudioPosition />
            </PlaylistSettingsContext.Provider>
          </CurrentTimeContext.Provider>
        </IsPlayingContext.Provider>
      </PlaybackRefsContext.Provider>
    );

    expect(registered.size).toBe(2);
  });
});
