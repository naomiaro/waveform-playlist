import { useState, useCallback } from 'react';
import { updateAnnotationBoundaries as computeAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '../types';

export interface UseAnnotationControlsOptions {
  initialContinuousPlay?: boolean;
  initialLinkEndpoints?: boolean;
}

export interface AnnotationUpdateParams {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: AnnotationData[];
  duration: number;
  linkEndpoints: boolean;
}

export interface UseAnnotationControlsReturn {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  setContinuousPlay: (value: boolean) => void;
  setLinkEndpoints: (value: boolean) => void;
  updateAnnotationBoundaries: (params: AnnotationUpdateParams) => AnnotationData[];
}

/**
 * Hook for managing annotation control state and boundary logic.
 * Boundary math lives in @waveform-playlist/core (shared with dawcore).
 */
export const useAnnotationControls = (
  options: UseAnnotationControlsOptions = {}
): UseAnnotationControlsReturn => {
  const { initialContinuousPlay = false, initialLinkEndpoints = true } = options;

  const [continuousPlay, setContinuousPlay] = useState(initialContinuousPlay);
  const [linkEndpoints, setLinkEndpoints] = useState(initialLinkEndpoints);

  const updateAnnotationBoundaries = useCallback(
    (params: AnnotationUpdateParams): AnnotationData[] => computeAnnotationBoundaries(params),
    []
  );

  return {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  };
};
