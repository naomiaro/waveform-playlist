import { describe, it, expect, vi } from 'vitest';
import { createValueSource } from '../valueSource';

describe('createValueSource', () => {
  it('returns the initial value until something is published', () => {
    const initial = { n: 0 };
    const { source } = createValueSource(initial);
    expect(source.getSnapshot()).toBe(initial);
    expect(source.getSnapshot()).toBe(initial);
  });

  it('publishes a value to every listener and keeps it as the snapshot', () => {
    const { source, publish } = createValueSource(0);
    const a = vi.fn();
    const b = vi.fn();
    source.subscribe(a);
    source.subscribe(b);

    publish(7);

    expect(a).toHaveBeenCalledWith(7);
    expect(b).toHaveBeenCalledWith(7);
    expect(source.getSnapshot()).toBe(7);
  });

  it('stops calling a listener once it unsubscribes', () => {
    const { source, publish } = createValueSource(0);
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    unsubscribe();
    publish(1);

    expect(listener).not.toHaveBeenCalled();
    expect(source.getSnapshot()).toBe(1);
  });

  it('does not notify when the published value is the current one', () => {
    const value = { n: 1 };
    const { source, publish } = createValueSource(value);
    const listener = vi.fn();
    source.subscribe(listener);

    publish(value);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps notifying the others when a listener unsubscribes during a publish', () => {
    const { source, publish } = createValueSource(0);
    const later = vi.fn();
    const unsubscribeFirst = source.subscribe(() => unsubscribeFirst());
    source.subscribe(later);

    publish(1);

    expect(later).toHaveBeenCalledWith(1);
  });

  it('keeps notifying the others when a listener throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { source, publish } = createValueSource(0);
    const later = vi.fn();
    source.subscribe(() => {
      throw new Error('boom');
    });
    source.subscribe(later);

    publish(1);

    expect(later).toHaveBeenCalledWith(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('counts the same function subscribed twice as two subscriptions', () => {
    const { source, publish } = createValueSource(0);
    const listener = vi.fn();
    const first = source.subscribe(listener);
    source.subscribe(listener);

    first();
    publish(1);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
