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
  // AudioWorklet processor (no DTS generation)
  {
    entry: {
      'worklet/recording-processor.worklet': 'src/worklet/recording-processor.worklet.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
