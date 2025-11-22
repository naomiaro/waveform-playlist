import React from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ClipTrack } from '@waveform-playlist/core';

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  sampleRate: number;
}

/**
 * Custom hook for handling clip drag operations (movement and trimming)
 *
 * Provides drag handlers and collision modifier for use with @dnd-kit/core DndContext.
 * Handles both clip movement (dragging entire clips) and boundary trimming (adjusting clip edges).
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
 *   tracks,
 *   onTracksChange: setTracks,
 *   samplesPerPixel,
 *   sampleRate,
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
}: UseClipDragHandlersOptions) {
  // Store original clip state when drag starts (for cumulative delta application)
  const originalClipStateRef = React.useRef<{
    offset: number;
    duration: number;
    startTime: number;
  } | null>(null);

  // Custom modifier for real-time collision detection during clip movement
  const collisionModifier = React.useCallback(
    (args: { transform: { x: number; y: number }; active: any }) => {
      const { transform, active } = args;

      if (!active?.data?.current) return transform;

      const { trackIndex, clipIndex, boundary } = active.data.current as {
        clipId: string;
        trackIndex: number;
        clipIndex: number;
        boundary?: 'left' | 'right';
      };

      // For boundary trimming, skip modifier - onDragMove handles constraints
      if (boundary) {
        return transform;
      }

      const track = tracks[trackIndex];
      if (!track) return transform;

      const clip = track.clips[clipIndex];
      if (!clip) return transform;

      // Convert pixel delta to time delta
      const timeDelta = (transform.x * samplesPerPixel) / sampleRate;

      // Handle clip movement (not trimming)
      let newStartTime = clip.startTime + timeDelta;

      // Get sorted clips for collision detection
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      const sortedIndex = sortedClips.findIndex((c) => c === clip);

      // Constraint 1: Cannot go before time 0
      newStartTime = Math.max(0, newStartTime);

      // Constraint 2: Cannot overlap with previous clip
      const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
      if (previousClip) {
        const previousEndTime = previousClip.startTime + previousClip.duration;
        newStartTime = Math.max(newStartTime, previousEndTime);
      }

      // Constraint 3: Cannot overlap with next clip
      const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
      if (nextClip) {
        const newEndTime = newStartTime + clip.duration;
        if (newEndTime > nextClip.startTime) {
          newStartTime = nextClip.startTime - clip.duration;
        }
      }

      // Convert constrained time back to pixel delta
      const constrainedTimeDelta = newStartTime - clip.startTime;
      const constrainedX = (constrainedTimeDelta * sampleRate) / samplesPerPixel;

      return {
        ...transform,
        x: constrainedX,
      };
    },
    [tracks, samplesPerPixel, sampleRate]
  );

  const onDragStart = React.useCallback(
    (event: { active: any }) => {
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
          offset: clip.offset,
          duration: clip.duration,
          startTime: clip.startTime,
        };
      }
    },
    [tracks]
  );

  const onDragMove = React.useCallback(
    (event: { active: any; delta: { x: number; y: number } }) => {
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

      const timeDelta = (delta.x * samplesPerPixel) / sampleRate;
      const MIN_DURATION = 0.1;

      // Get original clip state (stored on drag start)
      const originalClip = originalClipStateRef.current;

      // Update tracks in real-time during drag
      const newTracks = tracks.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        const sortedIndex = sortedClips.findIndex((clip) => clip === track.clips[clipIndex]);

        const newClips = track.clips.map((clip, cIdx) => {
          if (cIdx !== clipIndex) return clip;

          const audioBufferDuration = clip.audioBuffer.duration;

          if (boundary === 'left') {
            // Apply cumulative delta to ORIGINAL state (not current state)
            let newOffset = originalClip.offset + timeDelta;
            let newDuration = originalClip.duration - timeDelta;
            let newStartTime = originalClip.startTime + timeDelta;

            if (newOffset < 0) {
              const correction = -newOffset;
              newOffset = 0;
              newDuration += correction;
              newStartTime -= correction;
            }

            if (newDuration < MIN_DURATION) {
              const correction = MIN_DURATION - newDuration;
              newDuration = MIN_DURATION;
              newOffset -= correction;
              newStartTime -= correction;
              newOffset = Math.max(0, newOffset);
            }

            if (newOffset + newDuration > audioBufferDuration) {
              newOffset = audioBufferDuration - newDuration;
            }

            const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
            if (previousClip) {
              const previousEndTime = previousClip.startTime + previousClip.duration;
              if (newStartTime < previousEndTime) {
                const correction = previousEndTime - newStartTime;
                newStartTime = previousEndTime;
                newOffset += correction;
                newDuration -= correction;
                if (newDuration < MIN_DURATION) {
                  newDuration = MIN_DURATION;
                  newOffset = Math.min(newOffset, audioBufferDuration - MIN_DURATION);
                }
              }
            }

            newStartTime = Math.max(0, newStartTime);

            return { ...clip, offset: newOffset, duration: newDuration, startTime: newStartTime };
          } else {
            // Apply cumulative delta to ORIGINAL state (not current state)
            let newDuration = originalClip.duration + timeDelta;
            newDuration = Math.max(MIN_DURATION, newDuration);

            if (originalClip.offset + newDuration > audioBufferDuration) {
              newDuration = audioBufferDuration - originalClip.offset;
            }

            const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
            if (nextClip) {
              const newEndTime = originalClip.startTime + newDuration;
              if (newEndTime > nextClip.startTime) {
                newDuration = nextClip.startTime - originalClip.startTime;
                newDuration = Math.max(MIN_DURATION, newDuration);
              }
            }

            return { ...clip, duration: newDuration };
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
      const { trackIndex, clipIndex, boundary } = active.data.current as {
        clipId: string;
        trackIndex: number;
        clipIndex: number;
        boundary?: 'left' | 'right';
      };

      // Convert pixel delta to time (seconds)
      const timeDelta = (delta.x * samplesPerPixel) / sampleRate;

      // Minimum clip duration (0.1 seconds)
      const MIN_DURATION = 0.1;

      // Check if this is a boundary trim operation
      if (boundary) {
        // For boundary trimming, onDragMove already updated the tracks
        // onDragEnd doesn't need to do anything (state is already correct)
        // Just clear the original clip state ref
        originalClipStateRef.current = null;
        return;
      }

      // Handle clip movement (not trimming)
      const newTracks = tracks.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        // Get sorted clips for collision detection
        const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
        const sortedIndex = sortedClips.findIndex((clip) => clip === track.clips[clipIndex]);

        // Update the specific clip in this track
        const newClips = track.clips.map((clip, cIdx) => {
          if (cIdx !== clipIndex) return clip;

          // Calculate desired new start time
          let newStartTime = clip.startTime + timeDelta;

          // Collision detection constraints:
          // 1. Cannot go before time 0
          newStartTime = Math.max(0, newStartTime);

          // 2. Cannot overlap with previous clip
          const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
          if (previousClip) {
            const previousEndTime = previousClip.startTime + previousClip.duration;
            newStartTime = Math.max(newStartTime, previousEndTime);
          }

          // 3. Cannot overlap with next clip
          const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
          if (nextClip) {
            const newEndTime = newStartTime + clip.duration;
            if (newEndTime > nextClip.startTime) {
              // Push back to be adjacent to next clip
              newStartTime = nextClip.startTime - clip.duration;
            }
          }

          return {
            ...clip,
            startTime: newStartTime,
          };
        });

        return {
          ...track,
          clips: newClips,
        };
      });

      onTracksChange(newTracks);
    },
    [tracks, onTracksChange, samplesPerPixel, sampleRate]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
    collisionModifier,
  };
}
