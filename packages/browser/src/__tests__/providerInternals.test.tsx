// @vitest-environment jsdom
//
// #769: the pieces both providers are built from. Each exists once, in
// `src/providerInternals`, and is tested here without a provider.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { AnnotationData } from '@waveform-playlist/core';
import { createAnnotationLookup } from '../utils/annotationLookup';
import { followAnnotations } from '../providerInternals/followAnnotations';
import { centrePlayhead } from '../providerInternals/useScrollFollow';
import { useScrollFollow } from '../providerInternals/useScrollFollow';
import { useFrameCallbacks } from '../providerInternals/useFrameCallbacks';
import { useAnnotationState } from '../providerInternals/useAnnotationState';
import { useViewDefaults, DEFAULT_CONTROLS } from '../providerInternals/useViewDefaults';

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a', start: 0, end: 1, lines: ['a'] },
  { id: 'b', start: 1, end: 2, lines: ['b'] },
  // a gap between 2 and 3
  { id: 'c', start: 3, end: 4, lines: ['c'] },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function step(options: {
  time: number;
  activeId: string | null;
  followOnly: boolean;
  holdHighlight?: boolean;
  annotations?: AnnotationData[];
}) {
  const setActiveAnnotationId = vi.fn();
  const reachedEnd = followAnnotations({
    annotations: options.annotations ?? ANNOTATIONS,
    lookup: createAnnotationLookup<AnnotationData>(),
    time: options.time,
    activeId: options.activeId,
    followOnly: options.followOnly,
    holdHighlight: options.holdHighlight ?? false,
    setActiveAnnotationId,
  });
  return { reachedEnd, setActiveAnnotationId };
}

describe('followAnnotations', () => {
  it('does nothing without annotations', () => {
    const { reachedEnd, setActiveAnnotationId } = step({
      time: 1.5,
      activeId: null,
      followOnly: false,
      annotations: [],
    });
    expect(reachedEnd).toBe(false);
    expect(setActiveAnnotationId).not.toHaveBeenCalled();
  });

  describe('follow only (continuous play)', () => {
    it('moves the highlight to the annotation under the playhead', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 1.5,
        activeId: 'a',
        followOnly: true,
      });
      expect(reachedEnd).toBe(false);
      expect(setActiveAnnotationId).toHaveBeenCalledExactlyOnceWith('b');
    });

    it('sets nothing while the playhead stays in the active annotation', () => {
      const { setActiveAnnotationId } = step({ time: 1.5, activeId: 'b', followOnly: true });
      expect(setActiveAnnotationId).not.toHaveBeenCalled();
    });

    it('clears the highlight in a gap and never reports an end', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 2.5,
        activeId: 'b',
        followOnly: true,
      });
      expect(reachedEnd).toBe(false);
      expect(setActiveAnnotationId).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('leaves the highlight alone when told to hold it', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 1.5,
        activeId: 'a',
        followOnly: true,
        holdHighlight: true,
      });
      expect(reachedEnd).toBe(false);
      expect(setActiveAnnotationId).not.toHaveBeenCalled();
    });
  });

  describe('stop at the end of the active annotation', () => {
    it('reports the end once the playhead reaches it', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 1,
        activeId: 'a',
        followOnly: false,
      });
      expect(reachedEnd).toBe(true);
      expect(setActiveAnnotationId).not.toHaveBeenCalled();
    });

    it('does not report an end before it', () => {
      expect(step({ time: 0.99, activeId: 'a', followOnly: false }).reachedEnd).toBe(false);
    });

    it('holding the highlight does not stop it reporting the end', () => {
      // The hold belongs to the follow-only branch: applied here it would skip
      // the stop that returns the cursor to where playback started (#727).
      const { reachedEnd } = step({
        time: 1,
        activeId: 'a',
        followOnly: false,
        holdHighlight: true,
      });
      expect(reachedEnd).toBe(true);
    });

    it('adopts the annotation under the playhead when none is active', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 3.5,
        activeId: null,
        followOnly: false,
      });
      expect(reachedEnd).toBe(false);
      expect(setActiveAnnotationId).toHaveBeenCalledExactlyOnceWith('c');
    });

    it('does nothing when the active id is not in the list', () => {
      const { reachedEnd, setActiveAnnotationId } = step({
        time: 3.5,
        activeId: 'gone',
        followOnly: false,
      });
      expect(reachedEnd).toBe(false);
      expect(setActiveAnnotationId).not.toHaveBeenCalled();
    });
  });
});

