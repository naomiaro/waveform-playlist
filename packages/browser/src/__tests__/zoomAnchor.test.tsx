// @vitest-environment jsdom
//
// #828. Where a zoom change keeps the view, in both providers: the time under
// a hovering mouse over the timeline, else a range selection on screen, else
// the cursor on screen, else the centre (the maintainer's order, after
// Audacity's). jsdom has no layout, so the container's size, position and
// scroll are given by hand. With the sample rate equal to the zoom level, one
// pixel is one second before the zoom.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React, { StrictMode, useRef } from 'react';
import {
  anchoredScrollLeft,
  useZoomAnchor,
  zoomAnchorX,
  type ZoomAnchorTimes,
} from '../providerInternals/zoomAnchor';

// `layout.maxScroll` is the browser's clamp: the content's width minus the
// container's, which a zoom out lowers in the same commit as the zoom.
const layout = { maxScroll: Infinity };
// The container: 400 px wide, its left edge at client x 100, scrolled 1000 px.
const RECT = { left: 100, top: 50, right: 500, bottom: 250, width: 400, height: 200 };
function fakeLayout(element: HTMLElement, scrollLeft = 1000) {
  let value = scrollLeft;
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: RECT.width });
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    get: () => layout.maxScroll + RECT.width,
  });
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => Math.min(value, layout.maxScroll),
    set: (v: number) => {
      value = Math.min(v, layout.maxScroll);
    },
  });
  element.getBoundingClientRect = () => ({ ...RECT, x: RECT.left, y: RECT.top, toJSON() {} });
}

// What the browser's hit test finds at a point: jsdom has no layout.
const hitTest = { element: null as Element | null };
beforeEach(() => {
  document.elementFromPoint = () => hitTest.element;
});
afterEach(() => {
  cleanup();
  layout.maxScroll = Infinity;
  hitTest.element = null;
});

const NONE: ZoomAnchorTimes = { selectionStart: 0, selectionEnd: 0, cursorTime: 0 };

describe('anchoredScrollLeft', () => {
  it('keeps the content under the anchor at the anchor', () => {
    // Content pixel 1100 at 1000 spp is pixel 2200 at 500 spp.
    expect(
      anchoredScrollLeft({
        scrollLeft: 1000,
        anchorX: 100,
        oldSamplesPerPixel: 1000,
        newSamplesPerPixel: 500,
      })
    ).toBe(2100);
    expect(
      anchoredScrollLeft({
        scrollLeft: 1000,
        anchorX: 100,
        oldSamplesPerPixel: 500,
        newSamplesPerPixel: 1000,
      })
    ).toBe(450);
  });

  it('never goes below 0', () => {
    expect(
      anchoredScrollLeft({
        scrollLeft: 0,
        anchorX: 300,
        oldSamplesPerPixel: 500,
        newSamplesPerPixel: 1000,
      })
    ).toBe(0);
  });
});

describe('zoomAnchorX: the order', () => {
  const container = document.createElement('div');
  const inside = document.createElement('span');
  container.appendChild(inside);
  fakeLayout(container);
  const anchor = (
    times: ZoomAnchorTimes,
    hover: Parameters<typeof zoomAnchorX>[0]['hover'] = null
  ) =>
    zoomAnchorX({
      container,
      hover,
      scrollLeft: 1000,
      samplesPerPixel: 1000,
      sampleRate: 1000,
      times,
    });

  it('1. a hovering pointer over the timeline wins over a selection and the cursor', () => {
    hitTest.element = inside;
    expect(
      anchor({ selectionStart: 1100, selectionEnd: 1200, cursorTime: 1300 }, { x: 150, y: 100 })
    ).toBe(50);
  });

  it('1. a pointer over an overlay above the timeline does not count', () => {
    // Inside the container's rectangle, but the hit test finds an element
    // outside it (drawn above the timeline).
    hitTest.element = document.body;
    expect(anchor({ ...NONE, cursorTime: 1300 }, { x: 150, y: 100 })).toBe(300);
  });

  it("1. a pointer outside the container's rectangle does not count", () => {
    hitTest.element = inside;
    expect(anchor({ ...NONE, cursorTime: 1300 }, { x: 600, y: 100 })).toBe(300);
  });

  it('2. a range on screen: its centre', () => {
    expect(anchor({ selectionStart: 1100, selectionEnd: 1200, cursorTime: 1300 })).toBe(150);
  });

  it('2. a range whose centre is off screen: the centre of its visible part', () => {
    // 600 s to 1200 s: its centre (900) is left of the view (1000-1400).
    expect(anchor({ ...NONE, selectionStart: 600, selectionEnd: 1200 })).toBe(100);
    // 1300 s to 2000 s: its centre (1650) is right of the view.
    expect(anchor({ ...NONE, selectionStart: 1300, selectionEnd: 2000 })).toBe(350);
  });

  it('2. a range off screen, or one that fills the view, is passed over: the cursor, else the centre', () => {
    expect(anchor({ selectionStart: 100, selectionEnd: 200, cursorTime: 1300 })).toBe(300);
    expect(anchor({ selectionStart: 900, selectionEnd: 1500, cursorTime: 1300 })).toBe(300);
    expect(anchor({ selectionStart: 900, selectionEnd: 1500, cursorTime: 0 })).toBe(200);
  });

  it('2. a point selection is not a range', () => {
    expect(anchor({ selectionStart: 1100, selectionEnd: 1100, cursorTime: 1300 })).toBe(300);
  });

  it('3. the cursor on screen', () => {
    expect(anchor({ ...NONE, cursorTime: 1050 })).toBe(50);
  });

  it('4. the centre: nothing else on screen', () => {
    expect(anchor({ ...NONE, cursorTime: 5000 })).toBe(200);
  });
});

