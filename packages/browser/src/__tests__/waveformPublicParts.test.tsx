// @vitest-environment jsdom
//
// #685, step 3: the parts of the view are public and the consumer composes
// them. What that changes is asserted here, row by row of the upgrade guide:
// the three ready-made compositions, the parts that are drawn by being
// rendered (the timescale, the controls column and its width), the removed
// props and provider options, the recording session hook, and the
// development warnings for a part that is not where it can work.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { WaveformDataObject, ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { usePlaylistInfo } from '@waveform-playlist/ui-components';
import { warnMisplacedPart, resetPartWarnings } from '../components/partWarnings';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
} from '../AnnotationIntegrationContext';
import {
  SpectrogramIntegrationContext,
  type SpectrogramIntegration,
} from '../SpectrogramIntegrationContext';

const counts = vi.hoisted(() => ({
  loopMounts: 0,
  layout: 0,
  gains: [] as number[],
  canvasRegister: [] as unknown[],
  clipMouseDown: [] as Array<(event: unknown) => void>,
  clipsWithFades: 0,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement, useEffect } = await import('react');
  return {
    ...actual,
    TimescaleLoopRegion: (props: React.ComponentProps<typeof actual.TimescaleLoopRegion>) => {
      useEffect(() => {
        counts.loopMounts++;
      }, []);
      return createElement(actual.TimescaleLoopRegion, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.gains.push((props as { gain?: number }).gain ?? 1);
      counts.canvasRegister.push(
        (props as { spectrogramOnCanvasRegister?: unknown }).spectrogramOnCanvasRegister
      );
      return createElement(actual.SmartChannel, props);
    },
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clipMouseDown.push(props.onMouseDown as (event: unknown) => void);
      if (props.showFades) counts.clipsWithFades++;
      return createElement(actual.Clip, props);
    },
  };
});

vi.mock('../components/visualizationLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/visualizationLayout')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    // Rendered once per render of the tracks part and of the controls part.
    TracksLayout: (props: React.ComponentProps<typeof actual.TracksLayout>) => {
      counts.layout++;
      return createElement(actual.TracksLayout, props);
    },
  };
});

import * as api from '../index';
import {
  WaveformPlaylistProvider,
  MediaElementPlaylistProvider,
  Waveform,
  WaveformEditor,
  MediaElementWaveform,
  WaveformRoot,
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformRecordingPreview,
  WaveformSelection,
  WaveformPlayhead,
  useRecordingSession,
  useSelectedTrackId,
  useMediaElementTrack,
  WaveformAnnotationBoxes,
  MediaElementAnnotationBoxes,
  useEditorControls,
  usePlaylistTimeline,
  usePlaylistView,
  usePlaybackControls,
  type WaveformRecordingState,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string): ClipTrack {
  const data: number[] = [];
  for (let i = 0; i < 400; i++) data.push(-(i % 100), i % 100);
  const clip = {
    id: `${id}-clip`,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: WaveformData.create({
      version: 2,
      channels: 1,
      sample_rate: SAMPLE_RATE,
      samples_per_pixel: 256,
      bits: 16,
      length: 400,
      data,
    }),
  } as AudioClip;
  return {
    id,
    name: `name-${id}`,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}
const TRACKS = [makeTrack('t1'), makeTrack('t2')];

function createFakeAdapter() {
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
    setTrackMute: vi.fn(),
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  };
}

let probe: {
  editor: ReturnType<typeof useEditorControls>;
  isReady: boolean;
  view: ReturnType<typeof usePlaylistView>;
  controls: ReturnType<typeof usePlaybackControls>;
  selectedTrackId: string | null;
};
const Probe: React.FC = () => {
  probe = {
    editor: useEditorControls(),
    isReady: usePlaylistTimeline().isReady,
    view: usePlaylistView(),
    controls: usePlaybackControls(),
    selectedTrackId: useSelectedTrackId().selectedTrackId,
  };
  return null;
};

