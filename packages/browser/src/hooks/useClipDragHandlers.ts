import React from 'react';
import type {
  DragStartEvent as DragStartCallback,
  DragMoveEvent as DragMoveCallback,
  DragEndEvent as DragEndCallback,
} from '@dnd-kit/abstract';
import type { ClipTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { calculateBoundaryTrim } from '../utils/boundaryTrim';
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
    (event: Parameters<DragStartCallback>[0]) => {
      const data = event.operation.source?.data as
        | {
            boundary?: 'left' | 'right';
            trackIndex: number;
            clipIndex: number;
          }
        | undefined;

      if (!data) return;

      // Only store state for boundary trimming operations
      if (!data.boundary) {
        originalClipStateRef.current = null;
        return;
      }

      const track = tracks[data.trackIndex];
      const clip = track?.clips[data.clipIndex];

      if (clip) {
        // Store original clip state for cumulative delta application
        originalClipStateRef.current = {
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
          startSample: clip.startSample,
        };
        // Signal provider to skip loadAudio rebuilds during the drag
        isDraggingRef.current = true;
      }
    },
    [tracks, isDraggingRef]
  );

  const onDragMove = React.useCallback(
    (event: Parameters<DragMoveCallback>[0]) => {
      const data = event.operation.source?.data as
        | {
            boundary?: 'left' | 'right';
            trackIndex: number;
            clipIndex: number;
          }
        | undefined;

      if (!data) return;

      // Only update for boundary trimming operations (not clip movement)
      if (!data.boundary) return;

      // Need original clip state to apply cumulative delta
      if (!originalClipStateRef.current) return;

      const { boundary, trackIndex, clipIndex } = data;

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const rawDeltaX = currentX - event.operation.position.initial.x;
      const sampleDelta = rawDeltaX * samplesPerPixel;

      // Get original clip state (stored on drag start)
      const originalClip = originalClipStateRef.current;
      const snapFn = snapSamplePositionRef.current;

      // Track the effective delta after snapping (for engine.trimClip on drag end)
      let effectiveDelta = sampleDelta;

      // Update tracks in real-time during drag
      const newTracks = tracks.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        const sortedClips = [...track.clips].sort((a, b) => a.startSample - b.startSample);
        const sortedIndex = sortedClips.findIndex((clip) => clip === track.clips[clipIndex]);

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
      onTracksChange(newTracks);
    },
    [tracks, onTracksChange, samplesPerPixel, sampleRate]
  );

  const onDragEnd = React.useCallback(
    (event: Parameters<DragEndCallback>[0]) => {
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
            const revertedTracks = tracks.map((track, tIdx) => {
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
            onTracksChange(revertedTracks);
          }
        }
        isDraggingRef.current = false;
        originalClipStateRef.current = null;
        lastBoundaryDeltaRef.current = 0;
        return;
      }

      const data = event.operation.source?.data as
        | {
            clipId: string;
            trackIndex: number;
            boundary?: 'left' | 'right';
          }
        | undefined;

      if (!data) return;

      const { trackIndex, clipId, boundary } = data;

      // Boundary trims: use the last delta stored by onDragMove (avoids stale snapshot position).
      // Clip moves: use transform.x (modifier-constrained, cached as plain object in snapshot).
      const sampleDelta = boundary
        ? lastBoundaryDeltaRef.current
        : event.operation.transform.x * samplesPerPixel;

      const trackId = tracks[trackIndex]?.id;

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
        } else if (!engineRef.current) {
          console.warn('[waveform-playlist] engineRef is null — trim not synced to adapter');
        } else {
          engineRef.current.trimClip(trackId, clipId, boundary, Math.floor(sampleDelta));
        }
        originalClipStateRef.current = null;
        lastBoundaryDeltaRef.current = 0;
        return;
      }

      // Clip move: delegate to engine in one shot
      if (!trackId) {
        console.warn(
          `[waveform-playlist] onDragEnd: track at index ${trackIndex} not found — move not synced to adapter`
        );
      } else if (!engineRef.current) {
        console.warn('[waveform-playlist] engineRef is null — move not synced to adapter');
      } else {
        engineRef.current.moveClip(trackId, clipId, Math.floor(sampleDelta));
      }
    },
    [tracks, onTracksChange, samplesPerPixel, engineRef, isDraggingRef]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
