// @vitest-environment jsdom
//
// #687: the control panel of a track is composed from pieces bound to that
// track. `<WaveformTrackControls>` renders its children once per track inside
// a per-track context; `useTrack()` reads it; `<DefaultTrackControls />` is
// what it renders when it has no children. The three props that switched
// things on (`renderTrackControls`, `onRemoveTrack`, `trackReordering`) are
// gone: a remove button or a reorder grip is drawn by being rendered.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { resetPartWarnings } from '../components/partWarnings';
import {
  SpectrogramIntegrationContext,
  type SpectrogramIntegration,
} from '../SpectrogramIntegrationContext';
const layoutCounts = vi.hoisted(() => ({ slots: 0 }));
vi.mock('../components/visualizationLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/visualizationLayout')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    // Rendered once per render of a track's slot.
    ControlSlot: (props: React.ComponentProps<typeof actual.ControlSlot>) => {
      layoutCounts.slots++;
      return createElement(actual.ControlSlot, props);
    },
  };
});

import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager } from '@dnd-kit/dom';
import * as api from '../index';
import {
  WaveformPlaylistProvider,
  MediaElementPlaylistProvider,
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  DefaultTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackPanSlider,
  TrackMenuButton,
  TrackReorderGrip,
  TrackRemoveButton,
  useTrack,
  usePlaylistMixer,
  usePlaylistTimeline,
  useSelectedTrackId,
  useEditorControls,
  type EditorControlsContextValue,
  type TrackContextValue,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string, over: Partial<ClipTrack> = {}): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
  return {
    id,
    name: 'Name ' + id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...over,
  } as ClipTrack;
}

function makeMidiTrack(id: string): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    midiNotes: [{ midi: 60, time: 0, duration: 0.5, velocity: 0.8 }],
  } as unknown as AudioClip;
  return { ...makeTrack(id), kind: 'midi', clips: [clip] } as ClipTrack;
}

interface FakeAdapter extends PlayoutAdapter {
  calls: Array<[string, string, unknown]>;
}

function createFakeAdapter(): FakeAdapter {
  const calls: Array<[string, string, unknown]> = [];
  return {
    calls,
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
    setTrackVolume: (id: string, value: number) => void calls.push(['volume', id, value]),
    setTrackMute: (id: string, value: boolean) => void calls.push(['mute', id, value]),
    setTrackSolo: (id: string, value: boolean) => void calls.push(['solo', id, value]),
    setTrackPan: (id: string, value: number) => void calls.push(['pan', id, value]),
    setLoop() {},
    dispose() {},
  } as unknown as FakeAdapter;
}

// What the pieces of each track saw, by track id.
const seen = new Map<string, TrackContextValue>();
const renders = new Map<string, number>();
/** A consumer's own element in the template. */
const Spy: React.FC = () => {
  const track = useTrack();
  seen.set(track.id, track);
  renders.set(track.id, (renders.get(track.id) ?? 0) + 1);
  return <span data-testid={'spy-' + track.id}>{track.name}</span>;
};

let probe: {
  isReady: boolean;
  trackStateCount: number;
  selectedTrackId: string | null;
  controls: EditorControlsContextValue;
};
// How often the template of each track was mounted.
const mounts = new Map<string, number>();
const MountSpy: React.FC = () => {
  const { id } = useTrack();
  React.useEffect(() => {
    mounts.set(id, (mounts.get(id) ?? 0) + 1);
  }, [id]);
  return null;
};
const Probe: React.FC = () => {
  const { isReady } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { selectedTrackId } = useSelectedTrackId();
  probe = {
    isReady,
    trackStateCount: trackStates.filter(Boolean).length,
    selectedTrackId,
    controls: useEditorControls(),
  };
  return null;
};

interface AppProps {
  tracks: ClipTrack[];
  controls: React.ReactElement;
  loading?: boolean;
  onTracksChange?: (tracks: ClipTrack[]) => void;
  spectrogram?: SpectrogramIntegration | null;
}