const ANNOTATION_INTEGRATION = {
  AnnotationBox: ({ label }: { label: string }) => <span data-box>{label}</span>,
  AnnotationBoxesWrapper: ({ children }: { children?: React.ReactNode }) => (
    <div data-boxes>{children}</div>
  ),
  AnnotationText: () => <div data-annotation-list />,
} as unknown as AnnotationIntegration;
const ANNOTATION_LIST = { annotations: [{ id: 'n1', start: 0, end: 0.5, lines: ['one'] }] };

interface MultitrackOptions {
  tracks?: ClipTrack[];
  annotations?: boolean;
  spectrogram?: SpectrogramIntegration;
}

async function mountMultitrack(
  tree: () => React.ReactElement,
  { tracks = TRACKS, annotations = false, spectrogram }: MultitrackOptions = {}
) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter as unknown as PlayoutAdapter;
  const ui = () => (
    <AnnotationIntegrationContext.Provider value={annotations ? ANNOTATION_INTEGRATION : null}>
      <SpectrogramIntegrationContext.Provider value={spectrogram ?? null}>
        <WaveformPlaylistProvider
          tracks={tracks}
          sampleRate={SAMPLE_RATE}
          createAdapter={createAdapter}
          annotationList={annotations ? ANNOTATION_LIST : undefined}
        >
          <Probe />
          {tree()}
        </WaveformPlaylistProvider>
      </SpectrogramIntegrationContext.Provider>
    </AnnotationIntegrationContext.Provider>
  );
  const view = render(ui());
  await waitFor(() => expect(probe.isReady).toBe(true));
  await act(async () => {});
  counts.layout = 0;
  counts.loopMounts = 0;
  counts.gains = [];
  return { adapter, warn, rerender: () => view.rerender(ui()) };
}

const SECONDS = 8;
const ME_RATE = 44100;
const ME_LENGTH = (SECONDS * ME_RATE) / 441;
const ME_TRACK = {
  source: 'test.mp3',
  name: 'Test',
  waveformData: WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: ME_RATE,
    samples_per_pixel: 441,
    bits: 8,
    length: ME_LENGTH,
    data: Array.from({ length: ME_LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
  }) as unknown as WaveformDataObject,
};

const ME_FADED = { ...ME_TRACK, fadeIn: { duration: 1 }, fadeOut: { duration: 1 } };

let mediaControls: ReturnType<typeof usePlaybackControls>;
let mediaTrack: ReturnType<typeof useMediaElementTrack>;
const MediaProbe: React.FC = () => {
  mediaControls = usePlaybackControls();
  mediaTrack = useMediaElementTrack();
  return null;
};

/** Catches what a part throws, so a test can read the message. */
class Boundary extends React.Component<
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

/** The message a tree throws when rendered under the given mount, or '' when it renders. */
async function thrownBy(
  mount: (tree: () => React.ReactElement) => Promise<unknown>,
  tree: React.ReactElement
): Promise<string> {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let message = '';
  await mount(() => <Boundary onError={(m) => (message = m)}>{tree}</Boundary>);
  return message;
}

async function mountMediaElement(tree: React.ReactElement | (() => React.ReactElement)) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fake = {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on() {},
    off() {},
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn(),
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose: vi.fn(),
  };
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  const ui = () => (
    <MediaElementPlaylistProvider
      track={ME_FADED}
      samplesPerPixel={1000}
      createPlayout={createPlayout}
    >
      {typeof tree === 'function' ? tree() : tree}
      <MediaProbe />
    </MediaElementPlaylistProvider>
  );
  const view = render(ui());
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  await act(async () => {});
  return { warn, rerender: () => view.rerender(ui()) };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  resetPartWarnings();
});

const root = () => document.querySelector('[data-playlist-state]') as HTMLElement;
const scrollArea = () => document.querySelector('[data-scroll-container]') as HTMLElement;
/** The controls column: the root's first child when there is one beside the scroll area. */
const controlsColumn = () =>
  root().children.length === 2 ? (root().firstElementChild as HTMLElement) : null;
