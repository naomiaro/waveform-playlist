// @vitest-environment jsdom
//
// Undo and redo do nothing while a clip or track drag is in progress (#848,
// #906). dnd-kit calls the handlers inside `startTransition`; they are called
// the same way here.
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
import React, { startTransition } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';
import {
  useArrangement,
  useEditorControls,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { renderWithArrangement } from './helpers/arrangementProvider';
import { clip, track } from './helpers/engineHarness';

let editor: ReturnType<typeof useEditorControls>;
let arrangement: Arrangement;
let ready = false;

const Probe: React.FC = () => {
  editor = useEditorControls();
  arrangement = useArrangement();
  ready = usePlaylistTimeline().isReady;
  return null;
};

const CLIP_SOURCE = { data: { clipId: 'a1', trackIndex: 0, clipIndex: 0 } };
const REORDER_SOURCE = {
  data: { kind: 'track-reorder', trackId: 'A' },
  sortable: { index: 0, initialIndex: 0 },
};

function dispatch(name: 'onDragStart' | 'onDragEnd', event: unknown) {
  const handler = captured.dnd[name] as (event: never) => void;
  act(() => startTransition(() => handler(event as never)));
}

const startOf = () => (arrangement.getTracks()[0].clips[0] as { startSample: number }).startSample;

async function mountWithOneStep() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const view = renderWithArrangement(
    [track('A', [clip('a1', 0, 1)]), track('B', [clip('b1', 2, 1)])],
    {
      children: (
        <ClipInteractionProvider>
          <Probe />
        </ClipInteractionProvider>
      ),
    }
  );
  await waitFor(() => expect(ready).toBe(true));
  act(() => {
    arrangement.moveClip('A', 'a1', 4800);
  });
  expect(startOf()).toBe(4800);
  return view;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('undo during a drag (#848)', () => {
  it('undo and redo do nothing during a clip drag', async () => {
    await mountWithOneStep();
    dispatch('onDragStart', { operation: { source: CLIP_SOURCE } });

    act(() => editor.undo());
    expect(startOf()).toBe(4800);
    expect(arrangement.canUndo).toBe(true);

    dispatch('onDragEnd', { canceled: true, operation: { source: CLIP_SOURCE } });
    act(() => editor.undo());
    expect(startOf()).toBe(0);

    // Redo, with a drag in progress, does nothing either.
    dispatch('onDragStart', { operation: { source: CLIP_SOURCE } });
    act(() => editor.redo());
    expect(startOf()).toBe(0);
    expect(arrangement.canRedo).toBe(true);
  });

  it('undo and redo do nothing during a track-reorder drag', async () => {
    await mountWithOneStep();
    dispatch('onDragStart', { operation: { source: REORDER_SOURCE } });

    act(() => editor.undo());
    expect(startOf()).toBe(4800);

    dispatch('onDragEnd', { canceled: true, operation: { source: REORDER_SOURCE } });
    act(() => editor.undo());
    expect(startOf()).toBe(0);
  });

  it('undo works again when the drag provider unmounts mid-drag', async () => {
    const view = await mountWithOneStep();
    dispatch('onDragStart', { operation: { source: CLIP_SOURCE } });

    act(() => view.update({ children: <Probe /> }));
    act(() => editor.undo());
    expect(startOf()).toBe(0);
  });
});
