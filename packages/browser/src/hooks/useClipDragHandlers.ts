import React from 'react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { calculateBoundaryTrim } from '../utils/boundaryTrim';
import { sortedClipsOf } from '../utils/sortedClips';
import {
  useArrangement,
  usePlaylistView,
  useTrimPreviewOptional,
} from '../contexts/playlistContexts';
import type { TrimPreview } from '../providerInternals/useTrimPreview';

interface UseClipDragHandlersOptions {
  samplesPerPixel: number;
  /** Optional function that snaps a sample position to the nearest grid position.
   *  Used for boundary trim snapping (move snapping is handled by the SnapToGridModifier). */
  snapSamplePosition?: (samplePosition: number) => number;
}

type Boundary = 'left' | 'right';

/** What dnd-kit's source data holds for a clip (see `Clip` in ui-components). */
interface ClipDragData {
  kind?: string;
  clipId: string;
  boundary?: Boundary;
  trackIndex: number;
  clipIndex: number;
}

type Geometry = Pick<AudioClip, 'startSample' | 'durationSamples' | 'offsetSamples'>;

/** A boundary trim in progress: which clip, and its bounds when the drag started. */
interface TrimDrag {
  trackId: string;
  clipId: string;
  boundary: Boundary;
  original: Geometry;
}

/** A clip move in progress: the track it was picked up on, by id. */
interface MoveDrag {
  trackId: string;
  clipId: string;
}

// The loaded clips of each arrangement track object (the objects never
// change, so one array per object): what a drag can pick up and collide with.
const loadedClipsByTrack = new WeakMap<ArrangementTrack, readonly AudioClip[]>();
function loadedClipsOf(track: ArrangementTrack): readonly AudioClip[] {
  let clips = loadedClipsByTrack.get(track);
  if (!clips) {
    clips = track.clips.filter((clip): clip is AudioClip => !isLoadingClip(clip));
    loadedClipsByTrack.set(track, clips);
  }
  return clips;
}

/** A track's clips in timeline order, and where `clip` sits in it. */
function trimOrderFor(clips: readonly AudioClip[], clip: AudioClip) {
  const sortedClips = sortedClipsOf(clips);
  return { clips, sortedClips, sortedIndex: sortedClips.indexOf(clip) };
}

type TrimOrder = ReturnType<typeof trimOrderFor>;

/** Whether every clip except the one with id `clipId` is the same object in both arrays. */
function sameNeighbours(a: readonly AudioClip[], b: readonly AudioClip[], clipId: string): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== clipId && a[i] !== b[i]) return false;
  }
  return true;
}

/** The geometry of a clip whose `boundary` has moved by `delta` samples. */
function trimmedGeometry(original: Geometry, boundary: Boundary, delta: number): Geometry {
  return boundary === 'left'
    ? {
        startSample: original.startSample + delta,
        durationSamples: original.durationSamples - delta,
        offsetSamples: original.offsetSamples + delta,
      }
    : { ...original, durationSamples: original.durationSamples + delta };
}

interface ProposedTrim {
  drag: TrimDrag;
  clip: AudioClip;
  pixelDelta: number;
  samplesPerPixel: number;
  sampleRate: number;
  order: TrimOrder;
  snap: ((samplePosition: number) => number) | undefined;
}

/**
 * The trim delta, in whole samples, for a pointer `pixelDelta` from where the
 * drag started: constrained by the clip's neighbours and source, then with the
 * moved boundary's absolute position snapped to the grid.
 */
function proposedTrimDelta({
  drag,
  clip,
  pixelDelta,
  samplesPerPixel,
  sampleRate,
  order,
  snap,
}: ProposedTrim): number {
  const { original, boundary } = drag;
  const trimmed = calculateBoundaryTrim({
    originalClip: original,
    clip,
    pixelDelta,
    samplesPerPixel,
    sampleRate,
    boundary,
    sortedClips: order.sortedClips,
    sortedIndex: order.sortedIndex,
  });
  if (boundary === 'left') {
    const start = snap ? snap(trimmed.startSample) : trimmed.startSample;
    return Math.floor(start - original.startSample);
  }
  const end = trimmed.startSample + trimmed.durationSamples;
  const snappedEnd = snap ? snap(end) : end;
  return Math.floor(snappedEnd - original.startSample - original.durationSamples);
}

