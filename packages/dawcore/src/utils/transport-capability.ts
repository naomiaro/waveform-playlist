import type { DawTransportElement } from '../elements/daw-transport';

/**
 * Transport target resolution + duck-typed capability detection.
 *
 * Transport controls never instanceof-check their target — they probe for the
 * methods they need (`typeof target[m] === 'function'`). This is what lets the
 * same controls drive <daw-editor>, the future <daw-player> (#454), or any
 * conforming element, and lets editor-only controls render disabled against a
 * player (#474, spec "Transport Compatibility").
 */

/**
 * Resolve the target of the closest <daw-transport for="..."> ancestor.
 * Walks light-DOM ancestors only (`closest` does not cross shadow boundaries).
 */
export function resolveTransportTarget(el: Element): HTMLElement | null {
  const transport = el.closest('daw-transport') as DawTransportElement | null;
  return transport?.target ?? null;
}

/** True when target exists and every named method is a function on it. */
export function targetSupports(target: unknown, methods: readonly string[]): boolean {
  if (!target) return false;
  return methods.every((m) => typeof (target as Record<string, unknown>)[m] === 'function');
}

const warned = new WeakSet<Element>();

/**
 * One-time console warning for a transport control.
 * Dedup is per element — an element warns at most once total, regardless of
 * how many different warn* calls are made for it. This means a missing-target
 * warn and an unsupported-target warn share the same gate.
 */
export function warnOnce(element: Element, message: string): void {
  if (warned.has(element)) return;
  warned.add(element);
  console.warn(message);
}

/**
 * One-time console warning explaining why a control is disabled.
 * Delegates to {@link warnOnce} — an element that already triggered a
 * missing-target warn will not warn again here.
 */
export function warnUnsupportedOnce(element: Element, methods: readonly string[]): void {
  warnOnce(
    element,
    `[dawcore] <${element.tagName.toLowerCase()}> is disabled: its transport target ` +
      `does not implement ${methods.join(', ')}. See the transport compatibility ` +
      'table in the docs for which controls work with which targets.'
  );
}
