import { defineConfig } from 'vitest/config';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

export default defineConfig({
  // The same define as tsup.config.ts, so tests see the hints a build prints.
  define: installSpecsDefine('browser'),
  test: {
    environment: 'node',
  },
});
