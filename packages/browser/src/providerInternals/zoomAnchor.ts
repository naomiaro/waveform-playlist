import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Where a zoom change keeps the view (#828). The time at `anchorX` (pixels
 * from the left edge of the scroll container's visible area) before the zoom
 * is at the same `anchorX` after it. The browser clamps a `scrollLeft` past
 * the end; this clamps below 0.
 */
export function anchoredScrollLeft({
  scrollLeft,
  anchorX,
  oldSamplesPerPixel,
  newSamplesPerPixel,
}: {
  scrollLeft: number;
  anchorX: number;
  oldSamplesPerPixel: number;
  newSamplesPerPixel: number;
}): number {
  const contentX = ((scrollLeft + anchorX) * oldSamplesPerPixel) / newSamplesPerPixel;
  return Math.max(0, Math.round(contentX - anchorX));
}

/** The last position of a hovering pointer (mouse or pen), in client coordinates. */
interface HoverPoint {
  x: number;
  y: number;
}

/**
 * The anchor of a zoom change: the hovering pointer when it is over the
 * scroll container, its centre otherwise (a click on a zoom button puts the
 * pointer on the button, outside the container).
 */
export function zoomAnchorX(container: HTMLElement, hover: HoverPoint | null): number {
  if (hover) {
    const rect = container.getBoundingClientRect();
    if (
      hover.x >= rect.left &&
      hover.x < rect.right &&
      hover.y >= rect.top &&
      hover.y < rect.bottom
    ) {
      return hover.x - rect.left;
    }
  }
  return container.clientWidth / 2;
}

/**
 * Keeps the view anchored across a zoom change, for both providers: the time
 * under the hovering pointer stays under it when the pointer is over the
 * scroll container, and the time at the centre stays at the centre
 * otherwise. Touch input does not hover, so a touch clears the point.
 *
 * The scroll position the anchor starts from is the one recorded from the
 * container's scroll events (and from this hook's own writes), not the one
 * read after the commit: a zoom out shrinks the content in the same commit,
 * and the browser has clamped `scrollLeft` to the new width by the time the
 * layout effect reads it.
 *
 * Returns the committed zoom level as a ref, for the animation loop: it is
 * written in a layout effect, so a render that React throws away (a
 * suspended transition) does not reach the loop.
 */
export function useZoomAnchor(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  samplesPerPixel: number
): React.RefObject<number> {
  const committedRef = useRef(samplesPerPixel);
  const hoverRef = useRef<HoverPoint | null>(null);
  const scrolledRef = useRef<{ element: HTMLElement; scrollLeft: number } | null>(null);

  useEffect(() => {
    // Scroll events do not bubble; a capturing listener on the document sees
    // the container's, whichever element the container is now.
    const onScroll = (event: Event) => {
      const element = scrollContainerRef.current;
      if (element && event.target === element) {
        scrolledRef.current = { element, scrollLeft: element.scrollLeft };
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [scrollContainerRef]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      hoverRef.current =
        event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY };
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') hoverRef.current = null;
    };
    // The pointer left the window: nothing is hovered.
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) hoverRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerout', onOut);
    };
  }, []);

  // A layout effect: the scroll is set before the new zoom is painted. It
  // runs again with the same level on a StrictMode remount and an
  // <Activity> reveal; the committed ref makes those do nothing.
  useLayoutEffect(() => {
    const oldSamplesPerPixel = committedRef.current;
    committedRef.current = samplesPerPixel;
    if (oldSamplesPerPixel === samplesPerPixel) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrolled = scrolledRef.current;
    const scrollLeft = scrolled?.element === container ? scrolled.scrollLeft : container.scrollLeft;
    container.scrollLeft = anchoredScrollLeft({
      scrollLeft,
      anchorX: zoomAnchorX(container, hoverRef.current),
      oldSamplesPerPixel,
      newSamplesPerPixel: samplesPerPixel,
    });
    scrolledRef.current = { element: container, scrollLeft: container.scrollLeft };
  }, [samplesPerPixel, scrollContainerRef]);

  return committedRef;
}
