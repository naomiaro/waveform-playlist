import { useState, useCallback, startTransition, type RefObject } from 'react';
import type { PlaylistEngine } from '@waveform-playlist/engine';

/** The levels zoom steps through when the provider is given none. */
export const DEFAULT_ZOOM_LEVELS: readonly number[] = [256, 512, 1024, 2048, 4096, 8192];

/**
 * Where a step in direction `by` starts from: the first place of the level
 * for a step in, the last for a step out, so that a level given twice is one
 * step and not a step that changes nothing. -1 for a level that is not there.
 */
function levelIndex(levels: readonly number[], level: number, by: -1 | 1): number {
  return by === -1 ? levels.indexOf(level) : levels.lastIndexOf(level);
}

export interface ZoomControls {
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface UseZoomControlsProps {
  engineRef: RefObject<PlaylistEngine | null>;
  /**
   * Where the zoom is kept outside render, holding the initial zoom. Made by
   * the caller, because a new engine is built with it and the engine's
   * lifetime is set up before this hook. Only this hook writes it.
   */
  samplesPerPixelRef: RefObject<number>;
  /** Samples per pixel, smallest (most zoomed in) first. Stable by content. */
  zoomLevels: readonly number[];
}

/**
 * The zoom (samples per pixel). This hook owns it (#826): `zoomIn` and
 * `zoomOut` step through `zoomLevels` here, engine or not, and hand the new
 * level to the engine there is. A new engine is built with the level in
 * `samplesPerPixelRef`. Nothing is read back from an engine.
 *
 * `canZoomIn` and `canZoomOut` are computed from the level and the levels.
 * A level that is not one of `zoomLevels` has no step in either direction
 * (no engine is built for it either: the build fails and says so).
 *
 * samplesPerPixel updates use startTransition so React treats them as
 * non-urgent — during playback, animation RAF callbacks interleave
 * with the zoom re-render instead of being blocked.
 */
export function useZoomControls({
  engineRef,
  samplesPerPixelRef,
  zoomLevels,
}: UseZoomControlsProps): ZoomControls {
  const [samplesPerPixel, setSamplesPerPixel] = useState(() => samplesPerPixelRef.current);

  const step = useCallback(
    (by: -1 | 1) => {
      const index = levelIndex(zoomLevels, samplesPerPixelRef.current, by);
      if (index === -1) return;
      const next = zoomLevels[index + by];
      if (next === undefined) return;
      samplesPerPixelRef.current = next;
      startTransition(() => {
        setSamplesPerPixel(next);
      });
      engineRef.current?.setZoomLevel(next);
    },
    [engineRef, samplesPerPixelRef, zoomLevels]
  );

  const zoomIn = useCallback(() => step(-1), [step]);
  const zoomOut = useCallback(() => step(1), [step]);

  const inFrom = levelIndex(zoomLevels, samplesPerPixel, -1);
  const outFrom = levelIndex(zoomLevels, samplesPerPixel, 1);

  return {
    samplesPerPixel,
    zoomIn,
    zoomOut,
    canZoomIn: inFrom > 0,
    canZoomOut: outFrom !== -1 && outFrom < zoomLevels.length - 1,
  };
}
