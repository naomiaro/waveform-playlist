import { defineConfig } from 'tsup';
import { installSpecsDefine } from '../../scripts/build/install-specs.mjs';

export default defineConfig({
  entry: ['src/index.tsx', 'src/tone.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // The published peer ranges, for the install hints (src/utils/installCommand.ts).
  define: installSpecsDefine('browser'),
});
