// @vitest-environment jsdom
//
// The multitrack view's side of the selection drag (the rules are the hook's,
// see selectionDragDuringPlayback.test.tsx): what `WaveformRoot` adds on a
// press, and that it gives the hook what it needs (the preview for the
// highlight, the automatic-scroll flag).
//
// 50 pixels per second; the click overlay is given a 2000 px wide rectangle,
// because jsdom lays nothing out.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useSelectedTrackId,
  useSelection,
  useCurrentTime,
  useIsPlaying,
  usePlaybackControls,
} from '../contexts/playlistContexts';
import { Waveform } from '../components/Waveform';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 960;
const ZOOM_LEVELS = [480, 960, 1920];
const WAVE_HEIGHT = 80;
const SECONDS = 20;

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE * SECONDS,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * SECONDS,
  } as AudioClip;
  return {
    id,
    name: id,
    kind: 'audio',
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

function createFakeAdapter() {
  const play = vi.fn();
  const adapter = {
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
    play,
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
  return { adapter, play };
}

let probe: {
  selectedTrackId: string | null;
  selection: { selectionStart: number; selectionEnd: number };
  currentTime: number;
  isPlaying: boolean;
  controls: ReturnType<typeof usePlaybackControls>;
};

const Probe: React.FC = () => {
  probe = {
    selectedTrackId: useSelectedTrackId().selectedTrackId,
    selection: useSelection(),
    currentTime: useCurrentTime().currentTime,
    isPlaying: useIsPlaying().isPlaying,
    controls: usePlaybackControls(),
  };
  return null;
};

/** The overlay that takes presses on the tracks: the sibling laid over the rows. */
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

async function mount({ automaticScroll = false } = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const { adapter, play } = createFakeAdapter();
  const createAdapter = () => adapter;
  const tracks = [makeTrack('one'), makeTrack('two')];
  render(
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      zoomLevels={ZOOM_LEVELS}
      createAdapter={createAdapter}
      waveHeight={WAVE_HEIGHT}
      automaticScroll={automaticScroll}
    >
      <Probe />
      <Waveform />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => {
    expect(document.querySelectorAll('[data-track-row]').length).toBe(2);
    expect(document.querySelector('[data-playlist-state="ready"]')).not.toBeNull();
  });
  const overlay = clickOverlay();
  overlay.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 2000, bottom: 160, width: 2000, height: 160 }) as DOMRect;
  return { overlay, play };
}

async function startPlayback() {
  await act(async () => {
    await probe.controls.play();
  });
  expect(probe.isPlaying).toBe(true);
}

const highlights = () => document.querySelectorAll('[data-selection]').length;

async function press(overlay: HTMLElement, x: number, y: number) {
  await act(async () => {
    fireEvent.mouseDown(overlay, { button: 0, clientX: x, clientY: y });
  });
}
async function move(x: number) {
  await act(async () => {
    fireEvent.mouseMove(window, { buttons: 1, clientX: x, clientY: 10 });
  });
}
async function release(x: number) {
  await act(async () => {
    fireEvent.mouseUp(window, { button: 0, clientX: x, clientY: 10 });
  });
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('a press on the tracks of the multitrack view', () => {
  it('while stopped: selects the row under the pointer and moves the cursor there', async () => {
    const { overlay } = await mount();

    await press(overlay, 250, WAVE_HEIGHT * 1.5);
    expect(probe.selectedTrackId).toBe('two');
    expect(probe.currentTime).toBe(5);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 5 });
    await release(250);
    expect(probe.currentTime).toBe(5);
  });

  it('while playing: selects the row, and moves neither the cursor nor playback', async () => {
    const { overlay, play } = await mount();
    await startPlayback();
    const playsBefore = play.mock.calls.length;
    const cursorBefore = probe.currentTime;

    await press(overlay, 250, WAVE_HEIGHT * 1.5);
    expect(probe.selectedTrackId).toBe('two');
    expect(probe.currentTime).toBe(cursorBefore);
    expect(probe.selection).toEqual({ selectionStart: 0, selectionEnd: 0 });
    expect(play.mock.calls.length).toBe(playsBefore);

    // The one seek comes with the release.
    await release(250);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 5 });
    expect(probe.currentTime).toBe(5);
    expect(play.mock.calls.length).toBe(playsBefore + 1);
    // From the press, open-ended.
    expect(play.mock.lastCall).toEqual([5, undefined]);
    expect(probe.isPlaying).toBe(true);
  });
});

describe('a drag on the tracks of the multitrack view during playback', () => {
  it('automatic scroll off: the range is highlighted while it is drawn and becomes the selection on the release', async () => {
    const { overlay, play } = await mount();
    await startPlayback();
    const playsBefore = play.mock.calls.length;

    await press(overlay, 250, 10);
    await move(350);
    expect(highlights()).toBe(1);
    expect(probe.selection).toEqual({ selectionStart: 0, selectionEnd: 0 });
    expect(play.mock.calls.length).toBe(playsBefore);

    await release(350);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 7 });
    expect(highlights()).toBe(1);
    expect(play.mock.calls.length).toBe(playsBefore + 1);
    // The range, from its start to its end.
    expect(play.mock.lastCall).toEqual([5, 7]);
    expect(probe.isPlaying).toBe(true);
  });

  it('automatic scroll on: nothing is highlighted, and the release seeks to where the press landed', async () => {
    const { overlay, play } = await mount({ automaticScroll: true });
    await startPlayback();
    const playsBefore = play.mock.calls.length;

    await press(overlay, 250, 10);
    await move(350);
    expect(highlights()).toBe(0);
    expect(play.mock.calls.length).toBe(playsBefore);

    await release(350);
    expect(probe.selection).toEqual({ selectionStart: 5, selectionEnd: 5 });
    expect(highlights()).toBe(0);
    expect(play.mock.calls.length).toBe(playsBefore + 1);
    expect(play.mock.lastCall).toEqual([5, undefined]);
    expect(probe.isPlaying).toBe(true);
  });
});
