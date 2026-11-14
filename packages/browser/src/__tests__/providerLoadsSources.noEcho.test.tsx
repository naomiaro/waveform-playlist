// @vitest-environment jsdom
//
// #812: a change the provider applies FROM its own `tracks` prop is never
// echoed back through `onTracksChange`. The app already holds what it passed
// in; `onTracksChange` is for changes that originate in the engine (move,
// trim, split, undo, redo, reorder).
//
// Until this rule covered added tracks too, the provider answered a track the
// app appended by handing the app an array built from the tracks of the last
// render. An app that stores that array with a plain setter lost any append it
// had queued in between (found on /examples/waveform-data, which appends one
// track per peaks file from promise callbacks: 2, 4 and 3 rows of 4).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: () => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  }),
}));

import { render, act, waitFor } from '@testing-library/react';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import type { AudioClip, PlaylistTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  SAMPLE_RATE,
  Probe,
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  loadingTrack,
  mount,
  plainTrack,
  probe,
  ready,
  readyEvents,
  installProviderHarness,
} from './providerHarness';

installProviderHarness();

const NOT_SET = 'onTracksChange prop is not set';

function warningsAbout(warn: { mock: { calls: unknown[][] } }, text: string): string[] {
  return warn.mock.calls.map((call) => String(call[0])).filter((message) => message.includes(text));
}

