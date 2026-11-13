// @vitest-environment jsdom
//
// #686: the annotation UI is two parts that own their options, the same under
// both providers. `WaveformAnnotationBoxes` (a part of either root, with the
// edge drag wired inside), `AnnotationList` (anywhere under either provider),
// and one home for editable / link endpoints / continuous play: provider
// state, read with `useAnnotationOptions()`. Every case below runs under
// `WaveformPlaylistProvider` and under `MediaElementPlaylistProvider`.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

const dragOptions = vi.hoisted(
  () =>
    [] as {
      duration: number;
      sampleRate?: number;
      linkEndpoints: boolean;
      preview?: unknown;
      onAnnotationsChange: unknown;
    }[]
);
const sensorOptions = vi.hoisted(() => [] as ({ touchOptimized?: boolean } | undefined)[]);
// What the sensors hook returned, and what each DragDropProvider was given.
const sensorResults = vi.hoisted(() => [] as unknown[]);
const dragProviderProps = vi.hoisted(() => [] as { sensors?: unknown; modifiers?: unknown[] }[]);

vi.mock('@dnd-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    DragDropProvider: (props: React.ComponentProps<typeof actual.DragDropProvider>) => {
      dragProviderProps.push(props as { sensors?: unknown; modifiers?: unknown[] });
      return createElement(actual.DragDropProvider, props);
    },
  };
});

vi.mock('../hooks/useAnnotationDragHandlers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAnnotationDragHandlers')>();
  return {
    ...actual,
    useAnnotationDragHandlers: (
      options: Parameters<typeof actual.useAnnotationDragHandlers>[0]
    ) => {
      dragOptions.push(options);
      return actual.useAnnotationDragHandlers(options);
    },
  };
});

vi.mock('../hooks/useDragSensors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useDragSensors')>();
  return {
    ...actual,
    useDragSensors: (options?: Parameters<typeof actual.useDragSensors>[0]) => {
      sensorOptions.push(options);
      const sensors = actual.useDragSensors(options);
      sensorResults.push(sensors);
      return sensors;
    },
  };
});

import WaveformData from 'waveform-data';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { ClipTrack, AudioClip, AnnotationData } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import * as browser from '../index';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  usePlaybackControls,
  useAnnotations,
  useActiveAnnotation,
  useAnnotationOptions,
  useIsPlaying,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationBoxIntegrationProps,
  type AnnotationBoxesWrapperIntegrationProps,
  type AnnotationTextIntegrationProps,
} from '../AnnotationIntegrationContext';
import { Waveform } from '../components/Waveform';
import { MediaElementWaveform } from '../components/MediaElementWaveform';
import { WaveformRoot } from '../components/WaveformRoot';
import { MediaElementWaveformRoot } from '../components/MediaElementWaveformRoot';
import { WaveformTracks } from '../components/waveformParts';
import { WaveformAnnotationBoxes } from '../components/WaveformAnnotationBoxes';
import { AnnotationList } from '../components/AnnotationList';
import {
  ContinuousPlayCheckbox,
  EditableCheckbox,
  LinkEndpointsCheckbox,
} from '../components/AnnotationControls';
import { ClipInteractionOptions } from '../contexts/ClipInteractionContext';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
import { resetPartWarnings } from '../components/partWarnings';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Not 48000: that is the default the drag handlers fall back to.
const SAMPLE_RATE = 44100;
const SECONDS = 4;

