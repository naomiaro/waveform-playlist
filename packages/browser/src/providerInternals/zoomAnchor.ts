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
export interface HoverPoint {
  x: number;
  y: number;
}

/** What a zoom can be anchored on when no pointer hovers over the timeline, in seconds. */
export interface ZoomAnchorTimes {
  selectionStart: number;
  selectionEnd: number;
  /** Where Play starts (the playhead while playing). */
  cursorTime: number;
}

/**
 * The anchor of a zoom change, in pixels from the left edge of the visible
 * area, in this order (the maintainer's choice on #828, after Audacity's):
 *
 * 1. A hovering mouse or pen over the scroll container (the timeline: the
 *    tracks and the ruler). What is under the pointer is hit-tested at the
 *    zoom, not remembered from its last move: an overlay drawn above the
 *    timeline does not count, and a ruler chunk replaced under a resting
 *    pointer (by a zoom, by wheel scrolling) does not stop it counting. A
 *    keyboard press on a zoom button does not move the pointer: a mouse
 *    resting over the timeline stays the anchor.
 * 2. A range selection that is at least partly on screen and does not fill
 *    the view: its centre, or the centre of its visible part when its centre
 *    is off screen.
 * 3. The cursor when it is on screen.
 * 4. The centre of the view.
 */
export function zoomAnchorX({
  container,
  hover,
  scrollLeft,
  samplesPerPixel,
  sampleRate,
  times,
}: {
  container: HTMLElement;
  hover: HoverPoint | null;
  scrollLeft: number;
  /** The zoom level the view is drawn at before the change. */
  samplesPerPixel: number;
  sampleRate: number;
  times: ZoomAnchorTimes;
}): number {
  const width = container.clientWidth;
  if (hover) {
    const rect = container.getBoundingClientRect();
    const inRect =
      hover.x >= rect.left && hover.x < rect.right && hover.y >= rect.top && hover.y < rect.bottom;
    const hit = inRect ? container.ownerDocument.elementFromPoint(hover.x, hover.y) : null;
    if (hit && container.contains(hit)) return hover.x - rect.left;
  }

  const toX = (seconds: number) => (seconds * sampleRate) / samplesPerPixel - scrollLeft;
  const viewStart = (scrollLeft * samplesPerPixel) / sampleRate;
  const viewEnd = ((scrollLeft + width) * samplesPerPixel) / sampleRate;

  const { selectionStart, selectionEnd, cursorTime } = times;
  if (selectionEnd > selectionStart) {
    const onScreen = selectionStart < viewEnd && selectionEnd >= viewStart;
    const fillsView = selectionStart < viewStart && selectionEnd > viewEnd;
    if (onScreen && !fillsView) {
      let centre = (selectionStart + selectionEnd) / 2;
      if (centre < viewStart) centre = viewStart + (selectionEnd - viewStart) / 2;
      if (centre > viewEnd) centre = viewEnd - (viewEnd - selectionStart) / 2;
      return toX(centre);
    }
  }

  if (cursorTime >= viewStart && cursorTime <= viewEnd) return toX(cursorTime);

  return width / 2;
}

/**
 * The scroll position a zoom starts from. The live `scrollLeft`, except after
 * a zoom out that shrank the content in the same commit: the browser has
 * clamped `scrollLeft` to the new width by the time the layout effect reads
 * it, and the position recorded from the container's last scroll event (or
 * this hook's last write) is the one the view was at. A write made by code
 * just before the zoom has not fired its scroll event yet, so the live value
 * is used whenever it is not at the clamp.
 */
export function zoomStartScrollLeft(
  container: HTMLElement,
  recorded: { element: HTMLElement; scrollLeft: number } | null
): number {
  const live = container.scrollLeft;
  if (!recorded || recorded.element !== container) return live;
  const maxScroll = container.scrollWidth - container.clientWidth;
  const clamped = live >= maxScroll - 1 && recorded.scrollLeft > live;
  return clamped ? recorded.scrollLeft : live;
}

/**
 * Keeps the view anchored across a zoom change, for both providers
 * (`zoomAnchorX` gives the order). Touch input does not hover, so a touch
 * clears the pointer.
 *
 * Returns the committed zoom level as a ref, for the animation loop: it is
 * written in a layout effect, so a render that React throws away (a
 * suspended transition) does not reach the loop.
 */
export function useZoomAnchor({
  scrollContainerRef,
  samplesPerPixel,
  sampleRate,
  getTimes,
}: {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  samplesPerPixel: number;
  sampleRate: number;
  /** Read at the zoom: the provider's selection and cursor, from its refs. */
  getTimes: () => ZoomAnchorTimes;
}): React.RefObject<number> {
  const committedRef = useRef(samplesPerPixel);
  const hoverRef = useRef<HoverPoint | null>(null);
  const scrolledRef = useRef<{ element: HTMLElement; scrollLeft: number } | null>(null);
  const latestRef = useRef({ sampleRate, getTimes });

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

  // Before the anchor effect below, which reads it (effects run in order).
  useLayoutEffect(() => {
    latestRef.current = { sampleRate, getTimes };
  });

  // A layout effect: the scroll is set before the new zoom is painted. It
  // runs again with the same level on a StrictMode remount and an
  // <Activity> reveal; the committed ref makes those do nothing.
  useLayoutEffect(() => {
    const oldSamplesPerPixel = committedRef.current;
    committedRef.current = samplesPerPixel;
    if (oldSamplesPerPixel === samplesPerPixel) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollLeft = zoomStartScrollLeft(container, scrolledRef.current);
    const { sampleRate: rate, getTimes: read } = latestRef.current;
    container.scrollLeft = anchoredScrollLeft({
      scrollLeft,
      anchorX: zoomAnchorX({
        container,
        hover: hoverRef.current,
        scrollLeft,
        samplesPerPixel: oldSamplesPerPixel,
        sampleRate: rate,
        times: read(),
      }),
      oldSamplesPerPixel,
      newSamplesPerPixel: samplesPerPixel,
    });
    scrolledRef.current = { element: container, scrollLeft: container.scrollLeft };
  }, [samplesPerPixel, scrollContainerRef]);

  return committedRef;
}
