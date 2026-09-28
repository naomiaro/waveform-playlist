// @vitest-environment jsdom
//
// @dnd-kit 0.5 moved the per-sortable `feedback` mode into per-entity plugin
// config. SortableTrackControls MUST keep `feedback: 'move'` (see its doc
// comment: 'none' kills collision, 'default' splices React-owned DOM) AND keep
// the sortable's default plugins (OptimisticSortingPlugin drives the live
// sortable.index that drag-commit reads). A bare `plugins: [...]` array would
// silently drop those defaults, so both are asserted against the real manager.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager, Feedback } from '@dnd-kit/dom';
import { OptimisticSortingPlugin, SortableKeyboardPlugin } from '@dnd-kit/dom/sortable';
import { SortableTrackControls } from '../components/SortableTrackControls';

afterEach(cleanup);

function mountSortable() {
  const manager = new DragDropManager();
  render(
    <DragDropProvider manager={manager}>
      <SortableTrackControls trackId="t1" index={0}>
        {({ ref, handleRef }) => (
          <div ref={ref}>
            <button ref={handleRef}>grip</button>
          </div>
        )}
      </SortableTrackControls>
    </DragDropProvider>
  );
  return manager;
}

describe('SortableTrackControls per-entity Feedback plugin config (@dnd-kit 0.5)', () => {
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
});
