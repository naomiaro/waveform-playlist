/**
 * Whether a change to the arrangement made during a drag changed what is
 * dragged (#848 PR 3, P2). A drag writes nothing until its release (P1), so
 * any change while it is in progress came from elsewhere (an app's or an
 * agent's undo, reorder or removal). The drag is cancelled, like a
 * `pointercancel`, only when the change touched it: the dragged clip is gone
 * or no longer where the drag started from, or the dragged track is gone or
 * the order of the tracks changed. A mix change, another clip loading or an
 * edit elsewhere let the drag go on; its release applies to the arrangement
 * as it is then.
 */
import { isLoadingClip } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';

/** A clip drag past its threshold, with the clip's bounds when it started. */
export interface DraggedClip {
  trackId: string;
  clipId: string;
  startSample: number;
  durationSamples: number;
  offsetSamples: number;
}

/** A track drag, with the order of the tracks at the grab. */
export interface DraggedTrack {
  trackId: string;
  order: readonly string[];
}

/** True when the arrangement no longer holds the dragged clip where the drag started from. */
export function clipDragChanged(arrangement: Arrangement, drag: DraggedClip): boolean {
  const clip = arrangement
    .getTracks()
    .find((t) => t.id === drag.trackId)
    ?.clips.find((c) => c.id === drag.clipId);
  if (!clip || isLoadingClip(clip)) return true;
  return (
    clip.startSample !== drag.startSample ||
    clip.durationSamples !== drag.durationSamples ||
    clip.offsetSamples !== drag.offsetSamples
  );
}

/** True when the dragged track is gone or the order of the tracks is not the one at the grab. */
export function trackDragChanged(arrangement: Arrangement, drag: DraggedTrack): boolean {
  const ids = arrangement.getTracks().map((t) => t.id);
  if (!ids.includes(drag.trackId) || ids.length !== drag.order.length) return true;
  return ids.some((id, i) => id !== drag.order[i]);
}