const TRACKS: ClipTrack[] = [
  {
    id: 't1',
    name: 't1',
    clips: [
      {
        id: 'c1',
        startSample: 0,
        durationSamples: SAMPLE_RATE * SECONDS,
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

const SOURCE_SCALE = 441;
const LENGTH = (SECONDS * SAMPLE_RATE) / SOURCE_SCALE;
const WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: SAMPLE_RATE,
  samples_per_pixel: SOURCE_SCALE,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});
const MEDIA_TRACK = { source: 'test.mp3', waveformData: WAVEFORM_DATA, name: 'Test' };

const ANNOTATIONS: AnnotationData[] = [
  { id: 'n1', start: 0, end: 1, lines: ['one'] },
  { id: 'n2', start: 1, end: 2.5, lines: ['two'] },
  { id: 'n3', start: 2.5, end: 3, lines: ['three'] },
];

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

function createFakePlayout() {
  return {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on(event: string, listener: () => void) {
      if (event === 'loadedmetadata') queueMicrotask(listener);
    },
    off() {},
    play: vi.fn(),
    pause() {},
    stop() {},
    seekTo() {},
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose() {},
  };
}

let boxProps: Record<string, AnnotationBoxIntegrationProps> = {};
let wrapperProps: AnnotationBoxesWrapperIntegrationProps[] = [];
let listProps: AnnotationTextIntegrationProps[] = [];

const FakeBox: React.FC<AnnotationBoxIntegrationProps> = (props) => {
  boxProps[props.annotationId] = props;
  return (
    <button data-box={props.annotationId} onClick={props.onClick}>
      {props.label}
    </button>
  );
};
const FakeWrapper: React.FC<AnnotationBoxesWrapperIntegrationProps> = (props) => {
  wrapperProps.push(props);
  return <div data-box-row>{props.children}</div>;
};
const FakeAnnotationText: React.FC<AnnotationTextIntegrationProps> = (props) => {
  listProps.push(props);
  return <div data-list />;
};
const FakeCheckbox =
  (name: string): React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> =>
  ({ checked, onChange }) => (
    <input
      type="checkbox"
      aria-label={name}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );

const INTEGRATION = {
  AnnotationBox: FakeBox,
  AnnotationBoxesWrapper: FakeWrapper,
  AnnotationText: FakeAnnotationText,
  ContinuousPlayCheckbox: FakeCheckbox('continuous'),
  LinkEndpointsCheckbox: FakeCheckbox('link'),
  EditableCheckbox: FakeCheckbox('editable'),
} as unknown as AnnotationIntegration;

let probe: {
  controls: ReturnType<typeof usePlaybackControls>;
  annotations: ReturnType<typeof useAnnotations>;
  options: ReturnType<typeof useAnnotationOptions>;
  active: ReturnType<typeof useActiveAnnotation>;
  playing: ReturnType<typeof useIsPlaying>;
};

const ProbeChild: React.FC = () => {
  probe = {
    controls: usePlaybackControls(),
    annotations: useAnnotations(),
    options: useAnnotationOptions(),
    active: useActiveAnnotation(),
    playing: useIsPlaying(),
  };
  return null;
};

// The multitrack provider is ready when its engine is built.
let timelineReady = false;
const TimelineReadyProbe: React.FC = () => {
  timelineReady = usePlaylistTimeline().isReady;
  return null;
};

type Kind = 'WaveformPlaylistProvider' | 'MediaElementPlaylistProvider';
type AnnotationListProp = {
  annotations?: AnnotationData[];
  editable?: boolean;
  linkEndpoints?: boolean;
  isContinuousPlay?: boolean;
};

interface MountOptions {
  /** Multitrack provider only. */
  tracks?: ClipTrack[];
  annotationList?: AnnotationListProp;
  integration?: AnnotationIntegration | null;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
}

const DEFAULT_LIST: AnnotationListProp = { annotations: ANNOTATIONS };

async function mount(kind: Kind, children: React.ReactNode, options: MountOptions = {}) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  boxProps = {};
  wrapperProps = [];
  listProps = [];
  dragOptions.length = 0;
  sensorOptions.length = 0;
  sensorResults.length = 0;
  dragProviderProps.length = 0;
  const firstList = options.annotationList ?? DEFAULT_LIST;
  const integration = options.integration === undefined ? INTEGRATION : options.integration;
  const onAnnotationsChange = options.onAnnotationsChange ?? (() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const playout = createFakePlayout();
  const createPlayout = () => playout as unknown as MediaElementPlayout;
  timelineReady = false;
  let ready = false;
  const onReady = () => {
    ready = true;
  };
  const tree = (content: React.ReactNode, annotationList: AnnotationListProp = firstList) => (
    <AnnotationIntegrationContext.Provider value={integration}>
      {kind === 'WaveformPlaylistProvider' ? (
        <WaveformPlaylistProvider
          tracks={options.tracks ?? TRACKS}
          sampleRate={SAMPLE_RATE}
          samplesPerPixel={882}
          zoomLevels={[441, 882, 1764]}
          createAdapter={createAdapter}
          annotationList={annotationList}
          onAnnotationsChange={onAnnotationsChange}
        >
          <ProbeChild />
          <TimelineReadyProbe />
          {content}
        </WaveformPlaylistProvider>
      ) : (
        <MediaElementPlaylistProvider
          track={MEDIA_TRACK}
          samplesPerPixel={882}
          createPlayout={createPlayout}
          annotationList={annotationList}
          onAnnotationsChange={onAnnotationsChange}
          onReady={onReady}
        >
          <ProbeChild />
          {content}
        </MediaElementPlaylistProvider>
      )}
    </AnnotationIntegrationContext.Provider>
  );
  const view = render(tree(children));
  await waitFor(() =>
    expect(kind === 'WaveformPlaylistProvider' ? timelineReady : ready).toBe(true)
  );
  await act(async () => {});
  return {
    ...view,
    rerender: (content: React.ReactNode) => view.rerender(tree(content)),
    /** Renders the provider again with another `annotationList`. */
    setAnnotationList: (list: AnnotationListProp) => view.rerender(tree(children, list)),
  };
}

const lastList = () => listProps[listProps.length - 1];
const lastWrapper = () => wrapperProps[wrapperProps.length - 1];
const lastDrag = () => dragOptions[dragOptions.length - 1];

/** A root of the right kind with the tracks and the given parts. */
const view = (kind: Kind, parts: React.ReactNode) =>
  kind === 'WaveformPlaylistProvider' ? (
    <WaveformRoot>
      <WaveformTracks />
      {parts}
    </WaveformRoot>
  ) : (
    <MediaElementWaveformRoot>
      <WaveformTracks />
      {parts}
    </MediaElementWaveformRoot>
  );

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  resetPartWarnings();
  vi.restoreAllMocks();
});

