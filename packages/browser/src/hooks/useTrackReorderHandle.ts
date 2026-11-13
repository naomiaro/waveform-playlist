import { useContext, useEffect } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { Feedback } from '@dnd-kit/dom';
import type { Plugins } from '@dnd-kit/abstract';
import { createDragPopoverHealer } from '../utils/dragPopoverHealer';
import { TrackSlotWiringContext, useTrack } from '../components/trackContext';

export interface TrackReorderHandle {
  /** Attach to the element the track is dragged by (a grip). */
  handleRef: (element: Element | null) => void;
  /** True while this track is the one being dragged. */
  isDragSource: boolean;
}

const MOVE_FEEDBACK = Feedback.configure({ feedback: 'move' });
const withMoveFeedback = (defaults: Plugins): Plugins => [...defaults, MOVE_FEEDBACK];

/**
 * Makes the track whose control panel the caller is part of a vertical
 * sortable item in the ambient `DragDropProvider` (`ClipInteractionProvider`),
 * dragged by the element `handleRef` is attached to (#687; it replaces
 * `SortableTrackControls`). `<TrackReorderGrip />` is this hook with the
 * built-in grip; call it yourself for a grip of your own. Once per panel: two
 * calls for one track register the same sortable id twice.
 *
 * The item that moves is the slot `<WaveformTrackControls>` draws around the
 * panel, not an element of the caller. The per-source modifiers REPLACE the
 * provider's clip modifiers for this operation, so track drags are
 * vertical-only and skip clip collision and snap. Data kind 'track-reorder'
 * is the discriminator the shared drag handlers branch on.
 */
export function useTrackReorderHandle(): TrackReorderHandle {
  const { id, index } = useTrack();
  const wiring = useContext(TrackSlotWiringContext);
  const { ref, handleRef, isDragSource } = useSortable({
    id: `track-reorder-${id}`,
    index,
    group: 'playlist-tracks',
    type: 'track',
    accept: ['track'],
    data: { kind: 'track-reorder', trackId: id },
    modifiers: [RestrictToVerticalAxis],
    // Per-entity Feedback config (@dnd-kit 0.5+ moved `feedback` out of the
    // hook options into `plugins`). The FUNCTION form extends the sortable's
    // default plugins — a bare array would silently drop
    // OptimisticSortingPlugin, which drives the live `sortable.index` that
    // drag-commit reads (covered by trackReorderHandleFeedbackPlugins.test).
    //
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
    // sortables need shape. `isDragSource` is a reactive signal, unaffected
    // either way. See browser/CLAUDE.md "Track Reordering".
    plugins: withMoveFeedback,
  });

  // The sortable item is the slot's element, which the part owns: it is
  // handed to dnd-kit here, after the commit that mounted it.
  useEffect(() => {
    if (!wiring) return undefined;
    ref(wiring.elementRef.current);
    return () => ref(null);
  }, [ref, wiring]);

  // The slot draws itself lifted (opaque, with a shadow) while it is dragged.
  useEffect(() => {
    if (!wiring) return undefined;
    wiring.setDragSource(isDragSource);
    return () => wiring.setDragSource(false);
  }, [isDragSource, wiring]);

  // `feedback: 'move'` opts out of dnd-kit's placeholder — and with it the
  // plugin's own popover-recovery MutationObserver, which is only created
  // when a placeholder exists. OptimisticSortingPlugin's mid-drag
  // insertAdjacentElement splices force-dismiss the top-layer popover
  // (eventlessly, per spec), leaving the dragged row UA-hidden
  // (`[popover]:not(:popover-open) { display: none }`) for the rest of the
  // drag. Run our own healer while this row is the drag source.
  useEffect(() => {
    const element = wiring?.elementRef.current;
    if (!isDragSource || !element) return undefined;
    return createDragPopoverHealer(element);
  }, [isDragSource, wiring]);

  return { handleRef, isDragSource };
}
