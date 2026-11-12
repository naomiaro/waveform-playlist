import { useMemo } from 'react';
import { defaultTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useShallowStable } from '../hooks/useShallowStable';

export interface ControlsConfig {
  show: boolean;
  width: number;
}

// One object for every omitted `controls` prop: a fresh literal per render
// would invalidate the context value that carries it.
export const DEFAULT_CONTROLS: ControlsConfig = { show: false, width: 0 };

const TIMESCALE_HEIGHT = 30;

export interface UseViewDefaultsOptions {
  controls: ControlsConfig | undefined;
  theme: Partial<WaveformPlaylistTheme> | undefined;
  barWidth: number;
  barGap: number;
  progressBarWidth: number | undefined;
  timescale: boolean;
}

export interface ViewDefaults {
  controls: ControlsConfig;
  mergedTheme: WaveformPlaylistTheme;
  progressBarWidth: number;
  timeScaleHeight: number;
}

/**
 * The view configuration both providers derive from their props. Inline
 * object props (`controls={{ … }}`, `theme={{ … }}`) get a new identity on
 * every render of the parent; they keep the previous one here while their
 * contents are unchanged, so memoized context values are not invalidated.
 */
export function useViewDefaults({
  controls: controlsProp,
  theme: themeProp,
  barWidth,
  barGap,
  progressBarWidth,
  timescale,
}: UseViewDefaultsOptions): ViewDefaults {
  const controls = useShallowStable(controlsProp ?? DEFAULT_CONTROLS);
  const userTheme = useShallowStable(themeProp);
  const mergedTheme = useMemo(() => ({ ...defaultTheme, ...userTheme }), [userTheme]);

  return {
    controls,
    mergedTheme,
    // Default: as wide as a bar and its gap, so progress fills the gaps.
    progressBarWidth: progressBarWidth ?? barWidth + barGap,
    timeScaleHeight: timescale ? TIMESCALE_HEIGHT : 0,
  };
}
