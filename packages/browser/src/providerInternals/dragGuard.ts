/**
 * The drags in progress that undo and redo wait for (#848): a clip move, a
 * clip trim, a track-reorder drag. One per `WaveformPlaylistProvider`, which
 * owns it; the drag handlers begin and end it, `undo` / `redo` read it.
 *
 * Not React state: nothing re-renders when a drag starts or ends (`canUndo`
 * and `canRedo` are unchanged during a drag; only the actions are inert).
 */
export interface DragGuard {
  /** Marks a drag as in progress. The returned `end` is idempotent. */
  begin(): () => void;
  /** True while a `begin` has not been ended. */
  readonly active: boolean;
}

export function createDragGuard(): DragGuard {
  let count = 0;
  return {
    begin() {
      count++;
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        count--;
      };
    },
    get active() {
      return count > 0;
    },
  };
}
