import React, { useCallback } from 'react';
import type { ClipTrack } from '@waveform-playlist/core';
import { calculateSplitPoint, canSplitAt } from '@waveform-playlist/engine';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { usePlaylistView, usePlaybackRefs, useSelectedTrackId } from '../contexts/playlistContexts';

export interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  samplesPerPixel: number;
  engineRef: React.RefObject<PlaylistEngine | null>;
}

export interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackId: string, clipId: string, splitTime: number) => boolean;
}

/**
 * Hook for splitting clips at the playhead or at a specific time
 *
 * Splitting delegates to `engine.splitClip()` — the engine handles clip creation,
 * adapter sync, and emits statechange. The provider's statechange handler propagates
 * the updated tracks to the parent via `onTracksChange`.
 *
 * @param options - Configuration options
 * @returns Object with split functions
 *
 * @example
 * ```tsx
 * const { splitClipAtPlayhead } = useClipSplitting({
 *   tracks,
 *   samplesPerPixel,
 *   engineRef: playoutRef,
 * });
 *
 * // In keyboard handler
 * const handleKeyPress = (e: KeyboardEvent) => {
 *   if (e.key === 's' || e.key === 'S') {
 *     splitClipAtPlayhead();
 *   }
 * };
 * ```
 */
export const useClipSplitting = (options: UseClipSplittingOptions): UseClipSplittingResult => {
  const { tracks, engineRef } = options;
  const { sampleRate } = usePlaylistView();
  const { currentTimeRef } = usePlaybackRefs();
  const { selectedTrackId } = useSelectedTrackId();

  /**
   * Split a specific clip at a given time
   *
   * @param trackId - Id of the track containing the clip
   * @param clipId - Id of the clip
   * @param splitTime - Timeline position where to split (in seconds)
   * @returns true if pre-validation passed and the engine was called, false otherwise
   * (also for a track id or clip id that is not in `tracks`: nothing changes).
   * Note: engine.splitClip() returns void so a true here assumes the engine accepted
   * the split (it performs its own canSplitAt check internally).
   */
  const splitClipAt = useCallback(
    (trackId: string, clipId: string, splitTime: number): boolean => {
      const { samplesPerPixel } = options;

      const track = tracks.find((t) => t.id === trackId);
      if (!track) return false;

      const clip = track.clips.find((c) => c.id === clipId);
      if (!clip) return false;

      // Convert split time to sample position, snapped to pixel boundary
      const splitSample = Math.round(splitTime * sampleRate);
      const snappedSplitSample = calculateSplitPoint(splitSample, samplesPerPixel);

      // Pre-flight validation before sending to engine (engine also validates internally).
      // Duplicated here to provide early user feedback via console.warn.
      const MIN_DURATION_SAMPLES = Math.floor(0.1 * sampleRate);
      if (!canSplitAt(clip, snappedSplitSample, MIN_DURATION_SAMPLES)) {
        console.warn('Split point is invalid (outside bounds or too close to edge)');
        return false;
      }

      // Delegate to engine — handles clip creation, adapter sync, and emits statechange
      const engine = engineRef.current;
      if (!engine) {
        console.warn(
          '[waveform-playlist] The split was dropped: no engine is attached (before the first ' +
            'build, or while it is rebuilt after a change of tracks). The clip stays whole.'
        );
        return false;
      }

      engine.splitClip(track.id, clip.id, snappedSplitSample);
      return true;
    },
    [tracks, options, engineRef, sampleRate]
  );

  /**
   * Split clip at the current playhead position on the selected track
   * If no track is selected, does nothing
   *
   * @returns true if a clip was split, false otherwise
   */
  const splitClipAtPlayhead = useCallback((): boolean => {
    // If no track is selected, cannot split
    if (!selectedTrackId) {
      console.warn('[waveform-playlist] No track selected — click a clip to select a track first');
      return false;
    }

    // Find the selected track
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) {
      console.warn('Selected track not found');
      return false;
    }

    // Use ref for real-time position during playback (state updates are throttled)
    const currentTime = currentTimeRef.current ?? 0;

    // Find clip at current time on the selected track
    for (const clip of track.clips) {
      const clipStartTime = clip.startSample / sampleRate;
      const clipEndTime = (clip.startSample + clip.durationSamples) / sampleRate;

      // Check if currentTime is within this clip (not at boundaries)
      if (currentTime > clipStartTime && currentTime < clipEndTime) {
        // Found a clip! Split it
        return splitClipAt(track.id, clip.id, currentTime);
      }
    }

    console.warn(`[waveform-playlist] No clip found at playhead position on track "${track.name}"`);
    return false;
  }, [tracks, currentTimeRef, selectedTrackId, splitClipAt, sampleRate]);

  return {
    splitClipAtPlayhead,
    splitClipAt,
  };
};
