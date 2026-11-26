// @vitest-environment jsdom
//
// #848 PR 3 (P2): a change to the arrangement made elsewhere during a drag
// cancels the drag when it changed what is dragged. Driven through the real
// provider, `ClipInteractionProvider` and dnd-kit's manager (its actions stand
// in for the pointer), as `clipDragAcrossArrival.test.tsx` does.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(() => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  })),
}));

import { act, cleanup } from '@testing-library/react';
import React from 'react';
import { useDragDropManager } from '@dnd-kit/react';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { WaveformEditor } from '../components/Waveform';
import { renderWithArrangement } from './helpers/arrangementProvider';
import { clip, fakeBuffer, fakeLoads, flush, loading, track, RATE } from './helpers/engineHarness';
import { dragChanged, dragSnapshot } from '../providerInternals/DragWatch';
import { createArrangement } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

type Manager = NonNullable<ReturnType<typeof useDragDropManager>>;
let manager: Manager | null = null;
const Probe: React.FC = () => {
  manager = useDragDropManager();
  return null;
};

function mount(tracks: Parameters<typeof renderWithArrangement>[0], loadSource?: never) {
  return renderWithArrangement(tracks, {
    loadSource,
    children: (
      <ClipInteractionProvider>
        <Probe />
        <WaveformEditor />
      </ClipInteractionProvider>
    ),
  });
}

function draggableOf(clipId: string, boundary?: 'left' | 'right'): string {
  const found = [...manager!.registry.draggables].find((d) => {
    const data = d.data as { clipId?: string; boundary?: string } | undefined;
    return data?.clipId === clipId && data?.boundary === boundary;
  });
  expect(found).toBeDefined();
  return String(found!.id);
}

async function startDrag(id: string) {
  await act(async () => {
    manager!.actions.setDragSource(id);
    manager!.actions.start({ source: id, coordinates: { x: 300, y: 10 } });
    await flush();
  });
}

async function moveAndDrop(x: number) {
  await act(async () => {
    manager!.actions.move({ to: { x, y: 10 } });
    await flush();
  });
  await act(async () => {
    manager!.actions.stop();
    await flush();
  });
}

const dragging = () => manager!.dragOperation.status.dragging;

const documentWithPoint = document as Document & {
  elementFromPoint?: unknown;
  getAnimations?: unknown;
};
const elementPrototype = Element.prototype as Element & { getAnimations?: unknown };
const windowWithMedia = window as Window & { matchMedia?: unknown };
const saved = {
  elementFromPoint: documentWithPoint.elementFromPoint,
  getAnimations: documentWithPoint.getAnimations,
  elementGetAnimations: elementPrototype.getAnimations,
  matchMedia: windowWithMedia.matchMedia,
};

beforeEach(() => {
  manager = null;
  documentWithPoint.elementFromPoint = () => null;
  documentWithPoint.getAnimations = () => [];
  elementPrototype.getAnimations = () => [];
  windowWithMedia.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as Window['matchMedia'];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  documentWithPoint.elementFromPoint = saved.elementFromPoint;
  documentWithPoint.getAnimations = saved.getAnimations;
  elementPrototype.getAnimations = saved.elementGetAnimations;
  windowWithMedia.matchMedia = saved.matchMedia;
});

describe('an outside change cancels a React drag (#848)', () => {
  it('arrangement.undo() that takes the dragged clip back stops the drag as cancelled', async () => {
    const view = mount([track('A', [clip('c', 2, 1)])]);
    await act(flush);
    act(() => {
      view.arrangement.moveClip('A', 'c', RATE / 2);
    });
    const moveClip = vi.spyOn(view.arrangement, 'moveClip');
    await startDrag(draggableOf('c'));
    expect(dragging()).toBe(true);
    await act(async () => {
      view.arrangement.undo();
      await flush();
    });
    expect(dragging()).toBe(false);
    await moveAndDrop(250);
    expect(moveClip).not.toHaveBeenCalled();
  });

  it("removing the dragged clip's track stops a trim drag", async () => {
    const view = mount([track('A', [clip('c', 2, 1)]), track('B', [clip('d', 0, 1)])]);
    await act(flush);
    const trimClip = vi.spyOn(view.arrangement, 'trimClip');
    await startDrag(draggableOf('c', 'right'));
    await act(async () => {
      view.arrangement.removeTrack('A');
      await flush();
    });
    expect(dragging()).toBe(false);
    expect(trimClip).not.toHaveBeenCalled();
  });

  it('another clip loading does not stop a clip drag; the drop moves the clip', async () => {
    const loads = fakeLoads();
    const view = mount(
      [track('A', [loading('arriving', { start: 0, duration: 1 }), clip('c', 2, 1)])],
      loads.loadSource as never
    );
    await act(flush);
    const moveClip = vi.spyOn(view.arrangement, 'moveClip');
    await startDrag(draggableOf('c'));
    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(1));
      await flush();
      await flush();
    });
    expect(dragging()).toBe(true);
    await moveAndDrop(270);
    expect(moveClip).toHaveBeenCalledTimes(1);
  });

  it("a drag's own release is not taken for an outside change", async () => {
    const view = mount([track('A', [clip('c', 2, 1)])]);
    await act(flush);
    const moveClip = vi.spyOn(view.arrangement, 'moveClip');
    await startDrag(draggableOf('c'));
    await moveAndDrop(270);
    expect(moveClip).toHaveBeenCalledTimes(1);
    const c = view.arrangement.getTracks()[0].clips[0] as { startSample: number };
    expect(c.startSample).toBeLessThan(2 * RATE);
  });
});

describe('dragChanged (#848)', () => {
  const arrangementOf = () =>
    createArrangement({ tracks: [track('A', [clip('c', 2, 1)]), track('B', [clip('d', 0, 1)])] });

  it('a reorder during a track drag is a change; a mixer change is not', () => {
    const arrangement = arrangementOf();
    const snapshot = dragSnapshot(arrangement, { kind: 'track-reorder', trackId: 'A' })!;
    arrangement.setTrackVolume('B', 0.5);
    expect(dragChanged(arrangement, snapshot)).toBe(false);
    arrangement.reorderTrack('B', 0);
    expect(dragChanged(arrangement, snapshot)).toBe(true);
  });

  it('an edit of another clip is not a change for a clip drag', () => {
    const arrangement = arrangementOf();
    const snapshot = dragSnapshot(arrangement, { trackIndex: 0, clipId: 'c' })!;
    arrangement.moveClip('B', 'd', 100);
    expect(dragChanged(arrangement, snapshot)).toBe(false);
    arrangement.moveClip('A', 'c', 100);
    expect(dragChanged(arrangement, snapshot)).toBe(true);
  });
});
