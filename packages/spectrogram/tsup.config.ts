import { defineConfig } from 'tsup';

export default defineConfig([
  // Main package
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
  },
  // Web Worker (no DTS generation)
  {
    entry: {
      'worker/spectrogram.worker': 'src/worker/spectrogram.worker.ts',
    },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
