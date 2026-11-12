// @vitest-environment jsdom
//
// #768. The provider publishes its state through several contexts, grouped by
// how often their fields change, so that a component that reads `sampleRate`
// is not re-rendered by a volume slider, and one that reads `selectedTrackId`
// is not re-rendered by a loop change. Each test performs one action and
// states exactly which hooks' readers render for it.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import * as contextModule from '../WaveformPlaylistContext';
import * as publicApi from '../index';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { usePlaylistControls, usePlaylistView, usePlaylistSettings, usePlaylistZoom, usePlaylistTimeline, usePlaylistMixer, useTrackReorderPreview, usePlaylistAnnotations, useLoop, useSelectedTrackId, useUndoRedo, useIsPlaying, usePlaybackRefs, useSelection, useCurrentTime, useActiveAnnotation } from '../contexts/playlistContexts';
import type { AnnotationData, ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string, seconds = 1): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: seconds * SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
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
    play: vi.fn(),
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

// One reader per hook. Each records the value it was given and how many times
// it rendered.
const HOOKS = {
  view: usePlaylistView,
  settings: usePlaylistSettings,
  zoom: usePlaylistZoom,
  timeline: usePlaylistTimeline,
  mixer: usePlaylistMixer,
  reorder: useTrackReorderPreview,
  annotations: usePlaylistAnnotations,
  loop: useLoop,
  selectedTrack: useSelectedTrackId,
  undo: useUndoRedo,
  isPlaying: useIsPlaying,
  refs: usePlaybackRefs,
  selection: useSelection,
  currentTime: useCurrentTime,
  activeAnnotation: useActiveAnnotation,
  controls: usePlaylistControls,
} as const;

type HookName = keyof typeof HOOKS;
const HOOK_NAMES = Object.keys(HOOKS) as HookName[];

const renders = {} as Record<HookName, number>;
const values = {} as { [K in HookName]: ReturnType<(typeof HOOKS)[K]> };

const readers = HOOK_NAMES.map((name) => {
  const Reader: React.FC = () => {
    renders[name] = (renders[name] ?? 0) + 1;
    (values as Record<HookName, unknown>)[name] = HOOKS[name]();
    return null;
  };
  Reader.displayName = `Reader(${name})`;
  return <Reader key={name} />;
});

// One set of elements for every render of the wrapper: a reader then renders
// only when the context it reads changes.
const CHILDREN = <>{readers}</>;

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a1', start: 0, end: 0.4, lines: ['one'] },
  { id: 'a2', start: 0.5, end: 0.9, lines: ['two'] },
];

const TRACKS = [makeTrack('track-1'), makeTrack('track-2')];
const ZOOM_LEVELS = [500, 1000, 2000];

async function mount() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  for (const name of HOOK_NAMES) renders[name] = 0;
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  let tracks = TRACKS;
  let annotationList = { annotations: ANNOTATIONS };
  const Wrapper: React.FC = () => (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={1000}
      zoomLevels={ZOOM_LEVELS}
      createAdapter={createAdapter}
      annotationList={annotationList}
    >
      {CHILDREN}
    </WaveformPlaylistProvider>
  );
  const utils = render(<Wrapper />);
  await waitFor(() => expect(values.timeline.isReady).toBe(true));
  return {
    setTracks: (next: ClipTrack[]) => {
      tracks = next;
      utils.rerender(<Wrapper />);
    },
    // Annotations are a controlled prop: an edit arrives as a new array.
    setAnnotations: (next: AnnotationData[]) => {
      annotationList = { annotations: next };
      utils.rerender(<Wrapper />);
    },
  };
}

