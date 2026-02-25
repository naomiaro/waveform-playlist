import type { AudioClip } from './types';

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
