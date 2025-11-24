import React, { createContext, useContext, Fragment } from 'react';

export const TrackControlsContext = createContext<React.ReactNode>(<Fragment />);

export const useTrackControls = () => useContext(TrackControlsContext);
