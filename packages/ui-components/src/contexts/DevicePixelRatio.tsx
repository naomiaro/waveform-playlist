import React, { useState, createContext, useContext, ReactNode } from 'react';

function getScale() {
  return window.devicePixelRatio;
}

const DevicePixelRatioContext = createContext(getScale());

type Props = {
  children: ReactNode;
};
export const DevicePixelRatioProvider = ({ children }: Props) => {
  const [scale, setScale] = useState(getScale());

  matchMedia(`(resolution: ${getScale()}dppx)`).addEventListener(
    'change',
    () => {
      setScale(getScale());
    },
    { once: true }
  );

  return (
    <DevicePixelRatioContext.Provider value={Math.ceil(scale)}>
      {children}
    </DevicePixelRatioContext.Provider>
  );
};

export const useDevicePixelRatio = () => useContext(DevicePixelRatioContext);
