/**
 * Keeps a dnd-kit drag-feedback element visible for the duration of a drag.
 *
 * @dnd-kit/dom's Feedback plugin promotes the dragged element into the
 * browser top layer via the Popover API (`popover="manual"` + showPopover()).
 * During a sortable drag, OptimisticSortingPlugin reorders rows with
 * `insertAdjacentElement` — a remove + reinsert that force-dismisses the
 * popover with NO toggle events (per spec, removal-dismissal fires none).
 * A dismissed `[popover]` element falls under the UA rule
 * `[popover]:not(:popover-open) { display: none }`, so the dragged row
 * vanishes the moment it crosses a collision boundary. dnd-kit's own
 * recovery MutationObserver is only created when a placeholder exists
 * (`feedback !== 'move'`), so `feedback: 'move'` sortables never recover.
 *
 * This observer mirrors that upstream recovery for the 'move' case: on any
 * childList mutation, if the element is connected but its popover was
 * dismissed, re-show it. MutationObserver callbacks run as microtasks, so
 * the heal lands in the same frame as the splice — no visible flicker.
 */
export function createDragPopoverHealer(element: HTMLElement): () => void {
  if (typeof element.showPopover !== 'function') {
    // Browser without the Popover API: dnd-kit falls back to plain
    // fixed-position feedback, which DOM splices cannot dismiss.
    return () => {};
  }
  const heal = () => {
    if (!element.isConnected || !element.hasAttribute('popover')) return;
    let open = false;
    try {
      open = element.matches(':popover-open');
    } catch {
      // Selector unsupported (older engines): treat as closed and let
      // showPopover's own InvalidStateError guard below settle it.
    }
    if (open) return;
    try {
      element.showPopover();
    } catch {
      // InvalidStateError (already open / mid-toggle) — nothing to heal.
    }
  };
  const observer = new MutationObserver(heal);
  observer.observe(element.ownerDocument.body, {
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
}