describe('the annotation exports (#686)', () => {
  it('exports the two parts and the options hook, and not the names they replace', () => {
    const names = Object.keys(browser);
    expect(names).toEqual(
      expect.arrayContaining(['WaveformAnnotationBoxes', 'AnnotationList', 'useAnnotationOptions'])
    );
    for (const gone of [
      'MediaElementAnnotationBoxes',
      'PlaylistAnnotationList',
      'MediaElementAnnotationList',
      'useAnnotationEditing',
    ]) {
      expect(names).not.toContain(gone);
    }
  });
});

describe.each<Kind>(['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'])(
  'annotation options under %s (#686)',
  (kind) => {
    it('start from the annotationList prop and have one home', async () => {
      await mount(kind, null, {
        annotationList: {
          annotations: ANNOTATIONS,
          editable: true,
          linkEndpoints: true,
          isContinuousPlay: true,
        },
      });
      expect(probe.options).toEqual({ editable: true, linkEndpoints: true, continuousPlay: true });
      // The annotations value holds the annotations and nothing else.
      expect(Object.keys(probe.annotations)).toEqual(['annotations']);
    });

    it('default to false, each on its own', async () => {
      await mount(kind, null);
      expect(probe.options).toEqual({
        editable: false,
        linkEndpoints: false,
        continuousPlay: false,
      });
      cleanup();
      await mount(kind, null, { annotationList: { annotations: ANNOTATIONS, editable: true } });
      expect(probe.options).toEqual({
        editable: true,
        linkEndpoints: false,
        continuousPlay: false,
      });
      cleanup();
      await mount(kind, null, {
        annotationList: { annotations: ANNOTATIONS, linkEndpoints: true },
      });
      expect(probe.options).toEqual({
        editable: false,
        linkEndpoints: true,
        continuousPlay: false,
      });
    });

    it('are set through the shared controls, one at a time', async () => {
      await mount(kind, null);
      const before = probe.options;
      const annotationsBefore = probe.annotations;
      act(() => probe.controls.setAnnotationsEditable(true));
      expect(probe.options).toEqual({ ...before, editable: true });
      act(() => probe.controls.setLinkEndpoints(true));
      expect(probe.options).toEqual({ ...before, editable: true, linkEndpoints: true });
      act(() => probe.controls.setContinuousPlay(true));
      expect(probe.options).toEqual({ editable: true, linkEndpoints: true, continuousPlay: true });
      // No option is part of the annotations value: its readers stand still.
      expect(probe.annotations).toBe(annotationsBefore);
    });

    it('follow the prop when the value of a field changes', async () => {
      const { setAnnotationList } = await mount(kind, null, {
        annotationList: { annotations: ANNOTATIONS },
      });
      setAnnotationList({ annotations: ANNOTATIONS, editable: true });
      expect(probe.options).toEqual({
        editable: true,
        linkEndpoints: false,
        continuousPlay: false,
      });
      setAnnotationList({ annotations: ANNOTATIONS, editable: true, linkEndpoints: true });
      expect(probe.options).toEqual({ editable: true, linkEndpoints: true, continuousPlay: false });
      setAnnotationList({
        annotations: ANNOTATIONS,
        editable: true,
        linkEndpoints: true,
        isContinuousPlay: true,
      });
      expect(probe.options).toEqual({ editable: true, linkEndpoints: true, continuousPlay: true });
      // A field that is left out again counts as false.
      setAnnotationList({ annotations: ANNOTATIONS });
      expect(probe.options).toEqual({
        editable: false,
        linkEndpoints: false,
        continuousPlay: false,
      });
    });

    it('keep a value set with a setter while the prop says the same as before', async () => {
      const { setAnnotationList } = await mount(kind, null, {
        annotationList: { annotations: ANNOTATIONS, editable: true },
      });
      act(() => probe.controls.setAnnotationsEditable(false));
      act(() => probe.controls.setLinkEndpoints(true));
      act(() => probe.controls.setContinuousPlay(true));
      // A new object with the same values (an inline prop), and new annotations.
      setAnnotationList({ annotations: [...ANNOTATIONS], editable: true });
      expect(probe.options).toEqual({ editable: false, linkEndpoints: true, continuousPlay: true });
      // The prop changes: it wins, for the field that changed only.
      setAnnotationList({ annotations: ANNOTATIONS, editable: false, linkEndpoints: false });
      expect(probe.options).toEqual({ editable: false, linkEndpoints: true, continuousPlay: true });
      setAnnotationList({ annotations: ANNOTATIONS, editable: true, linkEndpoints: false });
      expect(probe.options).toEqual({ editable: true, linkEndpoints: true, continuousPlay: true });
    });

    it('the three checkboxes show and set them', async () => {
      const { getByLabelText } = await mount(
        kind,
        <>
          <ContinuousPlayCheckbox />
          <LinkEndpointsCheckbox />
          <EditableCheckbox />
        </>,
        { annotationList: { annotations: ANNOTATIONS, linkEndpoints: true } }
      );
      const checked = () =>
        ['continuous', 'link', 'editable'].map(
          (name) => (getByLabelText(name) as HTMLInputElement).checked
        );
      expect(checked()).toEqual([false, true, false]);
      fireEvent.click(getByLabelText('continuous'));
      fireEvent.click(getByLabelText('link'));
      fireEvent.click(getByLabelText('editable'));
      expect(probe.options).toEqual({ editable: true, linkEndpoints: false, continuousPlay: true });
      // Each box shows its own option, also when the option is on.
      expect(checked()).toEqual([true, false, true]);
    });
  }
);

