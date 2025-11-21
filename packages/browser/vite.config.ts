import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Get the entry point from environment variable
const entry = process.env.VITE_ENTRY || 'index';

const entryPoints: Record<string, string> = {
  index: resolve(__dirname, 'src/index.tsx'),
  annotations: resolve(__dirname, 'src/annotations-app.tsx'),
  'stem-tracks': resolve(__dirname, 'src/stem-tracks-app.tsx'),
  'flexible-example': resolve(__dirname, 'src/flexible-example-app.tsx'),
  effects: resolve(__dirname, 'src/effects-app.tsx'),
  recording: resolve(__dirname, 'src/recording-app.tsx'),
};

const outputNames: Record<string, string> = {
  index: 'waveform-playlist',
  annotations: 'annotations-bundle',
  'stem-tracks': 'stem-tracks-bundle',
  'flexible-example': 'flexible-example-bundle',
  effects: 'effects-bundle',
  recording: 'recording-bundle',
};

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../ghpages/js',
    emptyOutDir: false,
    lib: entry === 'index' ? {
      entry: entryPoints[entry],
      name: 'WaveformPlaylist',
      formats: ['umd'],
      fileName: () => `${outputNames[entry]}.js`,
    } : undefined,
    rollupOptions: {
      input: entry === 'index' ? undefined : entryPoints[entry],
      output: entry === 'index' ? {
        exports: 'named',
      } : {
        entryFileNames: `${outputNames[entry]}.js`,
        format: 'iife',
      },
      external: entry === 'index' ? ['react', 'react-dom', 'styled-components'] : undefined,
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
      '@waveform-playlist/webaudio-peaks': resolve(__dirname, '../webaudio-peaks/dist/index.mjs'),
    },
  },
});
