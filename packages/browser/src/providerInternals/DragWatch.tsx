/**
 * A change to the arrangement made elsewhere while a drag is in progress
 * cancels the drag when it changed what is dragged (#848 PR 3, P2), as
 * `<daw-editor>` does. The React drags write nothing until their release
 * (a clip move is one `moveClip`, a trim previews and is one `trimClip`, a
 * reorder is one `reorderTrack`), so a change during a drag came from
 * outside: an app's or an agent's `arrangement.undo()`, `reorderTrack`,
 * `removeTrack`. The change goes through; a mix change, another clip
 * loading or an edit elsewhere let the drag go on.
 *
 * Render-less, inside `ClipInteractionProvider`'s `DragDropProvider`
 * (`useDragDropManager` and `useDragDropMonitor` must be below it). It cancels
 * through the manager (`actions.stop({ canceled: true })`), which ends the
 * operation and dispatches `dragend` with `canceled`, which every handler
 * already treats as a cancel.
 */
import React from 'react';
import { useDragDropManager, useDragDropMonitor } from '@dnd-kit/react';
import type { DragStartEvent } from '@dnd-kit/abstract';
import { isLoadingClip } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';
import { useArrangement } from '../contexts/playlistContexts';

/** What a drag holds of the arrangement when it starts. */
export type DragSnapshot =
  | {
      kind: 'clip';
      trackId: string;
      clipId: string;
      startSample: number;
      durationSamples: number;
      offsetSamples: number;
    }
  | { kind: 'track'; trackId: string; order: readonly string[] };

interface DragData {
  kind?: string;
  trackId?: string;
  trackIndex?: number;
  clipId?: string;
}

/** The snapshot of a drag that starts with this source data; null when it drags nothing of the arrangement. */
export function dragSnapshot(
  arrangement: Arrangement,
  data: DragData | undefined
): DragSnapshot | null {
  if (!data) return null;
  const tracks = arrangement.getTracks();
  if (data.kind === 'track-reorder') {
    if (!data.trackId) return null;
    return { kind: 'track', trackId: data.trackId, order: tracks.map((t) => t.id) };
  }
  if (data.trackIndex === undefined || !data.clipId) return null;
  const track = tracks[data.trackIndex];
  const clip = track?.clips.find((c) => c.id === data.clipId);
  if (!track || !clip || isLoadingClip(clip)) return null;
  return {
    kind: 'clip',
    trackId: track.id,
    clipId: clip.id,
    startSample: clip.startSample,
    durationSamples: clip.durationSamples,
    offsetSamples: clip.offsetSamples,
  };
}

/**
 * True when the arrangement no longer holds what the drag started from: the
 * clip is gone, still loading or at other bounds; the track is gone or the
 * order of the tracks is another.
 */
export function dragChanged(arrangement: Arrangement, snapshot: DragSnapshot): boolean {
  const tracks = arrangement.getTracks();
  if (snapshot.kind === 'track') {
    const ids = tracks.map((t) => t.id);
    if (!ids.includes(snapshot.trackId) || ids.length !== snapshot.order.length) return true;
    return ids.some((id, i) => id !== snapshot.order[i]);
  }
  const clip = tracks
    .find((t) => t.id === snapshot.trackId)
    ?.clips.find((c) => c.id === snapshot.clipId);
  if (!clip || isLoadingClip(clip)) return true;
  return (
    clip.startSample !== snapshot.startSample ||
    clip.durationSamples !== snapshot.durationSamples ||
    clip.offsetSamples !== snapshot.offsetSamples
  );
}

/** Cancels the drag in progress when an outside change to the arrangement touched it. */
export const DragWatch: React.FC = () => {
  const arrangement = useArrangement();
  const manager = useDragDropManager();
  // The drag in progress, read inside the arrangement listener: no state, no
  // render per change (skill react-patterns).
  const snapshotRef = React.useRef<DragSnapshot | null>(null);

  // One handlers object for the component's lifetime: dnd-kit re-subscribes
  // the monitor whenever the object changes, and a re-subscription would put
  // this dragend listener after the provider's, so the release's own commit
  // would reach the arrangement listener with the snapshot still set (review
  // of #919). Subscribed once on mount, it runs before the provider's.
  const arrangementRef = React.useRef(arrangement);
  React.useLayoutEffect(() => {
    arrangementRef.current = arrangement;
  }, [arrangement]);
  const handlers = React.useMemo(
    () => ({
      onDragStart: (event: DragStartEvent) => {
        snapshotRef.current = dragSnapshot(
          arrangementRef.current,
          event.operation.source?.data as DragData | undefined
        );
      },
      onDragEnd: () => {
        snapshotRef.current = null;
      },
    }),
    []
  );
  useDragDropMonitor(handlers);

  React.useEffect(() => {
    // Without a manager there is no drag to cancel.
    if (!manager) return;
    return arrangement.subscribe(() => {
      const snapshot = snapshotRef.current;
      if (!snapshot || !dragChanged(arrangement, snapshot)) return;
      snapshotRef.current = null;
      manager.actions.stop({ canceled: true });
    });
  }, [arrangement, manager]);

  return null;
};
