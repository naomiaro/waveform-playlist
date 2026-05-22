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
  // Web Worker — ESM only, no DTS, don't clean (would wipe first build's output)
  // NOTE: Uncomment when src/worker/spectrogram.worker.ts and src/orchestrator/index.ts are created (Task 2, Task 7)
  // {
  //   entry: {
  //     'worker/spectrogram.worker': 'src/worker/spectrogram.worker.ts',
  //     'orchestrator/index': 'src/orchestrator/index.ts',
  //   },
  //   format: ['esm'],
  //   dts: false,
  //   splitting: false,
  //   sourcemap: true,
  //   clean: false,
  // },
]);
