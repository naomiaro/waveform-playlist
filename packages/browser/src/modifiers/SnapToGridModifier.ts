import {
  Modifier,
  configurator,
  type DragDropManager,
  type DragOperation,
} from '@dnd-kit/abstract';
import {
  ticksPerBeat,
  ticksPerBar,
  ticksToSamples,
  samplesToTicks,
  snapToGrid,
} from '@waveform-playlist/core';
import type { SnapTo } from '@waveform-playlist/ui-components';

interface SnapToGridBeatsOptions {
  mode: 'beats';
  snapTo: SnapTo;
  bpm: number;
  timeSignature: [number, number];
  samplesPerPixel: number;
  sampleRate: number;
}

interface SnapToGridTimescaleOptions {
  mode: 'timescale';
  gridSamples: number;
  samplesPerPixel: number;
}

type SnapToGridOptions = SnapToGridBeatsOptions | SnapToGridTimescaleOptions;

/**
 * dnd-kit modifier that quantizes clip drag movement to a grid.
 *
 * Two modes:
 * - "beats": Snaps to beat/bar grid using PPQN tick space for exact musical timing.
 * - "timescale": Snaps to a sample-based grid derived from timescale markers.
 *
 * Designed to compose with ClipCollisionModifier — snap first,
 * then collision constrains the snapped position.
 */
export class SnapToGridModifier extends Modifier<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DragDropManager<any, any>,
  SnapToGridOptions
> {
  apply(operation: DragOperation): { x: number; y: number } {
    const { transform, source } = operation;

    if (!this.options || !source?.data) return transform;

    // Don't snap boundary trims — snapping for trims is handled in the drag handler
    const { boundary, startSample } = source.data as {
      boundary?: 'left' | 'right';
      startSample?: number;
    };
    if (boundary) return transform;

    const { samplesPerPixel } = this.options;

    // Snap the absolute position (not just the delta) so clips land exactly
    // on grid lines even if they started off-grid.
    if (this.options.mode === 'timescale') {
      const { gridSamples } = this.options;
      if (startSample !== undefined) {
        const proposedPosition = startSample + transform.x * samplesPerPixel;
        const snappedPosition = Math.round(proposedPosition / gridSamples) * gridSamples;
        return { x: (snappedPosition - startSample) / samplesPerPixel, y: 0 };
      }
      // Fallback: snap delta (no startSample available)
      const deltaSamples = transform.x * samplesPerPixel;
      const snappedSamples = Math.round(deltaSamples / gridSamples) * gridSamples;
      return { x: snappedSamples / samplesPerPixel, y: 0 };
    }

    // Beats mode
    const { snapTo, bpm, timeSignature, sampleRate } = this.options;

    if (snapTo === 'off') return transform;

    const gridTicks = snapTo === 'bar' ? ticksPerBar(timeSignature) : ticksPerBeat(timeSignature);

    if (startSample !== undefined) {
      // Snap absolute position in tick space
      const proposedSamples = startSample + transform.x * samplesPerPixel;
      const proposedTicks = samplesToTicks(proposedSamples, bpm, sampleRate);
      const snappedTicks = snapToGrid(proposedTicks, gridTicks);
      const snappedSamples = ticksToSamples(snappedTicks, bpm, sampleRate);
      return { x: (snappedSamples - startSample) / samplesPerPixel, y: 0 };
    }

    // Fallback: snap delta (no startSample available)
    const deltaSamples = transform.x * samplesPerPixel;
    const deltaTicks = samplesToTicks(deltaSamples, bpm, sampleRate);
    const snappedTicks = snapToGrid(deltaTicks, gridTicks);
    const snappedSamples = ticksToSamples(snappedTicks, bpm, sampleRate);

    return { x: snappedSamples / samplesPerPixel, y: 0 };
  }

  static configure = configurator(SnapToGridModifier);
}
