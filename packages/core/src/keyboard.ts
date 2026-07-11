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

/**
 * Handle a keyboard event against a list of shortcuts.
 * Pure function, no framework dependency.
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

  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

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
