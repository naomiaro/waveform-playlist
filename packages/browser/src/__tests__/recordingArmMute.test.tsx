// @vitest-environment jsdom
//
// #812, the maintainer's QJ and QM. While a take records, the armed track is
// muted through the arrangement, so the mixer and its Mute button show it;
// the built-in Mute button of that track is disabled; and the mute from
// before the take is written back when the take ends or the armed track
// changes, whatever was set in between. `useTrack().isRecordingArmed` tells
// an app's own mute control. Nothing is written for a track that is gone.
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
import { useRecordingArm } from '../contexts/playlistContexts';
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
  recorder: React.ReactNode = <Recorder />
): Promise<ArrangementRender> {
  const view = renderWithArrangement(tracks, {
    children: (
      <>
        <Probe />
        {VIEW}
        {recorder}
      </>
    ),
  });
  await waitFor(() => expect(probe.isReady).toBe(true));
  return view;
}

const muted = (view: ArrangementRender, id: string) => view.arrangement.getMixer().get(id)?.muted;

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

describe('the armed track shows its mute during a take (QJ, QM)', () => {
  it("the armed track's mute button shows muted and is disabled during a take, and only that track's slot renders when the take starts", async () => {
    const view = await mount([makeTrack('a'), makeTrack('b'), makeTrack('c')]);
    expect(muteButtonOf('b').disabled).toBe(false);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('false');
    expect(seen.get('b')!.isRecordingArmed).toBe(false);
    const before = new Map(renders);
    const aValue = seen.get('a');
    const slotsBefore = layoutCounts.slots;

    act(() => probe.controls.setRecordingActive(true, 'b'));

    expect(muted(view, 'b')).toBe(true);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('true');
    expect(muteButtonOf('b').disabled).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(false);
    expect(muteButtonOf('c').disabled).toBe(false);
    expect(seen.get('b')!.isRecordingArmed).toBe(true);
    expect(renders.get('b')).toBe(before.get('b')! + 1);
    expect(renders.get('a')).toBe(before.get('a'));
    expect(renders.get('c')).toBe(before.get('c'));
    expect(seen.get('a')).toBe(aValue);
    // One slot rendered: b's (its mute and its arm change in one render).
    expect(layoutCounts.slots).toBe(slotsBefore + 1);

    // A click on the disabled button changes nothing.
    fireEvent.click(muteButtonOf('b'));
    expect(muted(view, 'b')).toBe(true);

    act(() => probe.controls.setRecordingActive(false));
    expect(muted(view, 'b')).toBe(false);
    expect(muteButtonOf('b').disabled).toBe(false);
    expect(muteButtonOf('b').getAttribute('aria-pressed')).toBe('false');
    expect(seen.get('b')!.isRecordingArmed).toBe(false);
  });

  it('the pre-take value is back when the take ends, also after arrangement.setTrackMute(id, false) during the take', async () => {
    const view = await mount([makeTrack('a', true), makeTrack('b')]);

    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(muted(view, 'a')).toBe(true);
    // The app unmutes the armed track during the take: overwritten at the end.
    act(() => view.arrangement.setTrackMute('a', false));
    expect(muted(view, 'a')).toBe(false);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(muted(view, 'a')).toBe(true);

    // The other way round: unmuted before, muted by the app during the take.
    act(() => setSession({ isRecording: true, trackId: 'b' }));
    act(() => view.arrangement.setTrackMute('b', true));
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(muted(view, 'b')).toBe(false);
  });

  it('changing the armed track mid-session restores the first and mutes the second', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b', true), makeTrack('c')]);

    // Through useRecordingSession: its effect ends the first session and starts the next.
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(muted(view, 'a')).toBe(true);
    act(() => setSession({ isRecording: true, trackId: 'c' }));
    expect(muted(view, 'a')).toBe(false);
    expect(muted(view, 'c')).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(false);
    expect(muteButtonOf('c').disabled).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(muted(view, 'c')).toBe(false);

    // Through setRecordingActive within one session: the first is written back first.
    act(() => probe.controls.setRecordingActive(true, 'a'));
    act(() => view.arrangement.setTrackMute('a', true));
    act(() => probe.controls.setRecordingActive(true, 'b'));
    expect(muted(view, 'a')).toBe(false);
    expect(muted(view, 'b')).toBe(true);
    expect(seen.get('a')!.isRecordingArmed).toBe(false);
    expect(seen.get('b')!.isRecordingArmed).toBe(true);
    act(() => probe.controls.setRecordingActive(false));
    // b was muted before it was armed.
    expect(muted(view, 'b')).toBe(true);
    expect(muteButtonOf('b').disabled).toBe(false);
  });

  it.each<[string, { undoable?: boolean }]>([
    ['an undoable removal', {}],
    ['a removal that is not an undo step', { undoable: false }],
  ])(
    'the armed track removed during a take (%s): the end of the take throws nothing and adds no mixer entry',
    async (_name, options) => {
      const view = await mount([makeTrack('a'), makeTrack('b')]);
      act(() => setSession({ isRecording: true, trackId: 'b' }));
      act(() => view.arrangement.removeTrack('b', options));
      const mixer = view.arrangement.getMixer();
      const version = view.arrangement.mixerVersion;
      const hadEntry = mixer.has('b');

      expect(() => act(() => setSession({ isRecording: false, trackId: null }))).not.toThrow();

      expect(view.arrangement.getMixer()).toBe(mixer);
      expect(view.arrangement.mixerVersion).toBe(version);
      expect(view.arrangement.getMixer().has('b')).toBe(hadEntry);
      if (options.undoable === false) expect(hadEntry).toBe(false);
    }
  );

  it('unmount during a take restores the value: of the recording component, and of the provider', async () => {
    const view = await mount([makeTrack('a'), makeTrack('b')]);
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    expect(muted(view, 'a')).toBe(true);
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
    expect(muted(view, 'a')).toBe(false);
    expect(muteButtonOf('a').disabled).toBe(false);

    const second = await mount([makeTrack('c')]);
    act(() => setSession({ isRecording: true, trackId: 'c' }));
    expect(muted(second, 'c')).toBe(true);
    await act(async () => {
      second.unmount();
    });
    // The arrangement outlives the provider.
    expect(muted(second, 'c')).toBe(false);
  });

  it('an <Activity> hide of the recording component restores the value; the reveal arms again from the value then', async () => {
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
    expect(muted(view, 'a')).toBe(true);

    act(() => setMode('hidden'));
    expect(muted(view, 'a')).toBe(false);
    expect(muteButtonOf('a').disabled).toBe(false);
    act(() => setMode('visible'));
    expect(muted(view, 'a')).toBe(true);
    expect(muteButtonOf('a').disabled).toBe(true);
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(muted(view, 'a')).toBe(false);

    // A mute set while the recording component is hidden is the value the
    // reveal arms from, so it is the one written back at the end.
    act(() => setSession({ isRecording: true, trackId: 'a' }));
    act(() => setMode('hidden'));
    act(() => view.arrangement.setTrackMute('a', true));
    act(() => setMode('visible'));
    act(() => setSession({ isRecording: false, trackId: null }));
    expect(muted(view, 'a')).toBe(true);
  });

  it('an app that never arms a track: nothing is disabled and every isRecordingArmed is false', async () => {
    await mount([makeTrack('a'), makeTrack('b')]);
    act(() => probe.controls.setRecordingActive(true));
    const buttons = screen.getAllByRole('button', { name: 'Mute' }) as HTMLButtonElement[];
    expect(buttons.every((b) => !b.disabled)).toBe(true);
    expect(seen.get('a')!.isRecordingArmed).toBe(false);
    expect(seen.get('b')!.isRecordingArmed).toBe(false);
  });
});

describe('the arm context is internal and WebAudio only', () => {
  it('is not exported from the package entry or `/tone`', async () => {
    for (const api of [await import('../index'), await import('../tone')]) {
      expect('useRecordingArm' in api).toBe(false);
      expect('RecordingArmContext' in api).toBe(false);
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
      useRecordingArm();
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
      'useRecordingArm needs WaveformPlaylistProvider, and the nearest playlist provider here ' +
        'is MediaElementPlaylistProvider, which does not provide it'
    );
  });
});
