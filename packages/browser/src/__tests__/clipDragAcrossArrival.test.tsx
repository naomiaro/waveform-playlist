// @vitest-environment jsdom
//
// #812: a loading clip that names only its `src` draws nothing, so when its
// audio arrives it is added to the drawn row and every later clip of the row
// moves one position on. A drag in progress on one of those later clips must
// still commit to the clip that was picked up. Driven through the real
// provider, `ClipInteractionProvider` and dnd-kit's manager (its actions stand
// in for the pointer).
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
import { usePlaylistTimeline } from '../contexts/playlistContexts';
import { renderWithArrangement } from './helpers/arrangementProvider';
import { clip, fakeBuffer, fakeLoads, flush, loading, track, RATE } from './helpers/engineHarness';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

type Manager = NonNullable<ReturnType<typeof useDragDropManager>>;
let manager: Manager | null = null;
let timeline: ReturnType<typeof usePlaylistTimeline>;
let probeTransform: { x: number; y: number } | null = null;

const Probe: React.FC = () => {
  manager = useDragDropManager();
  timeline = usePlaylistTimeline();
  return null;
};

const ARRIVING = 'arriving';
const DRAGGED = 'dragged';
/** The dragged clip: loaded, 2 s in, after the loading clip in the track. */
const DRAGGED_START = 2 * RATE;

function mountRow() {
  const loads = fakeLoads();
  const view = renderWithArrangement(
    [track('A', [loading(ARRIVING, { start: 0, duration: undefined }), clip(DRAGGED, 2, 1)])],
    {
      loadSource: loads.loadSource,
      children: (
        <ClipInteractionProvider>
          <Probe />
          <WaveformEditor />
        </ClipInteractionProvider>
      ),
    }
  );
  return { view, loads };
}

/** The id of the draggable whose data is the dragged clip's, for a move or one boundary. */
function draggableOf(clipId: string, boundary?: 'left' | 'right'): string {
  const found = [...manager!.registry.draggables].find((draggable) => {
    const data = draggable.data as { clipId?: string; boundary?: string } | undefined;
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

async function arrive(loads: ReturnType<typeof fakeLoads>) {
  await act(async () => {
    expect(loads.calls).toHaveLength(1);
    loads.calls[0].resolve(fakeBuffer(1));
    await flush();
    await flush();
  });
  // The arrived clip is drawn now, first in the row.
  expect(timeline.tracks[0].clips.map((c) => c.id)).toEqual([ARRIVING, DRAGGED]);
}

async function dropAt(x: number) {
  await act(async () => {
    manager!.actions.move({ to: { x, y: 10 } });
    await flush();
    probeTransform = { ...manager!.dragOperation.transform };
  });
  await act(async () => {
    manager!.actions.stop();
    await flush();
  });
}

const startOf = (clipId: string) =>
  timeline.tracks[0].clips.find((c) => c.id === clipId)?.startSample;

// dnd-kit's auto-scroller asks the page what is under the pointer, and its
// Feedback plugin finishes the page's animations; jsdom has neither.
const documentWithPoint = document as Document & {
  elementFromPoint?: unknown;
  getAnimations?: unknown;
};
const originalElementFromPoint = documentWithPoint.elementFromPoint;
const originalGetAnimations = documentWithPoint.getAnimations;
const elementPrototype = Element.prototype as Element & { getAnimations?: unknown };
const originalElementGetAnimations = elementPrototype.getAnimations;
const windowWithMedia = window as Window & { matchMedia?: unknown };
const originalMatchMedia = windowWithMedia.matchMedia;
const NO_MEDIA_MATCH = {
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
};

beforeEach(() => {
  manager = null;
  documentWithPoint.elementFromPoint = () => null;
  documentWithPoint.getAnimations = () => [];
  elementPrototype.getAnimations = () => [];
  windowWithMedia.matchMedia = (() => NO_MEDIA_MATCH) as unknown as Window['matchMedia'];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  documentWithPoint.elementFromPoint = originalElementFromPoint;
  documentWithPoint.getAnimations = originalGetAnimations;
  elementPrototype.getAnimations = originalElementGetAnimations;
  windowWithMedia.matchMedia = originalMatchMedia;
});

describe('a drag across an arrival (#812)', () => {
  it('a clip that arrives earlier in the row during a move does not change which clip the drop moves', async () => {
    const { view, loads } = mountRow();
    await act(flush);
    const moveClip = vi.spyOn(view.arrangement, 'moveClip');
    expect(timeline.tracks[0].clips.map((c) => c.id)).toEqual([DRAGGED]);

    await startDrag(draggableOf(DRAGGED));
    await arrive(loads);
    const arrivedStart = startOf(ARRIVING);
    // The drag still holds the dragged clip: its draggable kept its id.
    expect((manager!.dragOperation.source?.data as { clipId?: string }).clipId).toBe(DRAGGED);
    await dropAt(270);
    expect(probeTransform).toEqual({ x: -30, y: 0 });

    expect(moveClip).toHaveBeenCalledTimes(1);
    expect(moveClip.mock.calls[0][1]).toBe(DRAGGED);
    expect(startOf(ARRIVING)).toBe(arrivedStart);
    expect(startOf(DRAGGED)).toBeLessThan(DRAGGED_START);
  });

  it('the same for a trim: the release trims the clip that was picked up', async () => {
    const { view, loads } = mountRow();
    await act(flush);
    const trimClip = vi.spyOn(view.arrangement, 'trimClip');

    await startDrag(draggableOf(DRAGGED, 'right'));
    await arrive(loads);
    const arrived = timeline.tracks[0].clips.find((c) => c.id === ARRIVING);
    await dropAt(270);

    expect(trimClip).toHaveBeenCalledTimes(1);
    expect(trimClip.mock.calls[0][1]).toBe(DRAGGED);
    expect(timeline.tracks[0].clips.find((c) => c.id === ARRIVING)).toEqual(arrived);
  });
});
