import { describe, it, expect } from 'vitest';
import {
  updateAnnotationBoundaries,
  LINK_THRESHOLD,
  MIN_ANNOTATION_DURATION,
} from '../annotations/boundaries';
import type { AnnotationData } from '../types/annotations';

const ann = (id: string, start: number, end: number): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});

describe('updateAnnotationBoundaries', () => {
  it('exports the shared constants', () => {
    expect(LINK_THRESHOLD).toBe(0.01);
    expect(MIN_ANNOTATION_DURATION).toBe(0.1);
  });

  it('does not mutate the input array or its objects', () => {
    const input = [ann('a', 0, 2), ann('b', 2, 4)];
    const snapshot = JSON.parse(JSON.stringify(input));
    updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.5,
      isDraggingStart: true,
      annotations: input,
      duration: 10,
      linkEndpoints: true,
    });
    expect(input).toEqual(snapshot);
  });

  it('clamps start to [0, end - 0.1]', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: -5,
      isDraggingStart: true,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].start).toBe(0);

    const result2 = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 5,
      isDraggingStart: true,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result2[0].start).toBeCloseTo(1.9); // end - MIN_ANNOTATION_DURATION
  });

  it('clamps end to [start + 0.1, duration]', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 99,
      isDraggingStart: false,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].end).toBe(10);
  });

  it('linked mode: moving a start moves the linked previous end with it', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.5,
      isDraggingStart: true,
      annotations: [ann('a', 0, 2), ann('b', 2, 4)], // linked at 2 (within 10ms)
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[1].start).toBeCloseTo(1.5);
    expect(result[0].end).toBeCloseTo(1.5);
  });

  it('linked mode: dragging start past an unlinked previous end snaps to it', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.0,
      isDraggingStart: true,
      annotations: [ann('a', 0, 1.5), ann('b', 2, 4)], // gap 1.5→2, not linked
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[1].start).toBeCloseTo(1.5); // snapped to prev.end
  });

  it('unlinked mode: colliding start pushes previous end back', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.0,
      isDraggingStart: true,
      annotations: [ann('a', 0, 1.5), ann('b', 2, 4)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[1].start).toBeCloseTo(1.0);
    expect(result[0].end).toBeCloseTo(1.0);
  });

  it('linked mode: moving an end cascades through consecutively linked neighbors', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 2.5,
      isDraggingStart: false,
      annotations: [ann('a', 0, 2), ann('b', 2, 4), ann('c', 4, 6)], // all linked
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[0].end).toBeCloseTo(2.5);
    expect(result[1].start).toBeCloseTo(2.5);
    // cascade: b's end did not move, so c is untouched (delta applies to starts only
    // when segments remain linked after b.start shifted — matches hook behavior)
    expect(result[2].start).toBeCloseTo(4);
  });

  it('unlinked mode: colliding end pushes and cascades next starts forward', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 4.5,
      isDraggingStart: false,
      annotations: [ann('a', 0, 2), ann('b', 4, 4.2), ann('c', 4.2, 6)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].end).toBeCloseTo(4.5);
    expect(result[1].start).toBeCloseTo(4.5); // pushed
    // Hand-traced against useAnnotationControls.ts:154-169: after the push, b becomes
    // (start: 4.5, end: 4.2) — the hook does NOT reconcile start > end in the unlinked
    // push branch. The cascade re-check uses `current.end > next.start`, i.e.
    // b.end (4.2, UNCHANGED — only b.start was reassigned) vs c.start (4.2).
    // 4.2 > 4.2 is false (strict), so the cascade loop breaks immediately and c is
    // NOT pushed. The brief's draft assertion (4.5) contradicted its own inline note;
    // corrected here to match actual hook behavior (characterization, not a "fix").
    expect(result[2].start).toBeCloseTo(4.2); // NOT pushed — current.end === next.start, not >
  });
});
