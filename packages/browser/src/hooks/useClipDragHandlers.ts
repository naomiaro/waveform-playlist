import React from 'react';
import { flushSync } from 'react-dom';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { calculateBoundaryTrim } from '../utils/boundaryTrim';
import { sortedClipsOf } from '../utils/sortedClips';
import { usePlaylistView, useTrimPreviewOptional } from '../contexts/playlistContexts';
import type { TrimPreview } from '../providerInternals/useTrimPreview';

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  /**
   * Not called by the handlers since #812: a move and a trim reach the engine
   * on release, and the provider hands the engine's tracks to its own
   * `onTracksChange` from there.
   */
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  engineRef: React.RefObject<PlaylistEngine | null>;
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

/** A track's clips in timeline order, and where the clip at `clipIndex` sits in it. */
function trimOrderFor(clips: readonly AudioClip[], clipIndex: number) {
  const sortedClips = sortedClipsOf(clips);
  return { clips, sortedClips, sortedIndex: sortedClips.indexOf(clips[clipIndex]) };
}

type TrimOrder = ReturnType<typeof trimOrderFor>;

/** Whether every clip except the one at `clipIndex` is the same object in both arrays. */
function sameNeighbours(
  a: readonly AudioClip[],
  b: readonly AudioClip[],
  clipIndex: number
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (i !== clipIndex && a[i] !== b[i]) return false;
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
 * **Move:** `onDragEnd` makes one `engine.moveClip()`.
 *
 * **Trim (#812):** each `onDragMove` publishes where the clip would be to the
 * provider's trim preview, which only the dragged clip's view follows; the
 * tracks and the engine are not changed. Each move is computed from the clip
 * as it was when the drag started, constrained by the engine as the release
 * will be (`engine.constrainTrimDelta`), so the preview shows what the
 * release commits. `onDragEnd` makes one `engine.trimClip()` with the delta of
 * the last preview and clears the preview in the same render; Escape clears
 * the preview only. Each of `moveClip` and `trimClip` is one undo step.
 *
 * The returned handlers keep their identity while `tracks` changes (it is read
 * through a ref), so they are safe to pass straight to `DragDropProvider`.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({
 *   tracks,
 *   onTracksChange: setTracks,
 *   samplesPerPixel,
 *   engineRef: playoutRef,
 * });
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
  tracks,
  samplesPerPixel,
  engineRef,
  snapSamplePosition,
}: UseClipDragHandlersOptions) {
  const { sampleRate } = usePlaylistView();
  // The provider's trim preview; none under another provider or outside one,
  // and then a trim is committed on release without being shown.
  const preview = useTrimPreviewOptional();
  // Store snap function in ref so onDragMove doesn't need it as a dependency
  const snapSamplePositionRef = React.useRef(snapSamplePosition);
  snapSamplePositionRef.current = snapSamplePosition;
  // Read through a ref, so that the handlers keep their identity when the
  // tracks change and are not handed to DragDropProvider anew mid-drag.
  const tracksRef = React.useRef(tracks);
  tracksRef.current = tracks;
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

  const onDragStart = React.useCallback((event: DragStartEvent) => {
    const data = event.operation.source?.data as ClipDragData | undefined;
    if (!data || data.kind === 'track-reorder') return;
    trimDragRef.current = null;
    trimOrderRef.current = null;
    lastBoundaryDeltaRef.current = 0;
    // A move needs nothing until the drop.
    if (!data.boundary) return;

    const track = tracksRef.current[data.trackIndex];
    const clip = track?.clips[data.clipIndex];
    if (!track || !clip) return;
    trimDragRef.current = {
      trackId: track.id,
      clipId: data.clipId ?? clip.id,
      boundary: data.boundary,
      original: {
        startSample: clip.startSample,
        durationSamples: clip.durationSamples,
        offsetSamples: clip.offsetSamples,
      },
    };
    trimOrderRef.current = trimOrderFor(track.clips, data.clipIndex);
  }, []);

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const data = event.operation.source?.data as ClipDragData | undefined;
      const drag = trimDragRef.current;
      if (!data?.boundary || !drag || !trimOrderRef.current) return;
      const { trackIndex, clipIndex } = data;

      const currentClips = tracksRef.current[trackIndex]?.clips;
      const clip = currentClips?.[clipIndex];
      if (!currentClips || !clip) return;
      if (!sameNeighbours(trimOrderRef.current.clips, currentClips, clipIndex)) {
        trimOrderRef.current = trimOrderFor(currentClips, clipIndex);
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
      // What `trimClip` will apply on release: the engine has not been
      // changed during the drag, so it constrains from the same bounds.
      // Without an engine the bounds captured at drag start decide.
      const engine = engineRef.current;
      const delta = engine
        ? engine.constrainTrimDelta(drag.trackId, drag.clipId, drag.boundary, proposed)
        : proposed;

      lastBoundaryDeltaRef.current = delta;
      const next: TrimPreview = {
        trackId: drag.trackId,
        clipId: drag.clipId,
        ...trimmedGeometry(drag.original, drag.boundary, delta),
      };
      preview?.publish(next);
    },
    [samplesPerPixel, sampleRate, engineRef, preview]
  );

  /** Ends a trim: one `trimClip` with the last preview's delta, the preview cleared with it. */
  const commitTrim = React.useCallback(
    (drag: TrimDrag, delta: number) => {
      const engine = engineRef.current;
      if (!engine) {
        console.warn(
          '[waveform-playlist] The trim was dropped: no engine is attached (before the first ' +
            'build, or while it is rebuilt after a change of tracks). The clip stays where it was.'
        );
      }
      // Committed and cleared in one synchronous render, so no frame shows the
      // clip where it was before the drag: `trimClip` reaches the app's state
      // through the provider's `onTracksChange` within this call.
      flushSync(() => {
        engine?.trimClip(drag.trackId, drag.clipId, drag.boundary, delta);
        preview?.publish(null);
      });
    },
    [engineRef, preview]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const data = event.operation.source?.data as ClipDragData | undefined;
      if (data?.kind === 'track-reorder') return;

      const drag = trimDragRef.current;
      const delta = lastBoundaryDeltaRef.current;
      trimDragRef.current = null;
      trimOrderRef.current = null;
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
      const trackId = tracksRef.current[data.trackIndex]?.id;
      if (!trackId) {
        console.warn(
          `[waveform-playlist] The move was dropped: there is no track at index ${data.trackIndex}. ` +
            'The clip stays where it was.'
        );
      } else if (!engineRef.current) {
        console.warn(
          '[waveform-playlist] The move was dropped: no engine is attached (before the first ' +
            'build, or while it is rebuilt after a change of tracks). The clip stays where it was.'
        );
      } else {
        engineRef.current.moveClip(trackId, data.clipId, Math.floor(sampleDelta));
      }
    },
    [samplesPerPixel, engineRef, preview, commitTrim]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
