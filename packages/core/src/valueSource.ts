/**
 * A value that changes too often to live in UI state (meter levels, recording
 * progress): read it with `getSnapshot()`, or be told about each new value
 * with `subscribe()`.
 *
 * The pair matches React's `useSyncExternalStore(source.subscribe,
 * source.getSnapshot)`, but nothing here depends on React.
 */
export interface ValueSource<T> {
  /**
   * Call `listener` with each new value. Returns the function that removes
   * the subscription.
   */
  subscribe(listener: (value: T) => void): () => void;
  /** The latest value. The same object is returned until the next change. */
  getSnapshot(): T;
}

/** Per-channel meter readings, each normalized to 0-1. */
export interface MeterLevels {
  /** Smoothed peak level per channel. */
  levels: number[];
  /** Highest level seen per channel since the last reset. */
  peakLevels: number[];
  /** RMS level per channel. */
  rmsLevels: number[];
}

export type MeterSource = ValueSource<MeterLevels>;

/** What a recording in progress has captured so far. */
export interface RecordingProgress {
  /** Elapsed recording time in seconds. */
  duration: number;
  /** Min/max peak pairs per channel, for the live waveform preview. */
  peaks: (Int8Array | Int16Array)[];
}

export type RecordingProgressSource = ValueSource<RecordingProgress>;

export interface ValueSourceHandle<T> {
  /** The read side, safe to hand to consumers. */
  source: ValueSource<T>;
  /** Replace the value and notify listeners. A no-op for the current value. */
  publish(value: T): void;
}

/** Build a `MeterLevels` of zeros for `channelCount` channels. */
export function silentMeterLevels(channelCount: number): MeterLevels {
  const count = Math.max(0, Math.floor(channelCount));
  return {
    levels: new Array<number>(count).fill(0),
    peakLevels: new Array<number>(count).fill(0),
    rmsLevels: new Array<number>(count).fill(0),
  };
}

/**
 * Create a `ValueSource` together with the function that publishes to it.
 * Published values must be new objects: listeners and `getSnapshot` callers
 * compare by identity.
 */
export function createValueSource<T>(initial: T): ValueSourceHandle<T> {
  let current = initial;
  // Keyed by a per-subscription token, so the same function subscribed twice
  // is two subscriptions.
  const listeners = new Map<symbol, (value: T) => void>();

  const source: ValueSource<T> = {
    subscribe(listener) {
      const token = Symbol('subscription');
      listeners.set(token, listener);
      return () => {
        listeners.delete(token);
      };
    },
    getSnapshot() {
      return current;
    },
  };

  const publish = (value: T) => {
    if (Object.is(value, current)) return;
    current = value;
    // Copy first: a listener may unsubscribe (itself or another) while this runs.
    for (const listener of [...listeners.values()]) {
      try {
        listener(value);
      } catch (err) {
        console.warn('[waveform-playlist] A value source listener threw: ' + String(err));
      }
    }
  };

  return { source, publish };
}
