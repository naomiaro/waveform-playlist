// @vitest-environment jsdom
//
// #812, the maintainer's QJ and QM, and #843. While a take records, the
// track it records onto is muted by the arrangement (`setTrackRecording`),
// outside the history: `trackStates`, `useTrack().muted` and its
// Mute button show it muted, the built-in Mute button of that track is
// disabled, and `getMixer()` keeps the track's own mute, which nothing writes
// for the take. A mute changed during the take stays after it.
// `useTrack().isRecording` tells an app's own mute control. React records
// onto one track at a time, and the provider's cleanup clears the take's mute.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import WaveformData from 'waveform-data';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { renderWithArrangement, type ArrangementRender } from './helpers/arrangementProvider';
import { resetPartWarnings } from '../components/partWarnings';
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
import { useRecordingTrack } from '../contexts/playlistContexts';
import {
  MediaElementPlaylistProvider,
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  TrackMuteButton,
  useTrack,
  usePlaylistTimeline,
  useEditorControls,
  useRecordingSession,
  type EditorControlsContextValue,
  type TrackContextValue,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const RATE = 48000;

function makeTrack(id: string, muted = false): ArrangementTrack {
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
    muted,
    soloed: false,
    volume: 1,
    pan: 0,
  };
}

// What the panel of each track saw, and how often it rendered, by track id.
const seen = new Map<string, TrackContextValue>();
const renders = new Map<string, number>();
const Spy: React.FC = () => {
  const track = useTrack();
  seen.set(track.id, track);
  renders.set(track.id, (renders.get(track.id) ?? 0) + 1);
  return null;
};

let probe: { isReady: boolean; controls: EditorControlsContextValue };
const Probe: React.FC = () => {
  probe = { isReady: usePlaylistTimeline().isReady, controls: useEditorControls() };
  return null;
};

interface Session {
  isRecording: boolean;
  trackId: string | null;
}
let setSession: (next: Session) => void = () => {};
/** The component of an app that records: it calls useRecordingSession. */
const Recorder: React.FC = () => {
  const [session, set] = useState<Session>({ isRecording: false, trackId: null });
  setSession = set;
  useRecordingSession(session);
  return null;
};

const VIEW = (
  <WaveformRoot>
    <WaveformTrackControls>
      <Spy />
      <TrackMuteButton />
    </WaveformTrackControls>
    <WaveformTracks />
  </WaveformRoot>
);

async function mount(
  tracks: ArrangementTrack[],
  recorder: React.ReactNode = <Recorder />,
  wrapper?: React.ComponentType<{ children: React.ReactNode }>
): Promise<ArrangementRender> {
  const view = renderWithArrangement(tracks, {
    children: (
      <>
        <Probe />
        {VIEW}
        {recorder}
      </>
    ),
    wrapper,
  });
  await waitFor(() => expect(probe.isReady).toBe(true));
  return view;
}

/** The track's own mute, in the arrangement's mix (the take's mute is not in it). */
const stored = (view: ArrangementRender, id: string) => view.arrangement.getMixer().get(id)?.muted;
/** What the track's panel reports: its own mute or the take's mute. */
const reported = (id: string) => seen.get(id)!.muted;
const recordingIds = (view: ArrangementRender) => [...view.arrangement.recordingTrackIds];

/** The built-in Mute button in the panel of track `id`. */
function muteButtonOf(id: string): HTMLButtonElement {
  const button = screen
    .getAllByRole('button', { name: 'Mute' })
    .find((b) => b.closest('[data-track-controls]')?.getAttribute('data-track-controls') === id);
  if (!button) throw new Error('no Mute button for ' + id);
  return button as HTMLButtonElement;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  resetPartWarnings();
  seen.clear();
  renders.clear();
  setSession = () => {};
});