/** Runs `action` and returns the names of the hooks whose reader rendered. */
async function rendered(action: () => void | Promise<void>): Promise<HookName[]> {
  const before = { ...renders };
  await act(async () => {
    await action();
  });
  return HOOK_NAMES.filter((name) => renders[name] !== before[name]).sort();
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('each hook returns its own group of fields (#768)', () => {
  it('has exactly the documented fields', async () => {
    await mount();
    const keys = (name: HookName) => Object.keys(values[name] as object).sort();

    expect(keys('view')).toEqual(
      [
        'sampleRate',
        'waveHeight',
        'timeScaleHeight',
        'controls',
        'barWidth',
        'barGap',
        'roundedBars',
        'progressBarWidth',
        'mono',
        'indefinitePlayback',
        'fillViewport',
      ].sort()
    );
    expect(keys('settings')).toEqual(['isAutomaticScroll', 'timeFormat']);
    expect(keys('zoom')).toEqual(['canZoomIn', 'canZoomOut', 'samplesPerPixel']);
    expect(keys('timeline')).toEqual(
      ['duration', 'isReady', 'onTracksChange', 'peaksDataArray', 'tracks'].sort()
    );
    expect(keys('mixer')).toEqual(['masterVolume', 'trackStates']);
    expect(keys('reorder')).toEqual(['trackDragPreview', 'trackReorderEpoch']);
    expect(keys('annotations')).toEqual(
      ['annotations', 'annotationsEditable', 'continuousPlay', 'linkEndpoints'].sort()
    );
    expect(keys('loop')).toEqual(['isLoopEnabled', 'loopEnd', 'loopStart']);
    expect(keys('selectedTrack')).toEqual(['selectedTrackId']);
    expect(keys('undo')).toEqual(['canRedo', 'canUndo']);
    expect(keys('isPlaying')).toEqual(['isPlaying']);
    expect(keys('refs')).toEqual(
      [
        'currentTimeRef',
        'visualTimeRef',
        'playbackStartTimeRef',
        'audioStartPositionRef',
        'getPlaybackTime',
        'getAudioContextTime',
        'getLookAhead',
        'getOutputLatency',
        'registerFrameCallback',
        'unregisterFrameCallback',
        'playoutRef',
        'isDraggingRef',
      ].sort()
    );
  });

  it('carries the values the provider was given', async () => {
    await mount();
    expect(values.view.sampleRate).toBe(SAMPLE_RATE);
    expect(values.zoom.samplesPerPixel).toBe(1000);
    expect(values.timeline.tracks).toHaveLength(2);
    expect(values.timeline.duration).toBe(1);
    expect(values.mixer.trackStates).toHaveLength(2);
    expect(values.annotations.annotations).toHaveLength(2);
    expect(values.refs.playoutRef.current).not.toBeNull();
  });
});

describe('an action re-renders only the readers of the group it changes (#768)', () => {
  it('a track volume change: the mixer', async () => {
    await mount();
    expect(await rendered(() => values.controls.setTrackVolume(0, 0.4))).toEqual(['mixer']);
    expect(values.mixer.trackStates[0].volume).toBe(0.4);
  });

  it('a mute, a solo and a pan change: the mixer', async () => {
    await mount();
    expect(await rendered(() => values.controls.setTrackMute(0, true))).toEqual(['mixer']);
    expect(await rendered(() => values.controls.setTrackSolo(1, true))).toEqual(['mixer']);
    expect(await rendered(() => values.controls.setTrackPan(1, -0.5))).toEqual(['mixer']);
  });

  it('a master volume change: the mixer', async () => {
    await mount();
    expect(await rendered(() => values.controls.setMasterVolume(0.5))).toEqual(['mixer']);
    expect(values.mixer.masterVolume).toBe(0.5);
  });

  // The two settings a user toggles are apart from the view value: every clip
  // overlay and the visualization shell read that one for `sampleRate`.
  it('a time-format change: the settings', async () => {
    await mount();
    expect(await rendered(() => values.controls.setTimeFormat('seconds'))).toEqual(['settings']);
    expect(values.settings.timeFormat).toBe('seconds');
  });

  it('an automatic-scroll toggle: the settings', async () => {
    await mount();
    const next = !values.settings.isAutomaticScroll;
    expect(await rendered(() => values.controls.setAutomaticScroll(next))).toEqual(['settings']);
    expect(values.settings.isAutomaticScroll).toBe(next);
  });

  it('a zoom: the zoom value, and the timeline (peaks are per zoom level)', async () => {
    await mount();
    expect(await rendered(() => values.controls.zoomIn())).toEqual(['timeline', 'zoom']);
    expect(values.zoom.samplesPerPixel).toBe(500);
    expect(values.zoom.canZoomIn).toBe(false);
  });

  it('a loop toggle and a loop region change: the loop', async () => {
    await mount();
    expect(await rendered(() => values.controls.setLoopEnabled(true))).toEqual(['loop']);
    expect(await rendered(() => values.controls.setLoopRegion(0.2, 0.6))).toEqual(['loop']);
    expect(values.loop).toEqual({ isLoopEnabled: true, loopStart: 0.2, loopEnd: 0.6 });
  });

  it('selecting a track: the selected track id', async () => {
    await mount();
    expect(await rendered(() => values.controls.setSelectedTrackId('track-2'))).toEqual([
      'selectedTrack',
    ]);
    expect(values.selectedTrack.selectedTrackId).toBe('track-2');
  });

  it('annotation settings and annotation edits: the annotations', async () => {
    const { setAnnotations } = await mount();
    expect(await rendered(() => values.controls.setContinuousPlay(true))).toEqual(['annotations']);
    expect(await rendered(() => values.controls.setLinkEndpoints(true))).toEqual(['annotations']);
    expect(await rendered(() => values.controls.setAnnotationsEditable(true))).toEqual([
      'annotations',
    ]);
    expect(
      await rendered(() =>
        setAnnotations([{ ...ANNOTATIONS[0], lines: ['changed'] }, ANNOTATIONS[1]])
      )
    ).toEqual(['annotations']);
    expect(values.annotations.annotations[0].lines).toEqual(['changed']);
  });

  it('an edit and its undo: the undo state (and nothing that is not about tracks)', async () => {
    await mount();
    expect(values.undo).toEqual({ canUndo: false, canRedo: false });
    const quiet: HookName[] = ['view', 'settings', 'zoom', 'loop', 'selectedTrack', 'annotations'];

    const afterEdit = await rendered(() => {
      values.refs.playoutRef.current!.moveClip('track-1', 'track-1-clip', SAMPLE_RATE / 10);
    });
    expect(afterEdit).toContain('undo');
    expect(values.undo).toEqual({ canUndo: true, canRedo: false });
    for (const name of quiet) expect(afterEdit).not.toContain(name);

    const afterUndo = await rendered(() => values.controls.undo());
    expect(afterUndo).toContain('undo');
    expect(values.undo).toEqual({ canUndo: false, canRedo: true });
    for (const name of quiet) expect(afterUndo).not.toContain(name);
  });

  it('a track-reorder preview: the reorder preview', async () => {
    await mount();
    expect(
      await rendered(() => values.controls.setTrackDragPreview({ trackId: 'track-1', toIndex: 1 }))
    ).toEqual(['reorder']);
    expect(await rendered(() => values.controls.bumpTrackReorderEpoch())).toEqual(['reorder']);
  });

  it('play: isPlaying only; pause: isPlaying and the resting position', async () => {
    await mount();
    expect(await rendered(() => values.controls.play(0))).toEqual(['isPlaying']);
    expect(values.isPlaying.isPlaying).toBe(true);
    const afterPause = await rendered(() => values.controls.pause());
    expect(afterPause).toContain('isPlaying');
    expect(afterPause.filter((n) => n !== 'isPlaying' && n !== 'currentTime')).toEqual([]);
    expect(values.isPlaying.isPlaying).toBe(false);
  });

  it('a seek while stopped: the resting position only', async () => {
    await mount();
    expect(await rendered(() => values.controls.seekTo(0.5))).toEqual(['currentTime']);
  });

  it('a selection: the selection (and the resting position, which follows its start)', async () => {
    await mount();
    expect(await rendered(() => values.controls.setSelection(0.1, 0.5))).toEqual([
      'currentTime',
      'selection',
    ]);
  });

  it('a longer timeline: the timeline, and none of the view, zoom, loop, selection or annotation readers', async () => {
    const { setTracks } = await mount();
    const names = await rendered(() => setTracks([TRACKS[0], TRACKS[1], makeTrack('track-3', 2)]));
    await waitFor(() => expect(values.timeline.duration).toBe(2));
    expect(names).toContain('timeline');
    // The mixer follows too: the new track gets its mixer state.
    expect(names).toContain('mixer');
    for (const quiet of [
      'view',
      'settings',
      'zoom',
      'loop',
      'selectedTrack',
      'annotations',
      'reorder',
      'isPlaying',
      'refs',
      'selection',
      'activeAnnotation',
      'controls',
    ] as HookName[]) {
      expect(names).not.toContain(quiet);
    }
  });
});

describe('the refs value never changes (#768)', () => {
  it('keeps its identity through every kind of change', async () => {
    const { setTracks } = await mount();
    const before = values.refs;
    const rendersBefore = renders.refs;

    await act(async () => {
      values.controls.setTrackVolume(0, 0.4);
      values.controls.setLoopEnabled(true);
      values.controls.setSelectedTrackId('track-2');
      values.controls.setTimeFormat('seconds');
      values.controls.zoomIn();
    });
    await act(async () => {
      await values.controls.play(0);
    });
    await act(async () => {
      values.controls.stop();
    });
    await act(async () => {
      setTracks([TRACKS[0], TRACKS[1], makeTrack('track-3', 2)]);
    });
    await waitFor(() => expect(values.timeline.duration).toBe(2));

    expect(values.refs).toBe(before);
    expect(renders.refs).toBe(rendersBefore);
  });
});

describe('the hooks the groups replace are gone (#768)', () => {
  // A hook kept under its old name with fewer fields would hand `undefined`
  // to plain-JS consumers without any error; a missing export fails at once.
  it.each([
    'usePlaylistData',
    'usePlaylistDataOptional',
    'usePlaylistState',
    'usePlaybackAnimation',
  ])('%s is not exported', (name) => {
    expect(name in contextModule).toBe(false);
    expect(name in publicApi).toBe(false);
  });

  it.each([
    'usePlaylistView',
    'usePlaylistSettings',
    'usePlaylistZoom',
    'usePlaylistTimeline',
    'usePlaylistMixer',
    'useTrackReorderPreview',
    'usePlaylistAnnotations',
    'useLoop',
    'useSelectedTrackId',
    'useUndoRedo',
    'useIsPlaying',
    'usePlaybackRefs',
  ])('%s is exported from the package entry', (name) => {
    expect(typeof (publicApi as Record<string, unknown>)[name]).toBe('function');
  });

  it('the optional readers stay internal to the package', () => {
    expect('usePlaylistViewOptional' in publicApi).toBe(false);
    expect('usePlaylistZoomOptional' in publicApi).toBe(false);
  });

  it.each(HOOK_NAMES)('the %s hook throws outside the provider, naming itself', (name) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Reader: React.FC = () => {
      HOOKS[name]();
      return null;
    };
    expect(() => render(<Reader />)).toThrow(
      `${HOOKS[name].name} must be used within WaveformPlaylistProvider`
    );
  });
});
