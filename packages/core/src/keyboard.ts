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

  const matchingShortcut = shortcuts.find((shortcut) => {
    const keyMatch =
      event.key.toLowerCase() === shortcut.key.toLowerCase() || event.key === shortcut.key;

    const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
    const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
    const metaMatch = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;
    const altMatch = shortcut.altKey === undefined || event.altKey === shortcut.altKey;

    return keyMatch && ctrlMatch && shiftMatch && metaMatch && altMatch;
  });

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
