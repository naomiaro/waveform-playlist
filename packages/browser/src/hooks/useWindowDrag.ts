import { useEffect, useRef } from 'react';

/**
 * Follows a mouse drag that began on an element for as long as the button is
 * held, wherever the pointer goes.
 *
 * An element's own `mousemove` / `mouseup` handlers stop running when the
 * pointer leaves it, so a drag tracked with them stalls outside the element
 * and, after a release outside, stays "active" with no button held. While
 * `active`, this listens on the window instead:
 *
 * - `onMove` for every `mousemove`;
 * - `onEnd` for `mouseup`, with the event;
 * - `onEnd(null)` for `blur`: after switching to another application mid-drag
 *   the `mouseup` goes elsewhere, so the drag ends without a final position.
 *
 * Text selection on the page is switched off while `active`.
 *
 * The caller starts the drag in its `onMouseDown` and sets `active` false in
 * `onEnd`. The latest callbacks are called; changing them does not
 * re-subscribe.
 */
export function useWindowDrag(
  active: boolean,
  onMove: (event: MouseEvent) => void,
  onEnd: (event: MouseEvent | null) => void
): void {
  const callbacksRef = useRef({ onMove, onEnd });
  useEffect(() => {
    callbacksRef.current = { onMove, onEnd };
  });

  useEffect(() => {
    if (!active) return;
    const move = (event: MouseEvent) => callbacksRef.current.onMove(event);
    const up = (event: MouseEvent) => callbacksRef.current.onEnd(event);
    const blur = () => callbacksRef.current.onEnd(null);
    // The press began on the element, so the browser would extend a text
    // selection across the page as the pointer travels over it. Switched off
    // for the length of the drag only (not with `preventDefault` on the press,
    // which would also stop the press from taking focus off a focused control).
    const root = document.documentElement;
    const previousUserSelect = root.style.userSelect;
    root.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', blur);
    return () => {
      root.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('blur', blur);
    };
  }, [active]);
}

/**
 * The horizontal position of a pointer inside `element`, in pixels from its
 * left edge, clamped to the element: a pointer to the left of it gives 0, one
 * to the right gives its width.
 */
export function clampedOffsetX(element: Element, clientX: number): number {
  const rect = element.getBoundingClientRect();
  return Math.min(Math.max(clientX - rect.left, 0), rect.width);
}
