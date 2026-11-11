import { useEffect, useLayoutEffect, useRef } from 'react';

// Page text selection is switched off while any drag is active. Counted, so
// that two components dragging at once cannot restore each other's 'none'.
let activeDrags = 0;
let userSelectBeforeDrags = '';

function suspendTextSelection(): () => void {
  const root = document.documentElement;
  if (activeDrags === 0) {
    userSelectBeforeDrags = root.style.userSelect;
    root.style.userSelect = 'none';
  }
  activeDrags++;
  return () => {
    activeDrags--;
    if (activeDrags === 0) {
      root.style.userSelect = userSelectBeforeDrags;
    }
  };
}

/**
 * Follows a mouse drag that began on an element for as long as the primary
 * button is held, wherever the pointer goes.
 *
 * An element's own `mousemove` / `mouseup` handlers stop running when the
 * pointer leaves it, so a drag tracked with them stalls outside the element
 * and, after a release outside, stays "active" with no button held. While
 * `active`, this listens on the window instead (capture phase, so a
 * `stopPropagation()` elsewhere on the page cannot hide the release):
 *
 * - `onMove` for every `mousemove` with the primary button held;
 * - `onEnd` for `mouseup`, with the event;
 * - `onEnd(null)` when the drag ended without a release position: the window
 *   lost focus (`blur`: the `mouseup` goes to another application), or a move
 *   arrives with the primary button no longer held (the `mouseup` was lost).
 *
 * Text selection on the page is switched off while `active`.
 *
 * The caller starts the drag in its `onMouseDown` (primary button only) and
 * sets `active` false in `onEnd`. The latest callbacks are called; changing
 * them does not re-subscribe.
 */
export function useWindowDrag(
  active: boolean,
  onMove: (event: MouseEvent) => void,
  onEnd: (event: MouseEvent | null) => void
): void {
  const callbacksRef = useRef({ onMove, onEnd });
  // Layout effect: the callbacks of a render are in place before any event
  // that follows its commit.
  useLayoutEffect(() => {
    callbacksRef.current = { onMove, onEnd };
  });

  useEffect(() => {
    if (!active) return;
    const move = (event: MouseEvent) => {
      if ((event.buttons & 1) === 0) {
        callbacksRef.current.onEnd(null);
        return;
      }
      callbacksRef.current.onMove(event);
    };
    const up = (event: MouseEvent) => callbacksRef.current.onEnd(event);
    const blur = () => callbacksRef.current.onEnd(null);
    // The press began on the element, so the browser would extend a text
    // selection across the page as the pointer travels over it. Switched off
    // for the length of the drag only (not with `preventDefault` on the press,
    // which would also stop the press from taking focus off a focused control).
    const resumeTextSelection = suspendTextSelection();
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('blur', blur);
    return () => {
      resumeTextSelection();
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('blur', blur);
    };
  }, [active]);
}

/**
 * The horizontal position of a pointer inside `element`, in pixels from its
 * left edge, clamped to the element: a pointer to the left of it gives 0, one
 * to the right gives its width. `null` when the element is no longer in the
 * document (its rectangle would be all zeros).
 */
export function clampedOffsetX(element: Element, clientX: number): number | null {
  if (!element.isConnected) return null;
  const rect = element.getBoundingClientRect();
  return Math.min(Math.max(clientX - rect.left, 0), rect.width);
}
