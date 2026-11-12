import React, { createContext, useContext, useMemo } from 'react';

/** What the clips below are told about interaction. */
export interface ClipInteractionContextValue {
  /** Clips can be dragged and trimmed. */
  enabled: boolean;
  /** Clips widen their trim handles for touch. */
  touchOptimized: boolean;
}

const NO_CLIP_INTERACTION: ClipInteractionContextValue = { enabled: false, touchOptimized: false };

const ClipInteractionContext = createContext<ClipInteractionContextValue>(NO_CLIP_INTERACTION);

export interface ClipInteractionOptionsProps {
  /** Clips below can be dragged and trimmed. Left out: inherited (false at the top). */
  enabled?: boolean;
  /** Clips below get wider trim handles for touch. Left out: inherited (false at the top). */
  touchOptimized?: boolean;
  children: React.ReactNode;
}

/**
 * The one source of the clip interaction options (#690). Every clip below
 * reads them from here; `<Waveform>` takes neither as a prop.
 *
 * `ClipInteractionProvider` renders this for you. Use it directly when you
 * wire up your own `DragDropProvider`, or nested inside a
 * `ClipInteractionProvider` to change one option for part of the tree: an
 * option you leave out keeps the value from above.
 */
export const ClipInteractionOptions: React.FC<ClipInteractionOptionsProps> = ({
  enabled: enabledProp,
  touchOptimized: touchOptimizedProp,
  children,
}) => {
  const inherited = useContext(ClipInteractionContext);
  const enabled = enabledProp ?? inherited.enabled;
  const touchOptimized = touchOptimizedProp ?? inherited.touchOptimized;
  // Two booleans in, one object out: the value changes only when one of them
  // does, however often the parent renders.
  const value = useMemo(() => ({ enabled, touchOptimized }), [enabled, touchOptimized]);
  return (
    <ClipInteractionContext.Provider value={value}>{children}</ClipInteractionContext.Provider>
  );
};

/** The options for the clip that calls it. */
export function useClipInteraction(): ClipInteractionContextValue {
  return useContext(ClipInteractionContext);
}

/** True when clips here can be dragged and trimmed. */
export function useClipInteractionEnabled(): boolean {
  return useContext(ClipInteractionContext).enabled;
}