/** The ruler draws its first tick label as text. */
const hasRuler = () => (scrollArea().textContent ?? '').includes('0:00');
const hasHeaders = () => (scrollArea().textContent ?? '').includes('name-t1');

describe('the package exports', () => {
  it('has the roots, the parts, the compositions and the recording hook', () => {
    const names = [
      'WaveformRoot',
      'MediaElementWaveformRoot',
      'WaveformTimescale',
      'WaveformLoopRegion',
      'WaveformTrackControls',
      'WaveformTracks',
      'WaveformClipHeaders',
      'WaveformFades',
      'WaveformRecordingPreview',
      'WaveformAnnotationBoxes',
      'MediaElementAnnotationBoxes',
      'WaveformSelection',
      'WaveformPlayhead',
      'Waveform',
      'WaveformEditor',
      'MediaElementWaveform',
      'useRecordingSession',
    ];
    const missing = names.filter((name) => !(name in api));
    expect(missing).toEqual([]);
  });

  it('no longer has the two prop-driven views', () => {
    expect('PlaylistVisualization' in api).toBe(false);
    expect('MediaElementPlaylist' in api).toBe(false);
  });
});

describe('the ready-made compositions', () => {
  it('<Waveform />: a ruler and a 200 px controls column, with no provider option for either', async () => {
    await mountMultitrack(() => <Waveform />);
    expect(hasRuler()).toBe(true);
    expect(controlsColumn()?.style.width).toBe('200px');
    expect(hasHeaders()).toBe(false);
    expect(document.querySelectorAll('[data-track-row]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(1);
  });

  it('<Waveform />: the selection and the loop region are among its parts', async () => {
    await mountMultitrack(() => <Waveform />);
    counts.loopMounts = 0;
    await act(async () => {
      probe.controls.setSelection(0.2, 0.6);
      probe.editor.setLoopRegion(0.2, 0.6);
      probe.editor.setLoopEnabled(true);
    });
    expect(document.querySelectorAll('[data-selection]')).toHaveLength(1);
    expect(counts.loopMounts).toBe(1);
  });

  it('<WaveformEditor />: the same with clip headers', async () => {
    await mountMultitrack(() => <WaveformEditor />);
    expect(hasRuler()).toBe(true);
    expect(controlsColumn()?.style.width).toBe('200px');
    expect(hasHeaders()).toBe(true);
  });

  it('<MediaElementWaveform />: a ruler, with no provider option for it', async () => {
    await mountMediaElement(<MediaElementWaveform />);
    expect(hasRuler()).toBe(true);
    expect(document.querySelectorAll('[data-track-row]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(1);
    // No fade curves: the fades part is not in this composition.
    expect(document.querySelectorAll('[data-clip-container] svg')).toHaveLength(0);
    await act(async () => {
      mediaControls.setSelection(1, 2);
    });
    expect(document.querySelectorAll('[data-selection]')).toHaveLength(1);
  });

  it('a render of the parent of <WaveformEditor /> does not render the tracks or the controls', async () => {
    const { rerender } = await mountMultitrack(() => <WaveformEditor />);
    rerender();
    await act(async () => {});
    expect(counts.layout).toBe(0);
  });

  it('a render of the parent of <MediaElementWaveform /> does not render the tracks', async () => {
    const { rerender } = await mountMediaElement(() => <MediaElementWaveform />);
    counts.layout = 0;
    rerender();
    await act(async () => {});
    expect(counts.layout).toBe(0);
  });

  it('a removed prop left on <Waveform> is ignored', async () => {
    const leftover = { showClipHeaders: true, onRemoveTrack: () => {} } as object;
    await mountMultitrack(() => <Waveform {...leftover} />);
    expect(hasHeaders()).toBe(false);
    expect(document.querySelector('[aria-label*="emove"]')).toBeNull();
  });

  it('a render of the parent of <Waveform /> does not render the tracks or the controls', async () => {
    const { rerender } = await mountMultitrack(() => <Waveform />);
    rerender();
    await act(async () => {});
    expect(counts.layout).toBe(0);
  });
});

describe('a part is drawn by being rendered', () => {
  it('no timescale part: no ruler', async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(hasRuler()).toBe(false);
    expect(controlsColumn()).toBeNull();
  });

  it('the controls column is as wide as the part says', async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTrackControls width={150} />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(controlsColumn()?.style.width).toBe('150px');
  });

  it('two controls parts: the first says how wide the column is', async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTrackControls width={150} />
        <WaveformTrackControls width={300} />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(controlsColumn()?.style.width).toBe('150px');
  });

  it('what the drawing primitives are told: the strip height and the column, from the parts', async () => {
    let info: ReturnType<typeof usePlaylistInfo> | undefined;
    const Mine: React.FC = () => {
      info = usePlaylistInfo();
      return null;
    };
    let withTimescale = true;
    let width = 150;
    const { rerender } = await mountMultitrack(() => (
      <WaveformRoot>
        {withTimescale ? <WaveformTimescale /> : null}
        <WaveformTrackControls width={width} />
        <WaveformTracks />
        <Mine />
      </WaveformRoot>
    ));
    expect(info?.timeScaleHeight).toBe(30);
    expect(info?.controls).toEqual({ show: true, width: 150 });
    // The spacer above the panels is as tall as the strip and its border.
    expect((controlsColumn()!.firstElementChild as HTMLElement).style.height).toBe('31px');

    width = 180;
    rerender();
    await act(async () => {});
    expect(info?.controls).toEqual({ show: true, width: 180 });
    expect(controlsColumn()?.style.width).toBe('180px');

    withTimescale = false;
    rerender();
    await act(async () => {});
    expect(info?.timeScaleHeight).toBe(0);
    expect((controlsColumn()!.firstElementChild as HTMLElement).style.height).not.toBe('31px');
  });

  it("a consumer's own element among the parts is drawn in the scrolling area", async () => {
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
        <div data-mine="">mine</div>
      </WaveformRoot>
    ));
    expect(scrollArea().querySelector('[data-mine]')).not.toBeNull();
  });

  it('the view value has neither `controls` nor `timeScaleHeight`', async () => {
    await mountMultitrack(() => <Waveform />);
    expect('controls' in probe.view).toBe(false);
    expect('timeScaleHeight' in probe.view).toBe(false);
  });

  it('the loop region stays mounted when the timescale before it comes and goes', async () => {
    let withTimescale = true;
    const { rerender } = await mountMultitrack(() => (
      <WaveformRoot>
        {withTimescale && <WaveformTimescale />}
        <WaveformLoopRegion />
        <WaveformTracks />
      </WaveformRoot>
    ));
    await act(async () => {
      probe.editor.setLoopRegion(0.2, 0.6);
      probe.editor.setLoopEnabled(true);
    });
    expect(counts.loopMounts).toBe(1);
    withTimescale = false;
    rerender();
    await act(async () => {});
    withTimescale = true;
    rerender();
    await act(async () => {});
    expect(counts.loopMounts).toBe(1);
  });

  it('MediaElement: fades, selection and playhead composed by hand, no ruler', async () => {
    await mountMediaElement(
      <MediaElementWaveformRoot>
        <WaveformTracks>
          <WaveformFades />
        </WaveformTracks>
        <WaveformSelection />
        <WaveformPlayhead />
      </MediaElementWaveformRoot>
    );
    expect(hasRuler()).toBe(false);
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-clip-container] svg')).toHaveLength(2);
  });

  it('MediaElement: the fades part switched on after the first render draws the curves', async () => {
    let showFades = false;
    const { rerender } = await mountMediaElement(() => (
      <MediaElementWaveformRoot>
        <WaveformTracks>{showFades ? <WaveformFades /> : null}</WaveformTracks>
      </MediaElementWaveformRoot>
    ));
    expect(document.querySelectorAll('[data-clip-container] svg')).toHaveLength(0);
    showFades = true;
    rerender();
    await act(async () => {});
    expect(document.querySelectorAll('[data-clip-container] svg')).toHaveLength(2);
  });
});

