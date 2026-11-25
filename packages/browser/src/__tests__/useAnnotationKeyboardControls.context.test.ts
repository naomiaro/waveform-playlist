// @vitest-environment jsdom
//
// Regression test for the MediaElement path.
//
// useAnnotationKeyboardControls is a general-purpose annotation keyboard hook and
// must work WITHOUT a WaveformPlaylistProvider (e.g. inside MediaElementPlaylistProvider).
// A v11 refactor made it call usePlaylistData() (since replaced, #768) unconditionally to read
// samplesPerPixel/sampleRate, which THROWS outside WaveformPlaylistProvider — crashing
// every MediaElement consumer that uses keyboard annotation controls.
//
// Rendered via react-dom/server because the throw happens during the render phase
// (no DOM needed; useKeyboardShortcuts only touches window inside an effect).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useAnnotationKeyboardControls } from '../hooks/useAnnotationKeyboardControls';
import { renderHook, act } from '@testing-library/react';
import { createAnnotationStore } from '@waveform-playlist/core';

const annotations = [
  { id: 'a', start: 0, end: 1, lines: ['one'] },
  { id: 'b', start: 1, end: 2, lines: ['two'] },
];

// Render the hook with NO WaveformPlaylistProvider and capture its return value.
function renderHookOutsideProvider(overrides: Record<string, unknown> = {}) {
  let api: ReturnType<typeof useAnnotationKeyboardControls> | undefined;
  function Harness() {
    api = useAnnotationKeyboardControls({
      store: createAnnotationStore(annotations),
      activeAnnotationId: 'a',
      duration: 10,
      linkEndpoints: false,
      // MediaElement consumers pass these explicitly (no WaveformPlaylist context):
      samplesPerPixel: 1000,
      sampleRate: 44100,
      ...overrides,
    });
    return null;
  }
  renderToString(createElement(Harness));
  return api!;
}

describe('useAnnotationKeyboardControls without WaveformPlaylistProvider (MediaElement path)', () => {
  it('does not throw during render when no WaveformPlaylistProvider is present', () => {
    expect(() => renderHookOutsideProvider()).not.toThrow();
  });

  it('navigation still works without the provider', () => {
    const onActiveAnnotationChange = vi.fn();
    const api = renderHookOutsideProvider({ onActiveAnnotationChange });
    api.selectNext();
    expect(onActiveAnnotationChange).toHaveBeenCalledWith('b');
  });
});

// #867: with a store, a boundary key finds the active annotation by id in the
// store's list as it is when the key is pressed.
describe('useAnnotationKeyboardControls with a store', () => {
  const list = () => [
    { id: 'a', start: 0, end: 1, lines: ['one'] },
    { id: 'b', start: 2, end: 3, lines: ['two'] },
  ];

  it('a key pressed in the same tick as an insert before the active annotation moves the active one', () => {
    const store = createAnnotationStore(list());
    const { result } = renderHook(() =>
      useAnnotationKeyboardControls({
        store,
        activeAnnotationId: 'b',
        duration: 10,
        linkEndpoints: false,
        samplesPerPixel: 1000,
        sampleRate: 44100,
      })
    );
    act(() => {
      store.update((c) => [{ id: 'x', start: 0.2, end: 0.5, lines: ['x'] }, ...c]);
      result.current.moveStartBoundary(0.01);
    });
    const byId = Object.fromEntries(store.getAnnotations().map((a) => [a.id, a]));
    expect(Object.keys(byId)).toEqual(['x', 'a', 'b']);
    expect(byId.b.start).toBeCloseTo(2.01, 5);
    expect(byId.a.start).toBe(0);
    expect(byId.x.start).toBe(0.2);
  });

  it('a key for an annotation that is no longer in the store does nothing', () => {
    const store = createAnnotationStore(list());
    const { result } = renderHook(() =>
      useAnnotationKeyboardControls({
        store,
        activeAnnotationId: 'b',
        duration: 10,
        linkEndpoints: false,
        samplesPerPixel: 1000,
        sampleRate: 44100,
      })
    );
    act(() => {
      store.update((c) => c.filter((a) => a.id !== 'b'));
      result.current.moveEndBoundary(0.01);
    });
    expect(store.getAnnotations().map((a) => a.id)).toEqual(['a']);
    expect(store.getAnnotations()[0].end).toBe(1);
  });

  it('navigation reads the store', () => {
    const store = createAnnotationStore(list());
    const onActiveAnnotationChange = vi.fn();
    const { result } = renderHook(() =>
      useAnnotationKeyboardControls({
        store,
        activeAnnotationId: 'a',
        onActiveAnnotationChange,
        duration: 10,
        linkEndpoints: false,
        samplesPerPixel: 1000,
        sampleRate: 44100,
      })
    );
    act(() => {
      store.update((c) => [...c, { id: 'c', start: 4, end: 5, lines: ['three'] }]);
    });
    result.current.selectLast();
    expect(onActiveAnnotationChange).toHaveBeenCalledWith('c');
  });
});