describe("the take's track shows as muted during a take (QJ, QM, #843)", () => {
  it("the take's track reports muted and getMixer keeps its own mute", async () => {
    const view = await mount([makeTrack('a'), makeTrack('b'), makeTrack('c')]);
    const writes = vi.spyOn(view.arrangement, 'setTrackMute');
    expect(muteButtonOf('b').disabled).toBe(false);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('false');
    expect(seen.get('b')!.isRecording).toBe(false);
    const before = new Map(renders);
    const aValue = seen.get('a');
    const slotsBefore = layoutCounts.slots;

    act(() => probe.controls.setRecordingActive(true, 'b'));

    expect(recordingIds(view)).toEqual(['b']);
    expect(reported('b')).toBe(true);
    // Rule (#843): the take's mute is not the mix; before, the mix itself was muted.
    expect(stored(view, 'b')).toBe(false);
    expect(writes).not.toHaveBeenCalled();
    expect(view.arrangement.canUndo).toBe(false);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('true');
    expect(muteButtonOf('b').disabled).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(false);
    expect(muteButtonOf('c').disabled).toBe(false);
    expect(seen.get('b')!.isRecording).toBe(true);
    expect(renders.get('b')).toBe(before.get('b')! + 1);
    expect(renders.get('a')).toBe(before.get('a'));
    expect(renders.get('c')).toBe(before.get('c'));
    expect(seen.get('a')).toBe(aValue);
    // One slot rendered: b's (its mute and its isRecording change in one render).
    expect(layoutCounts.slots).toBe(slotsBefore + 1);

    // A click on the disabled button changes nothing.
    fireEvent.click(muteButtonOf('b'));
    expect(stored(view, 'b')).toBe(false);
    expect(reported('b')).toBe(true);

    act(() => probe.controls.setRecordingActive(false));
    expect(recordingIds(view)).toEqual([]);
    expect(reported('b')).toBe(false);
    expect(stored(view, 'b')).toBe(false);
    expect(muteButtonOf('b').disabled).toBe(false);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('false');
    expect(seen.get('b')!.isRecording).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it('a track muted before the take reports muted during it and after it', async () => {
    const view = await mount([makeTrack('a', true)]);
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(reported('a')).toBe(true);
    expect(stored(view, 'a')).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(reported('a')).toBe(true);
    expect(stored(view, 'a')).toBe(true);
  });

  // Rule (#843): the take writes no mute, so nothing is written back at its
  // end. Before, the mute from before the take always came back.
  it('a mute changed during the take stays after it', async () => {
    const view = await mount([makeTrack('a', true), makeTrack('b')]);

    act(() => setSession({ isRecording: true, trackId: 'a' }));
    // The app unmutes the take's track during the take: it plays muted by the
    // take, and comes out of the take unmuted.
    act(() => view.arrangement.setTrackMute('a', false));
    expect(stored(view, 'a')).toBe(false);
    expect(reported('a')).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(stored(view, 'a')).toBe(false);
    expect(reported('a')).toBe(false);

    // The other way round: unmuted before, muted by the app during the take.
    act(() => setSession({ isRecording: true, trackId: 'b' }));
    act(() => view.arrangement.setTrackMute('b', true));
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(stored(view, 'b')).toBe(true);
    expect(reported('b')).toBe(true);
  });

  it("undo during a take does not end the take's mute", async () => {
    const view = await mount([makeTrack('a')]);
    act(() => probe.controls.setTrackVolume('a', 0.5));
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    act(() => probe.controls.undo());
    expect(seen.get('a')!.volume).toBe(1);
    expect(recordingIds(view)).toEqual(['a']);
    expect(reported('a')).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(reported('a')).toBe(false);
  });

  it("changing the take's track mid-session clears the first", async () => {
    const view = await mount([makeTrack('a'), makeTrack('b', true), makeTrack('c')]);

    // Through useRecordingSession: its effect ends the first session and starts the next.
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(reported('a')).toBe(true);
    act(() => setSession({ isRecording: true, trackId: 'c' }));
    expect(recordingIds(view)).toEqual(['c']);
    expect(reported('a')).toBe(false);
    expect(reported('c')).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(false);
    expect(muteButtonOf('c').disabled).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(recordingIds(view)).toEqual([]);
    expect(reported('c')).toBe(false);

    // Through setRecordingActive within one session: the first is cleared,
    // and a mute the app set on it meanwhile stays.
    act(() => probe.controls.setRecordingActive(true, 'a'));
    act(() => view.arrangement.setTrackMute('a', true));
    act(() => probe.controls.setRecordingActive(true, 'b'));
    expect(recordingIds(view)).toEqual(['b']);
    expect(reported('a')).toBe(true);
    expect(stored(view, 'a')).toBe(true);
    expect(reported('b')).toBe(true);
    expect(seen.get('a')!.isRecording).toBe(false);
    expect(seen.get('b')!.isRecording).toBe(true);
    act(() => probe.controls.setRecordingActive(false));
    // b was muted before the take recorded onto it.
    expect(reported('b')).toBe(true);
    expect(stored(view, 'b')).toBe(true);
    expect(muteButtonOf('b').disabled).toBe(false);
  });

  it('a track marked recording elsewhere (another arrangement user) is cleared when React records onto one', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')]);
    act(() => view.arrangement.setTrackRecording('a', true));
    expect(reported('a')).toBe(true);
    act(() => probe.controls.setRecordingActive(true, 'b'));
    expect(recordingIds(view)).toEqual(['b']);
    expect(reported('a')).toBe(false);
  });

  it.each<[string, { undoable?: boolean }]>([
    ['an undoable removal', {}],
    ['a removal that is not an undo step', { undoable: false }],
  ])(
    "the take's track removed during a take (%s): the end of the take throws nothing and adds no mixer entry",
    async (_name, options) => {
      const view = await mount([makeTrack('a'), makeTrack('b')]);
      act(() => setSession({ isRecording: true, trackId: 'b' }));
      act(() => view.arrangement.removeTrack('b', options));
      const mixer = view.arrangement.getMixer();
      const version = view.arrangement.mixerVersion;
      const hadEntry = mixer.has('b');

      expect(() => act(() => setSession({ isRecording: false, trackId: null }))).not.toThrow();

      expect(recordingIds(view)).toEqual([]);
      expect(view.arrangement.getMixer()).toBe(mixer);
      expect(view.arrangement.mixerVersion).toBe(version);
      expect(view.arrangement.getMixer().has('b')).toBe(hadEntry);
      if (options.undoable === false) expect(hadEntry).toBe(false);
    }
  );

  // Two things clear the take's mute when something goes away: the cleanup of
  // useRecordingSession (its component goes) and the provider's own cleanup
  // (the provider goes; the arrangement outlives it, F1).
  it("the recording component unmounting during a take clears the take's mute through its useRecordingSession cleanup; the provider stays", async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')]);
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(reported('a')).toBe(true);
    act(() =>
      view.update({
        children: (
          <>
            <Probe />
            {VIEW}
          </>
        ),
      })
    );
    expect(recordingIds(view)).toEqual([]);
    expect(reported('a')).toBe(false);
    expect(muteButtonOf('a').disabled).toBe(false);
  });

  it("the provider's cleanup clears a track marked directly (no useRecordingSession) and writes no mute", async () => {
    const view = await mount([makeTrack('a', true)], null);
    act(() => probe.controls.setRecordingActive(true, 'a'));
    act(() => view.arrangement.setTrackMute('a', false));
    const mutes = vi.spyOn(view.arrangement, 'setTrackMute');
    const takeMuteCalls = vi.spyOn(view.arrangement, 'setTrackRecording');
    await act(async () => {
      view.unmount();
    });
    // The arrangement outlives the provider: nothing is left recording, and the
    // mute the app set during the take stays (Rule (#843): before, the
    // provider wrote the mute from before the take back, `['a', true]`).
    expect(recordingIds(view)).toEqual([]);
    expect(stored(view, 'a')).toBe(false);
    expect(takeMuteCalls.mock.calls).toEqual([['a', false]]);
    expect(mutes).not.toHaveBeenCalled();
  });

  it("the provider unmounting with a useRecordingSession child clears the take's mute once", async () => {
    const view = await mount([makeTrack('c')]);
    act(() => setSession({ isRecording: true, trackId: 'c' }));
    expect(reported('c')).toBe(true);
    const takeMuteCalls = vi.spyOn(view.arrangement, 'setTrackRecording');
    await act(async () => {
      view.unmount();
    });
    expect(recordingIds(view)).toEqual([]);
    expect(takeMuteCalls.mock.calls).toEqual([['c', false]]);
  });

  it('StrictMode: setRecordingActive directly after mount still sets and clears once; a session started by useRecordingSession works too', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')], <Recorder />, React.StrictMode);
    const takeMuteCalls = vi.spyOn(view.arrangement, 'setTrackRecording');

    act(() => probe.controls.setRecordingActive(true, 'a'));
    expect(reported('a')).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(true);
    act(() => probe.controls.setRecordingActive(false));
    expect(reported('a')).toBe(false);
    expect(muteButtonOf('a').disabled).toBe(false);
    expect(takeMuteCalls.mock.calls).toEqual([
      ['a', true],
      ['a', false],
    ]);

    act(() => setSession({ isRecording: true, trackId: 'b' }));
    expect(reported('b')).toBe(true);
    expect(muteButtonOf('b').disabled).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(reported('b')).toBe(false);

    takeMuteCalls.mockClear();
    await act(async () => {
      view.unmount();
    });
    // Released already: the provider's cleanup clears nothing.
    expect(takeMuteCalls).not.toHaveBeenCalled();
  });

  it("an <Activity> hide of the provider during a take clears the take's mute once, and the reveal sets it again", async () => {
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Hideable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return <React.Activity mode={mode}>{children}</React.Activity>;
    };
    const view = await mount([makeTrack('a')], <Recorder />, Hideable);
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    const takeMuteCalls = vi.spyOn(view.arrangement, 'setTrackRecording');

    act(() => setMode('hidden'));
    expect(recordingIds(view)).toEqual([]);
    expect(takeMuteCalls.mock.calls).toEqual([['a', false]]);

    act(() => setMode('visible'));
    expect(recordingIds(view)).toEqual(['a']);
    expect(reported('a')).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(recordingIds(view)).toEqual([]);
    expect(reported('a')).toBe(false);
  });

  it("an <Activity> hide of the recording component clears the take's mute; the reveal sets it again", async () => {
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Hideable: React.FC = () => {
      const [mode, set] = useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return (
        <React.Activity mode={mode}>
          <Recorder />
        </React.Activity>
      );
    };
    const view = await mount([makeTrack('a')], <Hideable />);
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(reported('a')).toBe(true);

    act(() => setMode('hidden'));
    expect(reported('a')).toBe(false);
    expect(muteButtonOf('a').disabled).toBe(false);
    act(() => setMode('visible'));
    expect(reported('a')).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(reported('a')).toBe(false);

    // A mute set while the recording component is hidden stays after the take.
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    act(() => setMode('hidden'));
    act(() => view.arrangement.setTrackMute('a', true));
    act(() => setMode('visible'));
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(stored(view, 'a')).toBe(true);
    expect(reported('a')).toBe(true);
  });

  it('an app that never records onto a track: nothing is disabled, nothing is recording and every isRecording is false', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')]);
    act(() => probe.controls.setRecordingActive(true));
    const buttons = screen.getAllByRole('button', { name: 'Mute' }) as HTMLButtonElement[];
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(recordingIds(view)).toEqual([]);
    expect(seen.get('a')!.isRecording).toBe(false);
    expect(seen.get('b')!.isRecording).toBe(false);
  });
});

