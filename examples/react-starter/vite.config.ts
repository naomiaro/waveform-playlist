import { defineConfig } from 'vite';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// Full multitrack starter: WaveformPlaylistProvider on the default Tone.js
// engine. Unlike the media-element-player example, this path DOES resolve
// `@waveform-playlist/playout` and `tone` — the provider dynamically imports
// them when no `createAdapter` prop is given. Workspace packages resolve from
// source so the dev page reflects edits without a rebuild. (In a standalone
// app you would instead `npm install` the published packages — see README.md.)
export default defineConfig({
  root: import.meta.dirname,
  // Audio stems are served from the shared website assets.
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
      // Subpath alias must come before the bare one so `/tone` wins the match.
      '@waveform-playlist/browser/tone': path.resolve(repoRoot, 'packages/browser/src/tone.ts'),
      '@waveform-playlist/browser': path.resolve(repoRoot, 'packages/browser/src/index.tsx'),
      '@waveform-playlist/playout': path.resolve(repoRoot, 'packages/playout/src/index.ts'),
      '@waveform-playlist/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      '@waveform-playlist/engine': path.resolve(repoRoot, 'packages/engine/src/index.ts'),
      '@waveform-playlist/ui-components': path.resolve(
        repoRoot,
        'packages/ui-components/src/index.tsx'
      ),
    },
  },
  // NOTE: `tone` must NOT be excluded from optimizeDeps — its CJS dependency
  // `automation-events` needs pre-bundling or imports fail with "does not
  // provide an export named".
  server: {
    port: 5177,
    open: '/',
  },
});
