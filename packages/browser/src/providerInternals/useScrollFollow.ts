import { useCallback, useRef, useState } from 'react';

/**
 * Scrolls so that the playhead is in the middle of the container. Whole
 * pixels: a fractional `scrollLeft` is rounded by the browser anyway, and not
 * always the same way from frame to frame, which shows as jitter.
 */
export function centrePlayhead(
  container: HTMLDivElement,
  time: number,
  sampleRate: number,
  samplesPerPixel: number
): void {
  const pixelPosition = (time * sampleRate) / samplesPerPixel;
  container.scrollLeft = Math.round(Math.max(0, pixelPosition - container.clientWidth / 2));
}

export interface ScrollFollow {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  isAutomaticScroll: boolean;
  /** For the animation loop: current without waiting for a render. */
  isAutomaticScrollRef: React.RefObject<boolean>;
  setAutomaticScroll: (enabled: boolean) => void;
}

/** The scroll container and the automatic-scroll setting of a provider. */
export function useScrollFollow(initialAutomaticScroll: boolean): ScrollFollow {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAutomaticScroll, setIsAutomaticScroll] = useState(initialAutomaticScroll);
  const isAutomaticScrollRef = useRef<boolean>(initialAutomaticScroll);

  const setScrollContainer = useCallback((element: HTMLDivElement | null) => {
    scrollContainerRef.current = element;
  }, []);

  const setAutomaticScroll = useCallback((enabled: boolean) => {
    isAutomaticScrollRef.current = enabled;
    setIsAutomaticScroll(enabled);
  }, []);

  return {
    scrollContainerRef,
    setScrollContainer,
    isAutomaticScroll,
    isAutomaticScrollRef,
    setAutomaticScroll,
  };
}
