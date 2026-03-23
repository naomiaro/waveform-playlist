import { defineConfig } from 'vite';
import path from 'node:path';

const packageDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(packageDir, '../..');

// Resolve workspace peer dependencies from source (not dist/) so dev page
// picks up changes without rebuilding. Matches the Docusaurus webpack alias
// pattern in website/docusaurus.config.ts.
export default defineConfig({
  root: packageDir,
  publicDir: path.resolve(repoRoot, 'website/static'),
  resolve: {
    alias: {
      '@waveform-playlist/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      '@waveform-playlist/engine': path.resolve(repoRoot, 'packages/engine/src/index.ts'),
      '@waveform-playlist/playout': path.resolve(repoRoot, 'packages/playout/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