function mount(props: AppProps) {
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  let current = props;
  const App: React.FC<AppProps> = ({ tracks, controls, loading, onTracksChange, spectrogram }) => (
    <SpectrogramIntegrationContext.Provider value={spectrogram ?? null}>
      <WaveformPlaylistProvider
        tracks={tracks}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        deferEngineRebuild={loading}
        onTracksChange={onTracksChange}
      >
        <Probe />
        <WaveformRoot>
          {controls}
          <WaveformTracks />
        </WaveformRoot>
      </WaveformPlaylistProvider>
    </SpectrogramIntegrationContext.Provider>
  );
  const view = render(<App {...current} />);
  return {
    adapter,
    update: (next: Partial<AppProps>) => {
      current = { ...current, ...next };
      view.rerender(<App {...current} />);
    },
  };
}

async function ready() {
  await waitFor(() => expect(probe.isReady).toBe(true));
}

/** The slot of a track: the element the part draws around that track's template. */
function slotOf(id: string): HTMLElement {
  const spy = screen.getByTestId('spy-' + id);
  let node: HTMLElement | null = spy;
  while (node && !node.hasAttribute('data-track-controls')) node = node.parentElement;
  if (!node) throw new Error('no slot around the template of ' + id);
  return node;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  resetPartWarnings();
  seen.clear();
  renders.clear();
  mounts.clear();
});

const A = makeTrack('a');
const B = makeTrack('b');
const C = makeTrack('c');

describe('what the package exports', () => {
  it('has the pieces, the default panel and the hooks, and no SortableTrackControls', () => {
    for (const name of [
      'DefaultTrackControls',
      'TrackName',
      'TrackMuteButton',
      'TrackSoloButton',
      'TrackVolumeSlider',
      'TrackPanSlider',
      'TrackMenuButton',
      'TrackReorderGrip',
      'TrackRemoveButton',
      'useTrack',
      'useTrackReorderHandle',
    ]) {
      expect(api, name).toHaveProperty(name);
    }
    expect(api).not.toHaveProperty('SortableTrackControls');
  });
});

describe('<WaveformTrackControls> without children', () => {
  it('draws the default panel for every track: name, mute, solo, volume, pan', async () => {
    mount({ tracks: [A, B], controls: <WaveformTrackControls /> });
    await ready();
    expect(screen.getByText('Name a')).toBeTruthy();
    expect(screen.getByText('Name b')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Mute' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Solo' })).toHaveLength(2);
    expect(screen.getAllByRole('slider', { name: 'Volume' })).toHaveLength(2);
    expect(screen.getAllByRole('slider', { name: 'Pan' })).toHaveLength(2);
  });

  it('draws no remove button and no reorder grip: those are drawn by being rendered', async () => {
    mount({ tracks: [A, B], controls: <WaveformTrackControls /> });
    await ready();
    expect(screen.queryByTitle('Remove track')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move track up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Drag to reorder track' })).toBeNull();
  });

  it('is the same as <DefaultTrackControls /> written as the child', async () => {
    mount({ tracks: [A], controls: <WaveformTrackControls /> });
    await ready();
    const implicit = document.querySelector('[data-track-controls]')!.innerHTML;
    await act(async () => cleanup());
    mount({
      tracks: [A],
      controls: (
        <WaveformTrackControls>
          <DefaultTrackControls />
        </WaveformTrackControls>
      ),
    });
    await ready();
    const explicit = document.querySelector('[data-track-controls]')!.innerHTML;
    // styled-components class names are the same for the same components.
    expect(explicit).toBe(implicit);
  });
});

describe('<DefaultTrackControls> with children', () => {
  it('draws them inside the panel, after the pan slider, for every track', async () => {
    mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <DefaultTrackControls>
            <Spy />
          </DefaultTrackControls>
        </WaveformTrackControls>
      ),
    });
    await ready();
    const spy = screen.getByTestId('spy-b');
    const pan = within(slotOf('b')).getByRole('slider', { name: 'Pan' });
    // Same frame as the pan slider's wrapper, and after it.
    expect(spy.parentElement).toBe(pan.closest('label')!.parentElement);
    expect(pan.compareDocumentPosition(spy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(spy.textContent).toBe('Name b');
  });
});

