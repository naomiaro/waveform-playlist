import React from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';

export interface SortableTrackControlsRenderProps {
  /** Attach to the slot wrapper element (the sortable item). */
  ref: (element: Element | null) => void;
  /** Attach to the drag grip element. */
  handleRef: (element: Element | null) => void;
  isDragSource: boolean;
}

export interface SortableTrackControlsProps {
  trackId: string;
  index: number;
  disabled?: boolean;
  children: (props: SortableTrackControlsRenderProps) => React.ReactNode;
}

/**
 * Registers a track-controls row as a vertical sortable item in the ambient
 * DragDropProvider (ClipInteractionProvider). The per-source modifiers
 * REPLACE the provider's clip modifiers for this operation, so track drags
 * are vertical-only and skip clip collision/snap. Data kind 'track-reorder'
 * is the discriminator the shared drag handlers branch on.
 */
export const SortableTrackControls: React.FC<SortableTrackControlsProps> = ({
  trackId,
  index,
  disabled = false,
  children,
}) => {
  const { ref, handleRef, isDragSource } = useSortable({
    id: `track-reorder-${trackId}`,
    index,
    group: 'playlist-tracks',
    type: 'track',
    accept: ['track'],
    data: { kind: 'track-reorder', trackId },
    modifiers: [RestrictToVerticalAxis],
    disabled,
    // feedback: 'move' (NOT 'none' — see below) disables the Feedback
    // plugin's placeholder/clone splicing for this sortable while KEEPING its
    // dragOperation.shape computation alive. That plugin does raw,
    // React-bypassing DOM surgery on ANY pointer movement during an activated
    // drag (insertAdjacentElement to splice in a placeholder, then
    // `placeholder.replaceWith(element)` on drop) — confirmed via
    // MutationObserver instrumentation to relocate the React-owned row 6
    // times during a single one-slot drag, leaving its final parent/sibling
    // different from what React's fiber tree still believes. That desync is
    // permanent for the session: every later React-driven reorder (button OR
    // drag) computes the correct data but silently fails to update the DOM
    // for these rows. The placeholder splice is created only when
    // `feedback !== 'move'` (@dnd-kit/dom Feedback.ts) — 'move' keeps the
    // dragged element in the live DOM (no clone/placeholder) while still
    // running the *unconditional* `dragOperation.shape = ...` assignment.
    // `feedback: 'none'` looked like the boundary-trim precedent (Clip.tsx /
    // AnnotationBox.tsx) but is wrong here: 'none' bails out of Feedback's
    // render function BEFORE dragOperation.shape is ever set, and shape is
    // the ONLY input CollisionObserver.computeCollisions() checks — with
    // 'none', collision (and therefore sortable.index) never updates, so
    // drag-based reordering silently never commits. Boundary trims don't hit
    // this because they're plain useDraggable (no collision-based commit) —
    // sortables need shape. `isDragSource` (opacity feedback below) is a
    // reactive signal, unaffected either way. See browser/CLAUDE.md
    // "Track Reordering".
    feedback: 'move',
  });
  return <>{children({ ref, handleRef, isDragSource })}</>;
};
