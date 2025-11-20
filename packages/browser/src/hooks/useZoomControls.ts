import { useState, useCallback } from 'react';

export interface ZoomControls {
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface UseZoomControlsProps {
  initialSamplesPerPixel: number;
  zoomLevels?: number[]; // Array of samples per pixel values (lower = more zoomed in)
}

const DEFAULT_ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];

export function useZoomControls({
  initialSamplesPerPixel,
  zoomLevels = DEFAULT_ZOOM_LEVELS,
}: UseZoomControlsProps): ZoomControls {
  const [zoomIndex, setZoomIndex] = useState(() => {
    const index = zoomLevels.indexOf(initialSamplesPerPixel);
    return index !== -1 ? index : Math.floor(zoomLevels.length / 2);
  });

  const samplesPerPixel = zoomLevels[zoomIndex];
  const canZoomIn = zoomIndex > 0;
  const canZoomOut = zoomIndex < zoomLevels.length - 1;

  const zoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.min(zoomLevels.length - 1, prev + 1));
  }, [zoomLevels.length]);

  return {
    samplesPerPixel,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
  };
}
