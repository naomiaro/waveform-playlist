import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  root: import.meta.dirname,
  publicDir: path.resolve(repoRoot, 'website/static'),
  resolve: {
    alias: {
      '@dawcore/components': path.resolve(
        repoRoot,
        'packages/dawcore/src/index.ts',
      ),
      '@waveform-playlist/core': path.resolve(
        repoRoot,
        'packages/core/src/index.ts',
      ),
      '@waveform-playlist/engine': path.resolve(
        repoRoot,
        'packages/engine/src/index.ts',
      ),
      '@waveform-playlist/playout': path.resolve(
        repoRoot,
        'packages/playout/src/index.ts',
      ),
      '@dawcore/wam': path.resolve(
        repoRoot,
        'packages/dawcore-wam/src/index.ts',
      ),
      '@dawcore/faust': path.resolve(
        repoRoot,
        'packages/dawcore-faust/src/index.ts',
      ),
      // NOTE: `@dawcore/spectrogram` is deliberately NOT aliased to source. Its
      // worker URL — `new URL('@dawcore/spectrogram/worker/spectrogram.worker',
      // import.meta.url)` — needs node_modules resolution to find the built
      // worker dist. Source aliasing would break it. Rebuild the package
      // (`pnpm --filter @dawcore/spectrogram build`) after editing orchestrator/
      // computation code.
    },
  },
  optimizeDeps: {
    // @shren/faust2wam is a single ~8MB ESM bundle (libfaust WASM inlined) —
    // it is dynamically imported on first compile and needs no prebundling.
    exclude: ['@shren/faust2wam'],
  },
  server: {
    port: 5174,
    open: '/',
  },
});
