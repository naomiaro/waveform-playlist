import { defineConfig } from 'vitest/config';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

// spectrogram is no peer of browser: the spectrogram hook's error names it.
const BROWSER_INSTALL_EXTRAS = ['@waveform-playlist/spectrogram'];

export default defineConfig({
  // The same define as tsup.config.ts, so tests see the hints a build prints.
  define: installSpecsDefine('browser', BROWSER_INSTALL_EXTRAS),
  test: {
    environment: 'node',
  },
});