describe('what the tracks part hands every clip', () => {
  const quiet: ClipTrack = {
    ...makeTrack('q1'),
    clips: [
      {
        ...makeTrack('q1').clips[0],
        gain: 0.5,
        fadeIn: { duration: 0.2 },
        fadeOut: { duration: 0.2 },
      } as AudioClip,
    ],
  };

  it('gainScaled switched on after the first render scales the drawn waveform', async () => {
    let gainScaled = false;
    const { rerender } = await mountMultitrack(
      () => (
        <WaveformRoot>
          <WaveformTracks gainScaled={gainScaled} />
        </WaveformRoot>
      ),
      { tracks: [quiet] }
    );
    counts.gains = [];
    rerender();
    await act(async () => {});
    expect(counts.gains).not.toContain(0.5);
    gainScaled = true;
    rerender();
    await act(async () => {});
    expect(counts.gains).toContain(0.5);
  });

  it('<WaveformEditor /> draws the fades of a clip, <Waveform /> does not', async () => {
    counts.clipsWithFades = 0;
    await mountMultitrack(() => <WaveformEditor />, { tracks: [quiet] });
    expect(counts.clipsWithFades).toBeGreaterThan(0);
    await act(async () => {
      cleanup();
    });
    counts.clipsWithFades = 0;
    await mountMultitrack(() => <Waveform />, { tracks: [quiet] });
    expect(counts.clipsWithFades).toBe(0);
  });

  it('a press on a clip selects its track', async () => {
    counts.clipMouseDown = [];
    await mountMultitrack(() => <Waveform />);
    expect(probe.selectedTrackId).not.toBe('t2');
    // The handler of the last clip rendered: the clip of the second track.
    const pressSecondClip = counts.clipMouseDown[counts.clipMouseDown.length - 1];
    await act(async () => {
      pressSecondClip({ target: document.body });
    });
    expect(probe.selectedTrackId).toBe('t2');
  });

  it("the spectrogram integration's canvas registration reaches the channels", async () => {
    const registerSpectrogramCanvas = vi.fn();
    const spectrogram = {
      trackSpectrogramOverrides: new Map(),
      setTrackRenderMode: () => {},
      setTrackSpectrogramConfig: () => {},
      registerSpectrogramCanvas,
      unregisterSpectrogramCanvas: () => {},
      getColorMap: () => new Uint8Array(0),
      getFrequencyScale: () => (f: number) => f,
    } as unknown as SpectrogramIntegration;
    counts.canvasRegister = [];
    await mountMultitrack(() => <Waveform />, { spectrogram });
    expect(counts.canvasRegister.length).toBeGreaterThan(0);
    expect(counts.canvasRegister.every((fn) => fn === registerSpectrogramCanvas)).toBe(true);
  });
});

