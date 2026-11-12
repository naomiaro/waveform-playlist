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
import { usePlaybackShortcuts } from '../hooks/usePlaybackShortcuts';
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
const RENAMED_TRACK = { ...TRACK, name: 'Renamed' };

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
const installTimerFrames = () => {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
};

const webAudio = (
  children: React.ReactNode,
  adapter = createFakeAdapter(),
  props: { indefinitePlayback?: boolean } = {}
) => (
  <WaveformPlaylistProvider
    tracks={WEB_AUDIO_TRACKS}
    sampleRate={48000}
    samplesPerPixel={1024}
    createAdapter={() => adapter}
    {...props}
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
    installTimerFrames();
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
    installTimerFrames();
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
    installTimerFrames();
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
    installTimerFrames();
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
    // Each restart begins at the button's position, not just "again".
    const lastStart = () => vi.mocked(adapter.play).mock.lastCall?.[0];
    expect(lastStart()).toBe(1);
    await act(async () => {
      fireEvent.click(button('Fast Forward'));
    });
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(3));
    expect(lastStart()).toBe(4);
    await act(async () => {
      fireEvent.click(button('Rewind'));
    });
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(4));
    expect(lastStart()).toBe(0);
  });
});

// Found by the review of the first version of this change; each behaviour was
// chosen by the maintainer (2026-11-12).
describe('review fixes', () => {
  const MOVED = [
    'playbackStartTimeRef',
    'audioStartPositionRef',
    'getPlaybackTime',
    'getAudioContextTime',
    'getLookAhead',
    'getOutputLatency',
    'playoutRef',
    'isDraggingRef',
  ] as const;

  it('usePlaybackShortcuts throws under MediaElementPlaylistProvider, naming itself', () => {
    const message = thrownBy(() => usePlaybackShortcuts(), mediaElement);
    expect(message).toMatch(/^usePlaybackShortcuts needs WaveformPlaylistProvider/);
  });

  it('usePlaybackShortcuts outside any provider, and in each nesting', () => {
    expect(
      thrownBy(
        () => usePlaybackShortcuts(),
        (child) => <>{child}</>
      )
    ).toBe('usePlaybackShortcuts must be used within WaveformPlaylistProvider');
    cleanup();
    // The nearest provider decides.
    expect(
      thrownBy(
        () => usePlaybackShortcuts(),
        (child) => webAudio(mediaElement(child))
      )
    ).toMatch(/^usePlaybackShortcuts needs WaveformPlaylistProvider/);
    cleanup();
    expect(
      thrownBy(
        () => usePlaybackShortcuts(),
        (child) => mediaElement(webAudio(child))
      )
    ).toBeNull();
  });

  it('the Fast Forward button is enabled under MediaElementPlaylistProvider', async () => {
    await mountMediaElement(<FastForwardButton />);
    expect(
      (screen.getByRole('button', { name: 'Fast Forward' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('the moved-field message for playoutRef also says where the MediaElement player is', async () => {
    const readers = makeReaders({ refs: usePlaybackRefs });
    render(mediaElement(readers.children));
    const refs = readers.values.refs as unknown as Record<string, unknown>;
    expect(() => refs.playoutRef).toThrow(/useMediaElementTrack\(\)\.playoutRef/);
  });

  it('usePlaybackShortcuts still works under WaveformPlaylistProvider', () => {
    expect(
      thrownBy(
        () => usePlaybackShortcuts(),
        (child) => webAudio(child)
      )
    ).toBeNull();
  });

  it.each(MOVED)(
    'reading %s from usePlaybackRefs() throws and names useEngineRefs, under either provider',
    async (field) => {
      installTimerFrames();
      for (const wrap of [mediaElement, (child: React.ReactNode) => webAudio(child)]) {
        const readers = makeReaders({ refs: usePlaybackRefs });
        render(wrap(readers.children));
        const refs = readers.values.refs as unknown as Record<string, unknown>;
        expect(() => refs[field]).toThrow(
          `${field} is no longer on usePlaybackRefs(): read it from useEngineRefs()`
        );
        // Reading is what throws: asking whether the name exists does not.
        expect(field in refs).toBe(true);
        // Not a field of the value: spreading or listing it does not trip the guard.
        expect(Object.keys(refs).sort()).toEqual(SHARED_FIELDS.refs);
        expect(() => ({ ...refs })).not.toThrow();
        cleanup();
      }
    }
  );

  describe('seekTo past the end of the audio under WaveformPlaylistProvider (4 s of audio)', () => {
    async function mountWebAudio(props: { indefinitePlayback?: boolean } = {}) {
      installTimerFrames();
      const readers = makeReaders({
        controls: usePlaybackControls,
        editor: useEditorControls,
        currentTime: useCurrentTime,
        timeline: usePlaylistTimeline,
      });
      render(
        webAudio(
          <>
            <SkipBackwardButton skipAmount={5} />
            <SkipForwardButton skipAmount={5} />
            <FastForwardButton />
            {readers.children}
          </>,
          createFakeAdapter(),
          props
        )
      );
      await waitFor(() => expect(readers.values.timeline.isReady).toBe(true));
      return readers;
    }
    const click = (name: string) =>
      act(() => fireEvent.click(screen.getByRole('button', { name })));

    it('is clamped to the end by default; Skip Forward stops there and Fast Forward goes there', async () => {
      const readers = await mountWebAudio();
      act(() => readers.values.controls.seekTo(30));
      expect(readers.values.currentTime.currentTime).toBe(4);
      act(() => readers.values.controls.seekTo(1));
      click('Skip Forward');
      expect(readers.values.currentTime.currentTime).toBe(4);
      const fastForward = screen.getByRole('button', { name: 'Fast Forward' }) as HTMLButtonElement;
      expect(fastForward.disabled).toBe(false);
      act(() => readers.values.controls.seekTo(1));
      click('Fast Forward');
      expect(readers.values.currentTime.currentTime).toBe(4);
    });

    it('is honoured with indefinitePlayback, so Skip Backward from 30 s lands at 25 s', async () => {
      const readers = await mountWebAudio({ indefinitePlayback: true });
      act(() => readers.values.controls.seekTo(30));
      expect(readers.values.currentTime.currentTime).toBe(30);
      click('Skip Backward');
      expect(readers.values.currentTime.currentTime).toBe(25);
      // There is no finite end: Skip Forward keeps going.
      click('Skip Forward');
      click('Skip Forward');
      expect(readers.values.currentTime.currentTime).toBe(35);
      // ...and Fast Forward has nowhere to go: the button is disabled.
      expect(
        (screen.getByRole('button', { name: 'Fast Forward' }) as HTMLButtonElement).disabled
      ).toBe(true);
      // From code, an infinite time still means the end of the audio.
      act(() => readers.values.controls.seekTo(Infinity));
      expect(readers.values.currentTime.currentTime).toBe(4);
      // Never before the start.
      act(() => readers.values.controls.seekTo(-3));
      expect(readers.values.currentTime.currentTime).toBe(0);
    });

    it('is honoured during a recording session, and clamped again after it', async () => {
      const readers = await mountWebAudio();
      act(() => readers.values.editor.setRecordingActive(true));
      act(() => readers.values.controls.seekTo(30));
      expect(readers.values.currentTime.currentTime).toBe(30);
      click('Skip Backward');
      expect(readers.values.currentTime.currentTime).toBe(25);
      act(() => readers.values.editor.setRecordingActive(false));
      act(() => readers.values.controls.seekTo(30));
      expect(readers.values.currentTime.currentTime).toBe(4);
    });
  });

  describe('setSelection under MediaElementPlaylistProvider (8 s of audio)', () => {
    it('orders a reversed pair, so the highlight and Play agree', async () => {
      const readers = makeReaders({
        controls: usePlaybackControls,
        selection: useSelection,
        currentTime: useCurrentTime,
      });
      const fake = await mountMediaElement(
        <>
          <PlayButton />
          {readers.children}
        </>
      );
      act(() => readers.values.controls.setSelection(5, 2.5));
      expect(readers.values.selection).toEqual({ selectionStart: 2.5, selectionEnd: 5 });
      expect(readers.values.currentTime.currentTime).toBe(2.5);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      });
      expect(fake.play).toHaveBeenLastCalledWith(undefined, 2.5);
      fake.time = 5.01;
      await runFrame();
      // It was a range: it ended by itself, cursor back at its start.
      expect(readers.values.currentTime.currentTime).toBe(2.5);
    });

    it('clamps both times to the audio', async () => {
      const readers = makeReaders({ controls: usePlaybackControls, selection: useSelection });
      await mountMediaElement(readers.children);
      act(() => readers.values.controls.setSelection(-2, 30));
      expect(readers.values.selection).toEqual({ selectionStart: 0, selectionEnd: SECONDS });
      act(() => readers.values.controls.setSelection(20, 30));
      expect(readers.values.selection).toEqual({
        selectionStart: SECONDS,
        selectionEnd: SECONDS,
      });
    });
  });

  // "The latest instruction wins" (maintainer, 2026-11-12): a changed prop is
  // an instruction too, for the audio and for what the select shows.
  it('a changed playbackRate prop becomes the speed, over an earlier choice of the user', async () => {
    const fakes: FakePlayout[] = [];
    const createPlayout = () => {
      const fake = createFakePlayout();
      fakes.push(fake);
      return fake as unknown as MediaElementPlayout;
    };
    const readers = makeReaders({ rate: usePlaybackRate });
    const ui = (playbackRate: number, name = 'Test') => (
      <MediaElementPlaylistProvider
        track={name === 'Test' ? TRACK : RENAMED_TRACK}
        playbackRate={playbackRate}
        createPlayout={createPlayout}
      >
        {readers.children}
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(1.25));
    await waitFor(() => expect(fakes[0]?.addTrack).toHaveBeenCalled());
    // Also the first player: the prop reaches a custom playout.
    expect(fakes[0].rate).toBe(1.25);
    act(() => readers.values.rate.setPlaybackRate(1.5));

    view.rerender(ui(2));
    await waitFor(() => expect(fakes[1]?.addTrack).toHaveBeenCalled());
    expect(readers.values.rate.playbackRate).toBe(2);
    // A custom factory is not given the speed: the provider tells each new
    // player. The prop's speed, not the 1.5 chosen before the prop changed.
    expect(fakes[1].rate).toBe(2);
    expect(fakes[1].setPlaybackRate).not.toHaveBeenCalledWith(1.5);

    // The user chooses again: that wins, also on the next player.
    act(() => readers.values.rate.setPlaybackRate(0.75));
    view.rerender(ui(2, 'Renamed'));
    await waitFor(() => expect(fakes[2]?.addTrack).toHaveBeenCalled());
    expect(readers.values.rate.playbackRate).toBe(0.75);
    expect(fakes[2].rate).toBe(0.75);
  });

  it('a playbackRate that is not a number does not loop the provider', async () => {
    const readers = makeReaders({ rate: usePlaybackRate });
    render(
      <MediaElementPlaylistProvider
        track={TRACK}
        playbackRate={NaN}
        createPlayout={() => createFakePlayout() as unknown as MediaElementPlayout}
      >
        {readers.children}
      </MediaElementPlaylistProvider>
    );
    expect(readers.values.rate.playbackRate).toBeNaN();
    expect(readers.renders.rate).toBeLessThan(5);
  });

  it("a child's effect that sets the speed in the commit of a prop change wins, for select and player", async () => {
    const fakes: FakePlayout[] = [];
    const createPlayout = () => {
      const fake = createFakePlayout();
      fakes.push(fake);
      return fake as unknown as MediaElementPlayout;
    };
    const readers = makeReaders({ rate: usePlaybackRate });
    // Sets 2 whenever the prop it is shown changes: a child restoring a saved speed.
    const Restore: React.FC<{ prop: number }> = ({ prop }) => {
      const { setPlaybackRate } = usePlaybackRate();
      const first = React.useRef(true);
      React.useEffect(() => {
        if (first.current) {
          first.current = false;
          return;
        }
        setPlaybackRate(2);
      }, [prop, setPlaybackRate]);
      return null;
    };
    const ui = (playbackRate: number) => (
      <MediaElementPlaylistProvider
        track={TRACK}
        playbackRate={playbackRate}
        createPlayout={createPlayout}
      >
        <Restore prop={playbackRate} />
        {readers.children}
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(1));
    await waitFor(() => expect(fakes[0]?.addTrack).toHaveBeenCalled());
    view.rerender(ui(1.5));
    await waitFor(() => expect(fakes[1]?.addTrack).toHaveBeenCalled());
    expect(readers.values.rate.playbackRate).toBe(2);
    expect(fakes[1].rate).toBe(2);
  });

  it('a replaced player is created at the speed the user chose, not at the prop', async () => {
    const fakes: FakePlayout[] = [];
    // The provider passes the rate to the factory's options only for the
    // bundled engine; a custom playout is told through setPlaybackRate.
    const createPlayout = () => {
      const fake = createFakePlayout();
      fakes.push(fake);
      return fake as unknown as MediaElementPlayout;
    };
    const readers = makeReaders({ rate: usePlaybackRate });
    const ui = (track: typeof TRACK) => (
      <MediaElementPlaylistProvider track={track} createPlayout={createPlayout}>
        {readers.children}
      </MediaElementPlaylistProvider>
    );
    const view = render(ui(TRACK));
    await waitFor(() => expect(fakes).toHaveLength(1));
    await waitFor(() => expect(fakes[0].addTrack).toHaveBeenCalled());
    act(() => readers.values.rate.setPlaybackRate(1.5));
    expect(fakes[0].rate).toBe(1.5);

    view.rerender(ui({ ...TRACK, name: 'Renamed' }));
    await waitFor(() => expect(fakes).toHaveLength(2));
    await waitFor(() => expect(fakes[1].addTrack).toHaveBeenCalled());
    expect(readers.values.rate.playbackRate).toBe(1.5);
    expect(fakes[1].rate).toBe(1.5);
  });
});
