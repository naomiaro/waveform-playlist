// @vitest-environment jsdom
//
// #740: the active annotation changes at every annotation boundary during
// playback. Only the box that stops being active and the one that becomes
// active may re-render.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  usePlaybackControls,
  useEditorControls,
  useActiveAnnotation,
  usePlaylistTimeline,
  usePlaylistZoom,
} from '../contexts/playlistContexts';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationBoxIntegrationProps,
} from '../AnnotationIntegrationContext';
import { WaveformAnnotationBoxes } from '../components/WaveformAnnotationBoxes';
import { WaveformExtentContext } from '../components/waveformLayoutContext';
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

const ANNOTATIONS = [
  { id: 'n1', start: 0, end: 1, lines: ['one'] },
  { id: 'n2', start: 1, end: 2, lines: ['two'] },
  { id: 'n3', start: 2, end: 3, lines: ['three'] },
  { id: 'n4', start: 3, end: 4, lines: ['four'] },
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

let boxRenders: Record<string, number> = {};
let lastProps: Record<string, AnnotationBoxIntegrationProps> = {};

const FakeBox: React.FC<AnnotationBoxIntegrationProps> = (props) => {
  boxRenders[props.annotationId] = (boxRenders[props.annotationId] ?? 0) + 1;
  lastProps[props.annotationId] = props;
  return (
    <button data-box={props.annotationId} data-active={props.isActive} onClick={props.onClick}>
      {props.label}
    </button>
  );
};

const INTEGRATION = {
  AnnotationBox: FakeBox,
  AnnotationBoxesWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
} as unknown as AnnotationIntegration;

let probe: {
  controls: ReturnType<typeof usePlaybackControls>;
  editor: ReturnType<typeof useEditorControls>;
  data: ReturnType<typeof usePlaylistTimeline> & ReturnType<typeof usePlaylistZoom>;
  activeAnnotationId: string | null;
};

const ProbeChild: React.FC = () => {
  probe = {
    controls: usePlaybackControls(),
    editor: useEditorControls(),
    data: { ...usePlaylistTimeline(), ...usePlaylistZoom() },
    activeAnnotationId: useActiveAnnotation().activeAnnotationId,
  };
  return null;
};

const ANNOTATION_LIST = { annotations: ANNOTATIONS };

// The row takes its width from the root of the view (#685); there is no root here.
const EXTENT = { displayDuration: 60, tracksFullWidth: 2000 };

type LabelFn = React.ComponentProps<typeof WaveformAnnotationBoxes>['getLabel'];

async function mount({ getLabel }: { getLabel?: LabelFn } = {}) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  boxRenders = {};
  lastProps = {};
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  render(
    <AnnotationIntegrationContext value={INTEGRATION}>
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        annotationList={ANNOTATION_LIST}
      >
        <ProbeChild />
        <WaveformExtentContext value={EXTENT}>
          <WaveformAnnotationBoxes getLabel={getLabel} />
        </WaveformExtentContext>
      </WaveformPlaylistProvider>
    </AnnotationIntegrationContext>
  );
  await waitFor(() => expect(probe.data.isReady).toBe(true));
  await act(async () => {});
  return { adapter };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('annotation boxes (#740)', () => {
  it('renders a box per annotation at its pixel position', async () => {
    await mount();

    expect(Object.keys(boxRenders).sort()).toEqual(['n1', 'n2', 'n3', 'n4']);
    const pxPerSecond = SAMPLE_RATE / probe.data.samplesPerPixel;
    expect(lastProps.n3.startPosition).toBe(2 * pxPerSecond);
    expect(lastProps.n3.endPosition).toBe(3 * pxPerSecond);
    expect(lastProps.n3.annotationIndex).toBe(2);
    expect(lastProps.n3.label).toBe('n3');
  });

  it('an active-annotation change renders the two boxes involved and no other', async () => {
    await mount();
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });
    boxRenders = {};

    await act(async () => {
      probe.controls.setActiveAnnotationId('n2');
    });

    expect(Object.keys(boxRenders).sort()).toEqual(['n1', 'n2']);
    expect(lastProps.n1.isActive).toBe(false);
    expect(lastProps.n2.isActive).toBe(true);
  });

  it('a click on a box makes it active and plays it to its end', async () => {
    const { adapter } = await mount();
    const play = adapter.play as ReturnType<typeof vi.fn>;

    await act(async () => {
      fireEvent.click(document.querySelector('[data-box="n3"]')!);
    });

    expect(probe.activeAnnotationId).toBe('n3');
    expect(play.mock.lastCall).toEqual([2, 3]);
  });

  it('a click after continuous play is switched on plays on past the end', async () => {
    const { adapter } = await mount();
    const play = adapter.play as ReturnType<typeof vi.fn>;
    // The click handler is a prop of every memoized box and never changes:
    // it reads continuous play when the click happens (#686).
    await act(async () => {
      probe.controls.setContinuousPlay(true);
    });

    await act(async () => {
      fireEvent.click(document.querySelector('[data-box="n3"]')!);
    });

    expect(probe.activeAnnotationId).toBe('n3');
    expect(play.mock.lastCall?.[0]).toBe(2);
    expect(play.mock.lastCall?.[1]).toBeUndefined();
  });

  it('every box moves when the zoom changes', async () => {
    await mount();
    const before = lastProps.n3.startPosition;
    const sppBefore = probe.data.samplesPerPixel;

    await act(async () => {
      probe.editor.zoomIn();
    });

    expect(probe.data.samplesPerPixel).not.toBe(sppBefore);
    expect(lastProps.n3.startPosition).toBe((2 * SAMPLE_RATE) / probe.data.samplesPerPixel);
    expect(lastProps.n3.startPosition).not.toBe(before);
  });

  it('every box follows the editable setting', async () => {
    await mount();
    expect(lastProps.n1.editable).toBe(false);

    await act(async () => {
      probe.controls.setAnnotationsEditable(true);
    });

    expect(lastProps.n1.editable).toBe(true);
    expect(lastProps.n4.editable).toBe(true);
  });

  it('a box whose label changed renders even when its active state did not', async () => {
    let prefix = 'A';
    await mount({ getLabel: (annotation, index) => prefix + index + ':' + annotation.id });
    expect(lastProps.n3.label).toBe('A2:n3');

    prefix = 'B';
    await act(async () => {
      probe.controls.setActiveAnnotationId('n1');
    });

    // n3 is neither the old nor the new active box; the memo must not hide a
    // changed label.
    expect(lastProps.n3.label).toBe('B2:n3');
  });

  // #704 close-out: an edge drag publishes its moves to the provider's
  // preview source instead of changing the annotations on every move.
  describe('edge-drag preview', () => {
    it('a previewed move renders the box it moves and no other, and the provider not at all', async () => {
      await mount();
      const controlsBefore = probe.controls;
      const dataBefore = probe.data;
      const pxPerSecond = SAMPLE_RATE / probe.data.samplesPerPixel;
      boxRenders = {};

      await act(async () => {
        probe.controls.annotationPreview.publish(
          ANNOTATIONS.map((a) => (a.id === 'n2' ? { ...a, end: a.end - 0.25 } : a))
        );
      });

      expect(Object.keys(boxRenders)).toEqual(['n2']);
      expect(lastProps.n2.endPosition).toBe((ANNOTATIONS[1].end - 0.25) * pxPerSecond);
      expect(probe.controls).toBe(controlsBefore);
      expect(probe.data).toBe(dataBefore);
    });

    it('dropping the preview puts the boxes back on the annotations', async () => {
      await mount();
      const pxPerSecond = SAMPLE_RATE / probe.data.samplesPerPixel;
      await act(async () => {
        probe.controls.annotationPreview.publish(
          ANNOTATIONS.map((a) => (a.id === 'n2' ? { ...a, end: a.end - 0.25 } : a))
        );
      });
      boxRenders = {};

      await act(async () => {
        probe.controls.annotationPreview.publish(null);
      });

      expect(Object.keys(boxRenders)).toEqual(['n2']);
      expect(lastProps.n2.endPosition).toBe(ANNOTATIONS[1].end * pxPerSecond);
    });
  });
});
