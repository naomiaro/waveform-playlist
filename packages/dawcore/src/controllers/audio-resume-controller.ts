import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { resumeGlobalAudioContext } from '@waveform-playlist/playout';

export class AudioResumeController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _target: EventTarget | null = null;
  private _attached = false;

  /** CSS selector, or 'document'. When undefined, controller is inert. */
  target?: string;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {
    // Defer to next frame so Lit's willUpdate() can set `target` from
    // the host's attribute before we read it. Same pattern as ViewportController.
    requestAnimationFrame(() => {
      if (!this._host.isConnected || this._attached || this.target === undefined) return;

      const resolvedTarget = this._resolveTarget();
      if (!resolvedTarget) return;

      this._target = resolvedTarget;
      this._attached = true;
      resolvedTarget.addEventListener('pointerdown', this._onGesture, {
        once: true,
        capture: true,
      });
      resolvedTarget.addEventListener('keydown', this._onGesture, {
        once: true,
        capture: true,
      });
    });
  }

  hostDisconnected() {
    this._removeListeners();
    this._attached = false;
  }

  private _onGesture = (e: Event) => {
    resumeGlobalAudioContext();
    // Remove the other listener (the fired one was auto-removed by { once: true })
    const otherType = e.type === 'pointerdown' ? 'keydown' : 'pointerdown';
    this._target?.removeEventListener(otherType, this._onGesture, {
      capture: true,
    });
    this._target = null;
  };

  private _resolveTarget(): EventTarget | null {
    const t = this.target;
    if (t === undefined) return null;
    if (t === '') return this._host;
    if (t === 'document') return document;

    const el = document.querySelector(t);
    if (!el) {
      console.warn('[dawcore] AudioResumeController: target not found for "' + t + '", using host');
      return this._host;
    }
    return el;
  }

  private _removeListeners() {
    if (!this._target) return;
    this._target.removeEventListener('pointerdown', this._onGesture, {
      capture: true,
    });
    this._target.removeEventListener('keydown', this._onGesture, {
      capture: true,
    });
    this._target = null;
  }
}