describe('the options the ready-made compositions keep', () => {
  it('<Waveform>: className reaches the root, and getAnnotationBoxLabel the annotation boxes', async () => {
    await mountMultitrack(
      () => <Waveform className="mine" getAnnotationBoxLabel={() => 'my label'} />,
      { annotations: true }
    );
    expect(root().classList.contains('mine')).toBe(true);
    expect(document.querySelector('[data-box]')?.textContent).toBe('my label');
    // The text list is there because there are annotations.
    expect(document.querySelector('[data-annotation-list]')).not.toBeNull();
  });

  it('<Waveform> without annotations renders no annotation list', async () => {
    await mountMultitrack(() => <Waveform />, { annotations: false });
    expect(document.querySelector('[data-annotation-list]')).toBeNull();
    expect(document.querySelector('[data-box]')).toBeNull();
  });

  it('<MediaElementWaveform>: className reaches the root', async () => {
    await mountMediaElement(<MediaElementWaveform className="mine" />);
    expect(root().classList.contains('mine')).toBe(true);
  });
});

describe('where a part works and where it throws', () => {
  const underMedia = (tree: () => React.ReactElement) => mountMediaElement(tree);
  const underMultitrack = (tree: () => React.ReactElement) => mountMultitrack(tree);

  it('outside a root: the timescale, the tracks, the loop region, the controls and both annotation rows throw', async () => {
    const outside: Array<[React.ReactElement, string]> = [
      [<WaveformTimescale />, 'The timescale must be rendered inside the waveform root'],
      [<WaveformTracks />, 'The tracks must be rendered inside the waveform root'],
      [<WaveformLoopRegion />, 'The loop region must be rendered inside the waveform root'],
      [<WaveformTrackControls />, 'The track controls must be rendered inside the waveform root'],
      [
        <WaveformAnnotationBoxes />,
        'The annotation boxes must be rendered inside the waveform root',
      ],
    ];
    for (const [part, message] of outside) {
      expect(await thrownBy(underMultitrack, part)).toBe(message);
      await act(async () => {
        cleanup();
      });
    }
    expect(await thrownBy(underMedia, <MediaElementAnnotationBoxes />)).toBe(
      'The annotation boxes must be rendered inside the waveform root'
    );
  });

  it('outside a root: the selection and the playhead draw', async () => {
    const message = await thrownBy(
      underMultitrack,
      <>
        <WaveformSelection />
        <WaveformPlayhead />
      </>
    );
    expect(message).toBe('');
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(1);
  });

  it('under the MediaElement provider: the loop region and the multitrack annotation boxes name the hook they need', async () => {
    expect(
      await thrownBy(
        underMedia,
        <MediaElementWaveformRoot>
          <WaveformTimescale />
          <WaveformLoopRegion />
          <WaveformTracks />
        </MediaElementWaveformRoot>
      )
    ).toBe(
      'useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is ' +
        'MediaElementPlaylistProvider, which does not provide it'
    );
    await act(async () => {
      cleanup();
    });
    expect(
      await thrownBy(
        underMedia,
        <MediaElementWaveformRoot>
          <WaveformTracks />
          <WaveformAnnotationBoxes />
        </MediaElementWaveformRoot>
      )
    ).toMatch(/^use(Annotations|AnnotationEditing) needs WaveformPlaylistProvider/);
  });

  it('under the MediaElement provider: a wrapped controls part is rendered among the tracks and throws', async () => {
    const Wrapped = () => <WaveformTrackControls />;
    expect(
      await thrownBy(
        underMedia,
        <MediaElementWaveformRoot>
          <Wrapped />
          <WaveformTracks />
        </MediaElementWaveformRoot>
      )
    ).toMatch(
      /needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider/
    );
  });

  it('each root throws under the other provider', async () => {
    expect(
      await thrownBy(
        underMedia,
        <WaveformRoot>
          <WaveformTracks />
        </WaveformRoot>
      )
    ).toMatch(/needs WaveformPlaylistProvider/);
    await act(async () => {
      cleanup();
    });
    expect(
      await thrownBy(
        underMultitrack,
        <MediaElementWaveformRoot>
          <WaveformTracks />
        </MediaElementWaveformRoot>
      )
    ).toMatch(/needs MediaElementPlaylistProvider/);
  });

  it('two roots under one provider both draw, each with its own playhead', async () => {
    await mountMultitrack(() => (
      <>
        <WaveformRoot>
          <WaveformTracks />
          <WaveformPlayhead />
        </WaveformRoot>
        <WaveformRoot>
          <WaveformTracks />
          <WaveformPlayhead />
        </WaveformRoot>
      </>
    ));
    expect(document.querySelectorAll('[data-playlist-state]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-track-row]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-playhead]')).toHaveLength(2);
  });

  it('a list of parts whose length changes remounts the later part, unless the parts have keys', async () => {
    let mounts = 0;
    const Mine: React.FC = () => {
      React.useEffect(() => {
        mounts++;
      }, []);
      return null;
    };
    for (const keyed of [false, true]) {
      mounts = 0;
      let withSelection = true;
      const { rerender } = await mountMultitrack(() => (
        <WaveformRoot>
          <WaveformTracks />
          <>
            {[
              withSelection ? <WaveformSelection key={keyed ? 'selection' : 0} /> : null,
              <Mine key={keyed ? 'mine' : withSelection ? 1 : 0} />,
            ].filter(Boolean)}
          </>
        </WaveformRoot>
      ));
      expect(mounts).toBe(1);
      withSelection = false;
      rerender();
      await act(async () => {});
      expect(mounts).toBe(keyed ? 1 : 2);
      await act(async () => {
        cleanup();
      });
    }
  });

  it('a loop region without a timescale has the strip to itself', async () => {
    let info: ReturnType<typeof usePlaylistInfo> | undefined;
    const Mine: React.FC = () => {
      info = usePlaylistInfo();
      return null;
    };
    await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformLoopRegion />
        <WaveformTracks />
        <Mine />
      </WaveformRoot>
    ));
    expect(info?.timeScaleHeight).toBe(30);
    expect(hasRuler()).toBe(false);
  });
});

