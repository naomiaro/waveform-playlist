// @vitest-environment jsdom
//
// #693: memo boundaries in the visualization. A selection drag sets the
// selection on every pointer move, and an active-annotation change happens
// throughout playback; neither may re-render the tracks, clips or channels,
// which do not depend on them. An edit to one clip re-renders that clip only.
//
// Render counts come from counting wrappers put around the real components.
// `SmartChannel` is rendered unconditionally by `ChannelWithProgress`, so its
// count is the count of `ChannelWithProgress` renders including those caused
// by a context it consumes.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const counts = vi.hoisted(() => ({
  clip: {} as Record<string, number>,
  channel: 0,
  track: {} as Record<string, number>,
  controls: 0,
  scale: 0,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clip[props.clipId] = (counts.clip[props.clipId] ?? 0) + 1;
      return createElement(actual.Clip, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.channel++;
      return createElement(actual.SmartChannel, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      const id = props.trackId ?? '?';
      counts.track[id] = (counts.track[id] ?? 0) + 1;
      return createElement(actual.Track, props);
    },
    Controls: (props: React.ComponentProps<typeof actual.Controls>) => {
      counts.controls++;
      return createElement(actual.Controls, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scale++;
      return createElement(actual.SmartScale, props);
    },
  };
});

import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistData,
  usePlaylistState,
} from '../WaveformPlaylistContext';
import { PlaylistVisualization } from '../components/PlaylistVisualization';
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

function makeClip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: makeWaveformData(400),
    ...overrides,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
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
  controls: ReturnType<typeof usePlaylistControls>;
  data: ReturnType<typeof usePlaylistData>;
  state: ReturnType<typeof usePlaylistState>;
};

const ProbeChild: React.FC = () => {
  probe = {
    controls: usePlaylistControls(),
    data: usePlaylistData(),
    state: usePlaylistState(),
  };
  return null;
};

const CONTROLS = { show: true, width: 200 };

const ANNOTATIONS = [
  { id: 'n1', start: 0, end: 0.5, lines: ['one'] },
  { id: 'n2', start: 0.5, end: 1, lines: ['two'] },
];

function resetCounts() {
  counts.clip = {};
  counts.channel = 0;
  counts.track = {};
  counts.controls = 0;
  counts.scale = 0;
}

