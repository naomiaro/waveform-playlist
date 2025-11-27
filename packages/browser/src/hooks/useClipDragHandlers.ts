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
    offsetSamples: number;
    durationSamples: number;
    startSample: number;
  } | null>(null);

  // Custom modifier for real-time collision detection during clip movement
  const collisionModifier = React.useCallback(
    (args: { transform: { x: number; y: number }; active: any }) => {
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

      // Convert sample-based properties to time for calculations
      const clipStartTime = clip.startSample / sampleRate;
      const clipDuration = clip.durationSamples / sampleRate;

      // Convert pixel delta to time delta
      const timeDelta = (transform.x * samplesPerPixel) / sampleRate;

      // Handle clip movement (not trimming)
      let newStartTime = clipStartTime + timeDelta;

      // Get sorted clips for collision detection
      const sortedClips = [...track.clips].sort((a, b) => (a.startSample - b.startSample));
      const sortedIndex = sortedClips.findIndex((c) => c === clip);

      // Constraint 1: Cannot go before time 0
      newStartTime = Math.max(0, newStartTime);

      // Constraint 2: Cannot overlap with previous clip
      const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
      if (previousClip) {
        const previousEndTime = (previousClip.startSample + previousClip.durationSamples) / sampleRate;
        newStartTime = Math.max(newStartTime, previousEndTime);
      }

      // Constraint 3: Cannot overlap with next clip
      const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
      if (nextClip) {
        const newEndTime = newStartTime + clipDuration;
        const nextClipStartTime = nextClip.startSample / sampleRate;
        if (newEndTime > nextClipStartTime) {
          newStartTime = nextClipStartTime - clipDuration;
        }
      }

      // Convert constrained time back to pixel delta
      const constrainedTimeDelta = newStartTime - clipStartTime;
      const constrainedX = (constrainedTimeDelta * sampleRate) / samplesPerPixel;

      return {
        ...transform,
        x: constrainedX,
        scaleX: 1,
        scaleY: 1,
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
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
          startSample: clip.startSample,
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

          const audioBufferDurationSamples = Math.floor(clip.audioBuffer.duration * sampleRate);

          if (boundary === 'left') {
            // Left boundary drag: moving left (negative delta) expands clip, moving right shrinks it
            // The RIGHT edge stays fixed. We're moving the LEFT edge.
            //
            // When dragging left (sampleDelta < 0):
            //   - startSample decreases (moves left)
            //   - durationSamples increases (clip gets longer)
            //   - offsetSamples decreases (reveal earlier audio from buffer)
            //
            // When dragging right (sampleDelta > 0):
            //   - startSample increases (moves right)
            //   - durationSamples decreases (clip gets shorter)
            //   - offsetSamples increases (hide earlier audio)

            // Calculate the constrained delta first, then apply it uniformly
            let constrainedDelta = Math.floor(sampleDelta);

            // Constraint 1: startSample cannot go below 0 (dragging left limit)
            // newStartSample = originalClip.startSample + delta >= 0
            // delta >= -originalClip.startSample
            const minDeltaForStart = -originalClip.startSample;
            if (constrainedDelta < minDeltaForStart) {
              constrainedDelta = minDeltaForStart;
            }

            // Constraint 2: offsetSamples cannot go below 0 (can't reveal audio before buffer start)
            // newOffsetSamples = originalClip.offsetSamples + delta >= 0
            // delta >= -originalClip.offsetSamples
            const minDeltaForOffset = -originalClip.offsetSamples;
            if (constrainedDelta < minDeltaForOffset) {
              constrainedDelta = minDeltaForOffset;
            }

            // Constraint 3: Cannot overlap with previous clip (dragging left limit)
            const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
            if (previousClip) {
              const previousEndSample = previousClip.startSample + previousClip.durationSamples;
              // newStartSample = originalClip.startSample + delta >= previousEndSample
              // delta >= previousEndSample - originalClip.startSample
              const minDeltaForPrevious = previousEndSample - originalClip.startSample;
              if (constrainedDelta < minDeltaForPrevious) {
                constrainedDelta = minDeltaForPrevious;
              }
            }

            // Constraint 4: Minimum duration (dragging right limit)
            // newDurationSamples = originalClip.durationSamples - delta >= MIN_DURATION_SAMPLES
            // -delta >= MIN_DURATION_SAMPLES - originalClip.durationSamples
            // delta <= originalClip.durationSamples - MIN_DURATION_SAMPLES
            const maxDeltaForMinDuration = originalClip.durationSamples - MIN_DURATION_SAMPLES;
            if (constrainedDelta > maxDeltaForMinDuration) {
              constrainedDelta = maxDeltaForMinDuration;
            }

            // Constraint 5: Cannot exceed audio buffer length
            // newOffsetSamples + newDurationSamples <= audioBufferDurationSamples
            // (originalClip.offsetSamples + delta) + (originalClip.durationSamples - delta) <= audioBufferDurationSamples
            // This simplifies to: originalClip.offsetSamples + originalClip.durationSamples <= audioBufferDurationSamples
            // This is always true if the clip was valid to begin with, so no constraint needed here

            // Now apply the constrained delta
            const newOffsetSamples = originalClip.offsetSamples + constrainedDelta;
            const newDurationSamples = originalClip.durationSamples - constrainedDelta;
            const newStartSample = originalClip.startSample + constrainedDelta;

            return {
              ...clip,
              offsetSamples: newOffsetSamples,
              durationSamples: newDurationSamples,
              startSample: newStartSample
            };
          } else {
            // Right boundary - only update duration
            // Apply cumulative delta to ORIGINAL state (not current state)
            let newDurationSamples = Math.floor(originalClip.durationSamples + sampleDelta);
            newDurationSamples = Math.max(MIN_DURATION_SAMPLES, newDurationSamples);

            if (originalClip.offsetSamples + newDurationSamples > audioBufferDurationSamples) {
              newDurationSamples = audioBufferDurationSamples - originalClip.offsetSamples;
            }

            const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
            if (nextClip) {
              const newEndSample = originalClip.startSample + newDurationSamples;
              if (newEndSample > nextClip.startSample) {
                newDurationSamples = nextClip.startSample - originalClip.startSample;
                newDurationSamples = Math.max(MIN_DURATION_SAMPLES, newDurationSamples);
              }
            }

            return { ...clip, durationSamples: newDurationSamples };
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

      // Handle clip movement (not trimming)
      const newTracks = tracks.map((track, tIdx) => {
        if (tIdx !== trackIndex) return track;

        // Get sorted clips for collision detection
        const sortedClips = [...track.clips].sort((a, b) => a.startSample - b.startSample);
        const sortedIndex = sortedClips.findIndex((clip) => clip === track.clips[clipIndex]);

        // Update the specific clip in this track
        const newClips = track.clips.map((clip, cIdx) => {
          if (cIdx !== clipIndex) return clip;

          // Calculate desired new start sample
          let newStartSample = Math.floor(clip.startSample + sampleDelta);

          // Collision detection constraints:
          // 1. Cannot go before sample 0
          newStartSample = Math.max(0, newStartSample);

          // 2. Cannot overlap with previous clip
          const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
          if (previousClip) {
            const previousEndSample = previousClip.startSample + previousClip.durationSamples;
            newStartSample = Math.max(newStartSample, previousEndSample);
          }

          // 3. Cannot overlap with next clip
          const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
          if (nextClip) {
            const newEndSample = newStartSample + clip.durationSamples;
            if (newEndSample > nextClip.startSample) {
              // Push back to be adjacent to next clip
              newStartSample = nextClip.startSample - clip.durationSamples;
            }
          }

          return {
            ...clip,
            startSample: newStartSample,
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
