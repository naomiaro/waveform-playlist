import React from 'react';
import type { DragEndEvent, DragStartEvent, DragMoveEvent, Modifier } from '@dnd-kit/core';
import type { ClipTrack } from '@waveform-playlist/core';
import { sortClipsByTime } from '@waveform-playlist/core';
import { constrainClipDrag, constrainBoundaryTrim } from '@waveform-playlist/engine';
import type { PlaylistEngine } from '@waveform-playlist/engine';

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  sampleRate: number;
  engineRef: React.RefObject<PlaylistEngine | null>;
}

/**
 * Custom hook for handling clip drag operations (movement and trimming)
 *
 * Provides drag handlers and collision modifier for use with @dnd-kit/core DndContext.
 * Handles both clip movement (dragging entire clips) and boundary trimming (adjusting clip edges).
 *
 * Clip movement delegates to `engine.moveClip()` — the engine handles constraints,
 * updates the adapter, and emits statechange. The provider's statechange handler
 * propagates the updated tracks to the parent via `onTracksChange`.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
 *   tracks,
 *   onTracksChange: setTracks,
 *   samplesPerPixel,
 *   sampleRate,
 *   engineRef: playoutRef,
 * });
 *
 * return (
 *   <DndContext
 *     onDragStart={onDragStart}
 *     onDragMove={onDragMove}
 *     onDragEnd={onDragEnd}
 *     modifiers={[restrictToHorizontalAxis, collisionModifier]}
 *   >
 *     <Waveform showClipHeaders={true} />
 *   </DndContext>
 * );
 * ```
 */
