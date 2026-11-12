import { createContext, useContext } from 'react';

/** What a `ClipInteractionProvider` above tells the clips it wraps. */
export interface ClipInteractionContextValue {
  /** A `ClipInteractionProvider` is present: clips can be dragged and trimmed. */
  enabled: boolean;
  /** The provider was given `touchOptimized`: clips widen their trim handles. */
  touchOptimized: boolean;
}

const NO_CLIP_INTERACTION: ClipInteractionContextValue = { enabled: false, touchOptimized: false };

const ClipInteractionContext = createContext<ClipInteractionContextValue>(NO_CLIP_INTERACTION);

export const ClipInteractionContextProvider = ClipInteractionContext.Provider;

/** The whole value; read by the clip that uses it (#690). */
export function useClipInteraction(): ClipInteractionContextValue {
  return useContext(ClipInteractionContext);
}

export function useClipInteractionEnabled(): boolean {
  return useContext(ClipInteractionContext).enabled;
}
