/**
 * Counts the listeners attached to an EventTarget, as the DOM spec keeps
 * them (D8, #848): a registration is keyed by type, callback and capture (a
 * second add of the same key is ignored, and keeps the first one's signal),
 * and it goes on `removeEventListener` with the same key or when its signal
 * aborts.
 *
 * For a lifetime whose leaked listeners would do nothing visible (a handler
 * that returns early once its state is reset), a test asserts
 * `probe.live()` instead of an event's effect. The calls are forwarded to
 * the target, so the listeners still run.
 */
import { vi } from 'vitest';

interface Registration {
  type: string;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
}

function captureOf(options: boolean | AddEventListenerOptions | EventListenerOptions | undefined) {
  return typeof options === 'boolean' ? options : (options?.capture ?? false);
}

export interface ListenerProbe {
  /** The listeners attached now, of `type` or of every type. */
  live(type?: string): number;
}

export function probeListeners(target: EventTarget): ListenerProbe {
  const registrations: Registration[] = [];
  const same = (a: Registration, b: Registration) =>
    a.type === b.type && a.listener === b.listener && a.capture === b.capture;
  const drop = (registration: Registration) => {
    const index = registrations.findIndex((r) => same(r, registration));
    if (index !== -1) registrations.splice(index, 1);
  };
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    add(type, listener, options);
    if (!listener) return;
    const registration = { type, listener, capture: captureOf(options) };
    const signal = typeof options === 'object' ? options.signal : undefined;
    if (signal?.aborted || registrations.some((r) => same(r, registration))) return;
    registrations.push(registration);
    signal?.addEventListener('abort', () => drop(registration), { once: true });
  });
  vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
    remove(type, listener, options);
    if (listener) drop({ type, listener, capture: captureOf(options) });
  });
  return {
    live: (type) => registrations.filter((r) => type === undefined || r.type === type).length,
  };
}
