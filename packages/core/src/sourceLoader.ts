import { createValueSource } from './valueSource';

export type SourceState<V> =
  | { status: 'pending' }
  | { status: 'loaded'; value: V }
  | { status: 'failed'; error: Error };

export interface SourceLoader<K, V> {
  /** Declare the whole set of keys that are wanted now. */
  setWanted(keys: Iterable<K>): void;
  /** Abort every load in flight. Wanted keys and loaded values are kept. */
  suspend(): void;
  /** Record a value the caller already holds as loaded. */
  provide(key: K, value: V): void;
  /** Start a failed key again. A no-op for any other state. */
  retry(key: K): void;
  /** `ValueSource` shape: a new Map object on every change. */
  subscribe(listener: (states: ReadonlyMap<K, SourceState<V>>) => void): () => void;
  getSnapshot(): ReadonlyMap<K, SourceState<V>>;
}

interface Entry<V> {
  state: SourceState<V>;
  /** Present only while a load is in flight. */
  controller?: AbortController;
  /** Identifies the load whose result may still be applied. */
  token: symbol;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

/**
 * Loads sources by key. One owner declares the whole set of wanted keys with
 * `setWanted`; a key is loaded once, kept while it stays wanted, and dropped
 * (its load aborted) when it leaves the set. Framework-free: read it with
 * `useSyncExternalStore(loader.subscribe, loader.getSnapshot)`.
 *
 * A rejection is ignored only when the loader aborted that load; a load that
 * rejects with an AbortError of its own is recorded as `failed` (`retry` restarts it).
 */
export function createSourceLoader<K, V>(options: {
  load: (key: K, signal: AbortSignal) => Promise<V>;
}): SourceLoader<K, V> {
  const { load } = options;
  const entries = new Map<K, Entry<V>>();
  // Set by suspend(), cleared by setWanted(): while set, nothing may start a load.
  let suspended = false;
  const { source, publish } = createValueSource<ReadonlyMap<K, SourceState<V>>>(new Map());

  const publishEntries = () => {
    const next = new Map<K, SourceState<V>>();
    for (const [key, entry] of entries) next.set(key, entry.state);
    publish(next);
  };

  const abort = (entry: Entry<V>) => {
    entry.controller?.abort();
  };

  // Start a load for `key`; the caller publishes afterwards.
  const start = (key: K) => {
    const token = Symbol('load');
    const controller = new AbortController();
    const entry: Entry<V> = { state: { status: 'pending' }, controller, token };
    entries.set(key, entry);

    const settle = (state: SourceState<V>) => {
      const current = entries.get(key);
      if (!current || current.token !== token) return;
      entries.set(key, { state, token });
      publishEntries();
    };

    let promise: Promise<V>;
    try {
      // A plain function that returns the value instead of a promise is accepted.
      promise = Promise.resolve(load(key, controller.signal));
    } catch (err) {
      entries.set(key, { state: { status: 'failed', error: toError(err) }, token });
      return;
    }
    promise.then(
      (value) => settle({ status: 'loaded', value }),
      (err: unknown) => {
        // The token above is what ignores a late result. This line only tells the
        // loader's own abort (ignored) from a load's own AbortError (a failure).
        if (controller.signal.aborted) return;
        settle({ status: 'failed', error: toError(err) });
      }
    );
  };

  return {
    setWanted(keys) {
      const wanted = new Set(keys);
      suspended = false;
      let changed = false;
      for (const [key, entry] of [...entries]) {
        if (wanted.has(key)) continue;
        abort(entry);
        entries.delete(key);
        changed = true;
      }
      for (const key of wanted) {
        const entry = entries.get(key);
        if (entry && (entry.state.status !== 'pending' || entry.controller)) continue;
        start(key);
        // Restarting a suspended key leaves it pending: nothing to publish unless it failed at once.
        if (!entry || entries.get(key)?.state.status !== 'pending') changed = true;
      }
      if (changed) publishEntries();
    },

    suspend() {
      suspended = true;
      for (const [key, entry] of [...entries]) {
        if (entry.state.status !== 'pending' || !entry.controller) continue;
        abort(entry);
        entries.set(key, { state: entry.state, token: Symbol('suspended') });
      }
    },

    provide(key, value) {
      const entry = entries.get(key);
      if (entry?.state.status === 'loaded') return;
      if (entry) abort(entry);
      entries.set(key, { state: { status: 'loaded', value }, token: Symbol('provided') });
      publishEntries();
    },

    retry(key) {
      if (entries.get(key)?.state.status !== 'failed') return;
      if (suspended) {
        // Nothing would abort a load started now: wait for the next setWanted.
        entries.set(key, { state: { status: 'pending' }, token: Symbol('suspended') });
      } else {
        start(key);
      }
      publishEntries();
    },

    subscribe: source.subscribe,
    getSnapshot: source.getSnapshot,
  };
}
