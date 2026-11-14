/**
 * Clip Operations
 *
 * Pure functions for constraining clip movement, boundary trimming,
 * and splitting clips on a timeline. All positions are in samples (integers).
 */

import type { AudioClip } from '@waveform-playlist/core';
import { createClip } from '@waveform-playlist/core';

/**
 * Constrain clip movement delta to prevent overlaps with adjacent clips
 * and going before sample 0.
 *
 * @param clip - The clip being dragged
 * @param deltaSamples - Requested movement in samples (negative = left, positive = right)
 * @param sortedClips - All clips on the track, sorted by startSample
 * @param clipIndex - Index of the dragged clip in sortedClips
 * @returns Constrained delta that prevents overlaps
 */
export function constrainClipDrag(
  clip: AudioClip,
  deltaSamples: number,
  sortedClips: AudioClip[],
  clipIndex: number
): number {
  let delta = deltaSamples;

  // Constraint 1: Cannot go before sample 0
  const minDelta = -clip.startSample;
  delta = Math.max(delta, minDelta);

  // Constraint 2: Cannot overlap previous clip
  if (clipIndex > 0) {
    const prevClip = sortedClips[clipIndex - 1];
    const prevClipEnd = prevClip.startSample + prevClip.durationSamples;
    // clip.startSample + delta >= prevClipEnd
    const minDeltaPrev = prevClipEnd - clip.startSample;
    delta = Math.max(delta, minDeltaPrev);
  }

  // Constraint 3: Cannot overlap next clip
  if (clipIndex < sortedClips.length - 1) {
    const nextClip = sortedClips[clipIndex + 1];
    // clip.startSample + clip.durationSamples + delta <= nextClip.startSample
    const maxDeltaNext = nextClip.startSample - (clip.startSample + clip.durationSamples);
    delta = Math.min(delta, maxDeltaNext);
  }

  return delta;
}

/**
 * Constrain boundary trim delta for left or right edge of a clip.
 *
 * LEFT boundary: delta moves the left edge (positive = shrink, negative = expand)
 * - startSample += delta, offsetSamples += delta, durationSamples -= delta
 *
 * RIGHT boundary: delta applied to durationSamples (positive = expand, negative = shrink)
 * - durationSamples += delta
 *
 * @param clip - The clip being trimmed
 * @param deltaSamples - Requested trim delta in samples
 * @param boundary - Which edge is being trimmed: 'left' or 'right'
 * @param sortedClips - All clips on the track, sorted by startSample
 * @param clipIndex - Index of the trimmed clip in sortedClips
 * @param minDurationSamples - Minimum allowed clip duration in samples
 * @returns Constrained delta
 */
export function constrainBoundaryTrim(
  clip: AudioClip,
  deltaSamples: number,
  boundary: 'left' | 'right',
  sortedClips: AudioClip[],
  clipIndex: number,
  minDurationSamples: number
): number {
  let delta = deltaSamples;

  if (boundary === 'left') {
    // Constraint 1: startSample + delta >= 0
    delta = Math.max(delta, -clip.startSample);

    // Constraint 2: offsetSamples + delta >= 0
    delta = Math.max(delta, -clip.offsetSamples);

    // Constraint 3: Cannot overlap previous clip
    if (clipIndex > 0) {
      const prevClip = sortedClips[clipIndex - 1];
      const prevClipEnd = prevClip.startSample + prevClip.durationSamples;
      // startSample + delta >= prevClipEnd
      delta = Math.max(delta, prevClipEnd - clip.startSample);
    }

    // Constraint 4: durationSamples - delta >= minDurationSamples
    // delta <= durationSamples - minDurationSamples
    delta = Math.min(delta, clip.durationSamples - minDurationSamples);
  } else {
    // RIGHT boundary

    // Constraint 1: durationSamples + delta >= minDurationSamples
    // delta >= minDurationSamples - durationSamples
    delta = Math.max(delta, minDurationSamples - clip.durationSamples);

    // Constraint 2: offsetSamples + (durationSamples + delta) <= sourceDurationSamples
    // delta <= sourceDurationSamples - offsetSamples - durationSamples
    delta = Math.min(delta, clip.sourceDurationSamples - clip.offsetSamples - clip.durationSamples);

    // Constraint 3: startSample + (durationSamples + delta) <= nextClip.startSample
    if (clipIndex < sortedClips.length - 1) {
      const nextClip = sortedClips[clipIndex + 1];
      // delta <= nextClip.startSample - startSample - durationSamples
      delta = Math.min(delta, nextClip.startSample - clip.startSample - clip.durationSamples);
    }
  }

  return delta;
}

/**
 * Snap a split sample position to the nearest pixel boundary.
 *
 * @param splitSample - The sample position to snap
 * @param samplesPerPixel - Current zoom level (samples per pixel)
 * @returns Snapped sample position
 */
export function calculateSplitPoint(splitSample: number, samplesPerPixel: number): number {
  return Math.floor(splitSample / samplesPerPixel) * samplesPerPixel;
}

/**
 * Split a clip into two clips at the given sample position.
 *
 * The left clip retains the original fadeIn; the right clip retains the original fadeOut.
 * Both clips share the same waveformData reference and the same `src`.
 * If the clip has a name, suffixes " (1)" and " (2)" are appended.
 *
 * @param clip - The clip to split
 * @param splitSample - The timeline sample position where the split occurs
 * @returns Object with `left` and `right` AudioClip
 */
export function splitClip(
  clip: AudioClip,
  splitSample: number
): { left: AudioClip; right: AudioClip } {
  const leftDuration = splitSample - clip.startSample;
  const rightDuration = clip.durationSamples - leftDuration;

  const leftName = clip.name ? `${clip.name} (1)` : undefined;
  const rightName = clip.name ? `${clip.name} (2)` : undefined;

  const left = createClip({
    startSample: clip.startSample,
    durationSamples: leftDuration,
    offsetSamples: clip.offsetSamples,
    sampleRate: clip.sampleRate,
    sourceDurationSamples: clip.sourceDurationSamples,
    gain: clip.gain,
    name: leftName,
    color: clip.color,
    fadeIn: clip.fadeIn,
    audioBuffer: clip.audioBuffer,
    waveformData: clip.waveformData,
    src: clip.src,
  });

  const right = createClip({
    startSample: splitSample,
    durationSamples: rightDuration,
    offsetSamples: clip.offsetSamples + leftDuration,
    sampleRate: clip.sampleRate,
    sourceDurationSamples: clip.sourceDurationSamples,
    gain: clip.gain,
    name: rightName,
    color: clip.color,
    fadeOut: clip.fadeOut,
    audioBuffer: clip.audioBuffer,
    waveformData: clip.waveformData,
    src: clip.src,
  });

  return { left, right };
}

/**
 * Check whether a clip can be split at the given sample position.
 *
 * The split point must be strictly inside the clip (not at start or end),
 * and both resulting clips must meet the minimum duration requirement.
 *
 * @param clip - The clip to check
 * @param sample - The timeline sample position to test
 * @param minDurationSamples - Minimum allowed clip duration in samples
 * @returns true if the split is valid
 */
export function canSplitAt(clip: AudioClip, sample: number, minDurationSamples: number): boolean {
  const clipEnd = clip.startSample + clip.durationSamples;

  // Must be strictly within clip bounds
  if (sample <= clip.startSample || sample >= clipEnd) {
    return false;
  }

  // Both resulting clips must meet minimum duration
  const leftDuration = sample - clip.startSample;
  const rightDuration = clipEnd - sample;

  return leftDuration >= minDurationSamples && rightDuration >= minDurationSamples;
}
