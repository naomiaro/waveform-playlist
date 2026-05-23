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
  // Web Worker — ESM only, no DTS, don't clean (would wipe first build's output).
  // The orchestrator entry is added in Task 7 when src/orchestrator/index.ts exists.
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
