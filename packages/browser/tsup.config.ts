import { defineConfig } from 'tsup';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

// spectrogram is no peer of browser: the spectrogram hook's error names it.
const BROWSER_INSTALL_EXTRAS = ['@waveform-playlist/spectrogram'];

export default defineConfig({
  entry: ['src/index.tsx', 'src/tone.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // What the install hints name (src/utils/installCommand.ts, scripts/build/install-specs.mjs).
  define: installSpecsDefine('browser', BROWSER_INSTALL_EXTRAS),
});
