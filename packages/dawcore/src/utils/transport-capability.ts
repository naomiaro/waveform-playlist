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

/**
 * True when the target cannot be judged yet: it is missing entirely, or it is
 * a custom element that has not upgraded (its methods don't exist until the
 * definition loads). Capability-gated controls give these the benefit of the
 * doubt and stay enabled — click-time resolution warns if still unusable —
 * instead of latching disabled before the app finishes booting.
 */
export function targetUndetermined(target: HTMLElement | null): boolean {
  if (!target) return true;
  const name = target.localName;
  return name.includes('-') && customElements.get(name) === undefined;
}

const warned = new WeakMap<Element, Set<string>>();

/**
 * One-time console warning for a transport control.
 * Dedup is per element per message — distinct messages on the same element
 * each warn once, while repeats of the same message stay silent. A
 * missing-target warn and an unsupported-target warn no longer suppress each
 * other.
 */
export function warnOnce(element: Element, message: string): void {
  let messages = warned.get(element);
  if (!messages) {
    messages = new Set();
    warned.set(element, messages);
  }
  if (messages.has(message)) return;
  messages.add(message);
  console.warn(message);
}

/**
 * One-time canonical warning for a control whose transport target is missing.
 * Every no-target site uses this single sentence so the message-keyed
 * {@link warnOnce} dedup collapses pointerdown-time and click-time warns into
 * one warning total. An optional suffix appends extra element-specific
 * context after the canonical text (still one message key per suffix).
 */
export function warnNoTargetOnce(element: Element, suffix?: string): void {
  warnOnce(
    element,
    `[dawcore] <${element.tagName.toLowerCase()}> has no target. Check ` +
      '<daw-transport for="..."> references a valid element id.' +
      (suffix ?? '')
  );
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
