import type { StorybookConfig } from '@storybook/react-webpack5';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-webpack5-compiler-swc', '@storybook/addon-docs'],
  staticDirs: [
    // Use website's static media for BBC peaks demo files
    { from: '../../../website/static/media', to: '/media' },
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  webpackFinal: async (config) => {
    // Resolve monorepo packages from source for better development experience
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@waveform-playlist/browser': path.resolve(__dirname, '../../browser/src'),
      '@waveform-playlist/core': path.resolve(__dirname, '../../core/src'),
      '@waveform-playlist/playout': path.resolve(__dirname, '../../playout/src'),
      '@waveform-playlist/ui-components': path.resolve(__dirname, '../src'),
      '@waveform-playlist/annotations': path.resolve(__dirname, '../../annotations/src'),
      '@waveform-playlist/recording': path.resolve(__dirname, '../../recording/dist'),
      '@waveform-playlist/webaudio-peaks': path.resolve(__dirname, '../../webaudio-peaks/src'),
      '@waveform-playlist/loaders': path.resolve(__dirname, '../../loaders/src'),
      // Force single styled-components instance to ensure ThemeProvider context works
      'styled-components': path.resolve(__dirname, '../node_modules/styled-components'),
    };

    // Ensure .ts and .tsx extensions are resolved
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', ...(config.resolve.extensions || [])];

    return config;
  },
};

export default config;