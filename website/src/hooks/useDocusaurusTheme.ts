import { useState, useEffect } from 'react';
import { defaultTheme, darkTheme, type WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

/**
 * Hook to detect and respond to Docusaurus theme changes
 *
 * Watches the data-theme attribute on the document element and returns
 * the appropriate theme (defaultTheme or darkTheme).
 *
 * @returns The current theme based on Docusaurus's theme setting
 */
export function useDocusaurusTheme(): WaveformPlaylistTheme {
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

  return isDark ? darkTheme : defaultTheme;
}
