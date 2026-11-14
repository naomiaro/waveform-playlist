// @vitest-environment jsdom
//
// #812: a clip in the app's `tracks` may name its audio (a `LoadingClip`), and
// `WaveformPlaylistProvider` loads it. This file: a source that settles after the first build,
// `onTracksChange`, a trim drag, and what is reported.
//
// The harness (`providerHarness.tsx`) mounts the real provider with a fake
// adapter, a `loadSource` whose calls stay pending until the test settles
// them, and a counter of `waveform-playlist:ready` events (one per FULL
// engine build).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  // Peaks are not the subject: a worker whose jobs never finish.
  createPeaksWorker: () => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  }),
}));

import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import type { AudioClip, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  SAMPLE_RATE,
  Probe,
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  loadingClip,
  loadingTrack,
  mount,
  plainClip,
  plainTrack,
  probe,
  ready,
  readyEvents,
  track,
  installProviderHarness,
  type FakeAdapter,
  type MountOptions,
} from './providerHarness';

installProviderHarness();

describe('a source that settles after the first build', () => {
  it('6: an appended track with a pending clip enters empty at once, is updated on settle, and undo is cleared', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();

    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/b.mp3')]);
    });
    expect(m.adapter.addTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.addTrack.mock.calls[0][0].id).toBe('b');
    expect(m.adapter.addTrack.mock.calls[0][0].clips).toEqual([]);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    // Precondition for the undo assertion below: the add can be undone.
    expect(probe.canUndo).toBe(true);
    await waitFor(() => expect(calls).toHaveLength(1));
    const tracksBefore = m.tracks();
    const mirroredBefore = m.onTracksChange.mock.calls.length;

    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });

    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.updateTrack.mock.calls[0][0]).toBe('b');
    expect(m.adapter.updateTrack.mock.calls[0][1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(probe.canUndo).toBe(false);
    // The arrival changed nothing in the app's state and was not mirrored.
    expect(m.tracks()).toBe(tracksBefore);
    expect(m.onTracksChange.mock.calls.length).toBe(mirroredBefore);
    // The view shows the resolved clip.
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);
  });
});

describe('an engine track nothing changed keeps its identity (review of #812)', () => {
  it('21: a pending loading clip added to a track that has clips does not rebuild; the arrival is a fill', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();
    const a = m.tracks()[0];

    await act(async () => {
      m.setTracks([{ ...a, clips: [...a.clips, loadingClip('late', '/late.mp3')] }]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    // Nothing at the moment of adding: the engine keeps running as it is.
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(m.adapter.updateTrack).not.toHaveBeenCalled();
    expect(m.adapter.addTrack).not.toHaveBeenCalled();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);

    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);
    const [id, updated] = m.adapter.updateTrack.mock.calls[0];
    expect(id).toBe('a');
    expect(updated.clips.map((clip) => clip.id)).toEqual(['a-clip', 'late']);
    expect(updated.clips[1].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('22: a parent that re-creates its track objects on every render causes no rebuild and no adapter call', async () => {
    const clipA = plainClip('a-clip');
    const clipB = plainClip('b-clip');
    const adapter = createFakeAdapter();
    const createAdapter = vi.fn(() => adapter as unknown as PlayoutAdapter);
    const Parent: React.FC = () => (
      <WaveformPlaylistProvider
        // New track objects and a new array on every render; the clips stay.
        tracks={[track('a', [clipA]), track('b', [clipB])]}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
      >
        <Probe />
      </WaveformPlaylistProvider>
    );
    const view = render(<Parent />);
    await ready();
    await flush();
    expect(readyEvents).toBe(1);
    const viewTracks = probe.timeline.tracks;

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        view.rerender(<Parent />);
      });
      await flush();
    }

    expect(readyEvents).toBe(1);
    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(adapter.addTrack).not.toHaveBeenCalled();
    expect(adapter.updateTrack).not.toHaveBeenCalled();
    expect(adapter.dispose).not.toHaveBeenCalled();
    expect(probe.timeline.tracks).toBe(viewTracks);
  });
});

