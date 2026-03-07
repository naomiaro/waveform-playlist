import type { AudioClip } from '@waveform-playlist/core';
import { constrainBoundaryTrim } from '@waveform-playlist/engine';

/**
 * Result of a boundary trim calculation — the new clip dimensions
 * after dragging a left or right boundary by a given pixel delta.
 */
export interface BoundaryTrimResult {
  startSample: number;
  durationSamples: number;
  offsetSamples: number;
}

export interface CalculateBoundaryTrimParams {
  /** The original clip state captured at drag start */
  originalClip: Pick<AudioClip, 'startSample' | 'durationSamples' | 'offsetSamples'>;
  /** The current clip with full AudioClip shape (used for constraint calculation) */
  clip: AudioClip;
  /** Raw pixel delta from drag start (positive = rightward) */
  pixelDelta: number;
  /** Samples per pixel (zoom level) */
  samplesPerPixel: number;
  /** Audio sample rate (used to compute minimum duration) */
  sampleRate: number;
  /** Which boundary is being dragged */
  boundary: 'left' | 'right';
  /** Clips on the same track, sorted by startSample (for collision detection) */
  sortedClips: AudioClip[];
  /** Index of the clip being trimmed within sortedClips */
  sortedIndex: number;
}

/**
 * Pure function that calculates new clip dimensions after a boundary trim drag.
 *
 * Converts a pixel delta to sample delta, constrains it via the engine's
 * `constrainBoundaryTrim`, and applies the constrained delta to the original
 * clip snapshot to produce new startSample, durationSamples, and offsetSamples.
 *
 * For left boundary: startSample and offsetSamples increase by the constrained delta,
 * durationSamples decreases by the same amount.
 *
 * For right boundary: only durationSamples changes (increases by the constrained delta).
 */
export function calculateBoundaryTrim({
  originalClip,
  clip,
  pixelDelta,
  samplesPerPixel,
  sampleRate,
  boundary,
  sortedClips,
  sortedIndex,
}: CalculateBoundaryTrimParams): BoundaryTrimResult {
  const sampleDelta = pixelDelta * samplesPerPixel;
  const MIN_DURATION_SAMPLES = Math.floor(0.1 * sampleRate);

  // Build a temporary clip with original state for constraint calculation
  const tempClip: AudioClip = {
    ...clip,
    startSample: originalClip.startSample,
    offsetSamples: originalClip.offsetSamples,
    durationSamples: originalClip.durationSamples,
  };

  const constrainedDelta = constrainBoundaryTrim(
    tempClip,
    Math.floor(sampleDelta),
    boundary,
    sortedClips,
    sortedIndex,
    MIN_DURATION_SAMPLES
  );

  if (boundary === 'left') {
    return {
      startSample: originalClip.startSample + constrainedDelta,
      durationSamples: originalClip.durationSamples - constrainedDelta,
      offsetSamples: originalClip.offsetSamples + constrainedDelta,
    };
  } else {
    return {
      startSample: originalClip.startSample,
      durationSamples: originalClip.durationSamples + constrainedDelta,
      offsetSamples: originalClip.offsetSamples,
    };
  }
}
