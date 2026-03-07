import { createContext, useContext } from 'react';

const ClipInteractionContext = createContext(false);

export const ClipInteractionContextProvider = ClipInteractionContext.Provider;

export function useClipInteractionEnabled(): boolean {
  return useContext(ClipInteractionContext);
}
