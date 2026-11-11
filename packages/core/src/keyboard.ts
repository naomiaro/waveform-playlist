/**
 * Framework-agnostic keyboard shortcut handling.
 * Used by both React (useKeyboardShortcuts) and Web Components (daw-editor).
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

/** A key + modifier combination, without an action. Used for remapping maps. */
export type KeyBinding = Pick<
  KeyboardShortcut,
  'key' | 'ctrlKey' | 'shiftKey' | 'metaKey' | 'altKey'
>;

/**
 * Does a keyboard event match a key binding?
 * `undefined` modifier = match any state; `false` = must NOT be pressed.
 */
export function matchesKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const keyMatch =
    event.key.toLowerCase() === binding.key.toLowerCase() || event.key === binding.key;
  const ctrlMatch = binding.ctrlKey === undefined || event.ctrlKey === binding.ctrlKey;
  const shiftMatch = binding.shiftKey === undefined || event.shiftKey === binding.shiftKey;
  const metaMatch = binding.metaKey === undefined || event.metaKey === binding.metaKey;
  const altMatch = binding.altKey === undefined || event.altKey === binding.altKey;
  return keyMatch && ctrlMatch && shiftMatch && metaMatch && altMatch;
}

const ELEMENT_NODE = 1;

/**
 * The elements the event passed through, innermost first. `event.target` is
 * retargeted to the shadow host for a listener outside a shadow root, so the
 * composed path is the only way to see a control inside a web component.
 */
function elementPath(event: KeyboardEvent): Element[] {
  const composed = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (composed.length > 0) {
    return composed.filter(
      (node): node is Element => (node as Node | null)?.nodeType === ELEMENT_NODE
    );
  }
  // Not dispatched (or no composedPath): walk up from the target.
  const path: Element[] = [];
  let current = event.target as Element | null;
  while (current && current.nodeType === ELEMENT_NODE) {
    path.push(current);
    current = current.parentElement;
  }
  return path;
}

/** `element.matches(selector)`, or `fallback` where the selector is not supported. */
function matchesOr(element: Element, selector: string, fallback: boolean): boolean {
  try {
    return element.matches(selector);
  } catch {
    return fallback;
  }
}

/**
 * Controls that take text or use many keys themselves (every `<input>` type,
 * including sliders and checkboxes): no shortcut fires on them.
 */
function ownsAllKeys(element: Element): boolean {
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (element as HTMLElement).isContentEditable === true
  );
}

/**
 * Does `key` activate this native control? Buttons and `<summary>` take Space
 * and Enter; a link takes Enter only (Space on a link scrolls the page, so
 * yielding it would lose the shortcut for nothing). A disabled button takes
 * neither.
 *
 * ARIA-role widgets (`role="button"` on a div) are left out on purpose: whether
 * they respond to a key is up to their own script, and yielding to one that
 * does not (a drag handle that is only draggable with a pointer) would just
 * make the key dead.
 */
function activates(element: Element, key: string): boolean {
  if (key !== ' ' && key !== 'Enter') return false;
  const tag = element.tagName;
  if (tag === 'BUTTON') return (element as HTMLButtonElement).disabled !== true;
  if (tag === 'SUMMARY') return true;
  return key === 'Enter' && (tag === 'A' || tag === 'AREA') && element.hasAttribute('href');
}

/**
 * Is this container actually showing? A closed custom dialog is often left in
 * the page: `hidden`, `aria-hidden`, `display: none`, or (animated ones)
 * `visibility: hidden` / `opacity: 0`. Unknown (no `checkVisibility`, as in
 * test DOMs) counts as showing.
 */
function isRendered(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const check = (
    element as Element & {
      checkVisibility?: (options?: {
        visibilityProperty?: boolean;
        opacityProperty?: boolean;
      }) => boolean;
    }
  ).checkVisibility;
  if (typeof check !== 'function') return true;
  try {
    return check.call(element, { visibilityProperty: true, opacityProperty: true });
  } catch {
    return true;
  }
}

/** An open modal `<dialog>` or a visible `aria-modal` container: Escape closes it. */
function isOpenModal(element: Element): boolean {
  if (element.getAttribute('aria-modal') === 'true') {
    // A closed custom dialog is often left in the page, hidden, with the
    // attribute still on it. That must not swallow Escape for good.
    return isRendered(element);
  }
  return (
    element.tagName === 'DIALOG' &&
    element.hasAttribute('open') &&
    matchesOr(element, ':modal', true)
  );
}

/**
 * A modal dialog is open in `doc`. Focus is not always inside it: clicking the
 * dialog's own padding can leave focus on `<body>`, and Escape still closes
 * the dialog from there. A modal inside a shadow root is only seen while focus
 * is inside it (the composed path), since this query does not pierce shadow DOM.
 */
function documentHasOpenModal(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  try {
    return Array.from(doc.querySelectorAll('dialog[open], [aria-modal="true"]')).some(isOpenModal);
  } catch {
    return false;
  }
}

/**
 * True when the key already means something to the control that has focus, so
 * a global shortcut must leave it alone:
 *
 * - `<input>` (every type), `<textarea>`, `<select>` and contenteditable keep
 *   every key;
 * - Escape belongs to an open modal dialog, wherever focus is;
 * - Space and Enter belong to a focused `<button>` or `<summary>`, and Enter to
 *   a focused link.
 *
 * It makes no difference how the control got focus. A button the user clicked
 * still has focus, so Space activates it again, exactly as it does on any
 * other page; a shortcut only gets the key once focus is somewhere else.
 *
 * `handleKeyboardEvent` applies this itself. It is exported for listeners that
 * match keys on their own.
 */
export function keyBelongsToFocusedControl(event: KeyboardEvent): boolean {
  const path = elementPath(event);
  const focused = path[0];

  if (event.key === 'Escape') {
    // Also when the event has no element target (dispatched on the document).
    const doc = focused?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
    if (path.some(isOpenModal) || documentHasOpenModal(doc)) return true;
  }
  if (!focused) return false;
  if (ownsAllKeys(focused)) return true;
  return activates(focused, event.key);
}

/**
 * Handle a keyboard event against a list of shortcuts.
 * Pure function, no framework dependency.
 *
 * Shortcuts do not fire for a key the focused control uses itself; see
 * `keyBelongsToFocusedControl`.
 */
export function handleKeyboardEvent(
  event: KeyboardEvent,
  shortcuts: KeyboardShortcut[],
  enabled: boolean
): void {
  if (!enabled) return;

  // Ignore key repeat events — holding a key fires keydown repeatedly.
  // Without this guard, holding Space rapidly toggles play/pause.
  if (event.repeat) return;

  if (keyBelongsToFocusedControl(event)) return;

  const matchingShortcut = shortcuts.find((shortcut) => matchesKeyBinding(event, shortcut));

  if (matchingShortcut) {
    if (matchingShortcut.preventDefault !== false) {
      event.preventDefault();
    }
    matchingShortcut.action();
  }
}

/**
 * Get a human-readable string representation of a keyboard shortcut.
 *
 * @param shortcut - The keyboard shortcut
 * @returns Human-readable string (e.g., "Cmd+Shift+S")
 */
export const getShortcutLabel = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  // Use Cmd on Mac, Ctrl on other platforms
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  if (shortcut.metaKey) {
    parts.push(isMac ? 'Cmd' : 'Ctrl');
  }

  if (shortcut.ctrlKey && !shortcut.metaKey) {
    parts.push('Ctrl');
  }

  if (shortcut.altKey) {
    parts.push(isMac ? 'Option' : 'Alt');
  }

  if (shortcut.shiftKey) {
    parts.push('Shift');
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
};