describe('centrePlayhead', () => {
  const container = (clientWidth: number) =>
    ({ clientWidth, scrollLeft: -1 }) as unknown as HTMLDivElement;

  it('scrolls so the playhead is in the middle, in whole pixels', () => {
    const element = container(301);
    // 10.013 s * 1000 Hz / 10 spp = 1001.3 px; minus 150.5 = 850.8
    centrePlayhead(element, 10.013, 1000, 10);
    expect(element.scrollLeft).toBe(851);
  });

  it('does not scroll before the start', () => {
    const element = container(400);
    centrePlayhead(element, 1, 1000, 10);
    expect(element.scrollLeft).toBe(0);
  });
});

describe('useScrollFollow', () => {
  it('starts from the given value and keeps ref and state together', () => {
    const { result } = renderHook(() => useScrollFollow(true));
    expect(result.current.isAutomaticScroll).toBe(true);
    expect(result.current.isAutomaticScrollRef.current).toBe(true);

    const before = result.current;
    act(() => {
      result.current.setAutomaticScroll(false);
      // Synchronously: a running loop reads the ref before the next render.
      expect(result.current.isAutomaticScrollRef.current).toBe(false);
    });
    expect(result.current.isAutomaticScroll).toBe(false);
    expect(result.current.setAutomaticScroll).toBe(before.setAutomaticScroll);
    expect(result.current.setScrollContainer).toBe(before.setScrollContainer);
    expect(result.current.scrollContainerRef).toBe(before.scrollContainerRef);
  });

  it('stores the scroll container in the ref', () => {
    const { result } = renderHook(() => useScrollFollow(false));
    const element = document.createElement('div');
    result.current.setScrollContainer(element);
    expect(result.current.scrollContainerRef.current).toBe(element);
    result.current.setScrollContainer(null);
    expect(result.current.scrollContainerRef.current).toBeNull();
  });
});

describe('useFrameCallbacks', () => {
  it('runs every registered callback with the frame data, in registration order', () => {
    const { result, rerender } = renderHook(() => useFrameCallbacks());
    const calls: string[] = [];
    const frame = { time: 1, visualTime: 0.9, sampleRate: 48000, samplesPerPixel: 1024 };
    result.current.registerFrameCallback('one', (data) => calls.push('one:' + data.visualTime));
    result.current.registerFrameCallback('two', (data) => calls.push('two:' + data.time));
    result.current.runFrameCallbacks(frame);
    expect(calls).toEqual(['one:0.9', 'two:1']);

    const before = result.current;
    rerender();
    expect(result.current.registerFrameCallback).toBe(before.registerFrameCallback);
    expect(result.current.unregisterFrameCallback).toBe(before.unregisterFrameCallback);
    expect(result.current.runFrameCallbacks).toBe(before.runFrameCallbacks);
  });

  it('stops calling an unregistered callback; the same id replaces', () => {
    const { result } = renderHook(() => useFrameCallbacks());
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    const frame = { time: 0, visualTime: 0, sampleRate: 1, samplesPerPixel: 1 };
    result.current.registerFrameCallback('id', first);
    result.current.registerFrameCallback('id', second);
    result.current.registerFrameCallback('other', other);
    result.current.unregisterFrameCallback('other');
    result.current.runFrameCallbacks(frame);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(frame);
    expect(other).not.toHaveBeenCalled();
  });
});