describe('the recording session', () => {
  // One snapshot object: a new one per call would re-render without end.
  const SNAPSHOT = { duration: 0, peaks: [] };
  const PROGRESS = {
    subscribe: () => () => {},
    getSnapshot: () => SNAPSHOT,
  } as unknown as WaveformRecordingState['progress'];
  const recording = (isRecording: boolean): WaveformRecordingState => ({
    isRecording,
    trackId: 't1',
    startSample: 0,
    progress: PROGRESS,
    bits: 16,
  });

  it('the preview part alone does not mute the armed track', async () => {
    let isRecording = false;
    const { adapter, rerender } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks>
          <WaveformRecordingPreview recordingState={recording(isRecording)} />
        </WaveformTracks>
      </WaveformRoot>
    ));
    isRecording = true;
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).not.toHaveBeenCalled();
  });

  it('useRecordingSession mutes the armed track for the take and restores it', async () => {
    let isRecording = false;
    const Session: React.FC = () => {
      useRecordingSession({ isRecording, trackId: 't1' });
      return null;
    };
    const { adapter, rerender } = await mountMultitrack(() => <Session />);
    expect(adapter.setTrackMute).not.toHaveBeenCalled();
    isRecording = true;
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t1', true);
    isRecording = false;
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t1', false);
  });

  it('the armed track changing during a take moves the mute', async () => {
    let trackId: string | null = null;
    const Session: React.FC = () => {
      useRecordingSession({ isRecording: trackId !== null, trackId });
      return null;
    };
    const { adapter, rerender } = await mountMultitrack(() => <Session />);
    trackId = 't1';
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t1', true);
    trackId = 't2';
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).toHaveBeenCalledWith('t1', false);
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t2', true);
  });

  it('the session ends when the component that holds it unmounts', async () => {
    let mounted = true;
    const Session: React.FC = () => {
      useRecordingSession({ isRecording: true, trackId: 't2' });
      return null;
    };
    const { adapter, rerender } = await mountMultitrack(() => (mounted ? <Session /> : <span />));
    // The provider was still loading when the effect first ran; a take starts later.
    await act(async () => {
      probe.editor.setRecordingActive(true, 't2');
    });
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t2', true);
    mounted = false;
    rerender();
    await act(async () => {});
    expect(adapter.setTrackMute).toHaveBeenLastCalledWith('t2', false);
  });
});

