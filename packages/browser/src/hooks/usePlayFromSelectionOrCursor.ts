import { useCallback, useEffect, useRef } from 'react';
import {
  usePlaybackAnimation,
  usePlaylistControls,
  usePlaylistState,
  useSelection,
} from '../WaveformPlaylistContext';

/**
 * The one way playback is started by the built-in controls, so the Play button
 * and the Space shortcut cannot drift apart:
 *
 * - a highlighted selection, with looping off: play the selection, then stop.
 *   If the cursor is inside the selection (playback was paused there), resume
 *   from the cursor to the selection's end instead of starting over;
 * - otherwise: play from the cursor. With looping on, the transport's own loop
 *   handles the boundaries.
 *
 * The returned function keeps its identity; it reads the latest selection and
 * loop state when it is called.
 */
export function usePlayFromSelectionOrCursor(): () => Promise<void> {
  const { currentTimeRef } = usePlaybackAnimation();
  const { selectionStart, selectionEnd } = useSelection();
  const { isLoopEnabled } = usePlaylistState();
  const { play } = usePlaylistControls();

  const latest = useRef({ selectionStart, selectionEnd, isLoopEnabled });
  useEffect(() => {
    latest.current = { selectionStart, selectionEnd, isLoopEnabled };
  });

  return useCallback(async () => {
    const { selectionStart: start, selectionEnd: end, isLoopEnabled: looping } = latest.current;
    const cursor = currentTimeRef.current ?? 0;
    if (end > start && !looping) {
      // Paused part-way through the selection: carry on from the cursor.
      const from = cursor > start && cursor < end ? cursor : start;
      await play(from, end - from);
    } else {
      await play(cursor);
    }
  }, [play, currentTimeRef]);
}
