// @vitest-environment jsdom
//
// #812: a clip whose audio is not loaded yet is drawn as a placeholder (from
// its `duration` or `waveformData`) and is absent from the engine. Nothing may
// edit it: it is drawn without dragging and trim handles, with
// `data-clip-placeholder="true"` on its container, and split never picks it.
// Another clip still stops at it (it is where the loaded clip will be).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import React from 'react';
import { useDragDropManager } from '@dnd-kit/react';

const counts = vi.hoisted(() => ({ clip: {} as Record<string, number> }));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clip[props.clipId] = (counts.clip[props.clipId] ?? 0) + 1;
      return createElement(actual.Clip, props);
    },
  };
});

import {
  fakeBuffer,
  flush,
  heldLoadSource,
  installProviderHarness,
  loadingClip,
  mount,
  plainClip,
  plainTrack,
  probe,
  ready,
  track,
  SAMPLE_RATE,
} from './providerHarness';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { WaveformEditor } from '../components/Waveform';
import { useClipSplitting } from '../hooks/useClipSplitting';
import { usePlaylistTimeline, usePlaylistZoom, useEngineRefs } from '../contexts/playlistContexts';
import type { PlaylistTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';

installProviderHarness();

/** What dnd-kit has registered, read from the manager of the nearest provider. */
let manager: ReturnType<typeof useDragDropManager> = null;
const ManagerProbe: React.FC = () => {
  manager = useDragDropManager();
  return null;
};

let splitting: ReturnType<typeof useClipSplitting> | null = null;
const SplitProbe: React.FC = () => {
  const { tracks } = usePlaylistTimeline();
  const { samplesPerPixel } = usePlaylistZoom();
  const { playoutRef } = useEngineRefs();
  splitting = useClipSplitting({ tracks, samplesPerPixel, engineRef: playoutRef });
  return null;
};

const VIEW = (
  <ClipInteractionProvider>
    <ManagerProbe />
    <SplitProbe />
    <WaveformEditor />
  </ClipInteractionProvider>
);

/** A track with a loaded clip at 0-2 s and a clip loading from `src` at 3-4 s. */
function mixedTrack(src: string): PlaylistTrack {
  return track('t1', [plainClip('real'), loadingClip('ph', src, { start: 3, duration: 1 })]);
}

function containerOfHeader(clipId: string): Element | null {
  return (
    document.querySelector(`[data-clip-id="${clipId}"]`)?.closest('[data-clip-container]') ?? null
  );
}

function draggablesOf(clipId: string) {
  const all = manager ? [...manager.registry.draggables] : [];
  return all.filter((d) => (d.data as { clipId?: string } | undefined)?.clipId === clipId);
}

/** Mounts with the loaded track first (the first build does not wait), then adds the loading clip. */
async function mountWithPlaceholder(src = '/ph.mp3') {
  const { calls, loadSource } = heldLoadSource();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const view = mount([plainTrack('t1')], { loadSource, children: VIEW });
  await ready();
  // `plainTrack('t1')` holds a clip with id 't1-clip'; the mixed track replaces it.
  act(() => view.setTracks([mixedTrack(src)]));
  await waitFor(() => expect(calls).toHaveLength(1));
  await waitFor(() => expect(document.querySelectorAll('[data-clip-container]')).toHaveLength(2));
  return { view, calls };
}

describe('a placeholder clip is drawn and cannot be edited', () => {
  it('carries data-clip-placeholder; the loaded clip does not', async () => {
    await mountWithPlaceholder();
    const marked = document.querySelectorAll('[data-clip-placeholder]');
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-clip-placeholder')).toBe('true');
    expect(marked[0].hasAttribute('data-clip-container')).toBe(true);
    const real = containerOfHeader('real');
    expect(real).not.toBeNull();
    expect(real!.hasAttribute('data-clip-placeholder')).toBe(false);
    expect(marked[0]).not.toBe(real);
  });

  it('starts no drag: every draggable of the placeholder is disabled, the loaded clip is enabled', async () => {
    await mountWithPlaceholder();
    // dnd-kit marks a registered handle at an unpredictable moment after mount.
    await waitFor(() => {
      const handle = document.querySelector('[data-clip-id="real"]');
      expect(handle?.getAttribute('aria-roledescription')).toBe('draggable');
      expect(handle?.getAttribute('aria-disabled')).toBe('false');
    });
    const placeholder = document.querySelector('[data-clip-placeholder="true"]')!;
    // No enabled draggable on or inside the placeholder (its own disabled move
    // draggable may mark the container with aria-disabled="true").
    expect(placeholder.querySelectorAll('[aria-disabled="false"]')).toHaveLength(0);
    expect(placeholder.getAttribute('aria-disabled')).not.toBe('false');
    // Its header is the presentational one: no drag handle id.
    expect(placeholder.querySelector('[data-clip-id]')).toBeNull();

    const ph = draggablesOf('ph');
    expect(ph.length).toBeGreaterThan(0);
    expect(ph.every((d) => d.disabled)).toBe(true);
    const real = draggablesOf('real');
    expect(real.some((d) => !d.disabled)).toBe(true);
  });

  it('has no trim handles; the loaded clip has both', async () => {
    await mountWithPlaceholder();
    expect(document.querySelectorAll('[data-boundary-edge][data-clip-id="real"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-boundary-edge][data-clip-id="ph"]')).toHaveLength(0);
    const placeholder = document.querySelector('[data-clip-placeholder="true"]')!;
    expect(placeholder.querySelectorAll('[data-boundary-edge]')).toHaveLength(0);
  });

  it('becomes an ordinary, draggable clip when its source loads', async () => {
    const { calls } = await mountWithPlaceholder();
    await act(async () => {
      calls[0].resolve(fakeBuffer(2));
    });
    await flush();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-clip-placeholder]')).toHaveLength(0)
    );
    expect(document.querySelectorAll('[data-boundary-edge][data-clip-id="ph"]')).toHaveLength(2);
    await waitFor(() => {
      const handle = document.querySelector('[data-clip-id="ph"]');
      expect(handle?.getAttribute('aria-roledescription')).toBe('draggable');
      expect(handle?.getAttribute('aria-disabled')).toBe('false');
    });
    expect(draggablesOf('ph').some((d) => !d.disabled)).toBe(true);
  });

  it('does not render when an unrelated source settles', async () => {
    const { calls, loadSource } = heldLoadSource();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = mount([plainTrack('t1')], { loadSource, children: VIEW });
    await ready();
    act(() =>
      view.setTracks([
        plainTrack('t1'),
        track('t2', [loadingClip('ph-a', '/a.mp3', { duration: 1 })]),
        track('t3', [loadingClip('ph-b', '/b.mp3', { duration: 1 })]),
      ])
    );
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-clip-placeholder="true"]')).toHaveLength(2)
    );
    await flush();
    const before = counts.clip['ph-a'];
    expect(before).toBeGreaterThan(0);

    const b = calls.find((c) => c.src === '/b.mp3')!;
    await act(async () => {
      b.resolve(fakeBuffer(1));
    });
    await flush();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-clip-placeholder="true"]')).toHaveLength(1)
    );
    // The control: the clip that loaded did render.
    expect(counts.clip['ph-b']).toBeGreaterThan(0);
    expect(counts.clip['ph-a']).toBe(before);
  });
});

