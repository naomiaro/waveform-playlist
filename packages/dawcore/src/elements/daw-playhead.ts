import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { AnimationController } from '../controllers/animation-controller';

@customElement('daw-playhead')
export class DawPlayheadElement extends LitElement {
  private _animation = new AnimationController(this);
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

  startAnimation(getTime: () => number, sampleRate: number, samplesPerPixel: number) {
    this._animation.start(() => {
      const time = getTime();
      const px = (time * sampleRate) / samplesPerPixel;
      if (this._line) {
        this._line.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    });
  }

  stopAnimation(time: number, sampleRate: number, samplesPerPixel: number) {
    this._animation.stop();
    const px = (time * sampleRate) / samplesPerPixel;
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }

  startBeatsAnimation(getTime: () => number, bpm: number, ppqn: number, ticksPerPixel: number) {
    const ticksPerSecond = (bpm * ppqn) / 60;
    this._animation.start(() => {
      const time = getTime();
      const px = (time * ticksPerSecond) / ticksPerPixel;
      if (this._line) {
        this._line.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    });
  }

  stopBeatsAnimation(time: number, bpm: number, ppqn: number, ticksPerPixel: number) {
    this._animation.stop();
    const px = (time * bpm * ppqn) / (60 * ticksPerPixel);
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
