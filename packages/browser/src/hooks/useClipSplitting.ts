import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type ClipTrack, type AudioClip, createClip } from '@waveform-playlist/core';
import { usePlaybackAnimation, usePlaylistState } from '../WaveformPlaylistContext';

export interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
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
  const { tracks, onTracksChange } = options;
  const { currentTime } = usePlaybackAnimation();
  const { selectedTrackId } = usePlaylistState();

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
   * Split clip at the current playhead position on the selected track
   * If no track is selected, does nothing
   *
   * @returns true if a clip was split, false otherwise
   */
  const splitClipAtPlayhead = useCallback((): boolean => {
    // If no track is selected, cannot split
    if (!selectedTrackId) {
      console.log('No track selected - click a clip to select a track first');
      return false;
    }

    // Find the selected track
    const trackIndex = tracks.findIndex(track => track.id === selectedTrackId);
    if (trackIndex === -1) {
      console.warn('Selected track not found');
      return false;
    }

    const track = tracks[trackIndex];

    // Find clip at current time on the selected track
    console.error(`[DEBUG] Searching for clip at currentTime=${currentTime} on track "${track.name}" (${track.clips.length} clips)`);
    for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex++) {
      const clip = track.clips[clipIndex];
      const clipEndTime = clip.startTime + clip.duration;
      console.error(`[DEBUG] Clip ${clipIndex}: startTime=${clip.startTime}, duration=${clip.duration}, endTime=${clipEndTime}`);
      console.error(`[DEBUG] Check: ${currentTime} > ${clip.startTime} = ${currentTime > clip.startTime}, ${currentTime} < ${clipEndTime} = ${currentTime < clipEndTime}`);

      // Check if currentTime is within this clip (not at boundaries)
      if (currentTime > clip.startTime && currentTime < clipEndTime) {
        // Found a clip! Split it
        console.error(`Splitting clip on track "${track.name}" at ${currentTime}s`);
        return splitClipAt(trackIndex, clipIndex, currentTime);
      }
    }

    console.error(`No clip found at playhead position on track "${track.name}"`);
    return false;
  }, [tracks, currentTime, selectedTrackId, splitClipAt]);

  return {
    splitClipAtPlayhead,
    splitClipAt,
  };
};
