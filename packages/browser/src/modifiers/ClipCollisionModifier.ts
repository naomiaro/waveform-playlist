import {
  Modifier,
  configurator,
  type DragDropManager,
  type DragOperation,
} from '@dnd-kit/abstract';
import { constrainClipDrag } from '@waveform-playlist/engine';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import { sortedClipsOf } from '../utils/sortedClips';

interface ClipCollisionOptions {
  /**
   * The tracks to check against, or a function returning them. Pass a function
   * (reading a ref, say) to keep the configured modifier's identity stable while
   * tracks change, so the modifiers array handed to DragDropProvider is not
   * rebuilt on every edit.
   */
  tracks: readonly ClipTrack[] | (() => readonly ClipTrack[]);
  samplesPerPixel: number;
}

/**
 * Modifier that constrains clip drag movement to prevent overlaps.
 *
 * For clip move operations: constrains horizontal transform to valid positions
 * using the engine's collision detection.
 *
 * For boundary trim operations: returns zero transform because the trim is
 * shown by the trim preview, which draws the clip at its previewed geometry,
 * not by a CSS translate.
 */
export class ClipCollisionModifier extends Modifier<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DragDropManager<any, any>,
  ClipCollisionOptions
> {
  apply(operation: DragOperation): { x: number; y: number } {
    const { transform, source } = operation;

    if (!source?.data || !this.options) return transform;

    // `clipIndex` is a position in the drawn row, not in `track.clips`: the clip
    // is found by its id.
    const { boundary, trackIndex, clipId } = source.data as {
      boundary?: 'left' | 'right';
      trackIndex: number;
      clipId: string;
    };

    // Boundary trims: zero transform (the trim preview draws the clip)
    if (boundary) return { x: 0, y: 0 };

    const { samplesPerPixel } = this.options;
    const tracks =
      typeof this.options.tracks === 'function' ? this.options.tracks() : this.options.tracks;
    const track = tracks[trackIndex];
    if (!track) return transform;

    const clip = track.clips.find((c: AudioClip) => c.id === clipId);
    if (!clip) return transform;

    // Convert pixel delta to samples, constrain, convert back
    const deltaSamples = transform.x * samplesPerPixel;
    const sortedClips = sortedClipsOf(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clip.id);
    const constrainedDelta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);

    return { x: constrainedDelta / samplesPerPixel, y: 0 };
  }

  static configure = configurator(ClipCollisionModifier);
}
