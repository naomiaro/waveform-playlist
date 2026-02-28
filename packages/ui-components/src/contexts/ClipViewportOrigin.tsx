import { createContext, type ReactNode, useContext } from "react";

const ClipViewportOriginContext = createContext<number>(0);

interface ClipViewportOriginProviderProps {
  originX: number;
  children: ReactNode;
}

export function ClipViewportOriginProvider({
  originX,
  children,
}: ClipViewportOriginProviderProps) {
  return (
    <ClipViewportOriginContext.Provider value={originX}>
      {children}
    </ClipViewportOriginContext.Provider>
  );
}

export function useClipViewportOrigin(): number {
  return useContext(ClipViewportOriginContext);
}
