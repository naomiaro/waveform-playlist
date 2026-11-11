import type { ClipTrack } from '@waveform-playlist/core';

/**
 * Timeline length in seconds: the end of the last clip across all tracks.
 * Uses each clip's own `sampleRate`, which is always defined (peaks-only clips
 * have no AudioBuffer to ask).
 */
export function timelineDuration(tracks: readonly ClipTrack[]): number {
  let maxDuration = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = (clip.startSample + clip.durationSamples) / clip.sampleRate;
      if (clipEnd > maxDuration) maxDuration = clipEnd;
    }
  }
  return maxDuration;
}
