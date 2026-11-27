// @vitest-environment jsdom
//
// #828. A zoom change keeps the time under the hovering pointer where it is
// when the pointer is over the scroll container, and the time at the centre
// otherwise (a zoom button is outside the container). Both providers use
// `useZoomAnchor`; jsdom has no layout, so the container's size, position and
// scroll are given by hand.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React, { StrictMode, useRef } from 'react';
import { anchoredScrollLeft, useZoomAnchor } from '../providerInternals/zoomAnchor';

afterEach(() => {
  cleanup();
  layout.maxScroll = Infinity;
});

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

// The container: 400 px wide, its left edge at client x 100, scrolled 1000 px.
const RECT = { left: 100, top: 50, right: 500, bottom: 250, width: 400, height: 200 };
// `layout.maxScroll` is the browser's clamp: the content's width minus the
// container's, which a zoom out lowers in the same commit as the zoom.
const layout = { maxScroll: Infinity };
function fakeLayout(element: HTMLDivElement, scrollLeft = 1000) {
  let value = scrollLeft;
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: RECT.width });
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => Math.min(value, layout.maxScroll),
    set: (v: number) => {
      value = Math.min(v, layout.maxScroll);
    },
  });
  element.getBoundingClientRect = () => ({ ...RECT, x: RECT.left, y: RECT.top, toJSON() {} });
}

const laidOut = new WeakSet<HTMLDivElement>();
const state = { element: null as HTMLDivElement | null, committed: null as React.RefObject<number> | null };
const Harness: React.FC<{ spp: number }> = ({ spp }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  state.committed = useZoomAnchor(ref, spp);
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
  target: EventTarget = window
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
  it('keeps the time under a mouse that is over the container', () => {
    const view = render(<Harness spp={1000} />);
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' });
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2100);
    expect(state.committed!.current).toBe(500);
  });

  it('keeps the centre when the mouse is outside the container (a zoom button)', () => {
    const view = render(<Harness spp={1000} />);
    pointer('pointermove', { clientX: 600, clientY: 100, pointerType: 'mouse' });
    view.rerender(<Harness spp={500} />);
    // Centre: content pixel 1200 at 1000 spp is 2400 at 500 spp, minus 200.
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('keeps the centre before any pointer has moved', () => {
    const view = render(<Harness spp={1000} />);
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a touch does not hover: the centre is kept', () => {
    const view = render(<Harness spp={1000} />);
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' });
    pointer('pointerdown', { clientX: 200, clientY: 100, pointerType: 'touch' });
    view.rerender(<Harness spp={500} />);
    expect(state.element!.scrollLeft).toBe(2200);
  });

  it('a pointer that left the window is not over the container', () => {
    const view = render(<Harness spp={1000} />);
    pointer('pointermove', { clientX: 200, clientY: 100, pointerType: 'mouse' });
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
