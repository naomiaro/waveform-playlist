import type { AudioClip, ClipTrack, PeakData } from '@waveform-playlist/core';
import type { PeakPipeline } from '../workers/peakPipeline';

/** Host interface for clip peak synchronization. */
export interface ClipPeakSyncHost {
  readonly samplesPerPixel: number;
  readonly mono: boolean;
  _clipBuffers: Map<string, AudioBuffer>;
  _clipOffsets: Map<string, { offsetSamples: number; durationSamples: number }>;
  _peaksData: Map<string, PeakData>;
  _peakPipeline: PeakPipeline;
}

/**
 * Regenerate peaks for clips that are new or whose offset/duration changed.
 * Handles split (new clip IDs) and trim (same ID, changed bounds).
 *
 * Called from the statechange handler when tracksVersion changes.
 */
export function syncPeaksForChangedClips(host: ClipPeakSyncHost, tracks: ClipTrack[]): void {
  for (const track of tracks) {
    for (const clip of track.clips) {
      // Check if peaks need regeneration: new clip or changed offset/duration
      const cached = host._clipOffsets.get(clip.id);
      const needsPeaks =
        !host._peaksData.has(clip.id) ||
        !cached ||
        cached.offsetSamples !== clip.offsetSamples ||
        cached.durationSamples !== clip.durationSamples;

      if (!needsPeaks) continue;

      const audioBuffer =
        clip.audioBuffer ??
        host._clipBuffers.get(clip.id) ??
        findAudioBufferForClip(host, clip, track);
      if (!audioBuffer) continue;

      // Update cached state
      host._clipBuffers = new Map(host._clipBuffers).set(clip.id, audioBuffer);
      host._clipOffsets.set(clip.id, {
        offsetSamples: clip.offsetSamples,
        durationSamples: clip.durationSamples,
      });

      // Generate peaks asynchronously
      host._peakPipeline
        .generatePeaks(
          audioBuffer,
          host.samplesPerPixel,
          host.mono,
          clip.offsetSamples,
          clip.durationSamples
        )
        .then((peakData) => {
          host._peaksData = new Map(host._peaksData).set(clip.id, peakData);
        })
        .catch((err) => {
          console.warn(
            '[dawcore] Failed to generate peaks for clip ' + clip.id + ': ' + String(err)
          );
        });
    }
  }
}

/** Find an AudioBuffer for a clip by checking siblings on the same track. */
function findAudioBufferForClip(
  host: ClipPeakSyncHost,
  clip: AudioClip,
  track: ClipTrack
): AudioBuffer | null {
  for (const sibling of track.clips) {
    if (sibling.id === clip.id) continue;
    const buf = host._clipBuffers.get(sibling.id);
    if (buf) return buf;
  }
  return null;
}