describe.each<Kind>(['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'])(
  'AnnotationList under %s (#686)',
  (kind) => {
    it('hands the list the annotations and the options of the provider', async () => {
      await mount(kind, <AnnotationList />, {
        annotationList: { annotations: ANNOTATIONS, linkEndpoints: true, isContinuousPlay: true },
      });
      expect(lastList().annotations).toBe(ANNOTATIONS);
      expect(lastList().editable).toBe(false);
      expect(lastList().annotationListConfig).toEqual({
        linkEndpoints: true,
        continuousPlay: true,
      });
      act(() => probe.controls.setLinkEndpoints(false));
      act(() => probe.controls.setContinuousPlay(false));
      act(() => probe.controls.setAnnotationsEditable(true));
      expect(lastList().annotationListConfig).toEqual({
        linkEndpoints: false,
        continuousPlay: false,
      });
      expect(lastList().editable).toBe(true);
    });

    it('passes height, the scroll options and a function child', async () => {
      const row = () => <span />;
      await mount(
        kind,
        <AnnotationList height={123} scrollActivePosition="start" scrollActiveContainer="all">
          {row}
        </AnnotationList>
      );
      expect(lastList().height).toBe(123);
      expect(lastList().scrollActivePosition).toBe('start');
      expect(lastList().scrollActiveContainer).toBe('all');
      expect(lastList().shouldScrollToActive).toBe(true);
      expect(lastList().renderAnnotationItem).toBe(row);
    });

    it('defaults: centred in the nearest container, the default row, no height', async () => {
      await mount(kind, <AnnotationList />);
      expect(lastList().scrollActivePosition).toBe('center');
      expect(lastList().scrollActiveContainer).toBe('nearest');
      expect(lastList().shouldScrollToActive).toBe(true);
      expect(lastList().renderAnnotationItem).toBeUndefined();
      expect(lastList().height).toBeUndefined();
    });

    it('does not follow the active annotation with scrollActivePosition="none"', async () => {
      await mount(kind, <AnnotationList scrollActivePosition="none" />);
      expect(lastList().shouldScrollToActive).toBe(false);
    });

    it('shows the actions only while editable', async () => {
      const actions = [{ text: 'x', title: 'x', action: () => {} }];
      await mount(kind, <AnnotationList actions={actions} />);
      expect(lastList().controls).toBeUndefined();
      act(() => probe.controls.setAnnotationsEditable(true));
      expect(lastList().controls).toBe(actions);
    });

    it('reports an edit through the provider and nowhere else', async () => {
      const onAnnotationsChange = vi.fn();
      await mount(kind, <AnnotationList />, { onAnnotationsChange });
      const edited = [{ ...ANNOTATIONS[0], lines: ['changed'] }, ...ANNOTATIONS.slice(1)];
      act(() => lastList().onAnnotationUpdate?.(edited));
      expect(onAnnotationsChange).toHaveBeenCalledTimes(1);
      expect(onAnnotationsChange).toHaveBeenCalledWith(edited);
    });

    it('a click on a row makes the annotation active and plays it', async () => {
      await mount(kind, <AnnotationList />);
      expect(probe.playing.isPlaying).toBe(false);
      await act(async () => {
        lastList().onAnnotationClick?.(ANNOTATIONS[1]);
      });
      await waitFor(() => expect(probe.playing.isPlaying).toBe(true));
      expect(probe.active.activeAnnotationId).toBe('n2');
    });

    it('keeps the click handler across a continuous-play toggle', async () => {
      await mount(kind, <AnnotationList />);
      const before = lastList().onAnnotationClick;
      expect(before).toBeTypeOf('function');
      act(() => probe.controls.setContinuousPlay(true));
      expect(lastList().onAnnotationClick).toBe(before);
    });

    it('keeps what it hands the list across an active-annotation change', async () => {
      await mount(kind, <AnnotationList />);
      const before = lastList();
      act(() => probe.controls.setActiveAnnotationId('n2'));
      const after = lastList();
      expect(after).not.toBe(before);
      const keys = Array.from(
        new Set([...Object.keys(before), ...Object.keys(after)])
      ) as (keyof AnnotationTextIntegrationProps)[];
      expect(keys.filter((key) => after[key] !== before[key])).toEqual(['activeAnnotationId']);
    });

    it('follows the preview of an edge drag', async () => {
      await mount(kind, <AnnotationList />);
      const moved = [{ ...ANNOTATIONS[0], end: 0.5 }, ...ANNOTATIONS.slice(1)];
      act(() => probe.controls.annotationPreview.publish(moved));
      expect(lastList().annotations).toBe(moved);
      act(() => probe.controls.annotationPreview.publish(null));
      expect(lastList().annotations).toBe(ANNOTATIONS);
    });

    it('draws nothing without annotations', async () => {
      const { container } = await mount(kind, <AnnotationList height={200} />, {
        annotationList: { annotations: [] },
      });
      expect(listProps).toHaveLength(0);
      expect(container.querySelector('[data-list]')).toBeNull();
    });

    it('draws nothing without the annotation integration, and says so once', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = await mount(
        kind,
        <>
          <AnnotationList />
          <AnnotationList />
        </>,
        { integration: null }
      );
      expect(container.querySelector('[data-list]')).toBeNull();
      const messages = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((text) => text.includes('AnnotationList'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('AnnotationProvider');
    });

    it('two lists both get the annotations', async () => {
      await mount(
        kind,
        <>
          <AnnotationList height={1} />
          <AnnotationList height={2} />
        </>
      );
      const heights = new Set(listProps.map((props) => props.height));
      expect(heights).toEqual(new Set([1, 2]));
    });
  }
);

describe.each<Kind>(['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'])(
  'WaveformAnnotationBoxes under %s (#686)',
  (kind) => {
    it('draws a box per annotation, 30 px high, labelled with the id', async () => {
      const { container } = await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      expect(container.querySelectorAll('[data-box]')).toHaveLength(3);
      expect(lastWrapper().height).toBe(30);
      expect(boxProps.n2.label).toBe('n2');
      expect(boxProps.n2.editable).toBe(false);
      // 882 samples per pixel at 44100 Hz: 50 px per second.
      expect(boxProps.n2.startPosition).toBe(50);
      expect(boxProps.n2.endPosition).toBe(125);
      expect(lastWrapper().width).toBe(SECONDS * 50);
    });

    it('takes getLabel and height', async () => {
      const getLabel = (annotation: AnnotationData, index: number) =>
        `${index + 1}:${annotation.id}`;
      await mount(kind, view(kind, <WaveformAnnotationBoxes getLabel={getLabel} height={44} />));
      expect(boxProps.n3.label).toBe('3:n3');
      expect(lastWrapper().height).toBe(44);
    });

    it("takes the box colour from the theme's annotationBoxBorder", async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      expect(boxProps.n1.color).toBe('#ff9800');
    });

    it('is editable when the provider says so', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      act(() => probe.controls.setAnnotationsEditable(true));
      expect(boxProps.n1.editable).toBe(true);
    });

    it('wires the edge drag itself: preview, real sample rate, audio length, link endpoints', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />), {
        annotationList: { annotations: ANNOTATIONS, linkEndpoints: true },
      });
      expect(lastDrag().preview).toBe(probe.controls.annotationPreview);
      expect(lastDrag().sampleRate).toBe(SAMPLE_RATE);
      expect(lastDrag().duration).toBe(SECONDS);
      expect(lastDrag().linkEndpoints).toBe(true);
      expect(lastDrag().onAnnotationsChange).toBe(probe.controls.setAnnotations);
      act(() => probe.controls.setLinkEndpoints(false));
      expect(lastDrag().linkEndpoints).toBe(false);
    });

    it('takes the touch setting of the drag from ClipInteractionOptions', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      expect(sensorOptions[sensorOptions.length - 1]).toEqual({ touchOptimized: false });
      cleanup();
      await mount(
        kind,
        <ClipInteractionOptions touchOptimized>
          {view(kind, <WaveformAnnotationBoxes />)}
        </ClipInteractionOptions>
      );
      expect(sensorOptions[sensorOptions.length - 1]).toEqual({ touchOptimized: true });
    });

    it('a click on a box makes the annotation active and plays it', async () => {
      const { container } = await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      await act(async () => {
        fireEvent.click(container.querySelector('[data-box="n2"]') as HTMLElement);
      });
      await waitFor(() => expect(probe.playing.isPlaying).toBe(true));
      expect(probe.active.activeAnnotationId).toBe('n2');
    });

    it('gives its drag provider those sensors and restricts the drag to the time axis', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      const given = dragProviderProps[dragProviderProps.length - 1];
      expect(given.sensors).toBe(sensorResults[sensorResults.length - 1]);
      expect(given.modifiers).toEqual([RestrictToHorizontalAxis]);
    });

    it('a toggle of continuous play or link endpoints renders no box', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      const before = { ...boxProps };
      act(() => probe.controls.setContinuousPlay(true));
      act(() => probe.controls.setLinkEndpoints(true));
      // The fake box records its props on every render: the same objects.
      for (const id of Object.keys(before)) expect(boxProps[id]).toBe(before[id]);
      // An editable toggle does render them: each gets or loses its handles.
      act(() => probe.controls.setAnnotationsEditable(true));
      for (const id of Object.keys(before)) expect(boxProps[id]).not.toBe(before[id]);
    });

    it('follows the preview of an edge drag', async () => {
      await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      const moved = [{ ...ANNOTATIONS[0], end: 0.5 }, ...ANNOTATIONS.slice(1)];
      act(() => probe.controls.annotationPreview.publish(moved));
      expect(boxProps.n1.endPosition).toBe(25);
    });

    it('draws nothing without annotations or without the integration', async () => {
      const first = await mount(kind, view(kind, <WaveformAnnotationBoxes />), {
        annotationList: { annotations: [] },
      });
      expect(first.container.querySelector('[data-box-row]')).toBeNull();
      cleanup();
      const second = await mount(kind, view(kind, <WaveformAnnotationBoxes />), {
        integration: null,
      });
      expect(second.container.querySelector('[data-box-row]')).toBeNull();
    });

    it('works without a list, and the list without boxes', async () => {
      const first = await mount(kind, view(kind, <WaveformAnnotationBoxes />));
      expect(first.container.querySelectorAll('[data-box]')).toHaveLength(3);
      expect(listProps).toHaveLength(0);
      cleanup();
      const second = await mount(
        kind,
        <>
          {view(kind, null)}
          <AnnotationList />
        </>
      );
      expect(second.container.querySelectorAll('[data-box]')).toHaveLength(0);
      expect(second.container.querySelector('[data-list]')).not.toBeNull();
    });
  }
);

