import React, { createContext, useContext, Fragment } from 'react';

export const TrackControlsContext = createContext(<Fragment />);

export const useTrackControls = () => useContext(TrackControlsContext);
