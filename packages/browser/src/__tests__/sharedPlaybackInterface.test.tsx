// @vitest-environment jsdom
//
// #688, part 2. Both providers render the same context objects for the part
// they share, so one hook and one control serve both. What only one provider
// has throws under the other, also when the other is nested inside it.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { AnnotationData, AudioClip, ClipTrack } from '@waveform-playlist/core';
import * as publicApi from '../index';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  useIsPlaying,
  useCurrentTime,
  useSelection,
  useActiveAnnotation,
  useAnnotations,
  usePlaybackControls,
  usePlaybackRefs,
  usePlaylistView,
  usePlaylistSettings,
  usePlaylistZoom,
  useEditorControls,
  useEngineRefs,
  useAnnotationEditing,
  useLoop,
  useSelectedTrackId,
  useUndoRedo,
  usePlaylistTimeline,
  usePlaylistMixer,
  useTrackReorderPreview,
  usePlaybackRate,
  useMediaElementTrack,
  useLoopOptional,
} from '../contexts/playlistContexts';
import {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  LoopButton,
} from '../components/PlaybackControls';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
import {
  AudioPosition,
  AutomaticScrollCheckbox,
  PlaybackRateSelect,
  SelectionTimeInputs,
  TimeFormatSelect,
} from '../components/ContextualControls';

const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SECONDS = 8;
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;

const waveform = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: SAMPLE_RATE,
  samples_per_pixel: SOURCE_SCALE,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});
const TRACK = { source: 'test.mp3', waveformData: waveform, name: 'Test' };

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a1', start: 0, end: 2, lines: ['one'] },
  { id: 'a2', start: 2, end: 4, lines: ['two'] },
];
const ANNOTATION_LIST = { annotations: ANNOTATIONS };

type Listener = (...args: unknown[]) => void;

function createFakePlayout() {
  const listeners = new Map<string, Set<Listener>>();
  const fake = {
    time: 0,
    rate: 1,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on(event: string, listener: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((listener) => listener(...args));
    },
    play: vi.fn((_when?: number, offset?: number) => {
      fake.time = offset ?? 0;
    }),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn((time: number) => {
      fake.time = time;
    }),
    setPlaybackRate: vi.fn((rate: number) => {
      fake.rate = rate;
    }),
    getCurrentTime: () => fake.time,
    dispose: vi.fn(),
  };
  return fake;
}
type FakePlayout = ReturnType<typeof createFakePlayout>;

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: 4 * 48000,
    offsetSamples: 0,
    sampleRate: 48000,
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
const WEB_AUDIO_TRACKS = [makeTrack('track-1')];

function createFakeAdapter(): PlayoutAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: 48000,
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

const SHARED = {
  isPlaying: useIsPlaying,
  currentTime: useCurrentTime,
  selection: useSelection,
  activeAnnotation: useActiveAnnotation,
  annotations: useAnnotations,
  controls: usePlaybackControls,
  refs: usePlaybackRefs,
  view: usePlaylistView,
  settings: usePlaylistSettings,
  zoom: usePlaylistZoom,
} as const;
const WEB_AUDIO_ONLY = {
  editorControls: useEditorControls,
  engineRefs: useEngineRefs,
  annotationEditing: useAnnotationEditing,
  loop: useLoop,
  selectedTrack: useSelectedTrackId,
  undo: useUndoRedo,
  timeline: usePlaylistTimeline,
  mixer: usePlaylistMixer,
  reorder: useTrackReorderPreview,
} as const;
const MEDIA_ELEMENT_ONLY = {
  rate: usePlaybackRate,
  track: useMediaElementTrack,
} as const;

