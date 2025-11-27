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
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap: number;
  /** Width in pixels of progress bars. Default: barWidth + barGap (fills gaps). Set to barWidth for no gap fill. */
  progressBarWidth?: number;
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
  barWidth: 1,
  barGap: 0,
});

export const usePlaylistInfo = () => useContext(PlaylistInfoContext);
