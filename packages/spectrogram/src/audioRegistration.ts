import type { ClipTrack, TrackSpectrogramOverrides } from '@waveform-playlist/core';
import { resolveRenderMode } from './spectrogram-helpers';

/**
 * The key an AudioBuffer's audio is registered under in the worker pool, the
 * same for as long as the buffer lives. Clips that share a buffer share the
 * key (a split keeps one buffer for both halves), so the pool holds the audio
 * once (#821). The worker's FFT cache key also carries each clip's range, so
 * two clips over different parts of one buffer keep separate entries.
 */
export type AudioKeyOf = (buffer: AudioBuffer) => string;

export function createAudioKeyOf(): AudioKeyOf {
  const keys = new WeakMap<AudioBuffer, string>();
  let next = 0;
  return (buffer) => {
    const existing = keys.get(buffer);
    if (existing !== undefined) return existing;
    next += 1;
    const key = `audio-${next}`;
    keys.set(buffer, key);
    return key;
  };
}

/**
 * The audio the pool should hold, by key: each buffer that a clip on a track
 * drawing a spectrogram (`spectrogram` or `both`) uses. A waveform track's
 * audio is never computed, so it is not sent (#821).
 */
export function spectrogramAudio(
  tracks: readonly ClipTrack[],
  overrides: ReadonlyMap<string, TrackSpectrogramOverrides>,
  audioKeyOf: AudioKeyOf
): Map<string, AudioBuffer> {
  const wanted = new Map<string, AudioBuffer>();
  for (const track of tracks) {
    if (resolveRenderMode(overrides.get(track.id), track.renderMode) === 'waveform') continue;
    for (const clip of track.clips) {
      if (clip.audioBuffer) wanted.set(audioKeyOf(clip.audioBuffer), clip.audioBuffer);
    }
  }
  return wanted;
}

/** Every channel of a buffer, as the views `getChannelData` returns (not copies). */
export function channelData(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch));
}