describe.each<Kind>(['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'])(
  'the ready-made composition under %s (#686)',
  (kind) => {
    const Composition = (
      kind === 'WaveformPlaylistProvider' ? Waveform : MediaElementWaveform
    ) as React.FC<Record<string, unknown>>;

    it('draws the boxes and the list with their defaults', async () => {
      const { container } = await mount(kind, <Composition />);
      expect(container.querySelectorAll('[data-box]')).toHaveLength(3);
      expect(container.querySelector('[data-list]')).not.toBeNull();
      expect(lastWrapper().height).toBe(30);
      expect(lastList().height).toBeUndefined();
    });

    it('takes className and ignores the annotation props it used to take', async () => {
      const { container } = await mount(
        kind,
        <Composition
          className="mine"
          annotationTextHeight={300}
          annotationControls={[{ text: 'x', action: () => {} }]}
          annotationListConfig={{ linkEndpoints: true }}
          renderAnnotationItem={() => null}
          getAnnotationBoxLabel={() => 'label'}
          scrollActivePosition="start"
          scrollActiveContainer="all"
          editable
          linkEndpoints
          onAnnotationUpdate={() => {}}
        />
      );
      expect(container.querySelector('.mine')).not.toBeNull();
      expect(lastList().height).toBeUndefined();
      expect(lastList().renderAnnotationItem).toBeUndefined();
      expect(lastList().scrollActivePosition).toBe('center');
      expect(lastList().scrollActiveContainer).toBe('nearest');
      expect(lastList().editable).toBe(false);
      expect(lastList().annotationListConfig).toEqual({
        linkEndpoints: false,
        continuousPlay: false,
      });
      expect(boxProps.n1.label).toBe('n1');
      expect(boxProps.n1.editable).toBe(false);
    });

    it('draws no list and no box row without annotations', async () => {
      const { container } = await mount(kind, <Composition />, {
        annotationList: { annotations: [] },
      });
      expect(container.querySelector('[data-list]')).toBeNull();
      expect(container.querySelector('[data-box-row]')).toBeNull();
    });
  }
);

