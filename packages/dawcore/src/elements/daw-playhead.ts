import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('daw-playhead')
export class DawPlayheadElement extends LitElement {
  private _line: HTMLElement | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    }
    div {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--daw-playhead-color, #d08070);
      will-change: transform;
    }
  `;

  render() {
    return html`<div></div>`;
  }

  firstUpdated() {
    this._line = this.shadowRoot!.querySelector('div');
  }

  /** Position the playhead line at an absolute pixel offset on the timeline.
   *  The editor's PlaybackAnimationController drives this each frame — the
   *  playhead owns no animation loop or time math of its own. */
  setPosition(px: number) {
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-playhead': DawPlayheadElement;
  }
}