describe('a track the app adds is not echoed back', () => {
  it('a: an append queued before the provider has applied the previous one is not lost', async () => {
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    const base = plainTrack('base');
    const a = plainTrack('a');
    const b = plainTrack('b');
    let appTracks: PlaylistTrack[] = [];
    let append: (track: PlaylistTrack) => void = () => {};

    const App: React.FC = () => {
      const [tracks, setTracks] = useState<PlaylistTrack[]>([base]);
      appTracks = tracks;
      append = (track) => setTracks((prev) => [...prev, track]);
      // The second append, as a promise callback on a page makes it: it is
      // queued after the render that holds `a` was committed and BEFORE the
      // provider's effect has handed `a` to the engine (a layout effect runs
      // between the two, in every run).
      const appended = useRef(false);
      useLayoutEffect(() => {
        if (appended.current || !tracks.includes(a)) return;
        appended.current = true;
        setTracks((prev) => [...prev, b]);
      }, [tracks]);
      return (
        <WaveformPlaylistProvider
          tracks={tracks}
          // A plain setter: it stores whatever the provider hands it.
          onTracksChange={setTracks}
          sampleRate={SAMPLE_RATE}
          createAdapter={createAdapter}
        >
          <Probe />
        </WaveformPlaylistProvider>
      );
    };

    render(<App />);
    await ready();
    await act(async () => {
      append(a);
    });
    await flush();

    expect(appTracks.map((t) => t.id)).toEqual(['base', 'a', 'b']);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['base', 'a', 'b']);
    expect(adapter.addTrack.mock.calls.map(([t]) => t.id)).toEqual(['a', 'b']);
    expect(readyEvents).toBe(1);
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('b: onTracksChange is not called for an added track or for its arrival; it is for a trim, with every track', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();

    // A decoded track.
    await act(async () => {
      m.setTracks([...m.tracks(), plainTrack('b')]);
    });
    // A track with a pending loading clip.
    const loading = loadingTrack('c', '/c.mp3');
    await act(async () => {
      m.setTracks([...m.tracks(), loading]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(m.adapter.addTrack.mock.calls.map(([t]) => t.id)).toEqual(['b', 'c']);
    expect(m.onTracksChange).not.toHaveBeenCalled();

    // The source arrives.
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('c');
    expect(m.onTracksChange).not.toHaveBeenCalled();

    // An edit that originates in the engine is reported, with all tracks.
    const fourth = loadingTrack('d', '/d.mp3');
    await act(async () => {
      m.setTracks([...m.tracks(), fourth]);
    });
    expect(m.onTracksChange).not.toHaveBeenCalled();
    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    expect(m.onTracksChange).toHaveBeenCalledTimes(1);
    const handed = m.onTracksChange.mock.calls[0][0];
    expect(handed.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect((handed[0].clips[0] as AudioClip).durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect((handed[2].clips[0] as AudioClip).audioBuffer).toBeDefined();
    // The clip that is still loading comes back as the app's loading clip.
    expect(handed[3].clips[0]).toBe(fourth.clips[0]);
    expect(readyEvents).toBe(1);
  });

  it('c: with no onTracksChange prop, a track the app adds or removes warns about nothing; a trim still warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    const ui = (tracks: PlaylistTrack[]) => (
      <WaveformPlaylistProvider
        tracks={tracks}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
      >
        <Probe />
      </WaveformPlaylistProvider>
    );
    const a = plainTrack('a');
    const view = render(ui([a]));
    await ready();

    await act(async () => {
      view.rerender(ui([a, plainTrack('b')]));
    });
    await flush();
    expect(adapter.addTrack).toHaveBeenCalledTimes(1);
    expect(warningsAbout(warn, NOT_SET)).toEqual([]);

    // The app empties its timeline: the engine is kept and told, not echoed.
    await act(async () => {
      view.rerender(ui([]));
    });
    await flush();
    expect(warningsAbout(warn, NOT_SET)).toEqual([]);

    // (Not `ready()` here: after an emptied timeline `isReady` stays false, #798.)
    await act(async () => {
      view.rerender(ui([a]));
    });
    await flush();
    expect(adapter.addTrack).toHaveBeenCalledTimes(2);
    expect(warningsAbout(warn, NOT_SET)).toEqual([]);
    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    expect(warningsAbout(warn, NOT_SET)).toHaveLength(1);
  });

  it('c2: the app emptying its timeline is not echoed either', async () => {
    const m = mount([plainTrack('a')]);
    await ready();
    // An add first, so the engine is one the provider keeps when it is emptied.
    await act(async () => {
      m.setTracks([...m.tracks(), plainTrack('b')]);
    });
    await act(async () => {
      m.setTracks([]);
    });
    await flush();
    expect(m.adapter.setTracks.mock.lastCall?.[0]).toEqual([]);
    expect(m.onTracksChange).not.toHaveBeenCalled();
    expect(probe.timeline.tracks).toEqual([]);
    expect(readyEvents).toBe(1);
  });

  it('d: tracks merged from a fixed list and state: an appended track is one addTrack and no rebuild', async () => {
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    const FIXED = [plainTrack('fixed-1'), plainTrack('fixed-2')];
    const fixedIds = new Set(FIXED.map((t) => t.id));
    let append: (track: PlaylistTrack) => void = () => {};
    const App: React.FC = () => {
      const [own, setOwn] = useState<PlaylistTrack[]>([]);
      append = (track) => setOwn((prev) => [...prev, track]);
      const tracks = useMemo(() => [...FIXED, ...own], [own]);
      return (
        <WaveformPlaylistProvider
          tracks={tracks}
          // Stores only what is not in the fixed list.
          onTracksChange={(next) => setOwn(next.filter((t) => !fixedIds.has(t.id)))}
          sampleRate={SAMPLE_RATE}
          createAdapter={createAdapter}
        >
          <Probe />
        </WaveformPlaylistProvider>
      );
    };
    render(<App />);
    await ready();
    expect(readyEvents).toBe(1);

    await act(async () => {
      append(plainTrack('dropped-1'));
    });
    await flush();
    expect(readyEvents).toBe(1);
    expect(adapter.addTrack.mock.calls.map(([t]) => t.id)).toEqual(['dropped-1']);

    await act(async () => {
      append(plainTrack('dropped-2'));
    });
    await flush();
    expect(readyEvents).toBe(1);
    expect(adapter.addTrack.mock.calls.map(([t]) => t.id)).toEqual(['dropped-1', 'dropped-2']);
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).not.toHaveBeenCalled();
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual([
      'fixed-1',
      'fixed-2',
      'dropped-1',
      'dropped-2',
    ]);
  });

  it('e: after an add with no echo, a trim of the added track is reported once and stored with no rebuild; the next add is one addTrack', async () => {
    const m = mount([plainTrack('a')]);
    await ready();
    const added = plainTrack('b');
    await act(async () => {
      m.setTracks([...m.tracks(), added]);
    });
    // The app keeps ITS track object; the engine holds its own copy of it.
    expect(m.tracks()[1]).toBe(added);
    expect(m.onTracksChange).not.toHaveBeenCalled();

    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('b', 'b-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();
    expect(m.onTracksChange).toHaveBeenCalledTimes(1);
    const handed = m.onTracksChange.mock.calls[0][0];
    expect(m.tracks()).toBe(handed);
    expect((handed[1].clips[0] as AudioClip).durationSamples).toBe(SAMPLE_RATE * 1.5);
    // Only the trim's own update; no rebuild, no add.
    expect(m.adapter.updateTrack.mock.calls.map(([id]) => id)).toEqual(['b']);
    expect(m.adapter.addTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(readyEvents).toBe(1);

    await act(async () => {
      m.setTracks([...m.tracks(), plainTrack('c')]);
    });
    await flush();
    expect(m.adapter.addTrack.mock.calls.map(([t]) => t.id)).toEqual(['b', 'c']);
    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(readyEvents).toBe(1);
    expect(m.onTracksChange).toHaveBeenCalledTimes(1);
  });

  it('g: a track the app added can be undone; the undo is the engine`s change and is reported', async () => {
    const m = mount([plainTrack('a')]);
    await ready();
    expect(probe.canUndo).toBe(false);
    await act(async () => {
      m.setTracks([...m.tracks(), plainTrack('b')]);
    });
    // As before this change: the engine's addTrack is an undo step.
    expect(probe.canUndo).toBe(true);
    expect(m.onTracksChange).not.toHaveBeenCalled();

    await act(async () => {
      probe.editor.undo();
    });
    await flush();
    // The engine removed the track; the app is told and stores it.
    expect(m.onTracksChange).toHaveBeenCalledTimes(1);
    expect(m.onTracksChange.mock.calls[0][0].map((t) => t.id)).toEqual(['a']);
    expect(m.tracks().map((t) => t.id)).toEqual(['a']);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['a']);
    expect(readyEvents).toBe(1);
    expect(probe.canUndo).toBe(false);
  });
});
