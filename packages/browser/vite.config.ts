import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

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
      external: ['react', 'react-dom', 'styled-components'],
      output: {
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'styled-components': 'styled',
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
      '@waveform-playlist/webaudio-peaks': resolve(__dirname, '../webaudio-peaks/dist/index.mjs'),
    },
  },
});