const SHARED_FIELDS: Record<keyof typeof SHARED, string[]> = {
  isPlaying: ['isPlaying'],
  currentTime: ['currentTime'],
  selection: ['selectionEnd', 'selectionStart'],
  activeAnnotation: ['activeAnnotationId'],
  annotations: ['annotations', 'continuousPlay'],
  controls: [
    'annotationPreview',
    'pause',
    'play',
    'scrollContainerRef',
    'seekTo',
    'setActiveAnnotationId',
    'setAnnotations',
    'setAutomaticScroll',
    'setContinuousPlay',
    'setScrollContainer',
    'setSelection',
    'setTimeFormat',
    'stop',
  ],
  refs: ['currentTimeRef', 'registerFrameCallback', 'unregisterFrameCallback', 'visualTimeRef'],
  view: [
    'barGap',
    'barWidth',
    'controls',
    'fillViewport',
    'indefinitePlayback',
    'mono',
    'progressBarWidth',
    'roundedBars',
    'sampleRate',
    'timeScaleHeight',
    'waveHeight',
  ],
  settings: ['isAutomaticScroll', 'timeFormat'],
  zoom: ['canZoomIn', 'canZoomOut', 'samplesPerPixel'],
};

type AnyHooks = Record<string, () => unknown>;

/** One reader per hook: records the value and counts its renders. */
function makeReaders<H extends AnyHooks>(hooks: H) {
  const names = Object.keys(hooks) as (keyof H & string)[];
  const renders = {} as Record<keyof H, number>;
  const values = {} as { [K in keyof H]: ReturnType<H[K]> };
  const elements = names.map((name) => {
    const Reader: React.FC = () => {
      renders[name] = (renders[name] ?? 0) + 1;
      (values as Record<string, unknown>)[name] = hooks[name]();
      return null;
    };
    Reader.displayName = `Reader(${name})`;
    return <Reader key={name} />;
  });
  const reset = () => {
    for (const name of names) renders[name] = 0;
  };
  const rendered = () => names.filter((name) => renders[name] > 0).sort();
  return { children: <>{elements}</>, renders, values, reset, rendered };
}

/** Renders `hook` and reports what it threw, if anything. */
function thrownBy(hook: () => unknown, wrap: (child: React.ReactNode) => React.ReactElement) {
  let message: string | null = null;
  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError(error: Error) {
      message = error.message;
      return { failed: true };
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  const Caller: React.FC = () => {
    hook();
    return null;
  };
  render(
    wrap(
      <Boundary>
        <Caller />
      </Boundary>
    )
  );
  return message as string | null;
}

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;

const runFrame = () =>
  act(() => {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, cb] of pending) cb(performance.now());
  });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  frames = new Map();
  nextFrameId = 1;
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    frames.delete(id);
  };
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  vi.restoreAllMocks();
});

async function mountMediaElement(children: React.ReactNode) {
  const fake = createFakePlayout();
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  render(
    <MediaElementPlaylistProvider
      track={TRACK}
      samplesPerPixel={882}
      createPlayout={createPlayout}
      annotationList={ANNOTATION_LIST}
    >
      {children}
    </MediaElementPlaylistProvider>
  );
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  await act(async () => {
    fake.emit('loadedmetadata');
  });
  return fake as FakePlayout;
}

/** The WebAudio provider's loading path needs frames that run by themselves. */
const useTimerFrames = () => {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
};

const webAudio = (children: React.ReactNode, adapter = createFakeAdapter()) => (
  <WaveformPlaylistProvider
    tracks={WEB_AUDIO_TRACKS}
    sampleRate={48000}
    samplesPerPixel={1024}
    createAdapter={() => adapter}
  >
    {children}
  </WaveformPlaylistProvider>
);

const mediaElement = (children: React.ReactNode) => (
  <MediaElementPlaylistProvider
    track={TRACK}
    createPlayout={() => createFakePlayout() as unknown as MediaElementPlayout}
  >
    {children}
  </MediaElementPlaylistProvider>
);

