import React, { useCallback } from 'react';
import type { ClipTrack } from '@waveform-playlist/core';
import { calculateSplitPoint, canSplitAt } from '@waveform-playlist/engine';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { usePlaybackAnimation, usePlaylistState } from '../WaveformPlaylistContext';

export interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  sampleRate: number;
  samplesPerPixel: number;
  engineRef: React.RefObject<PlaylistEngine | null>;
}

export interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackIndex: number, clipIndex: number, splitTime: number) => boolean;
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
 *   sampleRate,
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
  const { tracks, sampleRate, engineRef } = options;
  const { currentTimeRef } = usePlaybackAnimation();
  const { selectedTrackId } = usePlaylistState();

  /**
   * Split a specific clip at a given time
   *
   * @param trackIndex - Index of the track containing the clip
   * @param clipIndex - Index of the clip within the track
   * @param splitTime - Timeline position where to split (in seconds)
   * @returns true if pre-validation passed and the engine was called, false otherwise.
   * Note: engine.splitClip() returns void so a true here assumes the engine accepted
   * the split (it performs its own canSplitAt check internally).
   */
  const splitClipAt = useCallback(
    (trackIndex: number, clipIndex: number, splitTime: number): boolean => {
      const { samplesPerPixel } = options;

      const track = tracks[trackIndex];
      if (!track) return false;

      const clip = track.clips[clipIndex];
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
        console.warn('[waveform-playlist] engineRef is null — split not synced to adapter');
        return false;
      }

      engine.splitClip(track.id, clip.id, snappedSplitSample);
      return true;
    },
    [tracks, options, sampleRate, engineRef]
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
    const trackIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    if (trackIndex === -1) {
      console.warn('Selected track not found');
      return false;
    }

    const track = tracks[trackIndex];

    // Use ref for real-time position during playback (state updates are throttled)
    const currentTime = currentTimeRef.current ?? 0;

    // Find clip at current time on the selected track
    for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex++) {
      const clip = track.clips[clipIndex];
      const clipStartTime = clip.startSample / sampleRate;
      const clipEndTime = (clip.startSample + clip.durationSamples) / sampleRate;

      // Check if currentTime is within this clip (not at boundaries)
      if (currentTime > clipStartTime && currentTime < clipEndTime) {
        // Found a clip! Split it
        return splitClipAt(trackIndex, clipIndex, currentTime);
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
