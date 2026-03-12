import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const peerDeps = Object.keys(pkg.peerDependencies || {});

// Externalize all peerDependencies and their deep imports (e.g. @dnd-kit/abstract/modifiers).
// This prevents bundling peer deps, which causes duplicate instances at runtime.
const isExternal = (id: string) =>
  peerDeps.some((dep) => id === dep || id.startsWith(dep + '/'));

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*'],
      rollupTypes: true,
    }),
    visualizer({
      filename: './bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'WaveformPlaylist',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      external: isExternal,
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'styled-components': 'styled',
          tone: 'Tone',
        },
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@waveform-playlist/recording': resolve(__dirname, '../recording/dist/index.mjs'),
      '@waveform-playlist/annotations': resolve(__dirname, '../annotations/dist/index.mjs'),
      '@waveform-playlist/ui-components': resolve(__dirname, '../ui-components/dist/index.mjs'),
      '@waveform-playlist/core': resolve(__dirname, '../core/dist/index.mjs'),
      '@waveform-playlist/playout': resolve(__dirname, '../playout/dist/index.mjs'),
      '@waveform-playlist/loaders': resolve(__dirname, '../loaders/dist/index.mjs'),
    },
  },
});
