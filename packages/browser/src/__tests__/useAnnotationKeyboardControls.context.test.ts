// @vitest-environment jsdom
//
// Regression test for the MediaElement path.
//
// useAnnotationKeyboardControls is a general-purpose annotation keyboard hook and
// must work WITHOUT a WaveformPlaylistProvider (e.g. inside MediaElementPlaylistProvider).
// A v11 refactor made it call usePlaylistData() unconditionally to read
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

const annotations = [
  { id: 'a', start: 0, end: 1, lines: ['one'] },
  { id: 'b', start: 1, end: 2, lines: ['two'] },
];

// Render the hook with NO WaveformPlaylistProvider and capture its return value.
function renderHookOutsideProvider(overrides: Record<string, unknown> = {}) {
  let api: ReturnType<typeof useAnnotationKeyboardControls> | undefined;
  function Harness() {
    api = useAnnotationKeyboardControls({
      annotations,
      activeAnnotationId: 'a',
      onAnnotationsChange: () => {},
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
