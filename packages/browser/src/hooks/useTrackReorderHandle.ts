import { use, useEffect } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { Feedback } from '@dnd-kit/dom';
import type { Plugins } from '@dnd-kit/abstract';
import { createDragPopoverHealer } from '../utils/dragPopoverHealer';
import { warnOnce } from '../components/partWarnings';
import { TrackSlotWiringContext, useTrack } from '../components/trackContext';

export interface TrackReorderHandle {
  /** Attach to the element the track is dragged by (a grip). */
  handleRef: (element: Element | null) => void;
  /** True while this track is the one being dragged. */
  isDragSource: boolean;
}

// `dropAnimation: null`: with 'move' there is no placeholder to fly to, so
// dnd-kit's default drop animation animated the lifted slot from where it was
// to where it was, and the slot hung at the pointer for ~250 ms before
// jumping into place (measured on #796, on dev and on the branch alike).
const MOVE_FEEDBACK = Feedback.configure({ feedback: 'move', dropAnimation: null });
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
 * panel (the keyed element React reorders, #796), not an element of the
 * caller. The per-source modifiers REPLACE the
 * provider's clip modifiers for this operation, so track drags are
 * vertical-only and skip clip collision and snap. Data kind 'track-reorder'
 * is the discriminator the shared drag handlers branch on.
 */
export function useTrackReorderHandle(): TrackReorderHandle {
  const { id, index } = useTrack();
  const wiring = use(TrackSlotWiringContext);
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
    // different from what React's fiber tree still believes. (Measured when
    // the registered element was one level inside the keyed slot, before
    // #796; not re-run with the slot itself.) The placeholder splice is created only when
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
    // either way. OptimisticSortingPlugin still moves the element during the
    // drag (`insertAdjacentElement` next to the item it is dragged over);
    // that is safe only because the element is the keyed slot (#796, below).
    // See browser/notes/track-controls-and-reorder.md "Track Reordering".
    plugins: withMoveFeedback,
  });

  // The sortable item is the slot's element, which the part owns: the keyed
  // `ControlSlot`, so that the sorting plugin's moves are moves of the nodes
  // React reorders. An element inside it was moved into the neighbouring
  // slot, and React's next reorder left it there (#796). It is handed to
  // dnd-kit here, after the commit that mounted it. Not in a layout
  // effect: a child's layout effects run before React attaches its parent's
  // ref, so the slot's element would still be null on the first mount (tried:
  // no drag started at all).
  useEffect(() => {
    if (!wiring) return undefined;
    ref(wiring.elementRef.current);
    return () => ref(null);
  }, [ref, wiring]);

  // One handle per panel: a second one registers the same sortable id again.
  useEffect(() => {
    if (!wiring) return undefined;
    const { handleCount } = wiring;
    handleCount.current += 1;
    if (handleCount.current > 1) {
      warnOnce(
        'A track control panel has more than one reorder handle (<TrackReorderGrip /> or ' +
          'useTrackReorderHandle()): each registers the track as the same sortable item. ' +
          'Render one per panel.'
      );
    }
    return () => {
      handleCount.current -= 1;
    };
  }, [wiring]);

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
