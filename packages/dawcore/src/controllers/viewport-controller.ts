import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { getVisibleChunkIndices } from '../utils/viewport';

export { getVisibleChunkIndices };

const OVERSCAN_MULTIPLIER = 1.5;
const SCROLL_THRESHOLD = 100;

export class ViewportController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _lastScrollLeft = 0;

  // Permissive defaults: render everything until scroll container is attached
  visibleStart = -Infinity;
  visibleEnd = Infinity;
  containerWidth = 0;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {
    // Re-attach scroll listener on reconnect (e.g. element moved in DOM).
    // Use the host element itself as the scroll container (:host has overflow-x: auto).
    this._attachScrollContainer(this._host);
  }

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = null;
  }

  private _attachScrollContainer(container: HTMLElement) {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = container;
    container.addEventListener('scroll', this._onScroll, { passive: true });
    this._update(container.scrollLeft, container.clientWidth);
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
