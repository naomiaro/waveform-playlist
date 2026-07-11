import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import { AnnotationDragHandler } from '../interactions/annotation-drag';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost() {
  return {
    effectiveSampleRate: 48000,
    _renderSpp: 480, // 100px per second — round numbers for assertions
    _duration: 100,
    seekTo: vi.fn(),
  };
}

/** Build a fake PointerEvent targeting an element. */
function fakePointer(
  target: HTMLElement,
  clientX: number,
  overrides: Partial<PointerEvent> = {}
): PointerEvent {
  return {
    target,
    clientX,
    pointerId: 1,
    button: 0,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

describe('AnnotationDragHandler', () => {
  let host: ReturnType<typeof makeHost>;
  let handler: AnnotationDragHandler;
  let track: DawAnnotationTrackElement;
  let lane: HTMLElement;

  beforeEach(async () => {
    host = makeHost();
    handler = new AnnotationDragHandler(host);
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.editable = true;
    track.innerHTML =
      '<daw-annotation id="a" start="1" end="3">A</daw-annotation>' +
      '<daw-annotation id="b" start="3" end="5">B</daw-annotation>';
    document.body.appendChild(track);
    await flush();
    // Fake lane DOM as the editor would render it (only structure the handler reads).
    lane = document.createElement('div');
    lane.className = 'annotation-lane';
    lane.innerHTML =
      '<div class="annotation-box" data-annotation-id="a">' +
      '<div class="annotation-boundary" data-edge="end"></div>' +
      '</div>';
    document.body.appendChild(lane);
    // happy-dom has no layout — stub capture APIs the handler calls.
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    boundary.setPointerCapture = vi.fn();
    boundary.releasePointerCapture = vi.fn();
    const box = lane.querySelector('.annotation-box') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    track.remove();
    lane.remove();
  });

  it('boundary drag updates the annotation end through core math (write-through)', () => {
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    const down = fakePointer(boundary, 300); // at end=3s (100px/s)
    handler.onPointerDown(down, track);
    expect(down.stopPropagation).toHaveBeenCalled();
    handler._onPointerMove(fakePointer(boundary, 350)); // +0.5s
    expect(track.annotations[0].end).toBeCloseTo(3.5);
    handler._onPointerUp(fakePointer(boundary, 350));
    expect(track.annotations[0].end).toBeCloseTo(3.5);
  });

  it('pointercancel restores the drag-start snapshot', () => {
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    handler.onPointerDown(fakePointer(boundary, 300), track);
    handler._onPointerMove(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBeCloseTo(3.8);
    handler._onPointerCancel(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBeCloseTo(3); // restored
  });

  it('box click (under drag threshold) selects and seeks', () => {
    const box = lane.querySelector('.annotation-box') as HTMLElement;
    handler.onPointerDown(fakePointer(box, 150), track);
    handler._onPointerUp(fakePointer(box, 151)); // 1px — a click
    expect(track.activeAnnotationId).toBe('a');
    expect(host.seekTo).toHaveBeenCalledWith(1); // annotation start
  });

  it('boundary drag on a non-editable track is ignored', () => {
    track.editable = false;
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    const down = fakePointer(boundary, 300);
    handler.onPointerDown(down, track);
    handler._onPointerMove(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBe(3);
  });

  it('pointerdown on empty lane space is NOT consumed (falls through to timeline seek)', () => {
    const down = fakePointer(lane, 500);
    handler.onPointerDown(down, track);
    expect(down.stopPropagation).not.toHaveBeenCalled();
  });

  it('applyBoundaryResults matches elements by id, not live sort position, across a mid-drag reorder', () => {
    // Extend the fake lane with a box for "b" whose start-edge boundary we'll
    // drag — the existing beforeEach lane only wires "a".
    lane.insertAdjacentHTML(
      'beforeend',
      '<div class="annotation-box" data-annotation-id="b">' +
        '<div class="annotation-boundary" data-edge="start"></div>' +
        '</div>'
    );
    const bBox = lane.querySelector('[data-annotation-id="b"]') as HTMLElement;
    const bBoundary = bBox.querySelector('.annotation-boundary') as HTMLElement;
    bBoundary.setPointerCapture = vi.fn();
    bBoundary.releasePointerCapture = vi.fn();

    // b.start = 3s at 100px/s (_renderSpp 480 / 48000 sampleRate) = 300px.
    handler.onPointerDown(fakePointer(bBoundary, 300), track);

    // Frame 1: drag start edge far left, from 300px to 40px -> newTime 0.4s.
    // Core math (linkEndpoints=false): constrainedStart = min(b.end-0.1, max(0,0.4)) = 0.4;
    // 0.4 < a.end(3) so a's end is pushed back to 0.4 (collision, not link).
    handler._onPointerMove(fakePointer(bBoundary, 40));
    const aEl = track.annotationElements.find((el) => el.annotationId === 'a')!;
    const bEl = track.annotationElements.find((el) => el.annotationId === 'b')!;
    expect(aEl.start).toBeCloseTo(1);
    expect(aEl.end).toBeCloseTo(0.4);
    expect(bEl.start).toBeCloseTo(0.4);
    expect(bEl.end).toBeCloseTo(5);

    // Live start-sort order is now [b(0.4), a(1)] — flipped versus the
    // drag-start snapshot order [a, b]. A second frame exercises the
    // mismatch: with the OLD index-based write-back this cross-writes the
    // two elements' data.
    handler._onPointerMove(fakePointer(bBoundary, 20)); // -280px -> newTime 0.2s
    // Core math (always recomputed from the FROZEN drag-start snapshot,
    // where a.end is still 3): constrainedStart = min(4.9, 0.2) = 0.2;
    // 0.2 < a.end(3) (frozen) so a's end -> 0.2, b's start -> 0.2.
    expect(aEl.annotationId).toBe('a');
    expect(bEl.annotationId).toBe('b');
    expect(aEl.start).toBeCloseTo(1); // a's start never touched by this drag
    expect(aEl.end).toBeCloseTo(0.2);
    expect(bEl.start).toBeCloseTo(0.2);
    expect(bEl.end).toBeCloseTo(5); // b's end never touched by this drag

    handler._onPointerUp(fakePointer(bBoundary, 20));
  });
});
