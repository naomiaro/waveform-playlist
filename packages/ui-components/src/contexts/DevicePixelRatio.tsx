import React, { useState, useEffect, createContext, use, ReactNode } from 'react';

// Guarded so that importing this module on a server does not throw.
function getScale(): number {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio;
}

// `null` means "no provider": the hook then reads the live value itself, so
// the default is never captured at module-evaluation time.
const DevicePixelRatioContext = createContext<number | null>(null);

type Props = {
  children: ReactNode;
};

export const DevicePixelRatioProvider = ({ children }: Props) => {
  const [scale, setScale] = useState(getScale);

  // A `(resolution: Ndppx)` query only reports a change away from N, so the
  // subscription is rebuilt for each new ratio. Subscribing in an effect (not
  // in the render body) gives one listener at a time, removed on cleanup.
  useEffect(() => {
    const current = getScale();
    if (current !== scale) {
      // The ratio changed between render and this effect.
      setScale(current);
      return;
    }
    if (typeof matchMedia !== 'function') return;

    const query = matchMedia(`(resolution: ${scale}dppx)`);
    const handleChange = () => setScale(getScale());
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [scale]);

  return <DevicePixelRatioContext value={Math.ceil(scale)}>{children}</DevicePixelRatioContext>;
};

export const useDevicePixelRatio = (): number => use(DevicePixelRatioContext) ?? getScale();
