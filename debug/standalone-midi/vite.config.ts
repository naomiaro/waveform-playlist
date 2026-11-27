import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Resolve workspace packages from source (same as Docusaurus webpack aliases)
const packagesDir = path.resolve(__dirname, '../../packages');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@waveform-playlist/browser': path.join(packagesDir, 'browser/src'),
      '@waveform-playlist/core': path.join(packagesDir, 'core/src'),
      '@dawcore/midi': path.join(packagesDir, 'dawcore-midi/src'),
      '@waveform-playlist/playout': path.join(packagesDir, 'playout/src'),
      '@waveform-playlist/ui-components': path.join(packagesDir, 'ui-components/src'),
      '@waveform-playlist/engine': path.join(packagesDir, 'engine/src'),
    },
  },
  // Serve the MIDI file and SoundFont from the website's static dir
  server: {
    port: 5555,
    fs: {
      allow: [
        // Allow serving files from the entire monorepo
        path.resolve(__dirname, '../..'),
      ],
    },
  },
  // Copy static assets
  publicDir: path.resolve(__dirname, '../../website/static'),
});
