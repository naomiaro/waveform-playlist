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

/** `<input>` types that are not text entry: they use a few keys, not all of them. */
const NON_TEXT_INPUT_TYPES = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'color',
  'file',
  'image',
]);

function isNonTextInput(element: Element): boolean {
  return (
    element.tagName === 'INPUT' &&
    NON_TEXT_INPUT_TYPES.has((element.getAttribute('type') ?? 'text').toLowerCase())
  );
}

/** Controls that take text or use most keys themselves: no shortcut fires on them. */
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
 * Native controls that Space or Enter activates. ARIA-role widgets
 * (`role="button"` on a div) are left out on purpose: whether they respond to
 * a key is up to their own script, and yielding to one that does not (a drag
 * handle that is only draggable with a pointer) would just make the key dead.
 */
function isActivatable(element: Element): boolean {
  const tag = element.tagName;
  if (tag === 'BUTTON' || tag === 'SUMMARY') return true;
  return (tag === 'A' || tag === 'AREA') && element.hasAttribute('href');
}

/** An open modal `<dialog>` or an `aria-modal` container: Escape closes it. */
function isOpenModal(element: Element): boolean {
  if (element.getAttribute('aria-modal') === 'true') return true;
  return (
    element.tagName === 'DIALOG' &&
    element.hasAttribute('open') &&
    matchesOr(element, ':modal', true)
  );
}

/**
 * A modal dialog is open in the document of `element`. Focus is not always
 * inside it: clicking the dialog's own padding can leave focus on `<body>`,
 * and Escape still closes the dialog from there.
 */
function documentHasOpenModal(element: Element): boolean {
  const doc = element.ownerDocument;
  if (!doc) return false;
  try {
    return Array.from(doc.querySelectorAll('dialog[open], [aria-modal="true"]')).some(isOpenModal);
  } catch {
    return false;
  }
}

/**
 * How the focused element got focus. `:focus-visible` cannot answer this at
 * keydown time: Chromium makes the focused element match it as soon as any key
 * is pressed, so a button focused by a click matches during the very keydown
 * we are deciding about.
 *
 * `keyboardFocusedElement` is the element the user navigated to with the
 * keyboard (or that a script focused) and has not used a pointer since.
 */
let pointerDownPath: EventTarget[] = [];
let keyboardFocusedElement: EventTarget | null = null;
const observedDocuments = new Map<Document, number>();

function onPointerDown(event: Event): void {
  pointerDownPath = event.composedPath();
  // Any pointer use ends keyboard operation of the focused control, even when
  // the press does not move focus (a drag whose pointerdown is cancelled).
  keyboardFocusedElement = null;
}

function onFocusSourceKeyDown(): void {
  // Focus that moves after a key press (Tab, arrow keys) is keyboard focus.
  pointerDownPath = [];
}

function onFocusIn(event: Event): void {
  const focused = event.composedPath()[0] ?? event.target;
  // Pointer focus only when the pointer went down on the element itself (or
  // inside it). Focus moved by script after a click elsewhere, such as the
  // first item of a menu that was just opened, counts as keyboard focus.
  const byPointer = focused !== null && pointerDownPath.includes(focused);
  keyboardFocusedElement = byPointer ? null : focused;
  pointerDownPath = [];
}

/**
 * Start recording whether focus arrives by pointer or by keyboard, so that
 * `handleKeyboardEvent` can let Space remain a shortcut on a button the user
 * merely clicked. Call it when shortcuts are set up and call the returned
 * function to stop. Safe to call more than once per document.
 *
 * Without it every focused button is treated as keyboard-focused: Space and
 * Enter always activate the button and never run a shortcut.
 */
export function observeFocusSource(doc: Document = document): () => void {
  const count = observedDocuments.get(doc) ?? 0;
  observedDocuments.set(doc, count + 1);
  if (count === 0) {
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('keydown', onFocusSourceKeyDown, true);
    doc.addEventListener('focusin', onFocusIn, true);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const remaining = (observedDocuments.get(doc) ?? 1) - 1;
    if (remaining > 0) {
      observedDocuments.set(doc, remaining);
      return;
    }
    observedDocuments.delete(doc);
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('keydown', onFocusSourceKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    if (observedDocuments.size === 0) {
      pointerDownPath = [];
      keyboardFocusedElement = null;
    }
  };
}

/** The user is operating `element` from the keyboard (see `observeFocusSource`). */
function isKeyboardOperated(element: Element): boolean {
  // Not observing: assume keyboard, the accessible default.
  return observedDocuments.size === 0 || element === keyboardFocusedElement;
}

/**
 * True when the key already means something to the control that has focus, so
 * a global shortcut must leave it alone:
 *
 * - text fields, `<select>` and contenteditable keep every key, however they
 *   got focus. A focused dropdown works as it does everywhere else: Space and
 *   the arrow keys open or change it;
 * - Escape belongs to an open modal dialog, wherever focus is;
 * - Space and Enter belong to a focused `<button>`, link or `<summary>`, and
 *   every key belongs to a focused slider, checkbox or other non-text input.
 *
 * One exception, for Space only, and only for buttons, links, sliders and
 * checkboxes: one that got focus from a pointer click or drag keeps focus
 * without the user having navigated to it, and Space is the transport key, so
 * it stays a shortcut there. Clicking Mute or dragging a volume slider, and
 * then pressing Space, still plays. Enter always goes to the focused control.
 *
 * `handleKeyboardEvent` applies this itself. It is exported for listeners that
 * match keys on their own.
 */
export function keyBelongsToFocusedControl(event: KeyboardEvent): boolean {
  const path = elementPath(event);
  const focused = path[0];
  if (!focused) return false;

  if (event.key === 'Escape' && (path.some(isOpenModal) || documentHasOpenModal(focused))) {
    return true;
  }

  // Space on a control the user only clicked or dragged stays a shortcut.
  const isPointerSpace = event.key === ' ' && !isKeyboardOperated(focused);

  // Sliders and checkboxes keep every key (except that Space).
  if (isNonTextInput(focused)) return !isPointerSpace;
  if (ownsAllKeys(focused)) return true;
  if ((event.key === ' ' || event.key === 'Enter') && isActivatable(focused)) {
    return !isPointerSpace;
  }
  return false;
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
