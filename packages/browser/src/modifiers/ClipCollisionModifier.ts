import {
  Modifier,
  configurator,
  type DragDropManager,
  type DragOperation,
} from '@dnd-kit/abstract';
import { constrainClipDrag } from '@waveform-playlist/engine';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';

interface ClipCollisionOptions {
  tracks: ClipTrack[];
  samplesPerPixel: number;
}

/**
 * Modifier that constrains clip drag movement to prevent overlaps.
 *
 * For clip move operations: constrains horizontal transform to valid positions
 * using the engine's collision detection.
 *
 * For boundary trim operations: returns zero transform because visual feedback
 * comes from React state updates resizing the clip, not from CSS translate.
 */
export class ClipCollisionModifier extends Modifier<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DragDropManager<any, any>,
  ClipCollisionOptions
> {
  apply(operation: DragOperation): { x: number; y: number } {
    const { transform, source } = operation;

    if (!source?.data || !this.options) return transform;

    const { boundary, trackIndex, clipIndex } = source.data as {
      boundary?: 'left' | 'right';
      trackIndex: number;
      clipIndex: number;
    };

    // Boundary trims: zero transform (visual feedback from React state updates)
    if (boundary) return { x: 0, y: 0 };

    const { tracks, samplesPerPixel } = this.options;
    const track = tracks[trackIndex];
    if (!track) return transform;

    const clip = track.clips[clipIndex];
    if (!clip) return transform;

    // Convert pixel delta to samples, constrain, convert back
    const deltaSamples = transform.x * samplesPerPixel;
    const sortedClips = [...track.clips].sort((a, b) => a.startSample - b.startSample);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clip.id);
    const constrainedDelta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);

    return { x: constrainedDelta / samplesPerPixel, y: 0 };
  }

  static configure = configurator(ClipCollisionModifier);
}
