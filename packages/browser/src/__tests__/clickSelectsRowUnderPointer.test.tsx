// @vitest-environment jsdom
//
// A press on the tracks selects the track whose row is under the pointer
// (#762). The row is found in the layout the rows are positioned with: a
// track drawn in 'both' mode (spectrogram above waveform) is as tall as any
// other track, and the press handler once counted it twice as tall, so every
// row below it selected the row above.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider, usePlaylistState } from '../WaveformPlaylistContext';
import { Waveform } from '../components/Waveform';
import type { ClipTrack, AudioClip, RenderMode } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const WAVE_HEIGHT = 80;

function makeTrack(id: string, renderMode?: RenderMode): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
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
    renderMode,
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

let selectedTrackId: string | null = null;
const Probe: React.FC = () => {
  selectedTrackId = usePlaylistState().selectedTrackId;
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

function selectedRowIds(): string[] {
  return Array.from(document.querySelectorAll('[data-track-row][data-selected="true"]')).map(
    (row) => row.getAttribute('data-track-id') ?? ''
  );
}

async function mount(tracks: ClipTrack[], showClipHeaders = false) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  render(
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      waveHeight={WAVE_HEIGHT}
    >
      <Probe />
      <Waveform showClipHeaders={showClipHeaders} />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => {
    expect(document.querySelectorAll('[data-track-row]').length).toBe(tracks.length);
    expect(document.querySelector('[data-playlist-state="ready"]')).not.toBeNull();
  });
}

/** jsdom lays nothing out: the overlay's rect is at 0,0, so clientY is the offset. */
async function pressAt(y: number) {
  const overlay = clickOverlay();
  await act(async () => {
    fireEvent.mouseDown(overlay, { button: 0, clientX: 10, clientY: y });
  });
  await act(async () => {
    fireEvent.mouseUp(window, { button: 0, clientX: 10, clientY: y });
  });
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  selectedTrackId = null;
  vi.restoreAllMocks();
});

describe('a press on the tracks selects the row under the pointer', () => {
  it('with waveform tracks: each row selects its own track', async () => {
    await mount([makeTrack('one'), makeTrack('two'), makeTrack('three')]);

    await pressAt(WAVE_HEIGHT * 1.5);
    await waitFor(() => expect(selectedTrackId).toBe('two'));
    expect(selectedRowIds()).toEqual(['two']);

    await pressAt(WAVE_HEIGHT * 0.5);
    await waitFor(() => expect(selectedTrackId).toBe('one'));
    expect(selectedRowIds()).toEqual(['one']);
  });

  it("below a 'both' track: the rows are not shifted by its height (#762)", async () => {
    await mount([makeTrack('one', 'both'), makeTrack('two'), makeTrack('three')]);

    // Row 'two' spans 80 to 160. The old handler gave 'one' 0 to 160.
    await pressAt(WAVE_HEIGHT * 1.5);
    await waitFor(() => expect(selectedTrackId).toBe('two'));
    expect(selectedRowIds()).toEqual(['two']);

    await pressAt(WAVE_HEIGHT * 2.5);
    await waitFor(() => expect(selectedTrackId).toBe('three'));
    expect(selectedRowIds()).toEqual(['three']);

    await pressAt(WAVE_HEIGHT * 0.5);
    await waitFor(() => expect(selectedTrackId).toBe('one'));
  });

  it('counts the clip header in each row', async () => {
    await mount([makeTrack('one', 'both'), makeTrack('two')], true);

    // With 22 px headers the rows are 102 px: 'two' starts at 102.
    await pressAt(101);
    await waitFor(() => expect(selectedTrackId).toBe('one'));
    await pressAt(103);
    await waitFor(() => expect(selectedTrackId).toBe('two'));
  });

  it('below the last row: the selected track does not change', async () => {
    await mount([makeTrack('one'), makeTrack('two')]);

    await pressAt(WAVE_HEIGHT * 1.5);
    await waitFor(() => expect(selectedTrackId).toBe('two'));
    await pressAt(WAVE_HEIGHT * 5);
    expect(selectedTrackId).toBe('two');
    expect(selectedRowIds()).toEqual(['two']);
  });
});
