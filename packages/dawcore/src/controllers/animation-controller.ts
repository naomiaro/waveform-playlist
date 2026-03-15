import type { ReactiveController, ReactiveControllerHost } from 'lit';

export class AnimationController implements ReactiveController {
  private _rafId: number | null = null;
  private _callback: (() => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  start(callback: () => void) {
    this.stop();
    this._callback = callback;
    const loop = () => {
      this._callback?.();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._callback = null;
  }

  hostConnected() {}

  hostDisconnected() {
    this.stop();
  }
}
