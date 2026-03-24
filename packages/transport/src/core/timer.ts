export class Timer {
  private _onTick: () => void;
  private _rafId: number | null = null;
  private _running = false;

  constructor(onTick: () => void) {
    this._onTick = onTick;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._scheduleFrame();
  }

  stop(): void {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _scheduleFrame(): void {
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return;
      try {
        this._onTick();
      } catch (err) {
        console.warn('[waveform-playlist] Timer tick error:', String(err));
      }
      this._scheduleFrame();
    });
  }
}
