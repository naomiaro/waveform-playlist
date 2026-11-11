import React from 'react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { calculateBoundaryTrim } from '../utils/boundaryTrim';
import { sortedClipsOf } from '../utils/sortedClips';
import { usePlaylistData } from '../WaveformPlaylistContext';

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  engineRef: React.RefObject<PlaylistEngine | null>;
  /** Ref toggled during boundary trim drags. When true, the provider's loadAudio
   *  skips engine rebuilds so engine keeps original clip positions. On drag end,
   *  engine.trimClip() commits the final delta. Obtain from usePlaylistData(). */
  isDraggingRef: React.MutableRefObject<boolean>;
  /** Optional function that snaps a sample position to the nearest grid position.
   *  Used for boundary trim snapping (move snapping is handled by the SnapToGridModifier). */
  snapSamplePosition?: (samplePosition: number) => number;
}

/**
 * Custom hook for handling clip drag operations (movement and trimming)
 *
 * Provides drag handlers for use with @dnd-kit/react DragDropProvider.
 * Handles both clip movement (dragging entire clips) and boundary trimming (adjusting clip edges).
 *
 * Collision detection for clip moves is handled by `ClipCollisionModifier` (passed to DragDropProvider).
 *
 * **Move:** `onDragEnd` delegates to `engine.moveClip()` in one shot.
 *
 * **Trim:** `onDragMove` updates React state per-frame via `onTracksChange` for smooth
 * visual feedback (using cumulative deltas from the original clip snapshot). `isDraggingRef`
 * prevents loadAudio from rebuilding the engine during the drag, so the engine keeps the
 * original clip positions. On drag end, `engine.trimClip()` commits the final delta.
 *
 * The returned handlers keep their identity while `tracks` and `onTracksChange` change
 * (both are read through refs), so they are safe to pass straight to `DragDropProvider`.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({
 *   tracks,
 *   onTracksChange: setTracks,
 *   samplesPerPixel,
 *   engineRef: playoutRef,
 *   isDraggingRef,
 * });
 *
 * return (
 *   <DragDropProvider
 *     onDragStart={onDragStart}
 *     onDragMove={onDragMove}
 *     onDragEnd={onDragEnd}
 *     modifiers={[RestrictToHorizontalAxis, ClipCollisionModifier.configure({ tracks, samplesPerPixel })]}
 *   >
 *     <Waveform showClipHeaders={true} />
 *   </DragDropProvider>
 * );
 * ```
 */
