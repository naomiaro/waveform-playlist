import { createContext, useContext } from 'react';

/**
 * What the drawing primitives (`Track`, `SmartChannel`, `SmartScale`,
 * `TimeScale`) need from the view they are drawn in. The browser package's
 * roots publish it once per view; without one above, the defaults apply.
 */
export type PlaylistInfo = {
  sampleRate: number;
  samplesPerPixel: number;
  /** Height in pixels of one channel. Default: 80 */
  waveHeight: number;
  /** Height in pixels of the timescale strip; 0 when there is none. */
  timeScaleHeight: number;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). Default: false */
  roundedBars: boolean;
  /** Width in pixels of the playhead line. Default: barWidth + barGap. */
  progressBarWidth: number;
};

export const DEFAULT_WAVE_HEIGHT = 80;
export const DEFAULT_BAR_WIDTH = 1;
export const DEFAULT_BAR_GAP = 0;

export const PlaylistInfoContext = createContext<PlaylistInfo>({
  sampleRate: 48000,
  samplesPerPixel: 1000,
  waveHeight: DEFAULT_WAVE_HEIGHT,
  timeScaleHeight: 15,
  barWidth: DEFAULT_BAR_WIDTH,
  barGap: DEFAULT_BAR_GAP,
  roundedBars: false,
  progressBarWidth: DEFAULT_BAR_WIDTH + DEFAULT_BAR_GAP,
});

export const usePlaylistInfo = () => useContext(PlaylistInfoContext);
