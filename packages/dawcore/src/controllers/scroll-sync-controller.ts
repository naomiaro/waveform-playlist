import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Frozen-panes scroll sync. The editor's `.scroll-area` owns both scroll
 * axes; this controller keeps the ruler band (x) and controls column (y)
 * visually locked to it by applying translate3d transforms on EVERY scroll
 * event. (ViewportController's 100px threshold exists for chunk
 * virtualization and is too coarse for visual sync.)
 *
 * Also forwards wheel deltaY over the controls viewport to the scroll
 * container so the mouse wheel scrolls tracks while hovering the controls.
 * preventDefault fires only when the container is actually vertically
 * scrollable, so page scrolling is unaffected for unconstrained editors.
 */
export class ScrollSyncController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _wheelTarget: HTMLElement | null = null;

  /** Selector (in host shadow DOM) for the scroll container. */
  scrollSelector = '';
  /** Selector for the element receiving translate3d(-scrollLeft, 0, 0). */
  xTargetSelector = '';
  /** Selector for the element receiving translate3d(0, -scrollTop, 0). */
  yTargetSelector = '';
  /** Selector for the element whose wheel events forward to the container. */
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
    });
  }

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._wheelTarget?.removeEventListener('wheel', this._onWheel);
    this._scrollContainer = null;
    this._wheelTarget = null;
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

  private _attach() {
    const container = this._query(this.scrollSelector);
    if (!container) return;
    if (container !== this._scrollContainer) {
      this._scrollContainer?.removeEventListener('scroll', this._onScroll);
      this._scrollContainer = container;
      container.addEventListener('scroll', this._onScroll, { passive: true });
    }
    const wheelTarget = this._query(this.wheelForwardSelector);
    if (wheelTarget !== this._wheelTarget) {
      this._wheelTarget?.removeEventListener('wheel', this._onWheel);
      this._wheelTarget = wheelTarget;
      wheelTarget?.addEventListener('wheel', this._onWheel, { passive: false });
    }
    this._apply();
  }

  private _onScroll = () => {
    this._apply();
  };

  private _onWheel = (e: WheelEvent) => {
    const sc = this._scrollContainer;
    if (!sc) return;
    if (sc.scrollHeight <= sc.clientHeight) return;
    sc.scrollTop += e.deltaY;
    e.preventDefault();
  };

  private _apply() {
    const sc = this._scrollContainer;
    if (!sc) return;
    // Re-query targets each time: Lit conditional templates create/replace
    // these elements between renders (e.g. the header row appears with the
    // first loaded track).
    const xTarget = this._query(this.xTargetSelector);
    if (xTarget) xTarget.style.transform = `translate3d(${-sc.scrollLeft}px, 0, 0)`;
    const yTarget = this._query(this.yTargetSelector);
    if (yTarget) yTarget.style.transform = `translate3d(0, ${-sc.scrollTop}px, 0)`;
  }
}
