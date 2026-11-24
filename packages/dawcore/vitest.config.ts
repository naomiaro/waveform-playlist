import { defineConfig } from 'vitest/config';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

// playout is no peer of dawcore: the no-adapter error names it as one of two adapters.
const installSpecs = installSpecsDefine('dawcore', ['@waveform-playlist/playout']);

export default defineConfig({
  // The same define as tsup.config.ts, so tests see the hints a build prints.
  define: installSpecs,
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup/wait-timeout.ts'],
  },
});