describe('onTracksChange', () => {
  /** [a: a plain clip], ready, then [a, b: a loading clip that is pending]. */
  async function loadedPlusPending(over: Partial<LoadingClip> = {}, options: MountOptions = {}) {
    const held = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource: held.loadSource, ...options });
    await ready();
    const pendingClip = loadingClip('b-clip', '/b.mp3', over);
    await act(async () => {
      m.setTracks([m.tracks()[0], track('b', [pendingClip])]);
    });
    await waitFor(() => expect(held.calls).toHaveLength(1));
    return { m, calls: held.calls, pendingClip };
  }

  function adapterCalls(adapter: FakeAdapter) {
    return {
      setTracks: adapter.setTracks.mock.calls.length,
      addTrack: adapter.addTrack.mock.calls.length,
      updateTrack: adapter.updateTrack.mock.calls.length,
    };
  }

  it('7: a trim while another track loads hands the loading clip back, and feeding it back does nothing', async () => {
    const { m, calls, pendingClip } = await loadedPlusPending({ duration: 3 });
    // The pending clip is drawn as a placeholder, three seconds long.
    expect(probe.timeline.tracks[1].clips[0].durationSamples).toBe(3 * SAMPLE_RATE);
    const before = adapterCalls(m.adapter);
    const mirroredBefore = m.onTracksChange.mock.calls.length;

    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();

    // One call, with the trimmed clip and the loading clip still in place.
    expect(m.onTracksChange.mock.calls.length).toBe(mirroredBefore + 1);
    const handed = m.onTracksChange.mock.lastCall?.[0] as PlaylistTrack[];
    expect((handed[0].clips[0] as AudioClip).durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(handed[1].clips).toEqual([pendingClip]);
    expect(handed[1].clips[0]).toBe(pendingClip);
    // The app stored it (the mount helper does) and it came back as the prop:
    // no rebuild, no add; the one updateTrack is the engine's own for the trim.
    expect(m.tracks()).toBe(handed);
    expect(adapterCalls(m.adapter)).toEqual({ ...before, updateTrack: before.updateTrack + 1 });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('a');
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(probe.canUndo).toBe(true);
    // The view still draws the placeholder beside the trimmed clip.
    expect(probe.timeline.tracks[0].clips[0].durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(probe.timeline.tracks[1].clips[0].durationSamples).toBe(3 * SAMPLE_RATE);

    // The source then arrives through the normal path: the seed does not hide it.
    const buffer = fakeBuffer(4);
    await act(async () => {
      calls[0].resolve(buffer);
    });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('b');
    expect(m.adapter.updateTrack.mock.lastCall?.[1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('7b: the onTracksChange the timeline publishes strips placeholders and keeps the loading clip', async () => {
    const { m, pendingClip } = await loadedPlusPending({ duration: 3 });
    const published = probe.timeline.onTracksChange;
    // What a move of a trim sends: copies of the view's tracks.
    const copies = probe.timeline.tracks.map((t) => ({ ...t, clips: [...t.clips] }));
    expect(copies[1].clips[0].id).toBe('b-clip');
    expect(copies[1].clips[0]).not.toBe(pendingClip);

    await act(async () => {
      published?.(copies);
    });

    const handed = m.onTracksChange.mock.lastCall?.[0] as PlaylistTrack[];
    expect(handed[1].clips).toHaveLength(1);
    expect(handed[1].clips[0]).toBe(pendingClip);
    // And it keeps its identity while the app passes an inline callback.
    m.rerender();
    expect(probe.timeline.onTracksChange).toBe(published);
  });

  it('8: a source that settles during a drag is applied after the release, with no rebuild', async () => {
    const { m, calls } = await loadedPlusPending();
    const before = adapterCalls(m.adapter);

    probe.refs.isDraggingRef.current = true;
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await flush();
    // Held back while the drag is on; drawn already.
    expect(adapterCalls(m.adapter)).toEqual(before);
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);

    await act(async () => {
      probe.refs.isDraggingRef.current = false;
    });
    await flush();

    expect(adapterCalls(m.adapter)).toEqual({ ...before, updateTrack: before.updateTrack + 1 });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('b');
    expect(m.adapter.updateTrack.mock.lastCall?.[1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
  });

  it('8b: the same with moves of the trim before and after the arrival, and a release that trims', async () => {
    const { m, calls, pendingClip } = await loadedPlusPending();
    const before = adapterCalls(m.adapter);
    /** One pointer move of a trim of a-clip: copies of the view's tracks. */
    const move = async (durationSamples: number) => {
      const copies = probe.timeline.tracks.map((t, i) =>
        i === 0 ? { ...t, clips: t.clips.map((c) => ({ ...c, durationSamples })) } : t
      );
      await act(async () => {
        probe.timeline.onTracksChange?.(copies);
      });
    };

    probe.refs.isDraggingRef.current = true;
    await move(SAMPLE_RATE * 1.8);
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await move(SAMPLE_RATE * 1.5);
    // The view draws the arrived clip, but the app's state still names it as
    // loading: the engine does not hold it yet.
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);
    expect(m.tracks()[1].clips[0]).toBe(pendingClip);
    expect(adapterCalls(m.adapter)).toEqual(before);

    // The release, as useClipDragHandlers does it.
    await act(async () => {
      probe.refs.isDraggingRef.current = false;
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();

    const updates = m.adapter.updateTrack.mock.calls.slice(before.updateTrack);
    expect(updates.map(([id]) => id)).toEqual(['a', 'b']);
    expect(updates[1][1].clips[0].audioBuffer).toBe(buffer);
    expect(m.adapter.setTracks.mock.calls.length).toBe(before.setTracks);
    expect(readyEvents).toBe(1);
    expect(probe.timeline.tracks[0].clips[0].durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);

    // What the engine reported at the release was the baseline of that fill.
    // It is used once: an unrelated track appended next is an add, and `b` is
    // not updated (and undo not cleared) a second time.
    await act(async () => {
      m.setTracks([...m.tracks(), plainTrack('c')]);
    });
    await flush();
    const after = m.adapter.updateTrack.mock.calls.slice(before.updateTrack);
    expect(after.map(([id]) => id).filter((id) => id === 'b')).toHaveLength(1);
    expect(m.adapter.addTrack.mock.calls.length).toBe(before.addTrack + 1);
    expect(m.adapter.addTrack.mock.lastCall?.[0].id).toBe('c');
    expect(probe.canUndo).toBe(true);
    expect(readyEvents).toBe(1);
  });
});

describe('what is reported', () => {
  it('16: a loading clip on a MIDI track is rejected through onError, once per clip', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadSource } = heldLoadSource();
    const midi = track('m', [loadingClip('m-clip', '/m.mp3')], { kind: 'midi' });
    const m = mount([midi], { loadSource });
    await flush();
    m.rerender();
    await act(async () => {
      m.setTracks([{ ...midi }]);
    });
    await flush();
    // A second rejected clip makes the list of rejected clips a new one; the
    // first clip is the same object and is not reported again.
    const other = track('n', [loadingClip('n-clip', '/n.mp3')], { kind: 'midi' });
    await act(async () => {
      m.setTracks([midi, other]);
    });
    await flush();

    const about = (id: string) =>
      m.onError.mock.calls.filter(([error]) => error.message.includes(`"${id}"`));
    expect(about('m-clip')).toHaveLength(1);
    expect(about('m-clip')[0][0].message).toMatch(/MIDI/);
    expect(about('n-clip')).toHaveLength(1);
  });

  it('17: a placeholder is not warned about as a clip with no audio data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, loadSource } = heldLoadSource();
    mount([loadingTrack('a', '/a.mp3', { duration: 2 })], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(probe.timeline.tracks[0].clips).toHaveLength(1);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((text) => text.includes('no audio data'))).toEqual([]);
  });
});
