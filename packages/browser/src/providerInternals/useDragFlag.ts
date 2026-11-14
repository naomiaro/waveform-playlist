/**
 * The provider's `isDraggingRef` (`useEngineRefs().isDraggingRef`), which
 * `useClipDragHandlers` sets for the length of a trim drag. It is a ref whose
 * `current` tells the provider when it goes from true to false: a release
 * that changes nothing in the engine causes no render, and the provider may
 * be holding back something that arrived during the drag (#812).
 */

import { useRef, useState, type MutableRefObject } from 'react';

export function useDragFlag(onRelease: () => void): MutableRefObject<boolean> {
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;
  const [flag] = useState<MutableRefObject<boolean>>(() => {
    let dragging = false;
    return {
      get current() {
        return dragging;
      },
      set current(next: boolean) {
        const released = dragging && !next;
        dragging = next;
        if (released) onReleaseRef.current();
      },
    };
  });
  return flag;
}
