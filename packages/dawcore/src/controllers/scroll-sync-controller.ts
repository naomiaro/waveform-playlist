import type { ReactiveController, ReactiveControllerHost } from 'lit';

// Line scrolling uses 16px per line (standard line height).
const LINE_HEIGHT_PX = 16;

/**
 * Frozen-panes scroll sync. The editor's `.scroll-area` owns both scroll
 * axes; this controller keeps the ruler band (x) and controls column (y)
 * visually locked to it by applying translate3d transforms on EVERY scroll
 * event. (ViewportController's 100px threshold exists for chunk
 * virtualization and is too coarse for visual sync.)
 *
 * Also forwards wheel events from ALL elements matched by `wheelForwardSelector`
 * to the scroll container for both axes:
 *   - Horizontal scrub (deltaX) — ruler band stays in sync when the user
 *     scrolls the timeline left/right while hovering the ruler.
 *   - Vertical scroll (deltaY) — controls column lets the user scroll track
 *     rows while hovering the track controls.
 *
 * preventDefault fires only when at least one axis actually moved, so page
 * scrolling is unaffected for unconstrained editors and boundary scrolling
 * chains properly.
 */
export class ScrollSyncController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _wheelTargets: Set<HTMLElement> = new Set();
  private _warnedX = false;
  private _warnedY = false;

  /** Selector (in host shadow DOM) for the scroll container. */
  scrollSelector = '';
  /** Selector for the element receiving translate3d(-scrollLeft, 0, 0). */
  xTargetSelector = '';
  /** Selector for the element receiving translate3d(0, -scrollTop, 0). */
  yTargetSelector = '';
  /**
   * Selector (or comma-separated selectors) for elements whose wheel events
   * forward to the scroll container. All matching elements receive listeners.
   */
  wheelForwardSelector = '';

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {
    // Defer so the Shadow DOM renders before querying (same pattern as
    // ViewportController).
    requestAnimationFrame(() => {
      if (!this._host.isConnected) return;
      this._attach();
      if (!this._scrollContainer && this.scrollSelector) {
        console.warn(
          '[dawcore] ScrollSyncController: scroll container not found for "' +
            this.scrollSelector +
            '"'
        );
      }
    });
  }

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = null;
    for (const target of this._wheelTargets) {
      target.removeEventListener('wheel', this._onWheel);
    }
    this._wheelTargets.clear();
  }

  /**
   * Re-attach and re-apply transforms from the current scroll position.
   * Called from the host's updated() so elements created by a re-render
   * (e.g. the ruler appearing when the first track loads) pick up the
   * current offset and listeners.
   */
  sync() {
    this._attach();
  }

  private _query(selector: string): HTMLElement | null {
    return selector ? (this._host.shadowRoot?.querySelector(selector) as HTMLElement | null) : null;
  }

  private _queryAll(selector: string): HTMLElement[] {
    if (!selector) return [];
    return Array.from(this._host.shadowRoot?.querySelectorAll(selector) ?? []) as HTMLElement[];
  }

  private _attach() {
    const container = this._query(this.scrollSelector);
    if (!container) {
      if (this._scrollContainer && !this._scrollContainer.isConnected) {
        console.warn(
          '[dawcore] ScrollSyncController: scroll container "' +
            this.scrollSelector +
            '" was removed from the DOM — detaching listeners until it reappears.'
        );
        this._scrollContainer.removeEventListener('scroll', this._onScroll);
        this._scrollContainer = null;
        for (const t of this._wheelTargets) t.removeEventListener('wheel', this._onWheel);
        this._wheelTargets.clear();
      }
      return;
    }
    if (container !== this._scrollContainer) {
      this._scrollContainer?.removeEventListener('scroll', this._onScroll);
      this._scrollContainer = container;
      container.addEventListener('scroll', this._onScroll, { passive: true });
    }

    // Diff the current set of matched wheel targets.
    const nextTargets = new Set(this._queryAll(this.wheelForwardSelector));
    for (const old of this._wheelTargets) {
      if (!nextTargets.has(old)) {
        old.removeEventListener('wheel', this._onWheel);
        this._wheelTargets.delete(old);
      }
    }
    for (const next of nextTargets) {
      if (!this._wheelTargets.has(next)) {
        next.addEventListener('wheel', this._onWheel, { passive: false });
        this._wheelTargets.add(next);
      }
    }

    this._apply();
  }

  private _onScroll = () => {
    this._apply();
  };

  private _onWheel = (e: WheelEvent) => {
    const sc = this._scrollContainer;
    if (!sc) return;

    const scale =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_HEIGHT_PX
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? sc.clientHeight // used for Y; X uses clientWidth below
          : 1;

    const scaleX = e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? sc.clientWidth : scale;

    const beforeLeft = sc.scrollLeft;
    const beforeTop = sc.scrollTop;

    sc.scrollLeft += e.deltaX * scaleX;
    sc.scrollTop += e.deltaY * scale;

    if (sc.scrollLeft !== beforeLeft || sc.scrollTop !== beforeTop) {
      e.preventDefault();
    }
  };

  private _apply() {
    const sc = this._scrollContainer;
    if (!sc) return;
    // Re-query targets each time: Lit conditional templates create/replace
    // these elements between renders (e.g. the header row appears with the
    // first loaded track).
    const xTarget = this._query(this.xTargetSelector);
    if (xTarget) {
      xTarget.style.transform = `translate3d(${-sc.scrollLeft}px, 0, 0)`;
      this._warnedX = false;
    } else if (this.xTargetSelector && sc.scrollLeft !== 0 && !this._warnedX) {
      this._warnedX = true;
      console.warn(
        '[dawcore] ScrollSyncController: x target "' +
          this.xTargetSelector +
          '" not found while scrolled — the synced pane will appear frozen. Check the selector, or clear it if the target is intentionally not rendered.'
      );
    }
    const yTarget = this._query(this.yTargetSelector);
    if (yTarget) {
      yTarget.style.transform = `translate3d(0, ${-sc.scrollTop}px, 0)`;
      this._warnedY = false;
    } else if (this.yTargetSelector && sc.scrollTop !== 0 && !this._warnedY) {
      this._warnedY = true;
      console.warn(
        '[dawcore] ScrollSyncController: y target "' +
          this.yTargetSelector +
          '" not found while scrolled — the synced pane will appear frozen. Check the selector, or clear it if the target is intentionally not rendered.'
      );
    }
  }
}
