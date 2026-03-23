import { useEffect, useCallback } from 'react';
import { handleKeyboardEvent } from '@waveform-playlist/core';
import type { KeyboardShortcut } from '@waveform-playlist/core';

// Re-export from core for backwards compatibility
export type { KeyboardShortcut } from '@waveform-playlist/core';
export { handleKeyboardEvent, getShortcutLabel } from '@waveform-playlist/core';

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
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       key: ' ',
 *       action: togglePlayPause,
 *       description: 'Play/Pause',
 *       preventDefault: true,
 *     },
 *     {
 *       key: 's',
 *       action: splitClipAtPlayhead,
 *       description: 'Split clip at playhead',
 *       preventDefault: true,
 *     },
 *   ],
 * });
 * ```
 */
export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions): void => {
  const { shortcuts, enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => handleKeyboardEvent(event, shortcuts, enabled),
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