describe('split skips a placeholder', () => {
  async function mountTwoTracks() {
    const { calls, loadSource } = heldLoadSource();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = mount([plainTrack('t1')], { loadSource, children: VIEW });
    await ready();
    act(() =>
      view.setTracks([
        plainTrack('t1'),
        // Under the playhead at 1 s, like the loaded clip of t1 (0-2 s).
        track('t2', [loadingClip('ph', '/ph.mp3', { duration: 2 })]),
      ])
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(document.querySelectorAll('[data-clip-container]')).toHaveLength(2));
    const engine = probe.refs.playoutRef.current as PlaylistEngine;
    expect(engine).not.toBeNull();
    const split = vi.spyOn(engine, 'splitClip');
    act(() => probe.controls.seekTo(1));
    return { split };
  }

  it('returns false and does not call the engine when the only clip under the playhead is a placeholder', async () => {
    const { split } = await mountTwoTracks();
    act(() => probe.editor.setSelectedTrackId('t2'));
    let result: boolean | undefined;
    act(() => {
      result = splitting!.splitClipAtPlayhead();
    });
    expect(result).toBe(false);
    expect(split).not.toHaveBeenCalled();

    let direct: boolean | undefined;
    act(() => {
      direct = splitting!.splitClipAt(1, 0, 1);
    });
    expect(direct).toBe(false);
    expect(split).not.toHaveBeenCalled();
  });

  it('splits the real clip of the selected track', async () => {
    const { split } = await mountTwoTracks();
    act(() => probe.editor.setSelectedTrackId('t1'));
    let result: boolean | undefined;
    act(() => {
      result = splitting!.splitClipAtPlayhead();
    });
    expect(result).toBe(true);
    expect(split).toHaveBeenCalledTimes(1);
    expect(split.mock.lastCall?.slice(0, 2)).toEqual(['t1', 't1-clip']);
    expect(split.mock.lastCall?.[2]).toBeGreaterThan(SAMPLE_RATE * 0.9);
  });

  it('picks the real clip when a placeholder overlaps it on the same track', async () => {
    const { calls, loadSource } = heldLoadSource();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = mount([plainTrack('t1')], { loadSource, children: VIEW });
    await ready();
    // The placeholder comes FIRST in the track, so a loop that does not skip
    // it picks it.
    act(() =>
      view.setTracks([
        track('t1', [loadingClip('ph', '/ph.mp3', { duration: 2 }), plainClip('t1-clip')]),
      ])
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(document.querySelectorAll('[data-clip-container]')).toHaveLength(2));
    const engine = probe.refs.playoutRef.current as PlaylistEngine;
    const split = vi.spyOn(engine, 'splitClip');
    act(() => probe.controls.seekTo(1));
    act(() => probe.editor.setSelectedTrackId('t1'));
    let result: boolean | undefined;
    act(() => {
      result = splitting!.splitClipAtPlayhead();
    });
    expect(result).toBe(true);
    expect(split).toHaveBeenCalledTimes(1);
    expect(split.mock.lastCall?.slice(0, 2)).toEqual(['t1', 't1-clip']);
  });
});
