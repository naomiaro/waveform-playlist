import { useState, useEffect } from 'react';
import { defaultTheme, darkTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

interface DocusaurusThemeResult {
  theme: WaveformPlaylistTheme;
  isDarkMode: boolean;
}

/**
 * Hook to detect and respond to Docusaurus theme changes
 *
 * Watches the data-theme attribute on the document element and returns
 * the appropriate theme (defaultTheme or darkTheme) along with isDarkMode boolean.
 *
 * @returns Object containing the current theme and isDarkMode boolean
 */
export function useDocusaurusTheme(): DocusaurusThemeResult {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  return {
    theme: isDark ? darkTheme : defaultTheme,
    isDarkMode: isDark,
  };
}
