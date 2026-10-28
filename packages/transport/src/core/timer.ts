/**
 * Drives the scheduler at a fixed cadence.
 *
 * Primary source: a Web Worker running a setTimeout loop. Browsers stop
 * requestAnimationFrame and throttle main-thread timers in a hidden tab, but
 * Worker timers and message delivery keep their cadence, so the scheduler's
 * lookahead window never runs dry while the tab is in the background (#636).
 * One Worker lives from the first start() until dispose(); start/stop are
 * messages, so a seek during playback costs no Worker spin-up.
 *
 * Fallback: a main-thread setTimeout loop, used when there is no Worker/Blob
 * URL support (Node, SSR), when constructing the Worker throws (a CSP
 * without `worker-src blob:`), when the Worker fires `error`/`messageerror`
 * after construction, or when a started Worker never delivers its first tick
 * within WATCHDOG_INTERVALS ticks (a Worker the browser killed without an
 * event). Correct while the tab is visible or audible; a hidden, silent tab
 * may throttle it to 1 Hz and, after several minutes, to once per minute —
 * far beyond the 200 ms lookahead. Only a synchronous constructor refusal is
 * remembered page-wide (it is an environment fact, warned once); a later
 * Worker death is per Timer and is warned each time it happens.
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

/** Ticks of silence after `start` before a Worker is presumed dead. */
const WATCHDOG_INTERVALS = 4;

/** Page-wide memo: once a Worker CONSTRUCTOR was refused (CSP), every later
 *  Timer skips the probe and the warning — the environment will not change. */
let workerRefusedOnThisPage = false;

/** Test hook: forget the page-wide refusal verdict. */
export function _resetTimerWorkerVerdictForTests(): void {
  workerRefusedOnThisPage = false;
}

function describeWorkerError(event: unknown): string {
  const e = event as Partial<ErrorEvent> & { type?: string };
  const where = e.filename ? ' at ' + e.filename + ':' + (e.lineno ?? '?') : '';
  return 'worker ' + (e.type ?? 'error') + ': ' + (e.message ?? String(event)) + where;
}

function hasWorkerPlatform(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

export class Timer {
  private readonly _onTick: () => void;
  private readonly _intervalMs: number;
  private _running = false;
  private _disposed = false;
  private _warnedDisposed = false;
  private _worker: Worker | null = null;
  private _workerUrl: string | null = null;
  /** Set once the Worker path has been ruled out for this Timer. */
  private _useTimeoutFallback = false;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Armed when `start` is posted to the Worker; cleared by its first tick. */
  private _watchdogId: ReturnType<typeof setTimeout> | null = null;

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
    if (this._disposed) {
      if (!this._warnedDisposed) {
        this._warnedDisposed = true;
        console.warn('[waveform-playlist] Timer: start() on a disposed Timer is ignored');
      }
      return;
    }
    if (this._running) return;
    this._running = true;
    const worker = this._ensureWorker();
    if (worker) {
      worker.postMessage({ type: 'start', intervalMs: this._intervalMs } as TimerWorkerMessage);
      this._armWatchdog();
    } else if (this._timeoutId === null) {
      // (a synchronous Worker refusal inside _ensureWorker already scheduled it)
      this._scheduleTimeout();
    }
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    this._clearWatchdog();
    if (this._worker) {
      this._worker.postMessage({ type: 'stop' } as TimerWorkerMessage);
    }
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  /** Stop and release the Worker. A disposed Timer cannot be restarted —
   *  start() becomes a warned no-op, so a late play() on a disposed transport
   *  cannot leak a fresh Worker. */
  dispose(): void {
    this.stop();
    this._disposed = true;
    this._releaseWorker();
  }

  private _handleTick(): void {
    // A Worker tick may be in flight when stop() was posted; drop it.
    if (!this._running) return;
    this._clearWatchdog();
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
      // Reschedule only if the tick left nothing scheduled: _onTick() may have
      // called stop() (then _running is false) or stop()+start() (then start()
      // already created the next timeout — a second chain here would double
      // the tick rate on every such restart).
      if (this._running && this._timeoutId === null) this._scheduleTimeout();
    }, this._intervalMs);
  }

  private _releaseWorker(): void {
    if (this._worker) {
      this._worker.onmessage = null;
      this._worker.onerror = null;
      this._worker.onmessageerror = null;
      this._worker.terminate();
      this._worker = null;
    }
    if (this._workerUrl !== null) {
      URL.revokeObjectURL(this._workerUrl);
      this._workerUrl = null;
    }
  }

  private _armWatchdog(): void {
    this._clearWatchdog();
    this._watchdogId = setTimeout(() => {
      this._watchdogId = null;
      this._fallBackFromWorker(
        'no tick received within ' + WATCHDOG_INTERVALS * this._intervalMs + ' ms of start',
        false
      );
    }, WATCHDOG_INTERVALS * this._intervalMs);
  }

  private _clearWatchdog(): void {
    if (this._watchdogId !== null) {
      clearTimeout(this._watchdogId);
      this._watchdogId = null;
    }
  }

  /** The Worker path failed: release it and keep ticking on setTimeout. A
   *  constructor refusal is an environment fact remembered (and warned) once
   *  per page; a Worker that errored or went silent later is this Timer's
   *  own event and is warned every time. */
  private _fallBackFromWorker(reason: string, constructorRefused: boolean): void {
    this._useTimeoutFallback = true;
    this._clearWatchdog();
    this._releaseWorker();
    const silenced = constructorRefused && workerRefusedOnThisPage;
    if (constructorRefused) workerRefusedOnThisPage = true;
    if (!silenced) {
      console.warn(
        '[waveform-playlist] Timer: could not run a Worker ticker (' +
          reason +
          '); falling back to a main-thread setTimeout loop, which browsers throttle in a hidden tab'
      );
    }
    if (this._running && this._timeoutId === null) this._scheduleTimeout();
  }

  private _ensureWorker(): Worker | null {
    if (this._worker) return this._worker;
    if (this._useTimeoutFallback || workerRefusedOnThisPage || !hasWorkerPlatform()) {
      // No Worker platform at all (Node, SSR) is nothing to report; a refusal
      // was reported when it happened.
      this._useTimeoutFallback = true;
      return null;
    }
    try {
      const url = URL.createObjectURL(new Blob([TIMER_WORKER_SCRIPT], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => this._handleTick();
      // Some engines surface a CSP violation (or a later crash) here instead
      // of throwing from the constructor; a Worker that never ticks would
      // otherwise leave the transport silent with no fallback.
      worker.onerror = (event) => this._fallBackFromWorker(describeWorkerError(event), false);
      worker.onmessageerror = () => this._fallBackFromWorker('worker message error', false);
      this._worker = worker;
      this._workerUrl = url;
      return worker;
    } catch (err) {
      this._fallBackFromWorker(String(err), true);
      return null;
    }
  }
}
