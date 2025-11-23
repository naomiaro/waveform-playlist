import { useEffect, useCallback } from 'react';

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

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const { splitClipAtPlayhead } = useClipSplitting({ ... });
 *
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       key: 's',
 *       action: splitClipAtPlayhead,
 *       description: 'Split clip at playhead',
 *       preventDefault: true,
 *     },
 *     {
 *       key: 'S',
 *       shiftKey: true,
 *       action: () => splitAtSelection(),
 *       description: 'Split at selection boundaries',
 *       preventDefault: true,
 *     },
 *   ],
 * });
 * ```
 */
export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions): void => {
  const { shortcuts, enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if we're in an input/textarea element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Don't trigger shortcuts when typing in input fields
        return;
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.key === shortcut.key;

        const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatch =
          shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
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
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

/**
 * Get a human-readable string representation of a keyboard shortcut
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