describe('useAnnotationState', () => {
  const PROVIDER = 'TestProvider';

  it('passes numeric annotations through and keeps the ref current', () => {
    const list = { annotations: ANNOTATIONS };
    const { result, rerender } = renderHook(
      ({ annotationList }) =>
        useAnnotationState({
          annotationList,
          onAnnotationsChange: undefined,
          providerName: PROVIDER,
        }),
      { initialProps: { annotationList: list } }
    );
    expect(result.current.annotations).toBe(ANNOTATIONS);
    expect(result.current.annotationsRef.current).toBe(ANNOTATIONS);

    const next = [ANNOTATIONS[0]];
    rerender({ annotationList: { annotations: next } });
    expect(result.current.annotations).toBe(next);
    expect(result.current.annotationsRef.current).toBe(next);
  });

  it('is an empty list without annotations, and for unparsed ones (with an error)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const none = renderHook(() =>
      useAnnotationState({
        annotationList: undefined,
        onAnnotationsChange: undefined,
        providerName: PROVIDER,
      })
    );
    expect(none.result.current.annotations).toEqual([]);
    expect(error).not.toHaveBeenCalled();

    const unparsed = {
      annotations: [
        { id: 'x', start: '0.0', end: '1.0', lines: [] },
      ] as unknown as AnnotationData[],
    };
    const bad = renderHook(() =>
      useAnnotationState({
        annotationList: unparsed,
        onAnnotationsChange: undefined,
        providerName: PROVIDER,
      })
    );
    expect(bad.result.current.annotations).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain('numeric start/end');
  });

  it('setAnnotations reports to the latest callback, value or updater, with a stable identity', () => {
    const first = vi.fn();
    const second = vi.fn();
    const list = { annotations: ANNOTATIONS };
    const { result, rerender } = renderHook(
      ({ onAnnotationsChange }) =>
        useAnnotationState({ annotationList: list, onAnnotationsChange, providerName: PROVIDER }),
      { initialProps: { onAnnotationsChange: first } }
    );
    const setAnnotations = result.current.setAnnotations;
    const preview = result.current.annotationPreview;

    const replaced = [ANNOTATIONS[1]];
    setAnnotations(replaced);
    expect(first).toHaveBeenCalledExactlyOnceWith(replaced);

    rerender({ onAnnotationsChange: second });
    setAnnotations((current) => current.slice(0, 2));
    expect(second).toHaveBeenCalledExactlyOnceWith(ANNOTATIONS.slice(0, 2));
    expect(first).toHaveBeenCalledTimes(1);
    expect(result.current.setAnnotations).toBe(setAnnotations);
    expect(result.current.annotationPreview).toBe(preview);
  });

  it('warns, naming the provider, when there is no callback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useAnnotationState({
        annotationList: { annotations: ANNOTATIONS },
        onAnnotationsChange: undefined,
        providerName: PROVIDER,
      })
    );
    result.current.setAnnotations([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('Pass onAnnotationsChange to TestProvider');
  });

  it('active annotation and continuous play: ref first, then state, stable setters', () => {
    const { result } = renderHook(() =>
      useAnnotationState({
        annotationList: { annotations: ANNOTATIONS, isContinuousPlay: true },
        onAnnotationsChange: undefined,
        providerName: PROVIDER,
      })
    );
    expect(result.current.continuousPlay).toBe(true);
    expect(result.current.continuousPlayRef.current).toBe(true);
    expect(result.current.activeAnnotationId).toBeNull();

    const before = result.current;
    act(() => {
      result.current.setActiveAnnotationId('b');
      expect(result.current.activeAnnotationIdRef.current).toBe('b');
      result.current.setContinuousPlay(false);
      expect(result.current.continuousPlayRef.current).toBe(false);
    });
    expect(result.current.activeAnnotationId).toBe('b');
    expect(result.current.continuousPlay).toBe(false);
    expect(result.current.setActiveAnnotationId).toBe(before.setActiveAnnotationId);
    expect(result.current.setContinuousPlay).toBe(before.setContinuousPlay);
    expect(result.current.annotationLookup).toBe(before.annotationLookup);
  });
});

describe('useViewDefaults', () => {
  const base = { barWidth: 2, barGap: 1, timescale: false } as const;

  it('fills the defaults', () => {
    const { result } = renderHook(() =>
      useViewDefaults({
        ...base,
        controls: undefined,
        theme: undefined,
        progressBarWidth: undefined,
      })
    );
    expect(result.current.controls).toBe(DEFAULT_CONTROLS);
    expect(result.current.progressBarWidth).toBe(3);
    expect(result.current.timeScaleHeight).toBe(0);
    expect(result.current.mergedTheme.playheadColor).toBeDefined();
  });

  it('keeps identities across renders with equal inline objects', () => {
    const { result, rerender } = renderHook(
      ({ width, color }) =>
        useViewDefaults({
          ...base,
          timescale: true,
          controls: { show: true, width },
          theme: { playheadColor: color },
          progressBarWidth: 7,
        }),
      { initialProps: { width: 200, color: 'red' } }
    );
    const first = result.current;
    expect(first.progressBarWidth).toBe(7);
    expect(first.timeScaleHeight).toBe(30);
    expect(first.mergedTheme.playheadColor).toBe('red');

    rerender({ width: 200, color: 'red' });
    expect(result.current.controls).toBe(first.controls);
    expect(result.current.mergedTheme).toBe(first.mergedTheme);

    rerender({ width: 250, color: 'blue' });
    expect(result.current.controls).toEqual({ show: true, width: 250 });
    expect(result.current.mergedTheme.playheadColor).toBe('blue');
  });
});
