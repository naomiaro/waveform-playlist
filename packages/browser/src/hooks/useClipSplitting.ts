import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type ClipTrack, type AudioClip, createClip } from '@waveform-playlist/core';

export interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  currentTime: number;
}

export interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackIndex: number, clipIndex: number, splitTime: number) => boolean;
}

/**
 * Hook for splitting clips at the playhead or at a specific time
 *
 * @param options - Configuration options
 * @returns Object with split functions
 *
 * @example
 * ```tsx
 * const { splitClipAtPlayhead } = useClipSplitting({
 *   tracks,
 *   onTracksChange: setTracks,
 *   currentTime,
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
  const { tracks, onTracksChange, currentTime } = options;

  /**
   * Split a specific clip at a given time
   *
   * @param trackIndex - Index of the track containing the clip
   * @param clipIndex - Index of the clip within the track
   * @param splitTime - Timeline position where to split (in seconds)
   * @returns true if split was successful, false otherwise
   */
  const splitClipAt = useCallback(
    (trackIndex: number, clipIndex: number, splitTime: number): boolean => {
      const track = tracks[trackIndex];
      if (!track) return false;

      const clip = track.clips[clipIndex];
      if (!clip) return false;

      // Calculate clip end time
      const clipEndTime = clip.startTime + clip.duration;

      // Validate that split time is within clip bounds
      if (splitTime <= clip.startTime || splitTime >= clipEndTime) {
        console.warn('Split time is outside clip bounds');
        return false;
      }

      // Calculate relative position within the clip
      const relativeTime = splitTime - clip.startTime;

      // Create first clip (from start to split point)
      const firstClip = createClip({
        audioBuffer: clip.audioBuffer,
        startTime: clip.startTime,
        duration: relativeTime,
        offset: clip.offset,
        gain: clip.gain,
        name: clip.name ? `${clip.name} (1)` : undefined,
        color: clip.color,
        fadeIn: clip.fadeIn,
        // Note: fadeOut removed for first clip since it's cut
      });

      // Create second clip (from split point to end)
      const secondClip = createClip({
        audioBuffer: clip.audioBuffer,
        startTime: splitTime,
        duration: clip.duration - relativeTime,
        offset: clip.offset + relativeTime,
        gain: clip.gain,
        name: clip.name ? `${clip.name} (2)` : undefined,
        color: clip.color,
        // Note: fadeIn removed for second clip since it's cut
        fadeOut: clip.fadeOut,
      });

      // Create new clips array with the split clips
      const newClips = [...track.clips];
      newClips.splice(clipIndex, 1, firstClip, secondClip);

      // Update the track with new clips
      const newTracks = [...tracks];
      newTracks[trackIndex] = {
        ...track,
        clips: newClips,
      };

      onTracksChange(newTracks);
      return true;
    },
    [tracks, onTracksChange]
  );

  /**
   * Split clip at the current playhead position
   * Searches through all tracks to find a clip at the playhead position
   *
   * @returns true if a clip was split, false otherwise
   */
  const splitClipAtPlayhead = useCallback((): boolean => {
    // Search through all tracks to find clip(s) at current time
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const track = tracks[trackIndex];

      for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex++) {
        const clip = track.clips[clipIndex];
        const clipEndTime = clip.startTime + clip.duration;

        // Check if currentTime is within this clip (not at boundaries)
        if (currentTime > clip.startTime && currentTime < clipEndTime) {
          // Found a clip! Split it
          return splitClipAt(trackIndex, clipIndex, currentTime);
        }
      }
    }

    console.log('No clip found at playhead position');
    return false;
  }, [tracks, currentTime, splitClipAt]);

  return {
    splitClipAtPlayhead,
    splitClipAt,
  };
};
