import { useEffect, useState } from 'react';

/**
 * True while `active` is true and for `trailingMs` after it turns false.
 * Used to keep the track-reorder transform transition enabled through the
 * cancel-revert animation (see the drag-preview spec) without animating
 * unrelated layout changes outside a drag.
 */
export function useTrailingActive(active: boolean, trailingMs: number): boolean {
  const [trailing, setTrailing] = useState(active);
  useEffect(() => {
    if (active) {
      setTrailing(true);
      return undefined;
    }
    const timer = setTimeout(() => setTrailing(false), trailingMs);
    return () => clearTimeout(timer);
  }, [active, trailingMs]);
  return trailing || active;
}
