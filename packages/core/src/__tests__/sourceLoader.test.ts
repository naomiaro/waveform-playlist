import { describe, it, expect, vi } from 'vitest';
import { createSourceLoader } from '../sourceLoader';

interface Call<K> {
  key: K;
  signal: AbortSignal;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}

function setup<K = string>() {
  const calls: Call<K>[] = [];
  const load = vi.fn((key: K, signal: AbortSignal) => {
    return new Promise<string>((resolve, reject) => {
      calls.push({ key, signal, resolve, reject });
    });
  });
  const loader = createSourceLoader<K, string>({ load });
  return { calls, load, loader };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSourceLoader', () => {
  it('starts one load per new wanted key', () => {
    const { calls, loader } = setup();
    loader.setWanted(['a', 'a', 'b']);
    expect(calls.map((c) => c.key)).toEqual(['a', 'b']);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
    expect(loader.getSnapshot().get('b')).toEqual({ status: 'pending' });
  });

  it('leaves a loaded key alone on the next setWanted', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].resolve('A');
    await flush();
    const before = loader.getSnapshot();
    loader.setWanted(['a']);
    expect(calls).toHaveLength(1);
    expect(loader.getSnapshot()).toBe(before);
    expect(before.get('a')).toEqual({ status: 'loaded', value: 'A' });
  });

  it('drops a key that is no longer wanted: pending is aborted', () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.setWanted([]);
    expect(calls[0].signal.aborted).toBe(true);
    expect(loader.getSnapshot().has('a')).toBe(false);
  });

  it('drops a key that is no longer wanted: loaded is forgotten', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].resolve('A');
    await flush();
    loader.setWanted([]);
    expect(loader.getSnapshot().has('a')).toBe(false);
  });

  it('suspend aborts pending loads, keeps them pending in the snapshot, keeps loaded values', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a', 'b']);
    calls[1].resolve('B');
    await flush();
    loader.suspend();
    expect(calls[0].signal.aborted).toBe(true);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
    expect(loader.getSnapshot().get('b')).toEqual({ status: 'loaded', value: 'B' });
  });

  it('setWanted after suspend starts the suspended keys again', () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.suspend();
    loader.setWanted(['a']);
    expect(calls).toHaveLength(2);
    expect(calls[1].key).toBe('a');
    expect(calls[1].signal.aborted).toBe(false);
  });

  it('provide marks a key loaded and aborts its load in flight', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.provide('a', 'given');
    expect(calls[0].signal.aborted).toBe(true);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'given' });
    calls[0].resolve('late');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'given' });
  });

  it('provide is a no-op for a loaded key', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].resolve('A');
    await flush();
    const before = loader.getSnapshot();
    loader.provide('a', 'other');
    expect(loader.getSnapshot()).toBe(before);
    expect(before.get('a')).toEqual({ status: 'loaded', value: 'A' });
  });

  it('never records an AbortError of a load the loader aborted', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a', 'b']);
    loader.setWanted(['b']);
    loader.suspend();
    calls[0].reject(new DOMException('x', 'AbortError'));
    calls[1].reject(new DOMException('x', 'AbortError'));
    await flush();
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(true);
    expect(loader.getSnapshot().has('a')).toBe(false);
    expect(loader.getSnapshot().get('b')).toEqual({ status: 'pending' });
  });

  it('records an AbortError of a load the loader did not abort as failed, and retry starts it again', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].reject(new DOMException('own abort', 'AbortError'));
    await flush();
    const state = loader.getSnapshot().get('a');
    expect(state?.status).toBe('failed');
    if (state?.status !== 'failed') throw new Error('expected failed');
    expect(state.error.name).toBe('AbortError');
    loader.retry('a');
    expect(calls).toHaveLength(2);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
  });

  it('ignores a result that arrives after suspend', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.suspend();
    calls[0].resolve('stale');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
    loader.setWanted(['a']);
    expect(calls).toHaveLength(2);
    calls[1].resolve('fresh');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'fresh' });
  });

  it('a provided key is dropped by a setWanted that leaves it out', () => {
    const { loader } = setup();
    loader.provide('x', 'v');
    expect(loader.getSnapshot().get('x')).toEqual({ status: 'loaded', value: 'v' });
    loader.setWanted([]);
    expect(loader.getSnapshot().has('x')).toBe(false);
  });

  it('ignores the late result of an aborted load', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.setWanted([]);
    loader.setWanted(['a']);
    expect(calls).toHaveLength(2);
    calls[0].resolve('stale');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
    calls[1].resolve('fresh');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'fresh' });
  });

  it('a failed key stays failed until retry', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].reject(new Error('nope'));
    await flush();
    expect(loader.getSnapshot().get('a')?.status).toBe('failed');
    loader.setWanted(['a']);
    expect(calls).toHaveLength(1);
    loader.retry('a');
    expect(calls).toHaveLength(2);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
  });

  it('retry is a no-op for pending and loaded keys', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a', 'b']);
    calls[1].resolve('B');
    await flush();
    const before = loader.getSnapshot();
    loader.retry('a');
    loader.retry('b');
    loader.retry('missing');
    expect(calls).toHaveLength(2);
    expect(loader.getSnapshot()).toBe(before);
  });

  it('getSnapshot returns the same Map until something changes', async () => {
    const { calls, loader } = setup();
    const first = loader.getSnapshot();
    expect(loader.getSnapshot()).toBe(first);
    loader.setWanted(['a']);
    const second = loader.getSnapshot();
    expect(second).not.toBe(first);
    expect(loader.getSnapshot()).toBe(second);
    calls[0].resolve('A');
    await flush();
    expect(loader.getSnapshot()).not.toBe(second);
    expect(second.get('a')).toEqual({ status: 'pending' });
  });

  it('publishes a new Map to subscribers on each change', async () => {
    const { calls, loader } = setup();
    const listener = vi.fn();
    const unsubscribe = loader.subscribe(listener);
    loader.setWanted(['a']);
    expect(listener).toHaveBeenCalledTimes(1);
    calls[0].resolve('A');
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall?.[0]).toBe(loader.getSnapshot());
    unsubscribe();
    loader.setWanted([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('compares object keys by identity', () => {
    const { calls, loader } = setup<Blob>();
    const one = new Blob(['same']);
    const two = new Blob(['same']);
    loader.setWanted([one, two]);
    expect(calls).toHaveLength(2);
    expect(loader.getSnapshot().size).toBe(2);
  });

  it('a load that throws synchronously becomes failed', () => {
    const loader = createSourceLoader<string, string>({
      load: () => {
        throw new Error('sync');
      },
    });
    loader.setWanted(['a']);
    const state = loader.getSnapshot().get('a');
    expect(state?.status).toBe('failed');
    expect(state?.status === 'failed' && state.error.message).toBe('sync');
  });

  it('a non-Error rejection is wrapped in an Error', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    calls[0].reject('boom');
    await flush();
    const state = loader.getSnapshot().get('a');
    expect(state?.status).toBe('failed');
    if (state?.status !== 'failed') throw new Error('expected failed');
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error.message).toBe('boom');
  });

  it('suspend does not publish', () => {
    const { loader } = setup();
    loader.setWanted(['a']);
    const before = loader.getSnapshot();
    const listener = vi.fn();
    loader.subscribe(listener);
    loader.suspend();
    expect(loader.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('setWanted that only restarts suspended loads does not publish', () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.suspend();
    const before = loader.getSnapshot();
    const listener = vi.fn();
    loader.subscribe(listener);
    loader.setWanted(['a']);
    expect(calls).toHaveLength(2);
    expect(loader.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a restart whose load throws synchronously is published as failed', () => {
    let throwNow = false;
    const loader = createSourceLoader<string, string>({
      load: () => {
        if (throwNow) throw new Error('sync');
        return new Promise<string>(() => {});
      },
    });
    loader.setWanted(['a']);
    loader.suspend();
    throwNow = true;
    const listener = vi.fn();
    loader.subscribe(listener);
    loader.setWanted(['a']);
    expect(loader.getSnapshot().get('a')?.status).toBe('failed');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retry while suspended starts no load and leaves the key pending', async () => {
    const { calls, load, loader } = setup();
    loader.setWanted(['a']);
    calls[0].reject(new Error('nope'));
    await flush();
    loader.suspend();
    loader.retry('a');
    expect(load).toHaveBeenCalledTimes(1);
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'pending' });
    loader.setWanted(['a']);
    expect(load).toHaveBeenCalledTimes(2);
    expect(calls[1].signal.aborted).toBe(false);
    calls[1].resolve('A');
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'A' });
  });

  it('retry after setWanted following a suspend starts a load', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a']);
    loader.suspend();
    loader.setWanted(['a']);
    calls[1].reject(new Error('nope'));
    await flush();
    loader.retry('a');
    expect(calls).toHaveLength(3);
  });

  it('a load that returns a value instead of a promise becomes loaded', async () => {
    const loader = createSourceLoader<string, string>({
      load: (() => 'v') as unknown as (key: string, signal: AbortSignal) => Promise<string>,
    });
    loader.setWanted(['a']);
    await flush();
    expect(loader.getSnapshot().get('a')).toEqual({ status: 'loaded', value: 'v' });
  });

  it('retry whose load throws synchronously ends failed and publishes', async () => {
    let throwNow = false;
    const calls: Array<(reason: unknown) => void> = [];
    const loader = createSourceLoader<string, string>({
      load: () => {
        if (throwNow) throw new Error('sync');
        return new Promise<string>((_, reject) => calls.push(reject));
      },
    });
    loader.setWanted(['a']);
    calls[0](new Error('first'));
    await flush();
    throwNow = true;
    const listener = vi.fn();
    loader.subscribe(listener);
    loader.retry('a');
    const state = loader.getSnapshot().get('a');
    expect(state?.status === 'failed' && state.error.message).toBe('sync');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a load the loader aborted that rejects with a plain Error is ignored', async () => {
    const { calls, loader } = setup();
    loader.setWanted(['a', 'b']);
    loader.setWanted(['b']);
    calls[0].reject(new Error('late'));
    loader.suspend();
    calls[1].reject(new Error('late'));
    await flush();
    expect(loader.getSnapshot().has('a')).toBe(false);
    expect(loader.getSnapshot().get('b')).toEqual({ status: 'pending' });
  });
});
