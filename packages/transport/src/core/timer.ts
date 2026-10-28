/**
 * Drives the scheduler at a fixed cadence.
 *
 * Primary source: a Web Worker running a setTimeout loop. Browsers stop
 * requestAnimationFrame and throttle main-thread timers in a hidden tab, but
 * Worker timers and message delivery keep their cadence, so the scheduler's
 * lookahead window never runs dry while the tab is in the background (#636).
 * One Worker lives for the Timer's lifetime; start/stop are messages, so a
 * seek during playback costs no Worker spin-up.
 *
 * Fallback: a main-thread setTimeout loop, used when there is no Worker/Blob
 * URL support (Node, SSR) or constructing the Worker is refused (a CSP without
 * `worker-src blob:`). Correct while the tab is visible or audible; a hidden,
 * silent tab may throttle it to ~1 Hz, which exceeds the 200 ms lookahead.
 *
 * requestAnimationFrame is never used — it belongs to UI position updates.
 */

/** Tick cadence. 25 ms gives 8× headroom under the scheduler's default
 *  200 ms lookahead; a Worker message every 25 ms is negligible load. */
export const DEFAULT_TIMER_INTERVAL_MS = 25;

export interface TimerOptions {
  /** Milliseconds between ticks. Default DEFAULT_TIMER_INTERVAL_MS. */
  intervalMs?: number;
}

type TimerWorkerMessage = { type: 'start'; intervalMs: number } | { type: 'stop' };

/** The Worker body. Plain ES5-ish source so it needs no bundler support. */
const TIMER_WORKER_SCRIPT =
  'var timeoutId = null;\n' +
  'var intervalMs = ' +
  DEFAULT_TIMER_INTERVAL_MS +
  ';\n' +
  'function tick() {\n' +
  '  timeoutId = setTimeout(tick, intervalMs);\n' +
  "  postMessage('tick');\n" +
  '}\n' +
  'onmessage = function (event) {\n' +
  '  var message = event.data;\n' +
  '  if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }\n' +
  "  if (message && message.type === 'start') {\n" +
  '    intervalMs = message.intervalMs;\n' +
  '    timeoutId = setTimeout(tick, intervalMs);\n' +
  '  }\n' +
  '};\n';

export class Timer {
  private readonly _onTick: () => void;
  private readonly _intervalMs: number;
  private _running = false;
  private _worker: Worker | null = null;
  private _workerUrl: string | null = null;
  /** Set once the Worker path has been ruled out for this Timer. */
  private _useTimeoutFallback = false;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(onTick: () => void, options: TimerOptions = {}) {
    const intervalMs = options.intervalMs ?? DEFAULT_TIMER_INTERVAL_MS;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error(
        '[waveform-playlist] Timer: intervalMs must be a positive number, got ' + intervalMs
      );
    }
    this._onTick = onTick;
    this._intervalMs = intervalMs;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    const worker = this._ensureWorker();
    if (worker) {
      this._post(worker, { type: 'start', intervalMs: this._intervalMs });
    } else {
      this._scheduleTimeout();
    }
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._worker) {
      this._post(this._worker, { type: 'stop' });
    }
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  /** Stop and release the Worker. The Timer cannot be restarted afterwards
   *  without creating a new Worker, which start() does on demand. */
  dispose(): void {
    this.stop();
    if (this._worker) {
      this._worker.onmessage = null;
      this._worker.terminate();
      this._worker = null;
    }
    if (this._workerUrl !== null) {
      URL.revokeObjectURL(this._workerUrl);
      this._workerUrl = null;
    }
  }

  private _handleTick(): void {
    // A Worker tick may be in flight when stop() was posted; drop it.
    if (!this._running) return;
    try {
      this._onTick();
    } catch (err) {
      console.warn('[waveform-playlist] Timer tick error: ' + String(err));
    }
  }

  private _scheduleTimeout(): void {
    this._timeoutId = setTimeout(() => {
      this._timeoutId = null;
      this._handleTick();
      // _onTick() may have called stop()
      if (this._running) this._scheduleTimeout();
    }, this._intervalMs);
  }

  private _post(worker: Worker, message: TimerWorkerMessage): void {
    worker.postMessage(message);
  }

  private _ensureWorker(): Worker | null {
    if (this._worker) return this._worker;
    if (this._useTimeoutFallback) return null;
    if (
      typeof Worker === 'undefined' ||
      typeof Blob === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      // No Worker platform at all (Node, SSR): nothing surprising to report.
      this._useTimeoutFallback = true;
      return null;
    }
    try {
      const url = URL.createObjectURL(new Blob([TIMER_WORKER_SCRIPT], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => this._handleTick();
      this._worker = worker;
      this._workerUrl = url;
      return worker;
    } catch (err) {
      this._useTimeoutFallback = true;
      console.warn(
        '[waveform-playlist] Timer: could not start a Worker ticker (' +
          String(err) +
          '); falling back to a main-thread setTimeout loop, which browsers may throttle in a hidden tab'
      );
      return null;
    }
  }
}
