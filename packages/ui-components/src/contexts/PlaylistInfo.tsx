import { createContext, useContext } from 'react';

type Controls = {
  show: boolean;
  width: number;
};

type PlaylistInfo = {
  sampleRate: number;
  samplesPerPixel: number;
  zoomLevels: Array<number>;
  waveHeight: number;
  timeScaleHeight: number;
  duration: number;
  controls: Controls;
};

export const PlaylistInfoContext = createContext<PlaylistInfo>({
  sampleRate: 48000,
  samplesPerPixel: 1000,
  zoomLevels: [1000, 1500, 2000, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  controls: {
    show: false,
    width: 150,
  },
  duration: 30000,
});

export const usePlaylistInfo = () => useContext(PlaylistInfoContext);
