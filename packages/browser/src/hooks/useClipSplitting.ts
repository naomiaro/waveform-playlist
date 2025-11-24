import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type ClipTrack, type AudioClip, createClip } from '@waveform-playlist/core';
import { usePlaybackAnimation, usePlaylistState } from '../WaveformPlaylistContext';

export interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  sampleRate: number;
  samplesPerPixel: number;
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
  const { tracks, onTracksChange, sampleRate } = options;
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

      // Convert clip positions from samples to seconds for bounds checking
      const clipStartTime = clip.startSample / sampleRate;
      const clipEndTime = (clip.startSample + clip.durationSamples) / sampleRate;

      // Validate that split time is within clip bounds
      if (splitTime <= clipStartTime || splitTime >= clipEndTime) {
        console.warn('Split time is outside clip bounds');
        return false;
      }

      // Work with samples and pixels (all integers!) to avoid floating-point precision issues
      // Key insight: A pixel represents a RANGE of samples (samplesPerPixel samples)
      // By working in samples, we eliminate all floating-point errors
      const { sampleRate, samplesPerPixel } = options;

      // Convert split time from seconds to samples (round to nearest sample)
      const splitSample = Math.round(splitTime * sampleRate);

      // Calculate pixel positions from sample positions using integer division
      const clipStartPixel = Math.floor(clip.startSample / samplesPerPixel);
      const splitPixel = Math.floor(splitSample / samplesPerPixel);
      const clipEndSample = clip.startSample + clip.durationSamples;
      const clipEndPixel = Math.floor(clipEndSample / samplesPerPixel);

      // Calculate pixel widths (ensuring clips are adjacent)
      const firstClipPixelWidth = splitPixel - clipStartPixel;
      const secondClipPixelWidth = clipEndPixel - splitPixel;

      // Calculate sample positions from exact pixel boundaries
      // Both clips share the same boundary: the start of the split pixel
      const snappedSplitSample = splitPixel * samplesPerPixel;

      // First clip: starts at clip's original start, ends at split pixel boundary
      const firstClipStartSample = clip.startSample;
      const firstClipDurationSamples = snappedSplitSample - firstClipStartSample;

      // Second clip: starts at split pixel boundary, ends at clip's original end
      const secondClipStartSample = snappedSplitSample;
      const secondClipDurationSamples = clipEndSample - secondClipStartSample;

      // Calculate offset increment for second clip (in samples)
      const offsetIncrement = snappedSplitSample - clip.startSample;

      // Debug: log sample/pixel calculations
      console.error(`[SNAP DEBUG] Original: startSample=${clip.startSample}, splitSample=${splitSample}, endSample=${clipEndSample}`);
      console.error(`[SNAP DEBUG] Pixel positions: start=${clipStartPixel}, split=${splitPixel}, end=${clipEndPixel}`);
      console.error(`[SNAP DEBUG] Pixel widths: first=${firstClipPixelWidth}, second=${secondClipPixelWidth}`);
      console.error(`[SNAP DEBUG] Snapped split sample: ${snappedSplitSample}`);
      console.error(`[SNAP DEBUG] First clip: startSample=${firstClipStartSample}, durationSamples=${firstClipDurationSamples}`);
      console.error(`[SNAP DEBUG] Second clip: startSample=${secondClipStartSample}, durationSamples=${secondClipDurationSamples}`);
      console.error(`[SNAP DEBUG] Offset increment (samples): ${offsetIncrement}`);

      // Create first clip (from start to split point)
      const firstClip = createClip({
        audioBuffer: clip.audioBuffer,
        startSample: firstClipStartSample,
        durationSamples: firstClipDurationSamples,
        offsetSamples: clip.offsetSamples,
        gain: clip.gain,
        name: clip.name ? `${clip.name} (1)` : undefined,
        color: clip.color,
        fadeIn: clip.fadeIn,
        // Note: fadeOut removed for first clip since it's cut
      });

      // Create second clip (from split point to end)
      const secondClip = createClip({
        audioBuffer: clip.audioBuffer,
        startSample: secondClipStartSample,
        durationSamples: secondClipDurationSamples,
        offsetSamples: clip.offsetSamples + offsetIncrement,
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
    [tracks, onTracksChange, options]
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
      const clipStartTime = clip.startSample / sampleRate;
      const clipEndTime = (clip.startSample + clip.durationSamples) / sampleRate;
      console.error(`[DEBUG] Clip ${clipIndex}: startSample=${clip.startSample}, durationSamples=${clip.durationSamples}, endSample=${clip.startSample + clip.durationSamples}`);
      console.error(`[DEBUG] In seconds: startTime=${clipStartTime}, endTime=${clipEndTime}`);
      console.error(`[DEBUG] Check: ${currentTime} > ${clipStartTime} = ${currentTime > clipStartTime}, ${currentTime} < ${clipEndTime} = ${currentTime < clipEndTime}`);

      // Check if currentTime is within this clip (not at boundaries)
      if (currentTime > clipStartTime && currentTime < clipEndTime) {
        // Found a clip! Split it
        console.error(`Splitting clip on track "${track.name}" at ${currentTime}s`);
        return splitClipAt(trackIndex, clipIndex, currentTime);
      }
    }

    console.error(`No clip found at playhead position on track "${track.name}"`);
    return false;
  }, [tracks, currentTime, selectedTrackId, splitClipAt, sampleRate]);

  return {
    splitClipAtPlayhead,
    splitClipAt,
  };
};
