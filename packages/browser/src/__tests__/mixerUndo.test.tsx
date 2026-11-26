// @vitest-environment jsdom
//
// #843: a mixer change is an undo step of the arrangement. The provider's
// `trackStates` is derived from the arrangement's mix, so an undo moves it
// back with no code of the provider's own; the setters of
// `useEditorControls()` and `useTrack()` pass `MixerChangeOptions` on, so a
// gesture (many calls, one id) is one step. The arrangement's own rules are
// tested in the engine package.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { renderWithArrangement, type ArrangementRender } from './helpers/arrangementProvider';
import {
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  useTrack,
  usePlaylistMixer,
  usePlaylistTimeline,
  useEditorControls,
  useUndoRedo,
  type EditorControlsContextValue,
  type TrackContextValue,
  type TrackState,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const RATE = 48000;

function makeTrack(id: string): ArrangementTrack {
  const clip: AudioClip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: RATE,
    offsetSamples: 0,
    sampleRate: RATE,
    sourceDurationSamples: RATE,
    gain: 1,
  };
  return {
    id,
    kind: 'audio',
    name: 'Name ' + id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  };
}

let probe: {
  isReady: boolean;
  trackStates: TrackState[];
  canUndo: boolean;
  canRedo: boolean;
  controls: EditorControlsContextValue;
};
const Probe: React.FC = () => {
  const { isReady } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { canUndo, canRedo } = useUndoRedo();
  probe = { isReady, trackStates, canUndo, canRedo, controls: useEditorControls() };
  return null;
};

const seen = new Map<string, TrackContextValue>();
const Spy: React.FC = () => {
  const track = useTrack();
  seen.set(track.id, track);
  return null;
};

async function mount(tracks: ArrangementTrack[]): Promise<ArrangementRender> {
  const view = renderWithArrangement(tracks, {
    children: (
      <>
        <Probe />
        <WaveformRoot>
          <WaveformTrackControls>
            <Spy />
          </WaveformTrackControls>
          <WaveformTracks />
        </WaveformRoot>
      </>
    ),
  });
  await waitFor(() => expect(probe.isReady).toBe(true));
  return view;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  seen.clear();
});

describe('mixer changes are undo steps (#843)', () => {
  it('Undo after a volume change moves trackStates back', async () => {
    await mount([makeTrack('a'), makeTrack('b')]);
    expect(probe.canUndo).toBe(false);

    act(() => probe.controls.setTrackVolume('b', 0.25));
    expect(probe.trackStates.map((s) => s.volume)).toEqual([1, 0.25]);
    expect(probe.canUndo).toBe(true);

    act(() => probe.controls.undo());
    expect(probe.trackStates.map((s) => s.volume)).toEqual([1, 1]);
    expect(probe.canUndo).toBe(false);
    expect(probe.canRedo).toBe(true);

    act(() => probe.controls.redo());
    expect(probe.trackStates.map((s) => s.volume)).toEqual([1, 0.25]);
  });

  it('a gesture through useTrack().setVolume is one step', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')]);

    act(() => seen.get('a')!.setVolume(0.9, { gesture: 'fader-a' }));
    act(() => seen.get('a')!.setVolume(0.6, { gesture: 'fader-a' }));
    act(() => seen.get('a')!.setVolume(0.3, { gesture: 'fader-a' }));
    expect(probe.trackStates[0].volume).toBe(0.3);
    expect(seen.get('a')!.volume).toBe(0.3);

    act(() => probe.controls.undo());
    // One undo takes back the whole gesture, and nothing is left to undo.
    expect(probe.trackStates[0].volume).toBe(1);
    expect(seen.get('a')!.volume).toBe(1);
    expect(probe.canUndo).toBe(false);
    expect(view.arrangement.canUndo).toBe(false);

    // Without a gesture id, each call is a step of its own.
    act(() => seen.get('a')!.setVolume(0.9));
    act(() => seen.get('a')!.setVolume(0.6));
    act(() => probe.controls.undo());
    expect(probe.trackStates[0].volume).toBe(0.9);
  });

  it('a value given with { undoable: false } through useTrack() is no undo step', async () => {
    await mount([makeTrack('a')]);
    act(() => seen.get('a')!.setPan(-0.5, { undoable: false }));
    act(() => seen.get('a')!.setMuted(true, { undoable: false }));
    act(() => seen.get('a')!.setSoloed(true, { undoable: false }));
    expect(probe.trackStates[0]).toMatchObject({ pan: -0.5, muted: true, soloed: true });
    expect(probe.canUndo).toBe(false);
  });
});