/**
 * Custom hook for handling clip drag operations (movement and trimming)
 *
 * Provides drag handlers for use with @dnd-kit/react DragDropProvider.
 * Handles both clip movement (dragging entire clips) and boundary trimming (adjusting clip edges).
 *
 * Collision detection for clip moves is handled by `ClipCollisionModifier` (passed to DragDropProvider).
 *
 * It changes the provider's arrangement (`useArrangement()`), so it works
 * whether an engine is attached or not, and throws outside
 * `WaveformPlaylistProvider`.
 *
 * **Move:** `onDragStart` notes the clip's track by id; `onDragEnd` makes one
 * `arrangement.moveClip()` on that track, also when the tracks were reordered
 * meanwhile.
 *
 * **Trim (#812):** each `onDragMove` publishes where the clip would be to the
 * provider's trim preview, which only the dragged clip's view follows; the
 * tracks are not changed. Each move is computed from the clip as it was when
 * the drag started, constrained as the release will be
 * (`arrangement.constrainTrimDelta`), so the preview shows what the release
 * commits. `onDragEnd` makes one `arrangement.trimClip()` with the delta of
 * the last preview and clears the preview in the same render; Escape clears
 * the preview only. Each of `moveClip` and `trimClip` is one undo step.
 *
 * The returned handlers read the tracks from the arrangement when they run,
 * so they keep their identity and are safe to pass straight to
 * `DragDropProvider`.
 *
 * @example
 * ```tsx
 * const { tracks } = usePlaylistTimeline();
 * const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({ samplesPerPixel });
 *
 * return (
 *   <DragDropProvider
 *     onDragStart={onDragStart}
 *     onDragMove={onDragMove}
 *     onDragEnd={onDragEnd}
 *     modifiers={[RestrictToHorizontalAxis, ClipCollisionModifier.configure({ tracks, samplesPerPixel })]}
 *   >
 *     <WaveformEditor />
 *   </DragDropProvider>
 * );
 * ```
 */