describe('the recording-track context is internal and WebAudio only', () => {
  it('is not exported from the package entry or `/tone`', async () => {
    for (const api of [await import('../index'), await import('../tone')]) {
      expect('useRecordingTrack' in api).toBe(false);
      expect('RecordingTrackContext' in api).toBe(false);
    }
  });

  it('the MediaElement provider blocks it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playout = {
      on: () => () => {},
      addTrack: () => {},
      dispose: () => {},
      setOnPlaybackComplete: () => {},
    };
    const Reader: React.FC = () => {
      useRecordingTrack();
      return null;
    };
    expect(() =>
      render(
        <MediaElementPlaylistProvider
          track={{
            source: 'x.mp3',
            waveformData: WaveformData.create({
              version: 2,
              channels: 1,
              sample_rate: RATE,
              samples_per_pixel: 256,
              bits: 8,
              length: 4,
              data: [0, 0, 0, 0, 0, 0, 0, 0],
            }),
          }}
          createPlayout={() => playout as never}
        >
          <Reader />
        </MediaElementPlaylistProvider>
      )
    ).toThrow(
      'useRecordingTrack needs WaveformPlaylistProvider, and the nearest playlist provider here ' +
        'is MediaElementPlaylistProvider, which does not provide it'
    );
  });
});