const laidOut = new WeakSet<HTMLElement>();
const state = {
  element: null as HTMLDivElement | null,
  committed: null as React.RefObject<number> | null,
  times: NONE,
};
const Harness: React.FC<{ spp: number }> = ({ spp }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  state.committed = useZoomAnchor({
    scrollContainerRef: ref,
    samplesPerPixel: spp,
    sampleRate: 1000,
    getTimes: () => state.times,
  });
  return (
    <div
      ref={(el) => {
        // Called again on every render (a new function): lay out once.
        if (el && !laidOut.has(el)) {
          laidOut.add(el);
          fakeLayout(el);
        }
        if (el) state.element = el;
        ref.current = el;
      }}
    />
  );
};

function pointer(
  type: string,
  init: { clientX?: number; clientY?: number; pointerType?: string; relatedTarget?: null },
  target: EventTarget
) {
  const event = new Event(type, { bubbles: true });
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, { value });
  }
  act(() => {
    target.dispatchEvent(event);
  });
}

describe('useZoomAnchor', () => {
  afterEach(() => {
    state.times = NONE;
  });

  it('keeps the time under a mouse over the container (a keyboard zoom does not move it)', () => {
    const view = render(<Harness spp={1000} />);
    hitTest.element = state.element;
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' }, state.element!);
    state.times = { selectionStart: 1100, selectionEnd: 1200, cursorTime: 1300 };
    view.rerender(<Harness spp={500} />);
    // Content pixel 1100 at 1000 spp is 2200 at 500 spp, minus the anchor 100.
    expect(state.element!.scrollLeft).toBe(2100);
    expect(state.committed!.current).toBe(500);
  });

  it('a resting mouse over an element that the zoom replaces still counts (a ruler chunk)', () => {
    const view = render(<Harness spp={1000} />);
    const chunk = document.createElement('canvas');
    state.element!.appendChild(chunk);
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' }, chunk);
    // The chunk is replaced; the hit test now finds the container itself.
    chunk.remove();
    hitTest.element = state.element;
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2100);
  });

  it('a mouse outside the container (on a zoom button): the selection first', () => {
    const view = render(<Harness spp={1000} />);
    pointer('pointermove', { clientX: 600, clientY: 100, pointerType: 'mouse' }, document.body);
    state.times = { selectionStart: 1100, selectionEnd: 1200, cursorTime: 1300 };
    view.rerender(<Harness spp={500} />);
    // The selection's centre, 1150 s, at anchor 150: 2300 - 150.
    expect(state.element!.scrollLeft).toBe(2150);
  });

  it('keeps the centre before any pointer has moved, with nothing on screen', () => {
    const view = render(<Harness spp={1000} />);
    view.rerender(<Harness spp={500} />);
    // Centre: content pixel 1200 at 1000 spp is 2400 at 500 spp, minus 200.
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a touch does not hover', () => {
    const view = render(<Harness spp={1000} />);
    hitTest.element = state.element;
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' }, state.element!);
    pointer('pointerdown', { clientX: 200, clientY: 100, pointerType: 'touch' }, state.element!);
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a touch moving over the container does not hover either', () => {
    const view = render(<Harness spp={1000} />);
    hitTest.element = state.element;
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'touch' }, state.element!);
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a pointer that left the window is not over the container', () => {
    const view = render(<Harness spp={1000} />);
    hitTest.element = state.element;
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' }, state.element!);
    pointer('pointerout', { relatedTarget: null }, document);
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a zoom out anchors from the scroll before the content shrank, not the clamped one', () => {
    const view = render(<Harness spp={500} />);
    act(() => {
      state.element!.scrollLeft = 1422;
      state.element!.dispatchEvent(new Event('scroll'));
    });
    // The content halves in the commit of the zoom; by the layout effect the
    // browser has clamped scrollLeft to the new maximum.
    layout.maxScroll = 1000;
    view.rerender(<Harness spp={1000} />);
    // Centre: content pixel 1422 + 200 at 500 spp is 811 at 1000 spp, minus 200.
    expect(state.element!.scrollLeft).toBe(611);
  });

  it('a scroll written by code just before the zoom is the one anchored from', () => {
    const view = render(<Harness spp={1000} />);
    act(() => {
      state.element!.dispatchEvent(new Event('scroll'));
    });
    // "Go to the start, then zoom": the write's scroll event has not fired yet.
    // (The cursor is off screen, so the centre is the anchor.)
    state.element!.scrollLeft = 0;
    state.times = { ...NONE, cursorTime: 5000 };
    view.rerender(<Harness spp={500} />);
    // Centre: content pixel 200 at 1000 spp is 400 at 500 spp, minus 200.
    expect(state.element!.scrollLeft).toBe(200);
  });

  it('a render at the same level leaves the scroll alone, StrictMode included', () => {
    const view = render(
      <StrictMode>
        <Harness spp={1000} />
      </StrictMode>
    );
    view.rerender(
      <StrictMode>
        <Harness spp={1000} />
      </StrictMode>
    );
    expect(state.element!.scrollLeft).toBe(1000);
    expect(state.committed!.current).toBe(1000);
  });
});
