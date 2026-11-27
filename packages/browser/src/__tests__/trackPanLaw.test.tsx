// @vitest-environment jsdom
//
// #684: a track's pan law is a mixer value of the arrangement. The provider
// publishes it in `trackStates` and in `useTrack()`, and `setTrackPanLaw` /
// `setPanLaw` change it as an undo step. What decides the law (the first
// decoded audio) is the arrangement's rule, tested in the engine package.
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

function makeTrack(id: string, extra: Partial<ArrangementTrack> = {}): ArrangementTrack {
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
    ...extra,
  };
}

let probe: {
  isReady: boolean;
  trackStates: TrackState[];
  controls: EditorControlsContextValue;
};
const Probe: React.FC = () => {
  const { isReady } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  probe = { isReady, trackStates, controls: useEditorControls() };
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

describe('the pan law in trackStates', () => {
  it("is 'auto' for a track without decoded audio, and the track's own law when it carries one", async () => {
    await mount([makeTrack('a'), makeTrack('b', { panLaw: 'stereo' })]);
    expect(probe.trackStates.map((s) => s.panLaw)).toEqual(['auto', 'stereo']);
  });

  it('setTrackPanLaw changes it for that track only, and Undo takes it back', async () => {
    await mount([makeTrack('a'), makeTrack('b')]);
    const [a, b] = probe.trackStates;

    act(() => probe.controls.setTrackPanLaw('b', 'stereo'));

    expect(probe.trackStates.map((s) => s.panLaw)).toEqual(['auto', 'stereo']);
    // The other track's state object is the one from before.
    expect(probe.trackStates[0]).toBe(a);
    expect(probe.trackStates[1]).not.toBe(b);

    act(() => probe.controls.undo());
    expect(probe.trackStates.map((s) => s.panLaw)).toEqual(['auto', 'auto']);
  });

  it('passes the undo options on to the arrangement', async () => {
    const { arrangement } = await mount([makeTrack('a')]);
    const spy = vi.spyOn(arrangement, 'setTrackPanLaw');
    act(() => probe.controls.setTrackPanLaw('a', 'mono', { gesture: 'g' }));
    expect(spy).toHaveBeenCalledWith('a', 'mono', { gesture: 'g' });
  });

  it('a call with anything but a string id is ignored, with the one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mount([makeTrack('a')]);

    act(() => probe.controls.setTrackPanLaw(0 as unknown as string, 'stereo'));

    expect(probe.trackStates[0].panLaw).toBe('auto');
    expect(warn.mock.calls.some(([message]) => String(message).includes('setTrackPanLaw()'))).toBe(
      true
    );
  });
});

describe('the pan law in useTrack()', () => {
  it('has the law and a setter bound to its track', async () => {
    await mount([makeTrack('a'), makeTrack('b')]);
    expect(seen.get('a')?.panLaw).toBe('auto');

    act(() => seen.get('b')!.setPanLaw('mono'));

    expect(seen.get('b')?.panLaw).toBe('mono');
    expect(seen.get('a')?.panLaw).toBe('auto');
    expect(probe.trackStates.map((s) => s.panLaw)).toEqual(['auto', 'mono']);
  });

  it('the setter keeps its identity across a change of the law', async () => {
    await mount([makeTrack('a')]);
    const before = seen.get('a')!.setPanLaw;
    act(() => before('stereo'));
    expect(seen.get('a')!.setPanLaw).toBe(before);
  });
});