describe('the shared hooks under MediaElementPlaylistProvider', () => {
  it('each returns exactly its documented fields', async () => {
    const readers = makeReaders(SHARED);
    await mountMediaElement(readers.children);
    for (const name of Object.keys(SHARED) as (keyof typeof SHARED)[]) {
      expect(Object.keys(readers.values[name] as object).sort(), name).toEqual(SHARED_FIELDS[name]);
    }
  });

  it('the view and zoom values say what a single-track player cannot do', async () => {
    const readers = makeReaders(SHARED);
    await mountMediaElement(readers.children);
    expect(readers.values.view.mono).toBe(false);
    expect(readers.values.view.indefinitePlayback).toBe(false);
    expect(readers.values.view.fillViewport).toBe(false);
    expect(readers.values.view.sampleRate).toBe(SAMPLE_RATE);
    expect(readers.values.zoom).toEqual({
      samplesPerPixel: 882,
      canZoomIn: false,
      canZoomOut: false,
    });
    expect(readers.values.settings.timeFormat).toBe('hh:mm:ss.uuu');
    // A media element reports the audible position: one ref for both.
    expect(readers.values.refs.visualTimeRef).toBe(readers.values.refs.currentTimeRef);
  });

  it('the MediaElement-only hooks return exactly their documented fields', async () => {
    const readers = makeReaders(MEDIA_ELEMENT_ONLY);
    await mountMediaElement(readers.children);
    expect(Object.keys(readers.values.rate).sort()).toEqual(['playbackRate', 'setPlaybackRate']);
    expect(Object.keys(readers.values.track).sort()).toEqual([
      'duration',
      'fadeIn',
      'fadeOut',
      'isReady',
      'peaksDataArray',
      'playoutRef',
    ]);
    expect(readers.values.track.duration).toBe(SECONDS);
    expect(readers.values.track.isReady).toBe(true);
  });

  describe('each action renders only the readers of what it changes', () => {
    const ALL = { ...SHARED, ...MEDIA_ELEMENT_ONLY };

    it('a selection whose start moves (a leftward drag): selection and cursor', async () => {
      const readers = makeReaders(ALL);
      await mountMediaElement(readers.children);
      act(() => readers.values.controls.setSelection(4, 6));
      readers.reset();
      act(() => readers.values.controls.setSelection(3, 6));
      expect(readers.rendered()).toEqual(['currentTime', 'selection']);
    });

    it('a selection whose end moves (a rightward drag): selection only', async () => {
      const readers = makeReaders(ALL);
      await mountMediaElement(readers.children);
      act(() => readers.values.controls.setSelection(4, 6));
      readers.reset();
      act(() => readers.values.controls.setSelection(4, 7));
      expect(readers.rendered()).toEqual(['selection']);
    });

    it('a seek while stopped: cursor only', async () => {
      const readers = makeReaders(ALL);
      await mountMediaElement(readers.children);
      readers.reset();
      act(() => readers.values.controls.seekTo(3));
      expect(readers.rendered()).toEqual(['currentTime']);
      expect(readers.values.currentTime.currentTime).toBe(3);
    });

    it('play: isPlaying only; pause: isPlaying and the cursor; stop: back to the play start', async () => {
      const readers = makeReaders(ALL);
      const fake = await mountMediaElement(readers.children);
      act(() => readers.values.controls.seekTo(2));
      readers.reset();
      await act(async () => {
        await readers.values.controls.play();
      });
      expect(readers.rendered()).toEqual(['isPlaying']);
      fake.time = 5;
      await runFrame();
      // Playback advancing renders nothing: only the ref moves.
      expect(readers.rendered()).toEqual(['isPlaying']);
      readers.reset();
      act(() => readers.values.controls.pause());
      expect(readers.rendered()).toEqual(['currentTime', 'isPlaying']);
      expect(readers.values.currentTime.currentTime).toBe(5);
      await act(async () => {
        await readers.values.controls.play(1);
      });
      readers.reset();
      act(() => readers.values.controls.stop());
      expect(readers.rendered()).toEqual(['currentTime', 'isPlaying']);
      expect(readers.values.currentTime.currentTime).toBe(1);
    });

    it('the speed: rate only', async () => {
      const readers = makeReaders(ALL);
      const fake = await mountMediaElement(readers.children);
      readers.reset();
      act(() => readers.values.rate.setPlaybackRate(1.5));
      expect(readers.rendered()).toEqual(['rate']);
      expect(readers.values.rate.playbackRate).toBe(1.5);
      expect(fake.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
    });

    it('the time format and automatic scroll: settings only', async () => {
      const readers = makeReaders(ALL);
      await mountMediaElement(readers.children);
      readers.reset();
      act(() => readers.values.controls.setTimeFormat('seconds'));
      expect(readers.rendered()).toEqual(['settings']);
      expect(readers.values.settings.timeFormat).toBe('seconds');
      readers.reset();
      act(() => readers.values.controls.setAutomaticScroll(true));
      expect(readers.rendered()).toEqual(['settings']);
    });

    it('continuous play: annotations only; the active annotation: its own reader', async () => {
      const readers = makeReaders(ALL);
      await mountMediaElement(readers.children);
      readers.reset();
      act(() => readers.values.controls.setContinuousPlay(true));
      expect(readers.rendered()).toEqual(['annotations']);
      readers.reset();
      act(() => readers.values.controls.setActiveAnnotationId('a2'));
      expect(readers.rendered()).toEqual(['activeAnnotation']);
    });

    it('the player becoming ready: the track reader only', async () => {
      const readers = makeReaders(ALL);
      const fake = createFakePlayout();
      const createPlayout = () => fake as unknown as MediaElementPlayout;
      render(
        <MediaElementPlaylistProvider track={TRACK} createPlayout={createPlayout}>
          {readers.children}
        </MediaElementPlaylistProvider>
      );
      await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
      readers.reset();
      await act(async () => {
        fake.emit('loadedmetadata');
      });
      expect(readers.rendered()).toEqual(['track']);
    });

    it('the controls and refs values never change', async () => {
      const readers = makeReaders(ALL);
      const fake = await mountMediaElement(readers.children);
      const { controls, refs } = readers.values;
      const setPlaybackRate = readers.values.rate.setPlaybackRate;
      act(() => readers.values.controls.setSelection(1, 2));
      await act(async () => {
        await readers.values.controls.play();
      });
      fake.time = 1.5;
      await runFrame();
      act(() => readers.values.controls.stop());
      act(() => readers.values.rate.setPlaybackRate(2));
      expect(readers.values.controls).toBe(controls);
      expect(readers.values.refs).toBe(refs);
      expect(readers.values.rate.setPlaybackRate).toBe(setPlaybackRate);
      expect(readers.renders.controls).toBe(1);
      expect(readers.renders.refs).toBe(1);
    });
  });
});

describe('what only one provider has throws under the other', () => {
  for (const [name, hook] of Object.entries(WEB_AUDIO_ONLY)) {
    it(`${hook.name || name} under MediaElementPlaylistProvider`, () => {
      const message = thrownBy(hook, mediaElement);
      expect(message).toContain('WaveformPlaylistProvider');
    });

    it(`${hook.name || name} under a MediaElement provider nested in a WebAudio provider`, () => {
      const message = thrownBy(hook, (child) => webAudio(mediaElement(child)));
      expect(message).toMatch(/needs WaveformPlaylistProvider/);
      expect(message).toMatch(/nearest playlist provider here is MediaElementPlaylistProvider/);
    });
  }

  for (const [name, hook] of Object.entries(MEDIA_ELEMENT_ONLY)) {
    it(`${hook.name || name} under WaveformPlaylistProvider`, () => {
      const message = thrownBy(hook, (child) => webAudio(child));
      expect(message).toContain('MediaElementPlaylistProvider');
    });

    it(`${hook.name || name} under a WebAudio provider nested in a MediaElement provider`, () => {
      const message = thrownBy(hook, (child) => mediaElement(webAudio(child)));
      expect(message).toMatch(/needs MediaElementPlaylistProvider/);
      expect(message).toMatch(/nearest playlist provider here is WaveformPlaylistProvider/);
    });
  }

  it('a shared hook outside any provider names both', () => {
    const message = thrownBy(useIsPlaying, (child) => <>{child}</>);
    expect(message).toBe(
      'useIsPlaying must be used within WaveformPlaylistProvider or MediaElementPlaylistProvider'
    );
  });

  it('the shared hooks read the NEAREST provider when the two are nested', async () => {
    const inner = makeReaders({ view: usePlaylistView, zoom: usePlaylistZoom });
    const outer = makeReaders({ view: usePlaylistView });
    render(
      webAudio(
        <>
          {outer.children}
          {mediaElement(inner.children)}
        </>
      )
    );
    expect(outer.values.view.sampleRate).toBe(48000);
    expect(inner.values.view.sampleRate).toBe(SAMPLE_RATE);
    expect(inner.values.zoom.canZoomIn).toBe(false);
  });
});

describe('the WebAudio provider splits its actions and refs', () => {
  it('usePlaybackControls and useEditorControls share no field, and neither is missing one', async () => {
    useTimerFrames();
    const readers = makeReaders({
      controls: usePlaybackControls,
      editor: useEditorControls,
      refs: usePlaybackRefs,
      engineRefs: useEngineRefs,
      annotations: useAnnotations,
      editing: useAnnotationEditing,
      timeline: usePlaylistTimeline,
    });
    render(webAudio(readers.children));
    await waitFor(() => expect(readers.values.timeline.isReady).toBe(true));
    expect(Object.keys(readers.values.controls).sort()).toEqual(SHARED_FIELDS.controls);
    expect(Object.keys(readers.values.refs).sort()).toEqual(SHARED_FIELDS.refs);
    expect(Object.keys(readers.values.annotations).sort()).toEqual(SHARED_FIELDS.annotations);
    expect(Object.keys(readers.values.editing).sort()).toEqual([
      'annotationsEditable',
      'linkEndpoints',
    ]);
    expect(Object.keys(readers.values.editor).sort()).toEqual([
      'bumpTrackReorderEpoch',
      'clearLoopRegion',
      'redo',
      'reorderTrack',
      'setAnnotationsEditable',
      'setCurrentTime',
      'setLinkEndpoints',
      'setLoopEnabled',
      'setLoopRegion',
      'setLoopRegionFromSelection',
      'setMasterVolume',
      'setRecordingActive',
      'setSelectedTrackId',
      'setTrackDragPreview',
      'setTrackMute',
      'setTrackPan',
      'setTrackSolo',
      'setTrackVolume',
      'undo',
      'zoomIn',
      'zoomOut',
    ]);
    expect(Object.keys(readers.values.engineRefs).sort()).toEqual([
      'audioStartPositionRef',
      'getAudioContextTime',
      'getLookAhead',
      'getOutputLatency',
      'getPlaybackTime',
      'isDraggingRef',
      'playbackStartTimeRef',
      'playoutRef',
    ]);
  });

  it('continuous play renders the annotations reader and not the editing one, and the reverse', async () => {
    useTimerFrames();
    const readers = makeReaders({
      controls: usePlaybackControls,
      editor: useEditorControls,
      annotations: useAnnotations,
      editing: useAnnotationEditing,
      timeline: usePlaylistTimeline,
    });
    render(webAudio(readers.children));
    await waitFor(() => expect(readers.values.timeline.isReady).toBe(true));
    readers.reset();
    act(() => readers.values.controls.setContinuousPlay(true));
    expect(readers.rendered()).toEqual(['annotations']);
    readers.reset();
    act(() => readers.values.editor.setLinkEndpoints(true));
    expect(readers.rendered()).toEqual(['editing']);
  });
});

describe('the package exports', () => {
  it('has the new hooks and control', () => {
    for (const name of [
      'usePlaybackControls',
      'useEditorControls',
      'useEngineRefs',
      'useAnnotations',
      'useAnnotationEditing',
      'usePlaybackRate',
      'useMediaElementTrack',
      'PlaybackRateSelect',
    ]) {
      expect(publicApi, name).toHaveProperty(name);
    }
  });

  it('no longer has the hooks they replace', () => {
    for (const name of [
      'usePlaylistControls',
      'usePlaylistAnnotations',
      'useMediaElementAnimation',
      'useMediaElementState',
      'useMediaElementControls',
      'useMediaElementData',
    ]) {
      expect(publicApi, name).not.toHaveProperty(name);
    }
  });
});

describe('the library controls under MediaElementPlaylistProvider', () => {
  const CONTROLS = (
    <>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <RewindButton />
      <FastForwardButton />
      <SkipBackwardButton skipAmount={2} />
      <SkipForwardButton skipAmount={2} />
      <AudioPosition />
      <TimeFormatSelect />
      <AutomaticScrollCheckbox />
      <SelectionTimeInputs />
      <PlaybackRateSelect />
    </>
  );
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  it('Play starts from the cursor; Pause and Stop are disabled unless playing', async () => {
    const readers = makeReaders({ controls: usePlaybackControls, currentTime: useCurrentTime });
    const fake = await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    expect(button('Play').disabled).toBe(false);
    expect(button('Pause').disabled).toBe(true);
    expect(button('Stop').disabled).toBe(true);

    act(() => readers.values.controls.seekTo(3));
    await act(async () => {
      fireEvent.click(button('Play'));
    });
    expect(fake.play).toHaveBeenLastCalledWith(undefined, 3);
    expect(button('Play').disabled).toBe(true);
    expect(button('Pause').disabled).toBe(false);
    expect(button('Stop').disabled).toBe(false);

    fake.time = 5;
    await runFrame();
    act(() => fireEvent.click(button('Pause')));
    // After a pause the cursor rests where playback was, and Stop is disabled.
    expect(readers.values.currentTime.currentTime).toBe(5);
    expect(button('Stop').disabled).toBe(true);

    await act(async () => {
      fireEvent.click(button('Play'));
    });
    act(() => fireEvent.click(button('Stop')));
    // Stop returns the cursor to where that play started.
    expect(readers.values.currentTime.currentTime).toBe(5);
    expect(button('Play').disabled).toBe(false);
  });

  it('Play plays the highlighted selection and stops at its end, cursor back at its start', async () => {
    const readers = makeReaders({
      controls: usePlaybackControls,
      currentTime: useCurrentTime,
      isPlaying: useIsPlaying,
    });
    const fake = await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    // Not an annotation's range (those are 0-2 and 2-4): only the selection
    // can end this play at 3.5.
    act(() => readers.values.controls.setSelection(2.5, 3.5));
    await act(async () => {
      fireEvent.click(button('Play'));
    });
    expect(fake.play).toHaveBeenLastCalledWith(undefined, 2.5);
    fake.time = 3;
    await runFrame();
    expect(readers.values.isPlaying.isPlaying).toBe(true);
    fake.time = 3.51;
    await runFrame();
    expect(readers.values.isPlaying.isPlaying).toBe(false);
    expect(readers.values.currentTime.currentTime).toBe(2.5);
  });

  it('Rewind, Fast Forward and the skips seek, stopped and playing', async () => {
    const readers = makeReaders({ controls: usePlaybackControls, currentTime: useCurrentTime });
    const fake = await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    const cursor = () => readers.values.currentTime.currentTime;

    act(() => readers.values.controls.seekTo(3));
    act(() => fireEvent.click(button('Skip Forward')));
    expect(cursor()).toBe(5);
    act(() => fireEvent.click(button('Skip Backward')));
    expect(cursor()).toBe(3);
    act(() => fireEvent.click(button('Skip Backward')));
    act(() => fireEvent.click(button('Skip Backward')));
    expect(cursor()).toBe(0);
    act(() => fireEvent.click(button('Fast Forward')));
    expect(cursor()).toBe(SECONDS);
    act(() => fireEvent.click(button('Skip Forward')));
    expect(cursor()).toBe(SECONDS);
    act(() => fireEvent.click(button('Rewind')));
    expect(cursor()).toBe(0);
    expect(fake.play).not.toHaveBeenCalled();

    // During playback each one restarts playback at the new position.
    await act(async () => {
      fireEvent.click(button('Play'));
    });
    fake.time = 3;
    await runFrame();
    act(() => fireEvent.click(button('Skip Forward')));
    expect(fake.play).toHaveBeenLastCalledWith(undefined, 5);
    act(() => fireEvent.click(button('Rewind')));
    expect(fake.play).toHaveBeenLastCalledWith(undefined, 0);
    expect(button('Pause').disabled).toBe(false);
  });

  it('AudioPosition shows the cursor in the chosen format and follows playback', async () => {
    const readers = makeReaders({ controls: usePlaybackControls });
    const fake = await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    const position = () => screen.getByLabelText('Audio position').textContent;
    expect(position()).toBe('00:00:00.000');
    act(() => readers.values.controls.seekTo(3));
    expect(position()).toBe('00:00:03.000');
    fireEvent.change(screen.getByLabelText('Time format selection'), {
      target: { value: 'seconds' },
    });
    expect(position()).toBe('3');
    await act(async () => {
      fireEvent.click(button('Play'));
    });
    fake.time = 4;
    await runFrame();
    expect(position()).toBe('4');
  });

  it('PlaybackRateSelect shows and sets the speed; a speed set from code is listed', async () => {
    const readers = makeReaders({ rate: usePlaybackRate });
    const fake = await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    const select = screen.getByLabelText('Playback speed') as HTMLSelectElement;
    expect(select.value).toBe('1');
    expect([...select.options].map((o) => o.value)).toEqual([
      '0.5',
      '0.75',
      '1',
      '1.25',
      '1.5',
      '2',
    ]);
    fireEvent.change(select, { target: { value: '1.5' } });
    expect(fake.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
    expect(readers.values.rate.playbackRate).toBe(1.5);
    act(() => readers.values.rate.setPlaybackRate(0.9));
    expect(select.value).toBe('0.9');
    expect([...select.options].map((o) => o.value)).toContain('0.9');
  });

  it('PlaybackRateSelect offers the given rates', async () => {
    await mountMediaElement(<PlaybackRateSelect rates={[1, 1.5]} />);
    const select = screen.getByLabelText('Playback speed') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['1', '1.5']);
  });

  it('there is no loop to read: the internal optional reader gives null, not the blocked marker', async () => {
    let loop: unknown = 'unset';
    const Reader: React.FC = () => {
      loop = useLoopOptional();
      return null;
    };
    await mountMediaElement(<Reader />);
    expect(loop).toBeNull();
  });

  it('the automatic-scroll checkbox and the selection inputs read and write the provider', async () => {
    const readers = makeReaders({
      controls: usePlaybackControls,
      settings: usePlaylistSettings,
    });
    await mountMediaElement(
      <>
        {CONTROLS}
        {readers.children}
      </>
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(readers.values.settings.isAutomaticScroll).toBe(true);
    act(() => readers.values.controls.setSelection(1, 2));
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs.map((input) => input.value)).toEqual(['00:00:01.000', '00:00:02.000']);
  });

  it('a WebAudio-only control throws, naming the provider it needs', () => {
    const message = thrownBy(
      () => null,
      () =>
        mediaElement(
          <ErrorCatcher onError={(m) => (caught = m)}>
            <LoopButton />
          </ErrorCatcher>
        )
    );
    expect(message).toBeNull();
    expect(caught).toContain('WaveformPlaylistProvider');
  });
});

let caught: string | null = null;
class ErrorCatcher extends React.Component<
  { children: React.ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

describe('the library transport under WaveformPlaylistProvider', () => {
  it('the 0 shortcut moves the cursor to the start', async () => {
    useTimerFrames();
    const readers = makeReaders({
      controls: usePlaybackControls,
      currentTime: useCurrentTime,
      timeline: usePlaylistTimeline,
    });
    render(
      webAudio(
        <>
          <KeyboardShortcuts playback />
          {readers.children}
        </>
      )
    );
    await waitFor(() => expect(readers.values.timeline.isReady).toBe(true));
    act(() => readers.values.controls.seekTo(2));
    expect(readers.values.currentTime.currentTime).toBe(2);
    act(() => {
      fireEvent.keyDown(document.body, { key: '0' });
    });
    expect(readers.values.currentTime.currentTime).toBe(0);
  });

  it('Rewind and the skips still restart playback at the new position', async () => {
    useTimerFrames();
    const adapter = createFakeAdapter();
    const readers = makeReaders({
      controls: usePlaybackControls,
      currentTime: useCurrentTime,
      timeline: usePlaylistTimeline,
    });
    render(
      webAudio(
        <>
          <PlayButton />
          <RewindButton />
          <FastForwardButton />
          <SkipForwardButton skipAmount={1} />
          {readers.children}
        </>,
        adapter
      )
    );
    await waitFor(() => expect(readers.values.timeline.isReady).toBe(true));
    const button = (name: string) => screen.getByRole('button', { name });
    act(() => fireEvent.click(button('Skip Forward')));
    expect(readers.values.currentTime.currentTime).toBe(1);
    act(() => fireEvent.click(button('Fast Forward')));
    expect(readers.values.currentTime.currentTime).toBe(4);
    act(() => fireEvent.click(button('Rewind')));
    expect(readers.values.currentTime.currentTime).toBe(0);
    expect(adapter.play).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(button('Play'));
    });
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.click(button('Skip Forward'));
    });
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(2));
  });
});
