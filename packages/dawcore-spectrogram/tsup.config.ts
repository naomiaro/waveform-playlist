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
  // Web Worker — ESM only, no DTS, don't clean (would wipe first block's output).
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
  // Orchestrator subpath — emits dist/orchestrator/index.mjs + .d.mts so
  // consumers can `import { SpectrogramOrchestrator } from '@dawcore/spectrogram/orchestrator'`.
  {
    entry: {
      'orchestrator/index': 'src/orchestrator/index.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
