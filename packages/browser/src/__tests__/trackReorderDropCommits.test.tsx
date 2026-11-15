// @vitest-environment jsdom
//
// A track-reorder drop is ONE commit (#812): the new order, the cleared
// preview and the bumped epoch together. dnd-kit calls `onDragEnd` inside
// `startTransition`; since the arrangement owns the order, the reorder reaches
// React through `useSyncExternalStore` (rendered at once) while the epoch and
// the preview are state (transition updates). Committed apart, the slots are
// first moved under their old keys, which is what the epoch exists to avoid
// (see `bumpTrackReorderEpoch` in the provider).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';

const captured = vi.hoisted(() => ({ dnd: {} as Record<string, unknown> }));

// The real DragDropProvider, with the handlers ClipInteractionProvider gives it captured.
vi.mock('@dnd-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    DragDropProvider: (props: React.ComponentProps<typeof actual.DragDropProvider>) => {
      captured.dnd = props as unknown as Record<string, unknown>;
      return createElement(actual.DragDropProvider, props);
    },
  };
});
vi.mock('../hooks/useDragSensors', () => ({ useDragSensors: () => [] }));

import { act, cleanup, waitFor } from '@testing-library/react';
import React, { startTransition, useLayoutEffect } from 'react';
import {
  useEditorControls,
  usePlaylistTimeline,
  useTrackReorderPreview,
} from '../contexts/playlistContexts';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { renderWithArrangement } from './helpers/arrangementProvider';
import { clip, track } from './helpers/engineHarness';

/** Every committed (order, epoch, preview), in order. */
const commits: string[] = [];
let editor: ReturnType<typeof useEditorControls>;
let ready = false;

const Probe: React.FC = () => {
  const { tracks, isReady } = usePlaylistTimeline();
  const { trackReorderEpoch, trackDragPreview } = useTrackReorderPreview();
  editor = useEditorControls();
  ready = isReady;
  const preview = trackDragPreview
    ? `${trackDragPreview.trackId}>${trackDragPreview.toIndex}`
    : 'null';
  const state = `${tracks.map((t) => t.id).join('')} epoch=${trackReorderEpoch} preview=${preview}`;
  useLayoutEffect(() => {
    commits.push(state);
  });
  return null;
};

function reorderEnd(canceled = false) {
  return {
    canceled,
    operation: {
      source: {
        data: { kind: 'track-reorder', trackId: 'A' },
        sortable: { index: 1, initialIndex: 0 },
      },
    },
  } as never;
}

async function mountWithPreview() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  renderWithArrangement([track('A', [clip('a1', 0, 1)]), track('B', [clip('b1', 0, 1)])], {
    children: (
      <ClipInteractionProvider>
        <Probe />
      </ClipInteractionProvider>
    ),
  });
  await waitFor(() => expect(ready).toBe(true));
  // The drag is over B's slot: A would drop at index 1.
  act(() => editor.setTrackDragPreview({ trackId: 'A', toIndex: 1 }));
  commits.length = 0;
}

const onDragEnd = () => captured.dnd.onDragEnd as (event: never) => void;

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('a track-reorder drop is one commit (#812)', () => {
  it('called inside startTransition (as dnd-kit does), under act()', async () => {
    await mountWithPreview();

    act(() => startTransition(() => onDragEnd()(reorderEnd())));

    expect(commits).toEqual(['BA epoch=1 preview=null']);
  });

  it('called inside startTransition from a task of its own (no act())', async () => {
    await mountWithPreview();
    const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      await new Promise<void>((done) =>
        setTimeout(() => {
          startTransition(() => onDragEnd()(reorderEnd()));
          done();
        }, 0)
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }

    expect(commits).toEqual(['BA epoch=1 preview=null']);
  });

  it('a cancelled drop clears the preview and bumps the epoch in one commit, order unchanged', async () => {
    await mountWithPreview();

    act(() => startTransition(() => onDragEnd()(reorderEnd(true))));

    expect(commits).toEqual(['AB epoch=1 preview=null']);
  });
});
