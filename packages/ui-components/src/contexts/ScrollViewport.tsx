import React, {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  ReactNode,
} from 'react';

export interface ScrollViewport {
  scrollLeft: number;
  containerWidth: number;
  /** Left edge of the rendering window in pixels. Includes a 1.5× container-width over-scan buffer to the left of the visible area. */
  visibleStart: number;
  /** Right edge of the rendering window in pixels. Includes a 1.5× container-width over-scan buffer to the right of the visible area. */
  visibleEnd: number;
}

/**
 * External store for viewport state. Using useSyncExternalStore instead of
 * React context state allows consumers to use selectors — they only re-render
 * when their derived value changes, not on every viewport update.
 */
class ViewportStore {
  private _state: ScrollViewport | null;
  private _listeners = new Set<() => void>();
  private _notifyRafId: number | null = null;

  constructor(containerEl?: HTMLElement | null) {
    // Seed with actual container width if available, otherwise estimate from
    // window.innerWidth. This prevents the first render from mounting ALL
    // canvas chunks (viewport=null → no filtering), only to prune them to
    // ~3 visible chunks after the first measurement.
    const width =
      containerEl?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
    const buffer = width * 1.5;
    this._state = {
      scrollLeft: 0,
      containerWidth: width,
      visibleStart: 0,
      visibleEnd: width + buffer,
    };
  }

  subscribe = (callback: () => void): (() => void) => {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  };

  getSnapshot = (): ScrollViewport | null => this._state;

  /**
   * Update viewport state. Applies a 100px scroll threshold to skip updates
   * that don't affect chunk visibility (1000px chunks with 1.5× overscan buffer).
   * Only notifies listeners when the state actually changes.
   *
   * Listener notification is deferred by one frame via requestAnimationFrame
   * to avoid conflicting with React 19's concurrent rendering. When React
   * time-slices a render across frames, synchronous useSyncExternalStore
   * notifications can trigger "Should not already be working" errors.
   */
  update(scrollLeft: number, containerWidth: number): void {
    const buffer = containerWidth * 1.5;
    const visibleStart = Math.max(0, scrollLeft - buffer);
    const visibleEnd = scrollLeft + containerWidth + buffer;

    // Skip update if scroll hasn't moved enough to matter for chunk visibility.
    if (
      this._state &&
      this._state.containerWidth === containerWidth &&
      Math.abs(this._state.scrollLeft - scrollLeft) < 100
    ) {
      return;
    }

    this._state = { scrollLeft, containerWidth, visibleStart, visibleEnd };

    // Defer listener notification to the next frame so it doesn't fire
    // during React's concurrent render time-slice. getSnapshot() returns
    // the new state immediately, so React picks it up on the next render.
    if (this._notifyRafId === null) {
      this._notifyRafId = requestAnimationFrame(() => {
        this._notifyRafId = null;
        for (const listener of this._listeners) {
          listener();
        }
      });
    }
  }

  cancelPendingNotification(): void {
    if (this._notifyRafId !== null) {
      cancelAnimationFrame(this._notifyRafId);
      this._notifyRafId = null;
    }
  }
}

const ViewportStoreContext = createContext<ViewportStore | null>(null);

// Stable no-op subscribe for when no provider exists
const EMPTY_SUBSCRIBE = () => () => {};
const NULL_SNAPSHOT = () => null;

type ScrollViewportProviderProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
};

export const ScrollViewportProvider = ({ containerRef, children }: ScrollViewportProviderProps) => {
  const storeRef = useRef<ViewportStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new ViewportStore(containerRef.current);
  }
  const store = storeRef.current;
  const rafIdRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    store.update(el.scrollLeft, el.clientWidth);
  }, [containerRef, store]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      measure();
    });
  }, [measure]);

  // Synchronous initial measurement so children have viewport data on first render.
  // Without this, viewport is null during the first paint and all canvas chunks
  // mount (e.g., 8 per track × 13 tracks = 104 canvases), only to be pruned to
  // ~3 visible chunks after the useEffect measurement fires post-paint.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Scroll listener throttled via requestAnimationFrame
    el.addEventListener('scroll', scheduleUpdate, { passive: true });

    // ResizeObserver for container width changes
    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', scheduleUpdate);
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      store.cancelPendingNotification();
    };
  }, [containerRef, scheduleUpdate, store]);

  return <ViewportStoreContext value={store}>{children}</ViewportStoreContext>;
};

/**
 * Full viewport hook — re-renders on every viewport update (after threshold).
 * Use useScrollViewportSelector() instead when you only need derived state.
 */
export const useScrollViewport = (): ScrollViewport | null => {
  const store = use(ViewportStoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : EMPTY_SUBSCRIBE,
    store ? store.getSnapshot : NULL_SNAPSHOT,
    NULL_SNAPSHOT
  );
};

/**
 * Selector hook — only re-renders when the selector's return value changes
 * (compared via Object.is). Return primitive values (strings, numbers) for
 * best results, since objects/arrays create new references each call.
 *
 * Example: compute visible chunk key so the component only re-renders when
 * the set of visible chunks actually changes, not on every scroll update.
 */
export function useScrollViewportSelector<T>(selector: (viewport: ScrollViewport | null) => T): T {
  const store = use(ViewportStoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : EMPTY_SUBSCRIBE,
    () => selector(store ? store.getSnapshot() : null),
    () => selector(null)
  );
}

/**
 * Returns the indices of canvas chunks that are currently visible (plus overscan buffer).
 * Only triggers a re-render when the set of visible chunks changes, not on every scroll pixel.
 *
 * @param totalWidth Total width in CSS pixels of the content being chunked.
 * @param chunkWidth Width of each chunk in CSS pixels (typically MAX_CANVAS_WIDTH, 1000).
 * @param originX Pixel offset of this content's origin within the global scroll container.
 *   Clips not starting at position 0 must provide their left offset so chunk visibility
 *   is computed in global viewport coordinates. Defaults to 0 (e.g., TimeScale).
 */
export function useVisibleChunkIndices(
  totalWidth: number,
  chunkWidth: number,
  originX: number = 0
): number[] {
  const visibleChunkKey = useScrollViewportSelector((viewport) => {
    const totalChunks = Math.ceil(totalWidth / chunkWidth);
    const indices: number[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkLeft = i * chunkWidth;
      const thisChunkWidth = Math.min(totalWidth - chunkLeft, chunkWidth);

      if (viewport) {
        // Convert local chunk coordinates to global viewport space
        const chunkLeftGlobal = originX + chunkLeft;
        const chunkEndGlobal = chunkLeftGlobal + thisChunkWidth;
        if (chunkEndGlobal <= viewport.visibleStart || chunkLeftGlobal >= viewport.visibleEnd) {
          continue;
        }
      }

      indices.push(i);
    }

    return indices.join(',');
  });

  // Memoize on the key string so the returned array is referentially stable
  // between renders — safe to use directly in useLayoutEffect dependency arrays.
  return useMemo(
    () => (visibleChunkKey ? visibleChunkKey.split(',').map(Number) : []),
    [visibleChunkKey]
  );
}
