/**
 * Pure helpers for the track-reorder drag preview.
 *
 * The preview is view-level only: it produces a DISPLAY order/geometry while
 * the engine's committed `tracks` order stays untouched until drop.
 */

export interface TrackDragPreview {
  trackId: string;
  toIndex: number;
}

/**
 * Returns the display order with the previewed track moved to `toIndex`.
 * Identity (same reference) when there is nothing to do — null preview,
 * unknown id, or an index that doesn't change the order.
 */
export function applyTrackOrderPreview<T extends { id: string }>(
  tracks: readonly T[],
  preview: TrackDragPreview | null
): readonly T[] {
  if (!preview) return tracks;
  const fromIndex = tracks.findIndex((t) => t.id === preview.trackId);
  if (fromIndex === -1) return tracks;
  const toIndex = Math.max(0, Math.min(tracks.length - 1, preview.toIndex));
  if (toIndex === fromIndex) return tracks;
  const next = tracks.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export interface TrackLayout {
  topById: Map<string, number>;
  totalHeight: number;
}

/**
 * Cumulative vertical layout for absolutely-positioned track rows. Both the
 * waveform column and the controls column render from the SAME layout so they
 * can never drift apart mid-preview. Ids missing from `heightById` contribute
 * height 0 (defensive; should not happen in practice).
 */
export function computeTrackLayout(
  orderedIds: readonly string[],
  heightById: ReadonlyMap<string, number>
): TrackLayout {
  const topById = new Map<string, number>();
  let top = 0;
  for (const id of orderedIds) {
    topById.set(id, top);
    top += heightById.get(id) ?? 0;
  }
  return { topById, totalHeight: top };
}
