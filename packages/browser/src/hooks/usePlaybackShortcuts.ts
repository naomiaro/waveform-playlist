import { useCallback } from 'react';
import { usePlaybackControls, useIsPlaying } from '../contexts/playlistContexts';
import { usePlayFromSelectionOrCursor } from './usePlayFromSelectionOrCursor';
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts';

export interface UsePlaybackShortcutsOptions {
  /**
   * Enable the shortcuts. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Additional shortcuts to include alongside the default playback shortcuts.
   */
  additionalShortcuts?: KeyboardShortcut[];
  /**
   * Override default shortcuts. If provided, only these shortcuts will be used.
   */
  shortcuts?: KeyboardShortcut[];
}

export interface UsePlaybackShortcutsReturn {
  /** Rewind to the beginning (time = 0) */
  rewindToStart: () => void;
  /** Toggle play/pause */
  togglePlayPause: () => void;
  /** Stop playback and return to start position */
  stopPlayback: () => void;
  /** The list of active keyboard shortcuts */
  shortcuts: KeyboardShortcut[];
}

/**
 * Hook that provides common playback keyboard shortcuts for the playlist.
 *
 * Default shortcuts:
 * - `Space` - Toggle play/pause
 * - `Escape` - Stop playback
 * - `0` - Rewind to start (seek to time 0)
 *
 * @example
 * ```tsx
 * // Basic usage - enables default shortcuts
 * usePlaybackShortcuts();
 *
 * // With additional custom shortcuts
 * usePlaybackShortcuts({
 *   additionalShortcuts: [
 *     { key: 's', action: splitClipAtPlayhead, description: 'Split clip' },
 *   ],
 * });
 *
 * // Completely override shortcuts
 * usePlaybackShortcuts({
 *   shortcuts: [
 *     { key: 'Home', action: rewindToStart, description: 'Go to start' },
 *   ],
 * });
 * ```
 */
export const usePlaybackShortcuts = (
  options: UsePlaybackShortcutsOptions = {}
): UsePlaybackShortcutsReturn => {
  const { enabled = true, additionalShortcuts = [], shortcuts: overrideShortcuts } = options;

  const { isPlaying } = useIsPlaying();
  const { seekTo, pause, stop } = usePlaybackControls();
  // Space starts playback exactly as the Play button does.
  const playFromSelectionOrCursor = usePlayFromSelectionOrCursor();

  /**
   * Toggle between play and pause.
   */
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      playFromSelectionOrCursor().catch((err) => {
        console.warn('[waveform-playlist] Playback failed to start: ' + String(err));
      });
    }
  }, [isPlaying, playFromSelectionOrCursor, pause]);

  /**
   * Stop playback and return to start position.
   */
  const stopPlayback = useCallback(() => {
    stop();
  }, [stop]);

  /**
   * Rewind to the beginning of the timeline.
   * If playing, stops and restarts playback from the beginning.
   */
  const rewindToStart = useCallback(() => {
    seekTo(0);
  }, [seekTo]);

  // Default playback shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      key: ' ',
      action: togglePlayPause,
      description: 'Play/Pause',
      preventDefault: true,
    },
    {
      key: 'Escape',
      action: stopPlayback,
      description: 'Stop',
      preventDefault: true,
    },
    {
      key: '0',
      action: rewindToStart,
      description: 'Rewind to start',
      preventDefault: true,
    },
  ];

  // Use override shortcuts if provided, otherwise combine defaults with additional
  const activeShortcuts = overrideShortcuts ?? [...defaultShortcuts, ...additionalShortcuts];

  // Register the keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: activeShortcuts,
    enabled,
  });

  return {
    rewindToStart,
    togglePlayPause,
    stopPlayback,
    shortcuts: activeShortcuts,
  };
};
