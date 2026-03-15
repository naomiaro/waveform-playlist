import type { ReactiveController, ReactiveControllerHost } from 'lit';

const OVERSCAN_MULTIPLIER = 1.5;
const SCROLL_THRESHOLD = 100;

export class ViewportController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _lastScrollLeft = 0;

  visibleStart = 0;
  visibleEnd = 0;
  containerWidth = 0;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  attachScrollContainer(container: HTMLElement) {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = container;
    container.addEventListener('scroll', this._onScroll, { passive: true });
    this._update(container.scrollLeft, container.clientWidth);
  }

  getVisibleChunkIndices(totalWidth: number, chunkWidth: number, originX = 0): number[] {
    const totalChunks = Math.ceil(totalWidth / chunkWidth);
    const indices: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = originX + i * chunkWidth;
      const chunkEnd = chunkStart + chunkWidth;
      if (chunkEnd > this.visibleStart && chunkStart < this.visibleEnd) {
        indices.push(i);
      }
    }
    return indices;
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

  hostConnected() {}

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = null;
  }
}