describe('the edge of an annotation is dragged no further than the audio (#686)', () => {
  it('multitrack: an empty timeline is drawn 60 s long, and the drag is given 0', async () => {
    const { container } = await mount(
      'WaveformPlaylistProvider',
      view('WaveformPlaylistProvider', <WaveformAnnotationBoxes />),
      { tracks: [] }
    );
    // The row is as wide as the drawn timeline: 60 s at 50 px per second.
    expect(container.querySelectorAll('[data-box]')).toHaveLength(3);
    expect(lastWrapper().width).toBe(60 * 50);
    // The clamp is the audio's length, and there is no audio.
    expect(lastDrag().duration).toBe(0);
  });
});

describe('the annotation shortcuts read the options of the provider (#686)', () => {
  it('Shift+{ moves the end of the active annotation, and the next start with link endpoints on', async () => {
    const onAnnotationsChange = vi.fn();
    await mount('WaveformPlaylistProvider', <KeyboardShortcuts annotations />, {
      annotationList: { annotations: ANNOTATIONS, linkEndpoints: true },
      onAnnotationsChange,
    });
    act(() => probe.controls.setActiveAnnotationId('n1'));

    fireEvent.keyDown(window, { key: '{', shiftKey: true });
    expect(onAnnotationsChange).toHaveBeenCalledTimes(1);
    const linked = onAnnotationsChange.mock.lastCall![0] as AnnotationData[];
    expect(linked[0].end).toBeCloseTo(0.99, 5);
    expect(linked[1].start).toBeCloseTo(0.99, 5);

    act(() => probe.controls.setLinkEndpoints(false));
    fireEvent.keyDown(window, { key: '{', shiftKey: true });
    const unlinked = onAnnotationsChange.mock.lastCall![0] as AnnotationData[];
    expect(unlinked[0].end).toBeCloseTo(0.99, 5);
    expect(unlinked[1].start).toBe(1);
  });
});
