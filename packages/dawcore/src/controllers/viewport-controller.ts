import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { getVisibleChunkIndices } from '../utils/viewport';

export { getVisibleChunkIndices };

const OVERSCAN_MULTIPLIER = 1.5;
const SCROLL_THRESHOLD = 100;

export class ViewportController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _lastScrollLeft = 0;
  private _resizeObserver: ResizeObserver | null = null;

  // Permissive defaults: render everything until scroll container is attached
  visibleStart = -Infinity;
  visibleEnd = Infinity;
  containerWidth = 0;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  /** CSS selector for the scroll container inside the host's Shadow DOM. */
  scrollSelector = '';

  hostConnected() {
    // Defer to allow Shadow DOM to render before querying
    requestAnimationFrame(() => {
      if (!this._host.isConnected) return;
      const container = this.scrollSelector
        ? (this._host.shadowRoot?.querySelector(this.scrollSelector) as HTMLElement)
        : this._host;
      if (container) {
        this._attachScrollContainer(container);
      } else if (this.scrollSelector) {
        console.warn(
          '[dawcore] ViewportController: scroll container not found for "' +
            this.scrollSelector +
            '"'
        );
      }
    });
  }

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._scrollContainer = null;
  }

  private _attachScrollContainer(container: HTMLElement) {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._resizeObserver?.disconnect();
    this._scrollContainer = container;
    container.addEventListener('scroll', this._onScroll, { passive: true });
    this._update(container.scrollLeft, container.clientWidth);
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        if (!this._scrollContainer) return;
        const next = this._scrollContainer.clientWidth;
        if (next === this.containerWidth) return;
        this._update(this._scrollContainer.scrollLeft, next);
        this._host.requestUpdate();
      });
      this._resizeObserver.observe(container);
    }
    this._host.requestUpdate();
  }

  private _onScroll = () => {
    if (!this._scrollContainer) return;
    const { scrollLeft, clientWidth } = this._scrollContainer;
    if (Math.abs(scrollLeft - this._lastScrollLeft) >= SCROLL_THRESHOLD) {
      this._update(scrollLeft, clientWidth);
      this._host.requestUpdate();
    }
  };

  private _update(scrollLeft: number, containerWidth: number) {
    this._lastScrollLeft = scrollLeft;
    this.containerWidth = containerWidth;
    const buffer = containerWidth * OVERSCAN_MULTIPLIER;
    this.visibleStart = scrollLeft - buffer;
    this.visibleEnd = scrollLeft + containerWidth + buffer;
  }
}
