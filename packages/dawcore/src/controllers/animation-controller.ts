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
      // The callback may have called stop() (e.g. the editor's end-of-
      // timeline auto-stop fires from inside a frame). Rescheduling then
      // would leave a zombie loop burning frames with a null callback.
      if (this._callback !== null) {
        this._rafId = requestAnimationFrame(loop);
      }
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