export function useClipDragHandlers({
  tracks,
  onTracksChange,
  samplesPerPixel,
  sampleRate,
  engineRef,
}: UseClipDragHandlersOptions) {
  // Store original clip state when drag starts (for cumulative delta application)
  const originalClipStateRef = React.useRef<{
    offsetSamples: number;
    durationSamples: number;
    startSample: number;
  } | null>(null);

  // Custom modifier for real-time collision detection during clip movement.
  // Uses the engine's constrainClipDrag pure function for constraint math.
  const collisionModifier = React.useCallback(
    (args: Parameters<Modifier>[0]) => {
      const { transform, active } = args;

      if (!active?.data?.current) return { ...transform, scaleX: 1, scaleY: 1 };

      const { trackIndex, clipIndex, boundary } = active.data.current as {
        clipId: string;
        trackIndex: number;
        clipIndex: number;
        boundary?: 'left' | 'right';
      };

      // For boundary trimming, skip modifier - onDragMove handles constraints
      if (boundary) {
        return { ...transform, scaleX: 1, scaleY: 1 };
      }

      const track = tracks[trackIndex];
      if (!track) return { ...transform, scaleX: 1, scaleY: 1 };

      const clip = track.clips[clipIndex];
      if (!clip) return { ...transform, scaleX: 1, scaleY: 1 };

      // Convert pixel delta to samples and use engine's constrainClipDrag
      const deltaSamples = transform.x * samplesPerPixel;
      const sortedClips = sortClipsByTime(track.clips);
      const sortedIndex = sortedClips.findIndex((c) => c.id === clip.id);
      const constrainedDelta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);

      // Convert constrained sample delta back to pixel delta
      const constrainedX = constrainedDelta / samplesPerPixel;

      return {
        ...transform,
        x: constrainedX,
        scaleX: 1,
        scaleY: 1,
      };
    },
    [tracks, samplesPerPixel]
  );

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const { boundary } = active.data.current as { boundary?: 'left' | 'right' };

      // Only store state for boundary trimming operations
      if (!boundary) {
        originalClipStateRef.current = null;
        return;
      }

      const { trackIndex, clipIndex } = active.data.current as {
        clipId: string;
        trackIndex: number;
        clipIndex: number;
        boundary: 'left' | 'right';
      };

      const track = tracks[trackIndex];
      const clip = track?.clips[clipIndex];

      if (clip) {
        // Store original clip state for cumulative delta application
        originalClipStateRef.current = {
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
          startSample: clip.startSample,
        };
      }
    },
    [tracks]
  );

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const { active, delta } = event;

      // Only update for boundary trimming operations (not clip movement)
      const { boundary } = active.data.current as { boundary?: 'left' | 'right' };
      if (!boundary) return;

      // Need original clip state to apply cumulative delta
      if (!originalClipStateRef.current) return;

      // Extract clip metadata
      const { trackIndex, clipIndex } = active.data.current as {
        clipId: string;
        trackIndex: number;
        clipIndex: number;
        boundary: 'left' | 'right';
      };

      const sampleDelta = delta.x * samplesPerPixel;
      const MIN_DURATION_SAMPLES = Math.floor(0.1 * sampleRate); // 0.1 seconds minimum

      // Get original clip state (stored on drag start)
      const originalClip = originalClipStateRef.current;

      // Update tracks in real-time during drag
      const newTracks = tracks.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        const sortedClips = [...track.clips].sort((a, b) => a.startSample - b.startSample);
        const sortedIndex = sortedClips.findIndex((clip) => clip === track.clips[clipIndex]);

        const newClips = track.clips.map((clip, cIdx) => {
          if (cIdx !== clipIndex) return clip;

          // Use sourceDurationSamples (works for both audio and peaks-only clips)
          const audioBufferDurationSamples = clip.sourceDurationSamples;

          if (boundary === 'left') {
            // Use constrainBoundaryTrim from engine for the left boundary.
            // Build a temporary clip with original state for constraint calculation.
            const tempClip = {
              ...clip,
              startSample: originalClip.startSample,
              offsetSamples: originalClip.offsetSamples,
              durationSamples: originalClip.durationSamples,
            };
            const constrainedDelta = constrainBoundaryTrim(
              tempClip,
              Math.floor(sampleDelta),
              'left',
              sortedClips,
              sortedIndex,
              MIN_DURATION_SAMPLES
            );

            const newOffsetSamples = originalClip.offsetSamples + constrainedDelta;
            const newDurationSamples = originalClip.durationSamples - constrainedDelta;
            const newStartSample = originalClip.startSample + constrainedDelta;

            return {
              ...clip,
              offsetSamples: newOffsetSamples,
              durationSamples: newDurationSamples,
              startSample: newStartSample,
            };
          } else {
            // Right boundary - use constrainBoundaryTrim from engine
            const tempClip = {
              ...clip,
              startSample: originalClip.startSample,
              offsetSamples: originalClip.offsetSamples,
              durationSamples: originalClip.durationSamples,
            };
            const constrainedDelta = constrainBoundaryTrim(
              tempClip,
              Math.floor(sampleDelta),
              'right',
              sortedClips,
              sortedIndex,
              MIN_DURATION_SAMPLES
            );

            const newDurationSamples = originalClip.durationSamples + constrainedDelta;

            // Additional constraint: cannot exceed audio buffer length
            // (engine's constrainBoundaryTrim handles this via sourceDurationSamples)
            const clampedDuration = Math.min(
              newDurationSamples,
              audioBufferDurationSamples - originalClip.offsetSamples
            );

            return { ...clip, durationSamples: clampedDuration };
          }
        });

        return { ...track, clips: newClips };
      });

      onTracksChange(newTracks);
    },
    [tracks, onTracksChange, samplesPerPixel, sampleRate]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;

      // Extract clip metadata from drag data
      const { trackIndex, clipId, boundary } = active.data.current as {
        clipId: string;
        trackIndex: number;
        boundary?: 'left' | 'right';
      };

      // Convert pixel delta to samples
      const sampleDelta = delta.x * samplesPerPixel;

      // Check if this is a boundary trim operation
      if (boundary) {
        // For boundary trimming, onDragMove already updated the tracks
        // onDragEnd doesn't need to do anything (state is already correct)
        // Just clear the original clip state ref
        originalClipStateRef.current = null;
        return;
      }

      // Delegate to engine — handles constraints, adapter sync, and emits statechange
      const trackId = tracks[trackIndex]?.id;
      if (trackId && engineRef.current) {
        engineRef.current.moveClip(trackId, clipId, Math.floor(sampleDelta));
      }
    },
    [tracks, samplesPerPixel, engineRef]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
    collisionModifier,
  };
}
