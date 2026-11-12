// @vitest-environment jsdom
//
// #740: `PlaylistAnnotationList` renders at every annotation boundary during
// playback. What it hands to the list must keep its identity across that
// render, or every memoized row of the list renders again: the options object
// in particular is a dependency of a handler each row holds.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistTimeline,
} from '../WaveformPlaylistContext';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationTextIntegrationProps,
} from '../AnnotationIntegrationContext';
import { PlaylistAnnotationList } from '../components/PlaylistAnnotationList';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

const TRACKS: ClipTrack[] = [
  {
    id: 't1',
    name: 't1',
    clips: [
      {
        id: 'c1',
        startSample: 0,
        durationSamples: SAMPLE_RATE * 4,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack,
];

const ANNOTATION_LIST = {
  annotations: [
    { id: 'n1', start: 0, end: 1, lines: ['one'] },
    { id: 'n2', start: 1, end: 2, lines: ['two'] },
  ],
};

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

let listProps: AnnotationTextIntegrationProps[] = [];

const FakeAnnotationText: React.FC<AnnotationTextIntegrationProps> = (props) => {
  listProps.push(props);
  return null;
};

const INTEGRATION = { AnnotationText: FakeAnnotationText } as unknown as AnnotationIntegration;

let probe: {
  controls: ReturnType<typeof usePlaylistControls>;
  data: ReturnType<typeof usePlaylistTimeline>;
};

const ProbeChild: React.FC = () => {
  probe = { controls: usePlaylistControls(), data: usePlaylistTimeline() };
  return null;
};

async function mount() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  listProps = [];
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  render(
    <AnnotationIntegrationContext.Provider value={INTEGRATION}>
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        annotationList={ANNOTATION_LIST}
      >
        <ProbeChild />
        <PlaylistAnnotationList />
      </WaveformPlaylistProvider>
    </AnnotationIntegrationContext.Provider>
  );
  await waitFor(() => expect(probe.data.isReady).toBe(true));
  await act(async () => {});
}

const last = () => listProps[listProps.length - 1];

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('PlaylistAnnotationList (#740)', () => {
  it('an active-annotation change reaches the list and changes nothing else it is given', async () => {
    await mount();
    const before = last();

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    const after = last();
    expect(after).not.toBe(before);
    expect(after.activeAnnotationId).toBe('n2');
    // The union of keys: a prop that was dropped counts as changed too.
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)])
    ) as (keyof AnnotationTextIntegrationProps)[];
    const changed = keys.filter((key) => after[key] !== before[key]);
    expect(changed).toEqual(['activeAnnotationId']);
  });

  it('the options follow link endpoints and continuous play', async () => {
    await mount();
    expect(last().annotationListConfig).toEqual({ linkEndpoints: false, continuousPlay: false });
    const before = last().annotationListConfig;

    await act(async () => {
      probe.controls.setLinkEndpoints(true);
    });
    expect(last().annotationListConfig).toEqual({ linkEndpoints: true, continuousPlay: false });
    expect(last().annotationListConfig).not.toBe(before);

    await act(async () => {
      probe.controls.setContinuousPlay(true);
    });
    expect(last().annotationListConfig).toEqual({ linkEndpoints: true, continuousPlay: true });
  });
});
