import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    // Without shims, the CJS build stubs import.meta as {} and the top-level
    // `new URL('./worklet/…', import.meta.url)` throws Invalid URL at require
    // time (#574). shims replaces import.meta.url with pathToFileURL(__filename).
    shims: true,
  },
  {
    entry: {
      'worklet/meter-processor.worklet': 'src/worklet/meter-processor.worklet.ts',
      'worklet/recording-processor.worklet': 'src/worklet/recording-processor.worklet.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