describe('development warnings for a part that is not where it can work', () => {
  const warned = (warn: { mock: { calls: unknown[][] } }, text: string) =>
    warn.mock.calls.some((call) => String(call[0]).includes(text));

  it('a per-clip marker outside <WaveformTracks>', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
        <WaveformClipHeaders />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformClipHeaders>')).toBe(true);
    expect(hasHeaders()).toBe(false);
  });

  it('a child of <WaveformTracks> that is not one of its markers', async () => {
    const Wrapped = () => <WaveformFades />;
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks>
          <Wrapped />
        </WaveformTracks>
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformTracks>')).toBe(true);
  });

  it('a timescale wrapped in another component', async () => {
    const Wrapped = () => <WaveformTimescale />;
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <Wrapped />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformTimescale>')).toBe(true);
  });

  it('a controls part wrapped in another component', async () => {
    const Wrapped = () => <WaveformTrackControls />;
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <Wrapped />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformTrackControls>')).toBe(true);
  });

  it('the other two per-clip markers outside <WaveformTracks>', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
        <WaveformFades />
        <WaveformRecordingPreview recordingState={{} as WaveformRecordingState} />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformFades>')).toBe(true);
    expect(warned(warn, '<WaveformRecordingPreview>')).toBe(true);
  });

  it('a loop region wrapped in another component', async () => {
    const Wrapped = () => <WaveformLoopRegion />;
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <Wrapped />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformLoopRegion>')).toBe(true);
  });

  it('a tracks part wrapped in another component, with clip headers the root cannot see', async () => {
    const Wrapped = () => (
      <WaveformTracks>
        <WaveformClipHeaders />
      </WaveformTracks>
    );
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <Wrapped />
      </WaveformRoot>
    ));
    expect(warned(warn, 'disagree about <WaveformClipHeaders>')).toBe(true);
  });

  it('a warning is written once, and never in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnMisplacedPart('a message of this test alone');
    warnMisplacedPart('a message of this test alone');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[waveform-playlist] a message of this test alone');

    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      warnMisplacedPart('a message for production');
    } finally {
      process.env.NODE_ENV = before;
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('two controls parts in one root', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTrackControls />
        <WaveformTrackControls />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, 'more than one <WaveformTrackControls>')).toBe(true);
  });

  it.each([0, -20, Number.NaN])('a controls column of width %s', async (width) => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTrackControls width={width} />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformTrackControls width>')).toBe(true);
  });

  it('a positive width is not warned about', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTrackControls width={120} />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, '<WaveformTrackControls width>')).toBe(false);
  });

  it('a tracks part wrapped in another component, with a recording preview the root cannot see', async () => {
    const Wrapped = () => (
      <WaveformTracks>
        <WaveformRecordingPreview
          recordingState={{ isRecording: false } as WaveformRecordingState}
        />
      </WaveformTracks>
    );
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <Wrapped />
      </WaveformRoot>
    ));
    expect(warned(warn, 'disagree about <WaveformRecordingPreview>')).toBe(true);
  });

  it("a recording preview in a tracks part that is the root's own child is not warned about", async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks>
          <WaveformRecordingPreview
            recordingState={{ isRecording: false } as WaveformRecordingState}
          />
        </WaveformTracks>
      </WaveformRoot>
    ));
    expect(warned(warn, 'disagree')).toBe(false);
  });

  it("a recording preview in the MediaElement root's own tracks part is not warned about", async () => {
    const { warn } = await mountMediaElement(
      <MediaElementWaveformRoot>
        <WaveformTracks>
          <WaveformRecordingPreview
            recordingState={{ isRecording: false } as WaveformRecordingState}
          />
        </WaveformTracks>
      </MediaElementWaveformRoot>
    );
    expect(warned(warn, 'disagree')).toBe(false);
  });

  it('two tracks parts in one root', async () => {
    const { warn } = await mountMultitrack(() => (
      <WaveformRoot>
        <WaveformTracks />
        <WaveformTracks />
      </WaveformRoot>
    ));
    expect(warned(warn, 'more than one <WaveformTracks>')).toBe(true);
  });

  it('a controls part under the MediaElement root', async () => {
    const { warn } = await mountMediaElement(
      <MediaElementWaveformRoot>
        <WaveformTrackControls />
        <WaveformTracks />
      </MediaElementWaveformRoot>
    );
    expect(warned(warn, 'MediaElementWaveformRoot')).toBe(true);
    expect(controlsColumn()).toBeNull();
  });

  it('nothing is warned for the ready-made compositions', async () => {
    const { warn } = await mountMultitrack(() => <WaveformEditor />);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('<Waveform'))).toEqual([]);
  });
});
