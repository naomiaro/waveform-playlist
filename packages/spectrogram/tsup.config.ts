import { defineConfig } from 'tsup';

// React Provider + UI only. The worker entry now ships from @dawcore/spectrogram.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
