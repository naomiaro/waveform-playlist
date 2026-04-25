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
    },
  },
  server: {
    port: 5174,
    open: '/',
  },
});
