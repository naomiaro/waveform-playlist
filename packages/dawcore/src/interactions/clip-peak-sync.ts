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
  // Collect all current clip IDs for orphan detection
  const currentClipIds = new Set<string>();

  for (const track of tracks) {
    for (const clip of track.clips) {
      currentClipIds.add(clip.id);

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
      if (!audioBuffer) {
        console.warn(
          '[dawcore] syncPeaksForChangedClips: no AudioBuffer for clip ' +
            clip.id +
            ' — waveform will be blank'
        );
        continue;
      }

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

  // Clean up orphaned entries for clip IDs no longer in any track
  // (e.g., the original clip after a split is replaced by two new clips)
  cleanupOrphanedClipData(host, currentClipIds);
}

/**
 * Remove entries from per-clip Maps for clip IDs that no longer exist in any track.
 * Prevents memory leaks from orphaned AudioBuffer references after split operations.
 */
function cleanupOrphanedClipData(host: ClipPeakSyncHost, currentClipIds: Set<string>): void {
  let buffersChanged = false;
  let peaksChanged = false;

  for (const id of host._clipBuffers.keys()) {
    if (!currentClipIds.has(id)) {
      host._clipBuffers.delete(id);
      buffersChanged = true;
    }
  }
  let offsetsChanged = false;
  for (const id of host._clipOffsets.keys()) {
    if (!currentClipIds.has(id)) {
      host._clipOffsets.delete(id);
      offsetsChanged = true;
    }
  }
  for (const id of host._peaksData.keys()) {
    if (!currentClipIds.has(id)) {
      host._peaksData.delete(id);
      peaksChanged = true;
    }
  }

  // Reassign Maps that changed — _peaksData is @state() (triggers Lit re-render),
  // _clipBuffers uses reference identity for change detection in syncPeaksForChangedClips
  if (buffersChanged) {
    host._clipBuffers = new Map(host._clipBuffers);
  }
  if (offsetsChanged) {
    host._clipOffsets = new Map(host._clipOffsets);
  }
  if (peaksChanged) {
    host._peaksData = new Map(host._peaksData);
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