describe('the template and useTrack()', () => {
  it('renders the children once per track, each inside its own track', async () => {
    mount({
      tracks: [A, B, C],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    expect([...seen.keys()]).toEqual(['a', 'b', 'c']);
    expect(document.querySelectorAll('[data-track-controls]')).toHaveLength(3);
    expect(seen.get('b')).toMatchObject({
      id: 'b',
      kind: 'audio',
      index: 1,
      name: 'Name b',
      muted: false,
      soloed: false,
      volume: 1,
      pan: 0,
      renderMode: 'waveform',
      isLoading: false,
      isSelected: false,
      isFirst: false,
      isLast: false,
      hasSpectrogram: false,
    });
    expect(seen.get('a')).toMatchObject({ index: 0, isFirst: true, isLast: false });
    expect(seen.get('c')).toMatchObject({ index: 2, isFirst: false, isLast: true });
  });

  it('has exactly the documented fields', async () => {
    mount({
      tracks: [A],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    expect(Object.keys(seen.get('a')!).sort()).toEqual(
      [
        'id',
        'kind',
        'index',
        'name',
        'muted',
        'soloed',
        'volume',
        'pan',
        'renderMode',
        'isLoading',
        'isSelected',
        'isFirst',
        'isLast',
        'hasSpectrogram',
        'setMuted',
        'setSoloed',
        'setVolume',
        'setPan',
        'select',
        'moveUp',
        'moveDown',
        'setRenderMode',
        'openSpectrogramSettings',
      ].sort()
    );
  });

  it('the actions are bound to the track: they tell the engine its id', async () => {
    const { adapter } = mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    act(() => {
      seen.get('b')!.setMuted(true);
      seen.get('b')!.setSoloed(true);
      seen.get('b')!.setVolume(0.5);
      seen.get('b')!.setPan(-1);
    });
    expect(adapter.calls).toEqual([
      ['mute', 'b', true],
      ['solo', 'b', true],
      ['volume', 'b', 0.5],
      ['pan', 'b', -1],
    ]);
    expect(seen.get('b')).toMatchObject({ muted: true, soloed: true, volume: 0.5, pan: -1 });
    expect(seen.get('a')).toMatchObject({ muted: false, soloed: false, volume: 1, pan: 0 });
  });

  it('a change of one track renders the pieces of that track only', async () => {
    mount({
      tracks: [A, B, C],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    const before = new Map(renders);
    const aBefore = seen.get('a');
    act(() => seen.get('b')!.setVolume(0.2));
    expect(renders.get('b')).toBe(before.get('b')! + 1);
    expect(renders.get('a')).toBe(before.get('a'));
    expect(renders.get('c')).toBe(before.get('c'));
    // Another track's value is the very same object.
    expect(seen.get('a')).toBe(aBefore);
  });

  it('the actions keep their identity when the state of their track changes', async () => {
    mount({
      tracks: [A],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    const before = seen.get('a')!;
    act(() => before.setMuted(true));
    const after = seen.get('a')!;
    expect(after).not.toBe(before);
    for (const action of [
      'setMuted',
      'setSoloed',
      'setVolume',
      'setPan',
      'select',
      'moveUp',
      'moveDown',
      'setRenderMode',
      'openSpectrogramSettings',
    ] as const) {
      expect(after[action], action).toBe(before[action]);
    }
  });

  it('select() selects the track, and isSelected follows for the two tracks concerned', async () => {
    mount({
      tracks: [A, B, C],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    act(() => seen.get('a')!.select());
    const before = new Map(renders);
    act(() => seen.get('b')!.select());
    expect(probe.selectedTrackId).toBe('b');
    expect(seen.get('a')!.isSelected).toBe(false);
    expect(seen.get('b')!.isSelected).toBe(true);
    expect(renders.get('c')).toBe(before.get('c'));
  });

  it('moveDown() and moveUp() reorder, and index, isFirst and isLast follow', async () => {
    let tracks = [A, B, C];
    const view = mount({
      tracks,
      onTracksChange: (next) => {
        tracks = next;
        view.update({ tracks });
      },
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    await act(async () => seen.get('a')!.moveDown());
    expect(tracks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(seen.get('a')).toMatchObject({ index: 1, isFirst: false, isLast: false });
    expect(seen.get('b')).toMatchObject({ index: 0, isFirst: true });
    await act(async () => seen.get('c')!.moveUp());
    expect(tracks.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(seen.get('a')).toMatchObject({ index: 2, isLast: true });
  });

  it('a track moved twice moves from where it is, not from where it was mounted', async () => {
    const D = makeTrack('d');
    let tracks = [A, B, C, D];
    const view = mount({
      tracks,
      onTracksChange: (next) => {
        tracks = next;
        view.update({ tracks });
      },
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    await act(async () => seen.get('b')!.moveDown());
    expect(tracks.map((t) => t.id)).toEqual(['a', 'c', 'b', 'd']);
    // From the middle to the middle: neither isFirst nor isLast changed.
    expect(seen.get('b')).toMatchObject({ index: 2, isFirst: false, isLast: false });
    await act(async () => seen.get('b')!.moveDown());
    expect(tracks.map((t) => t.id)).toEqual(['a', 'c', 'd', 'b']);
    await act(async () => seen.get('b')!.moveUp());
    await act(async () => seen.get('b')!.moveUp());
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a change of one track renders the slot of that track only', async () => {
    mount({ tracks: [A, B, C], controls: <WaveformTrackControls /> });
    await ready();
    layoutCounts.slots = 0;
    act(() => probe.controls.setTrackVolume('b', 0.2));
    expect(layoutCounts.slots).toBe(1);
  });

  it('the slots are mounted again after a reorder drag, and only then', async () => {
    mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <MountSpy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    expect([...mounts.entries()]).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
    act(() => probe.controls.setTrackMute('a', true));
    expect(mounts.get('a')).toBe(1);
    // What the interaction provider calls when a reorder drag ends.
    act(() => probe.controls.bumpTrackReorderEpoch());
    expect([...mounts.entries()]).toEqual([
      ['a', 2],
      ['b', 2],
    ]);
  });

  it('throws outside the controls part, and says where it belongs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Spy />)).toThrow(/useTrack.*<WaveformTrackControls>/);
    expect(() =>
      render(
        <WaveformPlaylistProvider tracks={[A]} createAdapter={createFakeAdapter}>
          <TrackMuteButton />
        </WaveformPlaylistProvider>
      )
    ).toThrow(/useTrack.*<WaveformTrackControls>/);
  });
});

describe('the template is compared with the previous one', () => {
  const Parent: React.FC<{ tick: number; onRemove?: (id: string) => void }> = ({ onRemove }) => (
    <WaveformPlaylistProvider tracks={PARENT_TRACKS} createAdapter={PARENT_ADAPTER}>
      <Probe />
      <WaveformRoot>
        <WaveformTrackControls>
          <div style={{ height: '100%' }}>
            <TrackName />
            <Spy />
            {onRemove ? <TrackRemoveButton onRemove={onRemove} /> : null}
          </div>
        </WaveformTrackControls>
        <WaveformTracks />
      </WaveformRoot>
    </WaveformPlaylistProvider>
  );
  const PARENT_TRACKS = [A, B];
  const parentAdapter = createFakeAdapter();
  const PARENT_ADAPTER = () => parentAdapter;

  it('children written inline do not render the panels when the parent renders', async () => {
    const view = render(<Parent tick={0} />);
    await ready();
    const before = new Map(renders);
    view.rerender(<Parent tick={1} />);
    view.rerender(<Parent tick={2} />);
    expect(renders.get('a')).toBe(before.get('a'));
    expect(renders.get('b')).toBe(before.get('b'));
  });

  it('a prop with a new identity is a new template: every panel renders', async () => {
    const view = render(<Parent tick={0} onRemove={() => {}} />);
    await ready();
    const before = new Map(renders);
    view.rerender(<Parent tick={1} onRemove={() => {}} />);
    expect(renders.get('a')).toBe(before.get('a')! + 1);
    expect(renders.get('b')).toBe(before.get('b')! + 1);
  });

  it('a prop with the same identity is the same template', async () => {
    const onRemove = () => {};
    const view = render(<Parent tick={0} onRemove={onRemove} />);
    await ready();
    const before = new Map(renders);
    view.rerender(<Parent tick={1} onRemove={onRemove} />);
    expect(renders.get('a')).toBe(before.get('a'));
  });

  it('a changed template is drawn', async () => {
    const view = render(<Parent tick={0} />);
    await ready();
    expect(screen.queryByTitle('Remove track')).toBeNull();
    view.rerender(<Parent tick={1} onRemove={() => {}} />);
    expect(screen.getAllByTitle('Remove track')).toHaveLength(2);
  });
});

describe('the pieces', () => {
  const PIECES = (
    <WaveformTrackControls>
      <Spy />
      <TrackName />
      <TrackMuteButton />
      <TrackSoloButton />
      <TrackVolumeSlider />
      <TrackPanSlider />
    </WaveformTrackControls>
  );

  it('show and change the state of their own track', async () => {
    const { adapter } = mount({ tracks: [A, B], controls: PIECES });
    await ready();
    const b = within(slotOf('b'));
    fireEvent.click(b.getByRole('button', { name: 'Mute' }));
    fireEvent.click(b.getByRole('button', { name: 'Solo' }));
    fireEvent.change(b.getByRole('slider', { name: 'Volume' }), { target: { value: '0.4' } });
    fireEvent.change(b.getByRole('slider', { name: 'Pan' }), { target: { value: '0.5' } });
    expect(adapter.calls).toEqual([
      ['mute', 'b', true],
      ['solo', 'b', true],
      ['volume', 'b', 0.4],
      ['pan', 'b', 0.5],
    ]);
    expect(b.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('true');
    expect(b.getByRole('button', { name: 'Solo' }).getAttribute('aria-pressed')).toBe('true');
    expect((b.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('0.4');
    expect((b.getByRole('slider', { name: 'Pan' }) as HTMLInputElement).value).toBe('0.5');
    const a = within(slotOf('a'));
    expect(a.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('false');
    expect((a.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('1');
  });

  it('are disabled while their track is loading, and the name falls back to the position', async () => {
    const view = mount({
      tracks: [makeTrack('a', { name: '' })],
      loading: true,
      controls: PIECES,
    });
    const mute = await screen.findByRole('button', { name: 'Mute' });
    expect(probe.trackStateCount).toBe(0);
    expect(seen.get('a')).toMatchObject({ isLoading: true, name: 'Track 1' });
    expect(mute).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', true);
    await act(async () => view.update({ loading: false }));
    await waitFor(() => expect(probe.trackStateCount).toBe(1));
    expect(seen.get('a')!.isLoading).toBe(false);
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', false);
  });

  it('two of the same piece stay in sync', async () => {
    mount({
      tracks: [A],
      controls: (
        <WaveformTrackControls>
          <TrackMuteButton />
          <TrackMuteButton />
        </WaveformTrackControls>
      ),
    });
    await ready();
    const [first, second] = screen.getAllByRole('button', { name: 'Mute' });
    fireEvent.click(first);
    expect(second.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(second);
    expect(first.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('a click in a panel', () => {
  it('selects the track, in a panel of the consumer as well', async () => {
    mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    fireEvent.click(screen.getByTestId('spy-b'));
    expect(probe.selectedTrackId).toBe('b');
    expect(slotOf('b').getAttribute('data-track-controls')).toBe('b');
  });

  it('on the remove button calls onRemove with the track id and does not select', async () => {
    const onRemove = vi.fn();
    mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <Spy />
          <DefaultTrackControls />
          <TrackRemoveButton onRemove={onRemove} />
        </WaveformTrackControls>
      ),
    });
    await ready();
    fireEvent.click(within(slotOf('b')).getByTitle('Remove track'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('b');
    expect(probe.selectedTrackId).toBeNull();
  });
});

describe('<TrackReorderGrip />', () => {
  const WITH_GRIP = (
    <WaveformTrackControls>
      <Spy />
      <DefaultTrackControls />
      <TrackReorderGrip />
    </WaveformTrackControls>
  );

  it('draws the grip and the two move buttons, disabled at the ends', async () => {
    mount({ tracks: [A, B, C], controls: WITH_GRIP });
    await ready();
    expect(screen.getAllByRole('button', { name: 'Drag to reorder track' })).toHaveLength(3);
    const up = (id: string) => within(slotOf(id)).getByRole('button', { name: 'Move track up' });
    const down = (id: string) =>
      within(slotOf(id)).getByRole('button', { name: 'Move track down' });
    expect(up('a')).toHaveProperty('disabled', true);
    expect(down('a')).toHaveProperty('disabled', false);
    expect(up('b')).toHaveProperty('disabled', false);
    expect(down('b')).toHaveProperty('disabled', false);
    expect(up('c')).toHaveProperty('disabled', false);
    expect(down('c')).toHaveProperty('disabled', true);
  });

  it('the move buttons reorder and do not select', async () => {
    let tracks = [A, B, C];
    const view = mount({
      tracks,
      onTracksChange: (next) => {
        tracks = next;
        view.update({ tracks });
      },
      controls: WITH_GRIP,
    });
    await ready();
    await act(async () => {
      fireEvent.click(within(slotOf('a')).getByRole('button', { name: 'Move track down' }));
    });
    expect(tracks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    await act(async () => {
      fireEvent.click(within(slotOf('c')).getByRole('button', { name: 'Move track up' }));
    });
    expect(tracks.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    fireEvent.click(within(slotOf('a')).getByRole('button', { name: 'Drag to reorder track' }));
    expect(probe.selectedTrackId).toBeNull();
  });

  it("registers the track's slot as the sortable item and the grip as its handle", async () => {
    const manager = new DragDropManager();
    const adapter = createFakeAdapter();
    render(
      <DragDropProvider manager={manager}>
        <WaveformPlaylistProvider tracks={[A, B]} createAdapter={() => adapter}>
          <Probe />
          <WaveformRoot>
            {WITH_GRIP}
            <WaveformTracks />
          </WaveformRoot>
        </WaveformPlaylistProvider>
      </DragDropProvider>
    );
    await ready();
    const source = manager.registry.draggables.get('track-reorder-b')!;
    expect(source).toBeDefined();
    expect(source.element).toBe(slotOf('b'));
    expect(source.handle).toBe(
      within(slotOf('b')).getByRole('button', { name: 'Drag to reorder track' })
    );
  });

  it('a second handle in one panel warns once, and one handle does not', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const about = () =>
      warn.mock.calls.filter((call) => String(call[0]).includes('more than one reorder handle'));
    mount({ tracks: [A, B], controls: WITH_GRIP });
    await ready();
    expect(about()).toHaveLength(0);
    await act(async () => cleanup());
    mount({
      tracks: [A, B],
      controls: (
        <WaveformTrackControls>
          <DefaultTrackControls />
          <TrackReorderGrip />
          <TrackReorderGrip />
        </WaveformTrackControls>
      ),
    });
    await ready();
    // Two tracks, one message.
    expect(about()).toHaveLength(1);
  });

  it('the move buttons are disabled while the track is loading', async () => {
    mount({ tracks: [A, B], loading: true, controls: WITH_GRIP });
    await screen.findAllByRole('button', { name: 'Mute' });
    expect(within(slotOf('a')).getByRole('button', { name: 'Move track down' })).toHaveProperty(
      'disabled',
      true
    );
    // Not the first track: only the loading disables this one.
    expect(within(slotOf('b')).getByRole('button', { name: 'Move track up' })).toHaveProperty(
      'disabled',
      true
    );
  });
});

describe('<TrackMenuButton />', () => {
  const settings: Array<{ open: boolean }> = [];
  const setTrackRenderMode = vi.fn();
  const spectrogram = {
    trackSpectrogramOverrides: new Map(),
    setTrackRenderMode,
    setTrackSpectrogramConfig: vi.fn(),
    registerSpectrogramCanvas: vi.fn(),
    unregisterSpectrogramCanvas: vi.fn(),
    renderMenuItems: (props: {
      renderMode: string;
      onRenderModeChange: (mode: 'waveform' | 'spectrogram' | 'both') => void;
      onOpenSettings: () => void;
    }) => [
      {
        id: 'mode',
        content: (
          <button onClick={() => props.onRenderModeChange('both')}>
            mode is {props.renderMode}
          </button>
        ),
      },
      { id: 'settings', content: <button onClick={props.onOpenSettings}>open settings</button> },
    ],
    SettingsModal: (props: { open: boolean }) => {
      settings.push({ open: props.open });
      return null;
    },
    getColorMap: () => new Uint8Array(0),
    getFrequencyScale: () => (f: number) => f,
  } as unknown as SpectrogramIntegration;

  const MENU = (
    <WaveformTrackControls>
      <Spy />
      <TrackMenuButton />
    </WaveformTrackControls>
  );

  it('draws nothing without a spectrogram integration', async () => {
    mount({ tracks: [A], controls: MENU });
    await ready();
    expect(screen.queryByRole('button', { name: 'Track menu' })).toBeNull();
    expect(seen.get('a')!.hasSpectrogram).toBe(false);
  });

  it('draws the menu for an audio track and nothing for a MIDI track', async () => {
    mount({ tracks: [A, makeMidiTrack('m')], controls: MENU, spectrogram });
    await ready();
    expect(within(slotOf('a')).getByRole('button', { name: 'Track menu' })).toBeTruthy();
    expect(within(slotOf('m')).queryByRole('button', { name: 'Track menu' })).toBeNull();
    expect(seen.get('a')!.hasSpectrogram).toBe(true);
    expect(seen.get('m')).toMatchObject({ kind: 'midi', hasSpectrogram: false });
  });

  it('its items set the render mode of the track and open its settings', async () => {
    settings.length = 0;
    setTrackRenderMode.mockClear();
    mount({ tracks: [A, B], controls: MENU, spectrogram });
    await ready();
    fireEvent.click(within(slotOf('b')).getByRole('button', { name: 'Track menu' }));
    fireEvent.click(screen.getByText('mode is waveform'));
    expect(setTrackRenderMode).toHaveBeenCalledWith('b', 'both');
    // The fake items do not close the menu: it is still open.
    fireEvent.click(screen.getByText('open settings'));
    expect(settings[settings.length - 1].open).toBe(true);
  });

  it('the default panel has the menu', async () => {
    mount({ tracks: [A], controls: <WaveformTrackControls />, spectrogram });
    await ready();
    expect(screen.getByRole('button', { name: 'Track menu' })).toBeTruthy();
  });

  it('draws nothing when the integration offers no menu items', async () => {
    const { renderMenuItems: _none, ...withoutMenu } = spectrogram;
    mount({ tracks: [A], controls: MENU, spectrogram: withoutMenu as SpectrogramIntegration });
    await ready();
    expect(screen.queryByRole('button', { name: 'Track menu' })).toBeNull();
    // The integration is there: the actions of useTrack() still work.
    expect(seen.get('a')!.hasSpectrogram).toBe(true);
  });

  it('renderMode is the mode the integration has for the track', async () => {
    const withOverride = {
      ...spectrogram,
      trackSpectrogramOverrides: new Map([['b', { renderMode: 'both' }]]),
    } as unknown as SpectrogramIntegration;
    mount({ tracks: [A, B], controls: MENU, spectrogram: withOverride });
    await ready();
    expect(seen.get('a')!.renderMode).toBe('waveform');
    expect(seen.get('b')!.renderMode).toBe('both');
    fireEvent.click(within(slotOf('b')).getByRole('button', { name: 'Track menu' }));
    expect(screen.getByText('mode is both')).toBeTruthy();
  });

  it('the actions reach the integration that is there now, not the one from the first render', async () => {
    setTrackRenderMode.mockClear();
    const later = vi.fn();
    const view = mount({ tracks: [A], controls: MENU, spectrogram });
    await ready();
    const before = seen.get('a')!;
    await act(async () =>
      view.update({ spectrogram: { ...spectrogram, setTrackRenderMode: later } })
    );
    // The action is the same function, and it calls the new integration.
    expect(seen.get('a')!.setRenderMode).toBe(before.setRenderMode);
    act(() => seen.get('a')!.setRenderMode('both'));
    expect(later).toHaveBeenCalledWith('a', 'both');
    expect(setTrackRenderMode).not.toHaveBeenCalled();
  });

  it('openSpectrogramSettings() without an integration opens nothing, also once one is there', async () => {
    settings.length = 0;
    const view = mount({
      tracks: [A],
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    act(() => seen.get('a')!.openSpectrogramSettings());
    await act(async () => view.update({ spectrogram }));
    expect(settings.length).toBeGreaterThan(0);
    expect(settings.every((call) => call.open === false)).toBe(true);
  });

  it('a panel of the consumer opens the settings and sets the mode through useTrack()', async () => {
    settings.length = 0;
    setTrackRenderMode.mockClear();
    mount({
      tracks: [A],
      spectrogram,
      controls: (
        <WaveformTrackControls>
          <Spy />
        </WaveformTrackControls>
      ),
    });
    await ready();
    act(() => seen.get('a')!.setRenderMode('spectrogram'));
    expect(setTrackRenderMode).toHaveBeenCalledWith('a', 'spectrogram');
    act(() => seen.get('a')!.openSpectrogramSettings());
    expect(settings[settings.length - 1].open).toBe(true);
  });
});

describe('the removed props', () => {
  it('are ignored when left in plain JavaScript: the default panel, no remove button, no grip', async () => {
    const renderTrackControls = vi.fn(() => <span>custom</span>);
    const Loose = WaveformTrackControls as unknown as React.FC<Record<string, unknown>>;
    mount({
      tracks: [A],
      controls: (
        <Loose renderTrackControls={renderTrackControls} onRemoveTrack={() => {}} trackReordering />
      ),
    });
    await ready();
    expect(renderTrackControls).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
    expect(screen.queryByTitle('Remove track')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Drag to reorder track' })).toBeNull();
  });
});

describe('under the MediaElement provider', () => {
  it('a piece throws the message of useTrack()', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playout = {
      on: () => () => {},
      addTrack: () => {},
      dispose: () => {},
      setOnPlaybackComplete: () => {},
    };
    expect(() =>
      render(
        <MediaElementPlaylistProvider
          track={{
            source: 'x.mp3',
            waveformData: WaveformData.create({
              version: 2,
              channels: 1,
              sample_rate: SAMPLE_RATE,
              samples_per_pixel: 256,
              bits: 8,
              length: 4,
              data: [0, 0, 0, 0, 0, 0, 0, 0],
            }),
          }}
          createPlayout={() => playout as never}
        >
          <TrackVolumeSlider />
        </MediaElementPlaylistProvider>
      )
    ).toThrow(/useTrack.*<WaveformTrackControls>/);
  });
});
