// @vitest-environment jsdom
//
// #686: what a click on an annotation does, in the row of boxes and in the
// list. The hook is called here with the two context values it reads, so the
// arguments `play` is given can be asserted for both states of continuous
// play, and a failed start can be made to happen.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import {
  AnnotationOptionsContext,
  PlaybackControlsContext,
  type PlaybackControlsContextValue,
} from '../contexts/playlistContexts';
import { usePlayAnnotation } from '../hooks/usePlayAnnotation';

const ANNOTATION = { id: 'n2', start: 2, end: 3.5, lines: ['two'] };

function setup(initialContinuousPlay: boolean, play = vi.fn(() => Promise.resolve())) {
  const setActiveAnnotationId = vi.fn();
  const controls = { play, setActiveAnnotationId } as unknown as PlaybackControlsContextValue;
  let continuousPlay = initialContinuousPlay;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlaybackControlsContext.Provider value={controls}>
      <AnnotationOptionsContext.Provider
        value={{ editable: false, linkEndpoints: false, continuousPlay }}
      >
        {children}
      </AnnotationOptionsContext.Provider>
    </PlaybackControlsContext.Provider>
  );
  const view = renderHook(() => usePlayAnnotation(), { wrapper });
  return {
    play,
    setActiveAnnotationId,
    view,
    setContinuousPlay: (value: boolean) => {
      continuousPlay = value;
      view.rerender();
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePlayAnnotation (#686)', () => {
  it('continuous play off: makes the annotation active and plays its length', () => {
    const { play, setActiveAnnotationId, view } = setup(false);
    act(() => view.result.current(ANNOTATION));
    expect(setActiveAnnotationId).toHaveBeenCalledWith('n2');
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith(2, 1.5);
  });

  it('continuous play on: plays from the start with no end', () => {
    const { play, view } = setup(true);
    act(() => view.result.current(ANNOTATION));
    expect(play).toHaveBeenCalledWith(2, undefined);
  });

  it('is one function for the life of the component, and reads the option at the click', () => {
    const { play, view, setContinuousPlay } = setup(false);
    const first = view.result.current;
    setContinuousPlay(true);
    expect(view.result.current).toBe(first);
    act(() => first(ANNOTATION));
    expect(play).toHaveBeenLastCalledWith(2, undefined);
    setContinuousPlay(false);
    expect(view.result.current).toBe(first);
    act(() => first(ANNOTATION));
    expect(play).toHaveBeenLastCalledWith(2, 1.5);
  });

  it('a start that fails is reported as a warning that names the annotation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { view } = setup(
      false,
      vi.fn(() => Promise.reject(new Error('no audio')))
    );
    await act(async () => {
      view.result.current(ANNOTATION);
    });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('n2');
    expect(message).toContain('no audio');
  });
});
