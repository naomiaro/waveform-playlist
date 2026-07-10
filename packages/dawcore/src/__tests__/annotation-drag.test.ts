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
});
