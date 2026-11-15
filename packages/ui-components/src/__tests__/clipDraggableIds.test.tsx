// @vitest-environment jsdom
//
// A clip's three draggables are registered under ids built from its track id
// and clip id (#812), so they stay with the clip when its position in the row
// changes: a clip that arrives earlier in the row mid-drag must not take over
// the id of the clip being dragged. Read back from the REAL registry.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager } from '@dnd-kit/dom';
import { Clip } from '../components/Clip';

afterEach(cleanup);

interface Placement {
  trackIndex: number;
  clipIndex: number;
  trackId?: string;
  clipId?: string;
}

function clipElement({ trackIndex, clipIndex, trackId, clipId = 'c1' }: Placement) {
  return (
    <Clip
      clipId={clipId}
      trackId={trackId}
      trackIndex={trackIndex}
      clipIndex={clipIndex}
      trackName="Track 1"
      startSample={0}
      durationSamples={48000}
      samplesPerPixel={100}
      showHeader
    />
  );
}

function mount(placement: Placement) {
  const manager = new DragDropManager();
  const view = render(
    <DragDropProvider manager={manager}>{clipElement(placement)}</DragDropProvider>
  );
  const ids = () => [...manager.registry.draggables].map((draggable) => String(draggable.id));
  const rerender = (next: Placement) =>
    view.rerender(<DragDropProvider manager={manager}>{clipElement(next)}</DragDropProvider>);
  return { manager, ids, rerender };
}

describe("a clip's draggable ids", () => {
  it("a clip's draggable ids do not change when its row position changes", () => {
    const view = mount({ trackId: 't1', trackIndex: 0, clipIndex: 0 });
    const before = view.ids().sort();
    expect(before).toEqual(['clip-boundary-left/t1/c1', 'clip-boundary-right/t1/c1', 'clip/t1/c1']);
    view.rerender({ trackId: 't1', trackIndex: 2, clipIndex: 3 });
    expect(view.ids().sort()).toEqual(before);
    // The data keeps its shape and follows the new position.
    const move = view.manager.registry.draggables.get('clip/t1/c1');
    expect(move?.data).toMatchObject({ clipId: 'c1', trackIndex: 2, clipIndex: 3 });
  });

  it('ids with a slash or a hyphen in them do not run into each other', () => {
    const a = mount({ trackId: 't-1', clipId: 'c', trackIndex: 0, clipIndex: 0 });
    const b = mount({ trackId: 't', clipId: '1-c', trackIndex: 0, clipIndex: 0 });
    const c = mount({ trackId: 't/1', clipId: 'c', trackIndex: 0, clipIndex: 0 });
    const d = mount({ trackId: 't', clipId: '1/c', trackIndex: 0, clipIndex: 0 });
    const all = [a, b, c, d].map((view) => view.ids().find((id) => id.startsWith('clip/')));
    expect(new Set(all).size).toBe(4);
  });

  it('without a trackId the ids are built from the row positions, as before', () => {
    const view = mount({ trackIndex: 1, clipIndex: 2 });
    expect(view.ids().sort()).toEqual([
      'clip-1-2',
      'clip-boundary-left-1-2',
      'clip-boundary-right-1-2',
    ]);
  });
});
