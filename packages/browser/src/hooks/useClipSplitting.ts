import { useCallback } from 'react';
import { calculateSplitPoint, canSplitAt } from '@waveform-playlist/engine';
import {
  useArrangement,
  usePlaylistView,
  usePlaybackRefs,
  usePlaylistZoom,
  useSelectedTrackId,
} from '../contexts/playlistContexts';
import { loadedClipsOf } from '../utils/loadedTracks';

export interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackId: string, clipId: string, splitTime: number) => boolean;
}

/**
 * Hook for splitting clips at the playhead or at a specific time
 *
 * Splitting is one `arrangement.splitClip()` on the provider's arrangement
 * (`useArrangement()`): an undo step, engine or not; the engine and the view
 * follow the arrangement. Throws outside `WaveformPlaylistProvider`. The
 * split point is snapped at the provider's zoom level (`usePlaylistZoom()`).
 *
 * @returns Object with split functions
 *
 * @example
 * ```tsx
 * const { splitClipAtPlayhead } = useClipSplitting();
 *
 * // In keyboard handler
 * const handleKeyPress = (e: KeyboardEvent) => {
 *   if (e.key === 's' || e.key === 'S') {
 *     splitClipAtPlayhead();
 *   }
 * };
 * ```
 */
export const useClipSplitting = (): UseClipSplittingResult => {
  const arrangement = useArrangement();
  const { samplesPerPixel } = usePlaylistZoom();
  const { sampleRate } = usePlaylistView();
  const { currentTimeRef } = usePlaybackRefs();
  const { selectedTrackId } = useSelectedTrackId();

  /**
   * Split a specific clip at a given time
   *
   * @param trackId - Id of the track containing the clip
   * @param clipId - Id of the clip
   * @param splitTime - Timeline position where to split (in seconds)
   * @returns true if pre-validation passed and the arrangement was called, false otherwise
   * (also for a track id or clip id that is not there, or a clip still loading:
   * nothing changes). Note: splitClip() returns void so a true here assumes the
   * arrangement accepted the split (it performs its own canSplitAt check).
   */
  const splitClipAt = useCallback(
    (trackId: string, clipId: string, splitTime: number): boolean => {
      const track = arrangement.getTracks().find((t) => t.id === trackId);
      if (!track) return false;

      // A clip still loading cannot be split.
      const clip = loadedClipsOf(track).find((c) => c.id === clipId);
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

      arrangement.splitClip(track.id, clip.id, snappedSplitSample);
      return true;
    },
    [arrangement, samplesPerPixel, sampleRate]
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
    const track = arrangement.getTracks().find((t) => t.id === selectedTrackId);
    if (!track) {
      console.warn('Selected track not found');
      return false;
    }

    // Use ref for real-time position during playback (state updates are throttled)
    const currentTime = currentTimeRef.current ?? 0;

    // Find clip at current time on the selected track
    for (const clip of loadedClipsOf(track)) {
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
  }, [arrangement, currentTimeRef, selectedTrackId, splitClipAt, sampleRate]);

  return {
    splitClipAtPlayhead,
    splitClipAt,
  };
};