export function useClipDragHandlers({
  samplesPerPixel,
  snapSamplePosition,
}: UseClipDragHandlersOptions) {
  const arrangement = useArrangement();
  const { sampleRate } = usePlaylistView();
  // The provider's trim preview; none under another provider or outside one,
  // and then a trim is committed on release without being shown.
  const preview = useTrimPreviewOptional();
  // Store snap function in ref so onDragMove doesn't need it as a dependency
  const snapSamplePositionRef = React.useRef(snapSamplePosition);
  snapSamplePositionRef.current = snapSamplePosition;
  // The trimmed clip's neighbours in timeline order. Collision constraints
  // keep the clip between the same two neighbours, so the order found at drag
  // start holds for the drag and is not re-sorted on every pointer move.
  // `clips` is the array it was computed from: if any OTHER clip of the track
  // has been replaced since (an undo during the drag, a recording landing on
  // the track, audio arriving for it), it is recomputed.
  const trimOrderRef = React.useRef<TrimOrder | null>(null);
  // The trim in progress, with the clip's bounds at drag start (each move is
  // computed from them, never from the previous move).
  const trimDragRef = React.useRef<TrimDrag | null>(null);
  // The delta (samples) of the last published preview: what the release sends.
  const lastBoundaryDeltaRef = React.useRef(0);
  // The move in progress: the clip's track by id, so a reorder before the
  // drop does not move a clip of another track.
  const moveDragRef = React.useRef<MoveDrag | null>(null);

  // A drag that never ends (its component unmounts mid-drag) must not leave
  // its preview on screen.
  React.useEffect(() => {
    if (!preview) return;
    return () => {
      if (trimDragRef.current) {
        trimDragRef.current = null;
        preview.publish(null);
      }
    };
  }, [preview]);

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const data = event.operation.source?.data as ClipDragData | undefined;
      if (!data || data.kind === 'track-reorder') return;
      trimDragRef.current = null;
      trimOrderRef.current = null;
      moveDragRef.current = null;
      lastBoundaryDeltaRef.current = 0;
      // The row the drag began on is the arrangement's track at that index.
      const track = arrangement.getTracks()[data.trackIndex];
      if (!track) return;
      // A move needs nothing else until the drop.
      if (!data.boundary) {
        moveDragRef.current = { trackId: track.id, clipId: data.clipId };
        return;
      }

      // By id: `clipIndex` is a position in the drawn row, which can hold
      // placeholders that are not loaded clips.
      const clips = loadedClipsOf(track);
      const clip = clips.find((c) => c.id === data.clipId);
      if (!clip) return;
      trimDragRef.current = {
        trackId: track.id,
        clipId: clip.id,
        boundary: data.boundary,
        original: {
          startSample: clip.startSample,
          durationSamples: clip.durationSamples,
          offsetSamples: clip.offsetSamples,
        },
      };
      trimOrderRef.current = trimOrderFor(clips, clip);
    },
    [arrangement]
  );

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const data = event.operation.source?.data as ClipDragData | undefined;
      const drag = trimDragRef.current;
      if (!data?.boundary || !drag || !trimOrderRef.current) return;
      // By the id captured at drag start: the track's row can move mid-drag
      // (a reorder), and `data.trackIndex` is the row it had then. While the
      // track is gone, a move does nothing.
      const track = arrangement.getTracks().find((t) => t.id === drag.trackId);
      const currentClips = track ? loadedClipsOf(track) : undefined;
      const clip = currentClips?.find((c) => c.id === drag.clipId);
      if (!currentClips || !clip) return;
      if (!sameNeighbours(trimOrderRef.current.clips, currentClips, drag.clipId)) {
        trimOrderRef.current = trimOrderFor(currentClips, clip);
      }

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const proposed = proposedTrimDelta({
        drag,
        clip,
        pixelDelta: currentX - event.operation.position.initial.x,
        samplesPerPixel,
        sampleRate,
        order: trimOrderRef.current,
        snap: snapSamplePositionRef.current,
      });
      // What `trimClip` will apply on release: the clip has not been
      // changed during the drag, so it constrains from the same bounds.
      const delta = arrangement.constrainTrimDelta(
        drag.trackId,
        drag.clipId,
        drag.boundary,
        proposed
      );

      lastBoundaryDeltaRef.current = delta;
      const next: TrimPreview = {
        trackId: drag.trackId,
        clipId: drag.clipId,
        ...trimmedGeometry(drag.original, drag.boundary, delta),
      };
      preview?.publish(next);
    },
    [samplesPerPixel, sampleRate, arrangement, preview]
  );

  /** Ends a trim: one `trimClip` with the last preview's delta, the preview cleared with it. */
  const commitTrim = React.useCallback(
    (drag: TrimDrag, delta: number) => {
      // No frame shows the clip where it was before the drag: dnd-kit calls
      // this inside `startTransition`, but the view reads both the
      // arrangement and the preview with `useSyncExternalStore`, whose
      // updates React applies at once, together, even inside a transition.
      arrangement.trimClip(drag.trackId, drag.clipId, drag.boundary, delta);
      preview?.publish(null);
    },
    [arrangement, preview]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const data = event.operation.source?.data as ClipDragData | undefined;
      if (data?.kind === 'track-reorder') return;

      const drag = trimDragRef.current;
      const move = moveDragRef.current;
      const delta = lastBoundaryDeltaRef.current;
      trimDragRef.current = null;
      trimOrderRef.current = null;
      moveDragRef.current = null;
      lastBoundaryDeltaRef.current = 0;

      // Canceled (Escape, focus loss, unmount): nothing was changed but the
      // preview. A canceled move needs nothing: the Feedback plugin puts the
      // clip back and the engine was never told.
      if (event.canceled || !data) {
        if (drag) preview?.publish(null);
        return;
      }

      if (data.boundary) {
        if (drag) commitTrim(drag, delta);
        return;
      }

      // Clip move: transform.x is modifier-constrained, cached as a plain
      // object in the snapshot.
      const sampleDelta = event.operation.transform.x * samplesPerPixel;
      const tracks = arrangement.getTracks();
      // The track the clip was picked up on; by its row only when the drag
      // start was not seen (a custom wiring that calls onDragEnd alone).
      const trackId = move?.clipId === data.clipId ? move.trackId : tracks[data.trackIndex]?.id;
      const track = trackId === undefined ? undefined : tracks.find((t) => t.id === trackId);
      if (!track) {
        console.warn(
          `[waveform-playlist] The move was dropped: the clip's track is not there ` +
            `(row ${data.trackIndex}). The clip stays where it was.`
        );
      } else if (!loadedClipsOf(track).some((c) => c.id === data.clipId)) {
        console.warn(
          `[waveform-playlist] The move was dropped: track "${track.id}" has no clip "${data.clipId}".`
        );
      } else {
        arrangement.moveClip(track.id, data.clipId, Math.floor(sampleDelta));
      }
    },
    [samplesPerPixel, arrangement, preview, commitTrim]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
