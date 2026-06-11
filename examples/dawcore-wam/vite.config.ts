import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// Resolve workspace peer dependencies from source (not dist/) so the dev page
// picks up changes without rebuilding. Matches the examples/dawcore-native
// pattern. `@dawcore/wam` is pure TypeScript (no Lit decorators), so source
// aliasing is safe — it also makes @dawcore/components' dynamic
// import('@dawcore/wam') resolve to source.
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
      '@dawcore/transport': path.resolve(
        repoRoot,
        'packages/transport/src/index.ts',
      ),
      '@dawcore/wam': path.resolve(
        repoRoot,
        'packages/dawcore-wam/src/index.ts',
      ),
    },
  },
  optimizeDeps: {
    exclude: ['tone'],
  },
  server: {
    port: 5175,
    open: '/',
  },
});
