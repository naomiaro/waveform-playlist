// @vitest-environment jsdom
//
// #744: the MediaElement player's annotation boxes and text list, through the
// real MediaElementPlaylistProvider. An active-annotation change (every
// annotation boundary during playback) may render the two boxes involved and
// may change only `activeAnnotationId` among the props the list is given.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
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

import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

// Counts renders of the waveform channel: the proxy for "the waveform part of
// the visualization rendered".
const counts = vi.hoisted(() => ({ channel: 0 }));
// The options the boxes hand to the boundary-drag hook, latest last.
const dragOptions = vi.hoisted(
  () => [] as { sampleRate?: number; linkEndpoints?: boolean; preview?: unknown }[]
);

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.channel++;
      return createElement(actual.SmartChannel, props);
    },
  };
});

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  usePlaybackControls,
  useMediaElementTrack,
  useAnnotations,
  useAnnotationOptions,
  useActiveAnnotation,
} from '../contexts/playlistContexts';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationBoxIntegrationProps,
  type AnnotationTextIntegrationProps,
} from '../AnnotationIntegrationContext';
import { MediaElementWaveform } from '../components/MediaElementWaveform';
import { AnnotationList } from '../components/AnnotationList';
import type { AnnotationListProp } from '../providerInternals/useAnnotationState';
import { ComposedMediaElementWaveform } from './testCompositions';

// Not 48000: that is the default the drag handlers fall back to, and the
// track's own rate must reach them.
const SAMPLE_RATE = 44100;
const SOURCE_SCALE = 441;
const SAMPLES_PER_PIXEL = 882;
const SECONDS = 4;
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

const TRACK = { source: 'test.mp3', waveformData: WAVEFORM_DATA, name: 'Test' };

const ANNOTATIONS = [
  { id: 'n1', start: 0, end: 1, lines: ['one'] },
  { id: 'n2', start: 1, end: 2, lines: ['two'] },
  { id: 'n3', start: 2, end: 3, lines: ['three'] },
  { id: 'n4', start: 3, end: 4, lines: ['four'] },
];
const ANNOTATION_LIST = { annotations: ANNOTATIONS };

