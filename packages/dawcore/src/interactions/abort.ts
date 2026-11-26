/**
 * Cancellation (#848, the maintainer's design D1-D8): every abort is an
 * `AbortError` DOMException whose message names the cause, as `fetch()`
 * rejects (modern-web-guidance `js`: callers check `err.name`). A caller's
 * own signal rejects with that signal's `reason`.
 */

/** An `AbortError` with a message that names why. */
export function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError');
}

/** True for an abort (`AbortError`), the kind a caller asked for or a swap caused. */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'AbortError';
}

/**
 * The reason of an aborted signal, as it is: a call rejects with it, as
 * `fetch()` does (`abort()` without one gives an `AbortError` DOMException).
 */
export function reasonOf(signal: AbortSignal): unknown {
  return signal.reason;
}

/**
 * One AbortController per arrangement while the editor plays it, aborted
 * when it is swapped out (D2). Keyed by the arrangement, so a swap ends only
 * the waits of the one leaving: a clip added to the editor's own arrangement
 * while a handed-in one plays is not rejected when the own one comes back.
 */
export class PlaySignals {
  private _controllers = new WeakMap<object, AbortController>();

  /** The signal of an arrangement: aborted when it is next swapped out. */
  signalOf(arrangement: object): AbortSignal {
    let controller = this._controllers.get(arrangement);
    if (!controller) {
      controller = new AbortController();
      this._controllers.set(arrangement, controller);
    }
    return controller.signal;
  }

  /** The arrangement leaves play: its waits end with `reason`; a later play gets a new signal. */
  swappedOut(arrangement: object, reason: DOMException): void {
    const controller = this._controllers.get(arrangement);
    this._controllers.delete(arrangement);
    controller?.abort(reason);
  }
}

/** `promise`, or a rejection with the signal's reason as soon as it aborts. */
export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(reasonOf(signal));
  return new Promise<T>((resolve, reject) => {
    const done = new AbortController();
    signal.addEventListener('abort', () => reject(reasonOf(signal)), { signal: done.signal });
    promise.then(
      (value) => {
        done.abort();
        resolve(value);
      },
      (error: unknown) => {
        done.abort();
        reject(error);
      }
    );
  });
}
