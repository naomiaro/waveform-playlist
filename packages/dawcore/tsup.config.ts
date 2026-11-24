import { defineConfig } from 'tsup';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

// playout is no peer of dawcore: the no-adapter error names it as one of two adapters.
const installSpecs = installSpecsDefine('dawcore', ['@waveform-playlist/playout']);

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // What the install hints name (src/utils/install-command.ts, scripts/build/install-specs.mjs).
  define: installSpecs,
});
