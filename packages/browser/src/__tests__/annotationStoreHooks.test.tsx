// @vitest-environment jsdom
//
// The two annotation store hooks, without a provider: one store per
// component, and a reader that follows it (#867).
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import type {
  AnnotationData,
  AnnotationStore,
  AnnotationStoreOptions,
} from '@waveform-playlist/core';
import { useCreateAnnotationStore } from '../hooks/useCreateAnnotationStore';
import { useStoredAnnotations } from '../hooks/useStoredAnnotations';

const note = (id: string, start = 0, end = 1): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useCreateAnnotationStore', () => {
  it('returns the same store on every render', () => {
    const seen: AnnotationStore[] = [];
    const Probe: React.FC<{ init: () => AnnotationData[] }> = ({ init }) => {
      seen.push(useCreateAnnotationStore(init));
      return null;
    };
    const { rerender } = render(<Probe init={() => [note('a')]} />);
    rerender(<Probe init={() => [note('b')]} />);
    expect(seen.length).toBe(2);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[0].getAnnotations().map((a) => a.id)).toEqual(['a']);
  });

  it('reads init once per store', () => {
    const init = vi.fn(() => [note('a')]);
    const Probe = () => {
      useCreateAnnotationStore(init);
      return null;
    };
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('under StrictMode returns one store whose updates render', () => {
    let store: AnnotationStore | null = null;
    const Probe = () => {
      const created = useCreateAnnotationStore(() => [note('a')]);
      store = created;
      const list = useStoredAnnotations(created);
      return <div data-testid="ids">{list.map((a) => a.id).join(',')}</div>;
    };
    const { getByTestId } = render(
      <StrictMode>
        <Probe />
      </StrictMode>
    );
    act(() => {
      store!.update((c) => [...c, note('b', 2, 3)]);
    });
    expect(getByTestId('ids').textContent).toBe('a,b');
  });

  it('calls the beforeChange of the latest committed render', () => {
    let store: AnnotationStore | null = null;
    const Probe: React.FC<{ options: AnnotationStoreOptions }> = ({ options }) => {
      store = useCreateAnnotationStore(() => [note('a')], options);
      return null;
    };
    const refuse: AnnotationStoreOptions = { beforeChange: (_next, current) => current };
    const accept: AnnotationStoreOptions = { beforeChange: (next) => next };
    const { rerender } = render(<Probe options={refuse} />);
    store!.set([note('refused')]);
    expect(store!.getAnnotations().map((a) => a.id)).toEqual(['a']);
    rerender(<Probe options={accept} />);
    store!.set([note('accepted')]);
    expect(store!.getAnnotations().map((a) => a.id)).toEqual(['accepted']);
  });

  it('a throw from init reaches the nearest error boundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
      state = { error: null as Error | null };
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      render() {
        return this.state.error ? (
          <div data-testid="caught">{this.state.error.name}</div>
        ) : (
          this.props.children
        );
      }
    }
    const Probe = () => {
      useCreateAnnotationStore(() => [note('x'), note('x')]);
      return null;
    };
    const { getByTestId } = render(
      <Boundary>
        <Probe />
      </Boundary>
    );
    expect(getByTestId('caught').textContent).toBe('TypeError');
  });
});

describe('useStoredAnnotations', () => {
  it("returns the store's array and re-renders on a change", () => {
    let store: AnnotationStore | null = null;
    const seen: Array<readonly AnnotationData[]> = [];
    const Probe = () => {
      store = useCreateAnnotationStore(() => [note('a')]);
      seen.push(useStoredAnnotations(store));
      return null;
    };
    render(<Probe />);
    expect(seen[seen.length - 1]).toBe(store!.getAnnotations());
    const renders = seen.length;
    act(() => {
      store!.update((c) => [...c, note('b', 2, 3)]);
    });
    expect(seen.length).toBe(renders + 1);
    expect(seen[seen.length - 1]).toBe(store!.getAnnotations());
  });
});
