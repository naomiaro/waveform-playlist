import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/tone.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
