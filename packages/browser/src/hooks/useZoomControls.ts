import { useState, useCallback, useRef, startTransition, type RefObject } from 'react';
import type { PlaylistEngine } from '@waveform-playlist/engine';

/** The levels zoom steps through when the provider is given none. */
export const DEFAULT_ZOOM_LEVELS: readonly number[] = [256, 512, 1024, 2048, 4096, 8192];

/**
 * Where the zoom is in the levels. A place, not only a level: the levels are
 * the app's array, which may hold a level twice or in any order, and zoom
 * goes through it place by place (as the engine's own `zoomIn` / `zoomOut`
 * do).
 */
interface ZoomPlace {
  /** The levels `index` counts in. */
  levels: readonly number[];
  /** -1 when the level is not one of the levels. */
  index: number;
  samplesPerPixel: number;
}

/** The place's index in `levels`: its own while the levels are the same array, else the level's first. */
function indexIn(levels: readonly number[], place: ZoomPlace): number {
  return place.levels === levels ? place.index : levels.indexOf(place.samplesPerPixel);
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
  /** Samples per pixel; a lower index is a step in. The same array until its content changes. */
  zoomLevels: readonly number[];
}

/**
 * The zoom (samples per pixel). This hook owns it (#826): `zoomIn` and
 * `zoomOut` step through `zoomLevels` here, engine or not, one place at a
 * time, and hand the new level to the engine there is. A new engine is built
 * with the level in `samplesPerPixelRef`. Nothing is read back from an engine.
 *
 * `canZoomIn` and `canZoomOut` are computed from the place and the levels.
 * A level that is not one of `zoomLevels` has no step in either direction
 * (no engine is built for it either: the build fails and says so). When the
 * levels change, the place is the level's first in the new ones.
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
  const [place, setPlace] = useState<ZoomPlace>(() => ({
    levels: zoomLevels,
    index: zoomLevels.indexOf(samplesPerPixelRef.current),
    samplesPerPixel: samplesPerPixelRef.current,
  }));
  // The place outside render: two steps in one batch each start from the last.
  const placeRef = useRef(place);

  const step = useCallback(
    (by: -1 | 1) => {
      const from = indexIn(zoomLevels, placeRef.current);
      // A level that is not there has no step (-1 + 1 would be the first level).
      if (from === -1) return;
      const index = from + by;
      const next = zoomLevels[index];
      if (next === undefined) return;
      const nextPlace: ZoomPlace = { levels: zoomLevels, index, samplesPerPixel: next };
      placeRef.current = nextPlace;
      samplesPerPixelRef.current = next;
      startTransition(() => {
        setPlace(nextPlace);
      });
      engineRef.current?.setZoomLevel(next);
    },
    [engineRef, samplesPerPixelRef, zoomLevels]
  );

  const zoomIn = useCallback(() => step(-1), [step]);
  const zoomOut = useCallback(() => step(1), [step]);

  const index = indexIn(zoomLevels, place);

  return {
    samplesPerPixel: place.samplesPerPixel,
    zoomIn,
    zoomOut,
    canZoomIn: index > 0,
    canZoomOut: index !== -1 && index < zoomLevels.length - 1,
  };
}
