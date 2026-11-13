// @vitest-environment jsdom
//
// @dnd-kit 0.5 moved the per-sortable `feedback` mode into per-entity plugin
// config. useTrackReorderHandle MUST keep `feedback: 'move'` (see its
// comment: 'none' kills collision, 'default' splices React-owned DOM) AND keep
// the sortable's default plugins (OptimisticSortingPlugin drives the live
// sortable.index that drag-commit reads). A bare `plugins: [...]` array would
// silently drop those defaults, so both are asserted against the real manager.
// (The hook was the component SortableTrackControls until #687.)
import './jsdom-polyfills'; // must be first
import React, { StrictMode, useRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager, Feedback } from '@dnd-kit/dom';
import { OptimisticSortingPlugin, SortableKeyboardPlugin } from '@dnd-kit/dom/sortable';
import { useTrackReorderHandle } from '../hooks/useTrackReorderHandle';
import { resetPartWarnings } from '../components/partWarnings';
import {
  TrackContext,
  TrackSlotWiringContext,
  type TrackContextValue,
} from '../components/trackContext';

afterEach(() => {
  cleanup();
  resetPartWarnings();
  vi.restoreAllMocks();
});

const TRACK = { id: 't1', index: 0 } as TrackContextValue;
const dragSource: boolean[] = [];

const Grip: React.FC = () => {
  const { handleRef } = useTrackReorderHandle();
  return <button ref={handleRef as React.Ref<HTMLButtonElement>}>grip</button>;
};

const Slot: React.FC = () => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const wiring = useRef({
    elementRef,
    setDragSource: (value: boolean) => void dragSource.push(value),
    handleCount: { current: 0 },
  }).current;
  return (
    <div ref={elementRef} data-slot="">
      <TrackSlotWiringContext.Provider value={wiring}>
        <TrackContext.Provider value={TRACK}>
          <Grip />
        </TrackContext.Provider>
      </TrackSlotWiringContext.Provider>
    </div>
  );
};

function mountSortable() {
  const manager = new DragDropManager();
  render(
    <DragDropProvider manager={manager}>
      <Slot />
    </DragDropProvider>
  );
  return manager;
}

describe('useTrackReorderHandle per-entity Feedback plugin config (@dnd-kit 0.5)', () => {
  it('registers the sortable with feedback: "move"', () => {
    const manager = mountSortable();
    const source = manager.registry.draggables.get('track-reorder-t1');
    expect(source).toBeDefined();
    expect(source!.pluginConfig(Feedback)?.feedback).toBe('move');
  });

  it('keeps the default sortable plugins registered', () => {
    const manager = mountSortable();
    expect(manager.registry.plugins.get(OptimisticSortingPlugin)).toBeDefined();
    expect(manager.registry.plugins.get(SortableKeyboardPlugin)).toBeDefined();
  });

  it("the item that is dragged is the slot's element, and the grip is its handle", () => {
    const manager = mountSortable();
    const source = manager.registry.draggables.get('track-reorder-t1')!;
    expect(source.element).toBe(document.querySelector('[data-slot]'));
    expect(source.handle).toBe(document.querySelector('button'));
    expect(source.data).toEqual({ kind: 'track-reorder', trackId: 't1' });
  });

  it('one handle under StrictMode is still one handle: no warning', () => {
    // StrictMode runs the effect, its cleanup and the effect again; a count
    // that the cleanup did not give back would stand at two.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <StrictMode>
        <DragDropProvider manager={new DragDropManager()}>
          <Slot />
        </DragDropProvider>
      </StrictMode>
    );
    expect(
      warn.mock.calls.filter((call) => String(call[0]).includes('more than one reorder handle'))
    ).toHaveLength(0);
  });

  it('tells the slot that it is not being dragged, and again when it goes', () => {
    dragSource.length = 0;
    mountSortable();
    expect(dragSource).toEqual([false]);
    cleanup();
    expect(dragSource).toEqual([false, false]);
  });
});
