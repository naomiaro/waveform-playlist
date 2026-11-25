import { useEffect, useLayoutEffect, useRef } from 'react';
import { handleKeyboardEvent } from '@waveform-playlist/core';
import type { KeyboardShortcut } from '@waveform-playlist/core';

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

  // The listener reads the latest shortcuts from a ref. Callers build the array
  // inline, so its identity changes on every render; keyed on it, the window
  // listener was removed and re-added each time. Written in a LAYOUT effect, so
  // the ref is current as soon as a render commits: a passive effect runs after
  // paint for an update that is not a discrete event (the animation loop
  // stopping playback), and a key pressed in between ran the previous render's
  // handlers — Space paused a playback that had already ended (#895).
  const shortcutsRef = useRef(shortcuts);
  useLayoutEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) =>
      handleKeyboardEvent(event, shortcutsRef.current, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
};
