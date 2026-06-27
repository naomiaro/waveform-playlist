import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// MediaElement-only starter (issue #510). Resolves the workspace packages from
// source so the dev page reflects edits without a rebuild. Note what is ABSENT:
// there is NO alias for `@waveform-playlist/playout` and NO `tone` — the
// MediaElement playback path needs neither. That is the whole point of this
// example. (In a standalone app you would instead `npm install` the published
// packages — see README.md.)
export default defineConfig({
  root: import.meta.dirname,
  // Audio + pre-computed `.dat` peaks are served from the shared website assets.
  publicDir: path.resolve(repoRoot, 'website/static'),
  // No @vitejs/plugin-react dependency needed — esbuild compiles TSX with the
  // automatic JSX runtime (React 17+). A standalone copy would add the plugin
  // for Fast Refresh (see README.md).
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Source-aliased workspace packages import bare `react`/`styled-components`;
    // force a single copy so hooks/context work across the alias boundary
    // (otherwise: "Invalid hook call" from duplicate React).
    dedupe: ['react', 'react-dom', 'styled-components'],
    alias: {
      '@waveform-playlist/browser': path.resolve(repoRoot, 'packages/browser/src/index.tsx'),
      '@waveform-playlist/media-element-playout': path.resolve(
        repoRoot,
        'packages/media-element-playout/src/index.ts'
      ),
      '@waveform-playlist/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      '@waveform-playlist/engine': path.resolve(repoRoot, 'packages/engine/src/index.ts'),
      '@waveform-playlist/ui-components': path.resolve(
        repoRoot,
        'packages/ui-components/src/index.tsx'
      ),
      '@waveform-playlist/loaders': path.resolve(repoRoot, 'packages/loaders/src/index.ts'),
    },
  },
  // Belt-and-suspenders: never try to pre-bundle the engines this path doesn't use.
  optimizeDeps: {
    exclude: ['tone', '@waveform-playlist/playout'],
  },
  server: {
    port: 5176,
    open: '/',
  },
});
