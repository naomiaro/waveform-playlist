import { useCallback, useEffect, useRef } from 'react';
import {
  usePlaybackAnimation,
  usePlaylistControls,
  usePlaylistState,
} from '../WaveformPlaylistContext';

/**
 * The one way playback is started by the built-in controls, so the Play button
 * and the Space shortcut cannot drift apart:
 *
 * - a highlighted selection, with looping off: play the selection, then stop;
 * - otherwise: play from the cursor. With looping on, the transport's own loop
 *   handles the boundaries.
 *
 * The returned function keeps its identity; it reads the latest selection and
 * loop state when it is called.
 */
export function usePlayFromSelectionOrCursor(): () => Promise<void> {
  const { currentTimeRef } = usePlaybackAnimation();
  const { selectionStart, selectionEnd, isLoopEnabled } = usePlaylistState();
  const { play } = usePlaylistControls();

  const latest = useRef({ selectionStart, selectionEnd, isLoopEnabled });
  useEffect(() => {
    latest.current = { selectionStart, selectionEnd, isLoopEnabled };
  });

  return useCallback(async () => {
    const { selectionStart: start, selectionEnd: end, isLoopEnabled: looping } = latest.current;
    if (end > start && !looping) {
      await play(start, end - start);
    } else {
      await play(currentTimeRef.current ?? 0);
    }
  }, [play, currentTimeRef]);
}