function totalOf(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

async function mount(initialTracks: ClipTrack[], { annotations = false } = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const annotationList = annotations ? { annotations: ANNOTATIONS } : undefined;
  const ui = (tracks: ClipTrack[]) => (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      annotationList={annotationList}
      controls={CONTROLS}
      timescale
    >
      <ProbeChild />
      <PlaylistVisualization showClipHeaders />
    </WaveformPlaylistProvider>
  );
  const utils = render(ui(initialTracks));
  await waitFor(() => expect(probe.data.isReady).toBe(true));
  await act(async () => {});
  resetCounts();
  return { setTracks: (tracks: ClipTrack[]) => utils.rerender(ui(tracks)) };
}

function threeTracks() {
  const a = makeClip('a');
  const b = makeClip('b', { startSample: SAMPLE_RATE * 2 });
  const c = makeClip('c');
  const d = makeClip('d');
  return {
    a,
    b,
    c,
    d,
    tracks: [makeTrack('t1', [a, b]), makeTrack('t2', [c]), makeTrack('t3', [d])],
  };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('visualization memo boundaries (#693)', () => {
  it('mounts every clip, channel, track and control panel (the counters work)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    resetCounts();
    const adapter = createFakeAdapter();
    render(
      <WaveformPlaylistProvider
        tracks={threeTracks().tracks}
        sampleRate={SAMPLE_RATE}
        createAdapter={() => adapter}
        controls={CONTROLS}
        timescale
      >
        <ProbeChild />
        <PlaylistVisualization showClipHeaders />
      </WaveformPlaylistProvider>
    );
    await waitFor(() => expect(probe.data.isReady).toBe(true));

    expect(Object.keys(counts.clip).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(Object.keys(counts.track).sort()).toEqual(['t1', 't2', 't3']);
    expect(counts.channel).toBeGreaterThanOrEqual(4);
    expect(counts.controls).toBeGreaterThanOrEqual(3);
    expect(counts.scale).toBeGreaterThanOrEqual(1);
  });

  it('a selection that grows to the right re-renders no track, clip, channel or controls', async () => {
    await mount(threeTracks().tracks);
    await act(async () => {
      probe.controls.setSelection(0.1, 0.3);
    });
    resetCounts();

    await act(async () => {
      probe.controls.setSelection(0.1, 0.4);
    });
    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });

    expect(probe.state.selectionEnd).toBe(0.5);
    expect(counts.clip).toEqual({});
    expect(counts.track).toEqual({});
    expect(counts.channel).toBe(0);
    expect(counts.controls).toBe(0);
    expect(counts.scale).toBe(0);
  });

  it('a selection that grows to the left (the cursor moves too) re-renders none of them either', async () => {
    await mount(threeTracks().tracks);
    await act(async () => {
      probe.controls.setSelection(0.4, 0.6);
    });
    resetCounts();

    await act(async () => {
      probe.controls.setSelection(0.3, 0.6);
    });
    await act(async () => {
      probe.controls.setSelection(0.2, 0.6);
    });

    expect(probe.state.selectionStart).toBe(0.2);
    expect(counts.clip).toEqual({});
    expect(counts.track).toEqual({});
    expect(counts.channel).toBe(0);
    expect(counts.controls).toBe(0);
  });

  it('an active-annotation change re-renders none of them', async () => {
    await mount(threeTracks().tracks, { annotations: true });
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });
    resetCounts();

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    expect(probe.state.activeAnnotationId).toBe('n2');
    expect(counts.clip).toEqual({});
    expect(counts.track).toEqual({});
    expect(counts.channel).toBe(0);
    expect(counts.controls).toBe(0);
  });

  it('selecting another track re-renders the two tracks involved and no other', async () => {
    await mount(threeTracks().tracks);
    await act(async () => {
      probe.controls.setSelectedTrackId('t1');
    });
    resetCounts();

    await act(async () => {
      probe.controls.setSelectedTrackId('t2');
    });

    expect(Object.keys(counts.track).sort()).toEqual(['t1', 't2']);
    expect(Object.keys(counts.clip).sort()).toEqual(['a', 'b', 'c']);
    expect(counts.clip.d).toBeUndefined();
  });

  it('trimming one clip re-renders that clip only', async () => {
    const { a, b, c, d } = threeTracks();
    const { setTracks } = await mount([
      makeTrack('t1', [a, b]),
      makeTrack('t2', [c]),
      makeTrack('t3', [d]),
    ]);

    const trimmed = { ...a, durationSamples: SAMPLE_RATE / 2 };
    await act(async () => {
      setTracks([makeTrack('t1', [trimmed, b]), makeTrack('t2', [c]), makeTrack('t3', [d])]);
    });
    await waitFor(() => expect(probe.data.isReady).toBe(true));

    expect(counts.clip.a).toBeGreaterThanOrEqual(1);
    expect(counts.clip.b).toBeUndefined();
    expect(counts.clip.c).toBeUndefined();
    expect(counts.clip.d).toBeUndefined();
    expect(Object.keys(counts.track)).toEqual(['t1']);
  });

  it('a mixer change re-renders that track control panel only, and no clip', async () => {
    await mount(threeTracks().tracks);

    await act(async () => {
      probe.controls.setTrackVolume(1, 0.5);
    });

    expect(probe.data.trackStates[1].volume).toBe(0.5);
    expect(counts.controls).toBe(1);
    expect(totalOf(counts.clip)).toBe(0);
    expect(counts.channel).toBe(0);
  });

  it('the played-portion overlay of each clip still follows a seek while stopped', async () => {
    // Clips a, c and d span 0-1 s; b spans 2-3 s.
    await mount(threeTracks().tracks);
    const transforms = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-clip-container] div'))
        .map((el) => el.style.transform)
        .filter((t) => t.startsWith('scaleX'));

    await act(async () => {
      probe.controls.setCurrentTime(0.5);
    });
    expect(transforms().sort()).toEqual(['scaleX(0)', 'scaleX(0.5)', 'scaleX(0.5)', 'scaleX(0.5)']);

    await act(async () => {
      probe.controls.setCurrentTime(2.25);
    });
    expect(transforms().sort()).toEqual(['scaleX(0.25)', 'scaleX(1)', 'scaleX(1)', 'scaleX(1)']);
  });

  it('pressing a clip selects its track by its current index after the tracks change', async () => {
    const { a, b, c, d } = threeTracks();
    const { setTracks } = await mount([
      makeTrack('t1', [a, b]),
      makeTrack('t2', [c]),
      makeTrack('t3', [d]),
    ]);
    // t1 is removed: clip d's track moves from index 2 to index 1.
    await act(async () => {
      setTracks([makeTrack('t2', [c]), makeTrack('t3', [d])]);
    });
    await waitFor(() => expect(probe.data.isReady).toBe(true));

    const clipD = document.querySelector('[data-track-id="t3"] [data-clip-container]');
    expect(clipD).not.toBeNull();
    await act(async () => {
      fireEvent.mouseDown(clipD!);
    });

    expect(probe.state.selectedTrackId).toBe('t3');
  });

  it('still shows the selection and moves it', async () => {
    await mount(threeTracks().tracks);
    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });
    const selection = () => document.querySelector('[data-selection]') as HTMLElement | null;
    expect(selection()).not.toBeNull();
    const widthBefore = selection()!.style.width;

    await act(async () => {
      probe.controls.setSelection(0.1, 0.9);
    });
    expect(selection()!.style.width).not.toBe(widthBefore);
  });
});