export function useClipDragHandlers({
  tracks,
  onTracksChange,
  samplesPerPixel,
  engineRef,
  isDraggingRef,
  snapSamplePosition,
}: UseClipDragHandlersOptions) {
  const { sampleRate } = usePlaylistData();
  // Store snap function in ref so onDragMove doesn't need it as a dependency
  const snapSamplePositionRef = React.useRef(snapSamplePosition);
  snapSamplePositionRef.current = snapSamplePosition;
  // The handlers read tracks and onTracksChange through refs. A trim calls
  // onTracksChange on every pointer move; with `tracks` as a dependency all
  // three handlers were re-created per move and handed to DragDropProvider
  // mid-drag.
  const tracksRef = React.useRef(tracks);
  tracksRef.current = tracks;
  const onTracksChangeRef = React.useRef(onTracksChange);
  onTracksChangeRef.current = onTracksChange;
  // The trimmed clip's neighbours in timeline order, found once when the drag
  // starts. A trim replaces only the dragged clip, and collision constraints
  // keep it between the same two neighbours, so the order holds for the drag.
  const trimOrderRef = React.useRef<{ sortedClips: AudioClip[]; sortedIndex: number } | null>(null);
  // Store original clip state when drag starts (for cumulative delta application)
  const originalClipStateRef = React.useRef<{
    offsetSamples: number;
    durationSamples: number;
    startSample: number;
  } | null>(null);

  // Store the last boundary trim delta (samples) so onDragEnd uses the same value
  // as the last onDragMove visual update, avoiding stale-position mismatches.
  const lastBoundaryDeltaRef = React.useRef(0);

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const data = event.operation.source?.data as
        | {
            kind?: string;
            boundary?: 'left' | 'right';
            trackIndex: number;
            clipIndex: number;
          }
        | undefined;

      if (!data || data.kind === 'track-reorder') return;

      // Only store state for boundary trimming operations
      if (!data.boundary) {
        originalClipStateRef.current = null;
        // Group move into one undo step
        if (engineRef.current) {
          engineRef.current.beginTransaction();
        } else {
          console.warn(
            '[waveform-playlist] onDragStart: engine not ready, move will not be grouped for undo'
          );
        }
        return;
      }

      const track = tracksRef.current[data.trackIndex];
      const clip = track?.clips[data.clipIndex];

      if (clip) {
        // Store original clip state for cumulative delta application
        originalClipStateRef.current = {
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
          startSample: clip.startSample,
        };
        const sortedClips = sortedClipsOf(track.clips);
        trimOrderRef.current = { sortedClips, sortedIndex: sortedClips.indexOf(clip) };
        // Signal provider to skip loadAudio rebuilds during the drag
        isDraggingRef.current = true;
        // Group the drag into one undo step
        if (engineRef.current) {
          engineRef.current.beginTransaction();
        } else {
          console.warn(
            '[waveform-playlist] onDragStart: engine not ready, trim will not be grouped for undo'
          );
        }
      }
    },
    [isDraggingRef, engineRef]
  );

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const data = event.operation.source?.data as
        | {
            kind?: string;
            boundary?: 'left' | 'right';
            trackIndex: number;
            clipIndex: number;
          }
        | undefined;

      if (!data || data.kind === 'track-reorder') return;

      // Only update for boundary trimming operations (not clip movement)
      if (!data.boundary) return;

      // Need original clip state to apply cumulative delta
      if (!originalClipStateRef.current || !trimOrderRef.current) return;

      const { boundary, trackIndex, clipIndex } = data;

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const rawDeltaX = currentX - event.operation.position.initial.x;
      const sampleDelta = rawDeltaX * samplesPerPixel;

      // Get original clip state (stored on drag start)
      const originalClip = originalClipStateRef.current;
      const { sortedClips, sortedIndex } = trimOrderRef.current;
      const snapFn = snapSamplePositionRef.current;

      // Track the effective delta after snapping (for engine.trimClip on drag end)
      let effectiveDelta = sampleDelta;

      // Update tracks in real-time during drag
      const newTracks = tracksRef.current.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        const newClips = track.clips.map((clip, cIdx) => {
          if (cIdx !== clipIndex) return clip;

          let trimResult = calculateBoundaryTrim({
            originalClip,
            clip,
            pixelDelta: rawDeltaX,
            samplesPerPixel,
            sampleRate,
            boundary,
            sortedClips,
            sortedIndex,
          });

          // Snap the boundary position to the grid if a snap function is provided
          if (snapFn) {
            if (boundary === 'left') {
              const snappedStart = snapFn(trimResult.startSample);
              const delta = snappedStart - trimResult.startSample;
              trimResult = {
                startSample: snappedStart,
                durationSamples: trimResult.durationSamples - delta,
                offsetSamples: trimResult.offsetSamples + delta,
              };
              // Effective delta = how far the start moved from original
              effectiveDelta = snappedStart - originalClip.startSample;
            } else {
              const endSample = trimResult.startSample + trimResult.durationSamples;
              const snappedEnd = snapFn(endSample);
              trimResult = {
                ...trimResult,
                durationSamples: snappedEnd - trimResult.startSample,
              };
              // Effective delta = how much the duration changed from original
              effectiveDelta = trimResult.durationSamples - originalClip.durationSamples;
            }
          }

          return {
            ...clip,
            startSample: trimResult.startSample,
            durationSamples: trimResult.durationSamples,
            offsetSamples: trimResult.offsetSamples,
          };
        });

        return { ...track, clips: newClips };
      });

      lastBoundaryDeltaRef.current = effectiveDelta;
      onTracksChangeRef.current(newTracks);
    },
    [samplesPerPixel, sampleRate]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const kindData = event.operation.source?.data as { kind?: string } | undefined;
      if (kindData?.kind === 'track-reorder') return;

      // Handle canceled drags (focus loss, Escape key, component unmount).
      // Without this, isDraggingRef stays true and loadAudio skips rebuilds permanently.
      if (event.canceled) {
        // Revert React state for boundary trims — onDragMove updated tracks per-frame,
        // but the engine still has original positions (isDraggingRef blocked rebuilds).
        // For clip moves, originalClipStateRef is null so this block is skipped —
        // no React state revert needed because the Feedback plugin handles the visual
        // position (CSS translate removed on cancel) and engine was never mutated.
        if (originalClipStateRef.current) {
          const cancelData = event.operation.source?.data as
            | { trackIndex: number; clipIndex: number }
            | undefined;
          if (cancelData) {
            const { trackIndex, clipIndex } = cancelData;
            const original = originalClipStateRef.current;
            const revertedTracks = tracksRef.current.map((track, tIdx) => {
              if (tIdx !== trackIndex) return track;
              const newClips = track.clips.map((clip, cIdx) => {
                if (cIdx !== clipIndex) return clip;
                return {
                  ...clip,
                  offsetSamples: original.offsetSamples,
                  durationSamples: original.durationSamples,
                  startSample: original.startSample,
                };
              });
              return { ...track, clips: newClips };
            });
            onTracksChangeRef.current(revertedTracks);
          }
        }
        isDraggingRef.current = false;
        originalClipStateRef.current = null;
        trimOrderRef.current = null;
        lastBoundaryDeltaRef.current = 0;
        // Cancel aborts the transaction — no undo step pushed
        engineRef.current?.abortTransaction();
        return;
      }

      const data = event.operation.source?.data as
        | {
            clipId: string;
            trackIndex: number;
            boundary?: 'left' | 'right';
          }
        | undefined;

      if (!data) {
        // Transaction was opened in onDragStart — abort to prevent leak
        isDraggingRef.current = false;
        engineRef.current?.abortTransaction();
        return;
      }

      const { trackIndex, clipId, boundary } = data;

      // Boundary trims: use the last delta stored by onDragMove (avoids stale snapshot position).
      // Clip moves: use transform.x (modifier-constrained, cached as plain object in snapshot).
      const sampleDelta = boundary
        ? lastBoundaryDeltaRef.current
        : event.operation.transform.x * samplesPerPixel;

      const trackId = tracksRef.current[trackIndex]?.id;

      // Boundary trim: onDragMove updated React state per-frame for visuals.
      // isDraggingRef prevented loadAudio from rebuilding the engine, so the
      // engine still has the original (pre-drag) clip positions. Commit the
      // final delta via engine.trimClip() so the adapter has correct positions.
      if (boundary) {
        isDraggingRef.current = false;
        if (!trackId) {
          console.warn(
            `[waveform-playlist] onDragEnd: track at index ${trackIndex} not found — trim not synced to adapter`
          );
          engineRef.current?.abortTransaction();
        } else if (!engineRef.current) {
          console.warn('[waveform-playlist] engineRef is null — trim not synced to adapter');
        } else {
          engineRef.current.trimClip(trackId, clipId, boundary, Math.floor(sampleDelta));
          engineRef.current.commitTransaction();
        }
        originalClipStateRef.current = null;
        trimOrderRef.current = null;
        lastBoundaryDeltaRef.current = 0;
        return;
      }

      // Clip move: delegate to engine in one shot
      if (!trackId) {
        console.warn(
          `[waveform-playlist] onDragEnd: track at index ${trackIndex} not found — move not synced to adapter`
        );
        engineRef.current?.abortTransaction();
      } else if (!engineRef.current) {
        console.warn('[waveform-playlist] engineRef is null — move not synced to adapter');
      } else {
        engineRef.current.moveClip(trackId, clipId, Math.floor(sampleDelta));
        engineRef.current.commitTransaction();
      }
    },
    [samplesPerPixel, engineRef, isDraggingRef]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
