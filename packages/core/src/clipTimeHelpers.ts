import type { AudioClip, ClipTrack } from './types';

/** Clip start position in seconds */
export function clipStartTime(clip: AudioClip): number {
  return clip.startSample / clip.sampleRate;
}

/** Clip end position in seconds (start + duration) */
export function clipEndTime(clip: AudioClip): number {
  return (clip.startSample + clip.durationSamples) / clip.sampleRate;
}

/** Clip offset into source audio in seconds */
export function clipOffsetTime(clip: AudioClip): number {
  return clip.offsetSamples / clip.sampleRate;
}

/** Clip duration in seconds */
export function clipDurationTime(clip: AudioClip): number {
  return clip.durationSamples / clip.sampleRate;
}

/**
 * Max audio channel count across a track's clips.
 * Used to set Panner channelCount and offline render output channels.
 */
export function trackChannelCount(track: ClipTrack): number {
  return track.clips.reduce(
    (max, clip) => Math.max(max, clip.audioBuffer?.numberOfChannels ?? 1),
    1
  );
}

/**
 * Clip width in pixels at a given samplesPerPixel.
 * Shared by Clip.tsx (container sizing) and ChannelWithProgress.tsx (progress overlay)
 * to ensure pixel-perfect alignment. Floor-based endpoint subtraction guarantees
 * adjacent clips have no pixel gaps.
 */
export function clipPixelWidth(
  startSample: number,
  durationSamples: number,
  samplesPerPixel: number
): number {
  return (
    Math.floor((startSample + durationSamples) / samplesPerPixel) -
    Math.floor(startSample / samplesPerPixel)
  );
}