function createFakePlayout() {
  return {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    // Reports its metadata as soon as it is asked: "ready" right after creation.
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

let boxRenders: Record<string, number> = {};
let boxProps: Record<string, AnnotationBoxIntegrationProps> = {};
let listProps: AnnotationTextIntegrationProps[] = [];

const FakeBox: React.FC<AnnotationBoxIntegrationProps> = (props) => {
  boxRenders[props.annotationId] = (boxRenders[props.annotationId] ?? 0) + 1;
  boxProps[props.annotationId] = props;
  return (
    <button data-box={props.annotationId} onClick={props.onClick}>
      {props.label}
    </button>
  );
};

const FakeAnnotationText: React.FC<AnnotationTextIntegrationProps> = (props) => {
  listProps.push(props);
  return null;
};

const INTEGRATION = {
  AnnotationBox: FakeBox,
  AnnotationBoxesWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AnnotationText: FakeAnnotationText,
} as unknown as AnnotationIntegration;

let probe: {
  controls: ReturnType<typeof usePlaybackControls>;
  data: ReturnType<typeof useMediaElementTrack>;
  state: ReturnType<typeof useAnnotations> & ReturnType<typeof useActiveAnnotation>;
  options: ReturnType<typeof useAnnotationOptions>;
};

const ProbeChild: React.FC = () => {
  probe = {
    controls: usePlaybackControls(),
    data: useMediaElementTrack(),
    state: { ...useAnnotations(), ...useActiveAnnotation() },
    options: useAnnotationOptions(),
  };
  return null;
};

// The options are the provider's (#686): a test that needs one on gives it
// through the provider's `annotationList` prop.
async function mount(
  children: React.ReactNode,
  annotationList: AnnotationListProp = ANNOTATION_LIST
) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  boxRenders = {};
  boxProps = {};
  listProps = [];
  dragOptions.length = 0;
  const playout = createFakePlayout();
  const createPlayout = () => playout as unknown as MediaElementPlayout;
  const onAnnotationsChange = () => {};
  const tree = (content: React.ReactNode) => (
    <AnnotationIntegrationContext value={INTEGRATION}>
      <MediaElementPlaylistProvider
        track={TRACK}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        createPlayout={createPlayout}
        annotationList={annotationList}
        onAnnotationsChange={onAnnotationsChange}
      >
        <ProbeChild />
        {content}
      </MediaElementPlaylistProvider>
    </AnnotationIntegrationContext>
  );
  const { rerender } = render(tree(children));
  await waitFor(() => expect(probe.data.duration).toBe(SECONDS));
  await waitFor(() => expect(probe.data.peaksDataArray.length).toBe(1));
  await act(async () => {});
  return { playout, rerender: (content: React.ReactNode) => rerender(tree(content)) };
}

const lastList = () => listProps[listProps.length - 1];

function changedListProps(
  before: AnnotationTextIntegrationProps,
  after: AnnotationTextIntegrationProps
) {
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  ) as (keyof AnnotationTextIntegrationProps)[];
  return keys.filter((key) => after[key] !== before[key]);
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('MediaElement annotation boxes (#744)', () => {
  it('renders a box per annotation at its pixel position', async () => {
    await mount(<MediaElementWaveform />);

    expect(Object.keys(boxProps).sort()).toEqual(['n1', 'n2', 'n3', 'n4']);
    const pxPerSecond = SAMPLE_RATE / SAMPLES_PER_PIXEL;
    expect(boxProps.n3.startPosition).toBe(2 * pxPerSecond);
    expect(boxProps.n3.endPosition).toBe(3 * pxPerSecond);
    expect(boxProps.n3.annotationIndex).toBe(2);
    expect(boxProps.n3.label).toBe('n3');
    expect(boxProps.n3.editable).toBe(false);
  });

  it('an active-annotation change renders the two boxes involved and no other', async () => {
    await mount(<MediaElementWaveform />);
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });
    boxRenders = {};

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    expect(Object.keys(boxRenders).sort()).toEqual(['n1', 'n2']);
    expect(boxProps.n1.isActive).toBe(false);
    expect(boxProps.n2.isActive).toBe(true);
  });

  it('an active-annotation change does not render the waveform', async () => {
    await mount(<MediaElementWaveform />);
    expect(counts.channel).toBeGreaterThan(0);
    counts.channel = 0;

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    expect(boxProps.n2.isActive).toBe(true);
    expect(counts.channel).toBe(0);
  });

  it('a click on a box makes it active and plays from its start', async () => {
    const { playout } = await mount(<MediaElementWaveform />);

    await act(async () => {
      fireEvent.click(document.querySelector('[data-box="n3"]')!);
    });

    expect(probe.state.activeAnnotationId).toBe('n3');
    expect(playout.play.mock.lastCall).toEqual([undefined, 2]);
  });

  it('a click on a box whose play throws is reported, not left as an unhandled rejection', async () => {
    const { playout } = await mount(<MediaElementWaveform />);
    playout.play.mockImplementation(() => {
      throw new Error('player broke');
    });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    await act(async () => {
      fireEvent.click(document.querySelector('[data-box="n3"]')!);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
    expect(
      vi
        .mocked(console.warn)
        .mock.calls.some((call) =>
          String(call[0]).includes('Failed to start playback for annotation n3')
        )
    ).toBe(true);
  });

  it('boundary drags are converted with the rate of the track', async () => {
    await mount(<MediaElementWaveform />, {
      annotations: ANNOTATIONS,
      editable: true,
      linkEndpoints: true,
    });

    const options = dragOptions[dragOptions.length - 1];
    expect(options.sampleRate).toBe(SAMPLE_RATE);
    expect(options.linkEndpoints).toBe(true);
  });

  // #704 close-out: the built-in boxes drag with the provider's preview, so
  // onAnnotationsChange is called once per drag and not once per move.
  it('boundary drags publish to the provider preview', async () => {
    await mount(<MediaElementWaveform />, { annotations: ANNOTATIONS, editable: true });

    expect(dragOptions[dragOptions.length - 1].preview).toBe(probe.controls.annotationPreview);
  });

  it('a previewed move renders the box it moves, and the list is given the previewed annotations', async () => {
    await mount(<MediaElementWaveform />, { annotations: ANNOTATIONS, editable: true });
    const committed = probe.state.annotations;
    const previewed = committed.map((a, i) => (i === 1 ? { ...a, end: a.end - 0.25 } : a));
    boxRenders = {};

    await act(async () => {
      probe.controls.annotationPreview.publish(previewed);
    });

    expect(Object.keys(boxRenders)).toEqual([committed[1].id]);
    expect(lastList().annotations).toBe(previewed);
    expect(probe.state.annotations).toBe(committed);

    await act(async () => {
      probe.controls.annotationPreview.publish(null);
    });
    expect(lastList().annotations).toBe(committed);
  });

  it("the boxes follow the provider's editable option and the label function", async () => {
    // The ready-made composition takes no label function (#686): the box part does.
    await mount(<ComposedMediaElementWaveform getLabel={(a, index) => index + ':' + a.id} />, {
      annotations: ANNOTATIONS,
      editable: true,
    });

    expect(boxProps.n1.editable).toBe(true);
    expect(boxProps.n4.label).toBe('3:n4');
  });
});

describe('MediaElement annotation list (#744)', () => {
  it('through MediaElementWaveform, an active-annotation change changes nothing else the list is given', async () => {
    await mount(<MediaElementWaveform />, { annotations: ANNOTATIONS, linkEndpoints: true });
    const before = lastList();
    expect(before.annotationListConfig).toEqual({ linkEndpoints: true, continuousPlay: false });

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    const after = lastList();
    expect(after).not.toBe(before);
    expect(after.activeAnnotationId).toBe('n2');
    expect(changedListProps(before, after)).toEqual(['activeAnnotationId']);
  });

  it('through MediaElementWaveform, a render of the parent keeps the options object', async () => {
    const list = { annotations: ANNOTATIONS, linkEndpoints: true };
    const { rerender } = await mount(<MediaElementWaveform />, list);
    const before = lastList();

    await act(async () => {
      rerender(<MediaElementWaveform />);
    });

    expect(lastList().annotationListConfig).toBe(before.annotationListConfig);
  });

  it('standalone, a render of the list keeps the options object', async () => {
    const list = { annotations: ANNOTATIONS, linkEndpoints: true };
    const { rerender } = await mount(<AnnotationList />, list);
    const before = lastList();

    await act(async () => {
      rerender(<AnnotationList />);
    });

    // A new element: the list did render.
    expect(lastList()).not.toBe(before);
    expect(lastList().annotationListConfig).toBe(before.annotationListConfig);
  });

  it('standalone, an active-annotation change changes nothing else the list is given', async () => {
    await mount(<AnnotationList />);
    const before = lastList();

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    const after = lastList();
    expect(after.activeAnnotationId).toBe('n2');
    expect(changedListProps(before, after)).toEqual(['activeAnnotationId']);
  });

  it('the list gets link endpoints and continuous play of the provider', async () => {
    await mount(<AnnotationList />);
    expect(lastList().annotationListConfig).toEqual({
      linkEndpoints: false,
      continuousPlay: false,
    });

    await act(async () => {
      probe.controls.setContinuousPlay(true);
    });
    expect(lastList().annotationListConfig).toEqual({ linkEndpoints: false, continuousPlay: true });

    await act(async () => {
      probe.controls.setLinkEndpoints(true);
    });
    expect(lastList().annotationListConfig).toEqual({ linkEndpoints: true, continuousPlay: true });
    expect(probe.options).toEqual({ editable: false, linkEndpoints: true, continuousPlay: true });
  });

  it('actions are handed to the list only when editable', async () => {
    const actions = [{ text: 'x', title: 'Delete', action: () => {} }];
    await mount(<AnnotationList actions={actions} />);
    expect(lastList().editable).toBe(false);
    expect(lastList().controls).toBeUndefined();

    cleanup();
    await mount(<AnnotationList actions={actions} />, { annotations: ANNOTATIONS, editable: true });
    expect(lastList().editable).toBe(true);
    expect(lastList().controls).toBe(actions);
  });
});
