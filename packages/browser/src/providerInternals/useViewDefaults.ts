import { useMemo } from 'react';
import { defaultTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useShallowStable } from '../hooks/useShallowStable';

export interface UseViewDefaultsOptions {
  theme: Partial<WaveformPlaylistTheme> | undefined;
  barWidth: number;
  barGap: number;
  progressBarWidth: number | undefined;
}

export interface ViewDefaults {
  mergedTheme: WaveformPlaylistTheme;
  progressBarWidth: number;
}

/**
 * The view configuration both providers derive from their props. Inline
 * object props (`theme={{ … }}`) get a new identity on
 * every render of the parent; they keep the previous one here while their
 * contents are unchanged, so memoized context values are not invalidated.
 */
export function useViewDefaults({
  theme: themeProp,
  barWidth,
  barGap,
  progressBarWidth,
}: UseViewDefaultsOptions): ViewDefaults {
  const userTheme = useShallowStable(themeProp);
  const mergedTheme = useMemo(() => ({ ...defaultTheme, ...userTheme }), [userTheme]);

  return {
    mergedTheme,
    // Default: as wide as a bar and its gap, so progress fills the gaps.
    progressBarWidth: progressBarWidth ?? barWidth + barGap,
  };
}
