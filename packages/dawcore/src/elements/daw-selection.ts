import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-selection')
export class DawSelectionElement extends LitElement {
  @property({ type: Number, attribute: false }) startPx = 0;
  @property({ type: Number, attribute: false }) endPx = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      pointer-events: none;
      z-index: 5;
    }
    div {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--daw-selection-color, rgba(99, 199, 95, 0.3));
    }
  `;

  render() {
    const left = Math.min(this.startPx, this.endPx);
    const width = Math.abs(this.endPx - this.startPx);
    if (width === 0) return html``;
    return html`<div style="left: ${left}px; width: ${width}px;"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-selection': DawSelectionElement;
  }
}
