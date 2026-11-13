import React, { createContext, use, ReactNode } from 'react';

const ClipViewportOriginContext = createContext<number>(0);

interface ClipViewportOriginProviderProps {
  originX: number;
  children: ReactNode;
}

/**
 * Provides the clip's pixel-space origin (left offset) to descendant Channel
 * and SpectrogramChannel components so they can convert local chunk coordinates
 * to global viewport coordinates for virtual scrolling visibility checks.
 *
 * Without this, chunks are compared against the viewport in local (clip-relative)
 * space, which causes them to be culled incorrectly when a clip doesn't start
 * at position 0 on the timeline.
 */
export const ClipViewportOriginProvider = ({
  originX,
  children,
}: ClipViewportOriginProviderProps) => (
  <ClipViewportOriginContext value={originX}>{children}</ClipViewportOriginContext>
);

/**
 * Returns the clip's pixel-space left offset within the timeline.
 * Defaults to 0 when used outside a ClipViewportOriginProvider (e.g., TimeScale).
 */
export const useClipViewportOrigin = (): number => use(ClipViewportOriginContext);
