import { useMemo } from 'react';
import { defaultTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useShallowStable } from '../hooks/useShallowStable';

/**
 * The theme both providers hand to styled-components: the `theme` prop merged
 * over `defaultTheme`. An inline object prop (`theme={{ … }}`) gets a new
 * identity on every render of the parent; it keeps the previous one here
 * while its contents are unchanged, so nothing styled is re-rendered.
 *
 * The theme stays on the provider (#689): it is not an option of one view.
 * The transport controls, the checkboxes and the annotation list are drawn
 * outside a root and read it too.
 */
export function useMergedTheme(
  themeProp: Partial<WaveformPlaylistTheme> | undefined
): WaveformPlaylistTheme {
  const userTheme = useShallowStable(themeProp);
  return useMemo(() => ({ ...defaultTheme, ...userTheme }), [userTheme]);
}
