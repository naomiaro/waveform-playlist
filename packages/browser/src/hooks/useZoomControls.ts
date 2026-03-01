import { useState, useCallback, useRef, startTransition, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface ZoomControls {
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface UseZoomControlsProps {
  engineRef: RefObject<PlaylistEngine | null>;
  initialSamplesPerPixel: number;
}

/**
 * Hook for managing zoom controls via PlaylistEngine delegation.
 *
 * zoomIn/zoomOut delegate to the engine. State is mirrored back from
 * the engine via onEngineState(), which the provider's statechange
 * handler calls on every engine event.
 *
 * samplesPerPixel updates use startTransition so React treats them as
 * non-urgent — during playback, animation RAF callbacks interleave
 * with the zoom re-render instead of being blocked.
 */
export function useZoomControls({
  engineRef,
  initialSamplesPerPixel,
}: UseZoomControlsProps): ZoomControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [samplesPerPixel, setSamplesPerPixel] = useState(initialSamplesPerPixel);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  // Internal refs for statechange guards — prevent redundant setState
  // calls during high-frequency engine events (clip drags, play/pause).
  const canZoomInRef = useRef(true);
  const canZoomOutRef = useRef(true);
  const samplesPerPixelRef = useRef(initialSamplesPerPixel);

  const zoomIn = useCallback(() => {
    engineRef.current?.zoomIn();
  }, [engineRef]);

  const zoomOut = useCallback(() => {
    engineRef.current?.zoomOut();
  }, [engineRef]);

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.samplesPerPixel !== samplesPerPixelRef.current) {
      samplesPerPixelRef.current = state.samplesPerPixel;
      startTransition(() => {
        setSamplesPerPixel(state.samplesPerPixel);
      });
    }
    if (state.canZoomIn !== canZoomInRef.current) {
      canZoomInRef.current = state.canZoomIn;
      setCanZoomIn(state.canZoomIn);
    }
    if (state.canZoomOut !== canZoomOutRef.current) {
      canZoomOutRef.current = state.canZoomOut;
      setCanZoomOut(state.canZoomOut);
    }
  }, []);

  return {
    samplesPerPixel,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    onEngineState,
  };
}
