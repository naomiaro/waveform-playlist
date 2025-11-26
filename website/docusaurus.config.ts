import path from 'path';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Waveform Playlist',
  tagline: 'Multitrack Web Audio editor and player with canvas waveform visualizations',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://naomiaro.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/waveform-playlist/',

  // GitHub pages deployment config.
  organizationName: 'naomiaro',
  projectName: 'waveform-playlist',

  // Static files are now in website/static (copied from ghpages)
  staticDirectories: ['static'],

  onBrokenLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/naomiaro/waveform-playlist/tree/main/website/',
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    function (context, options) {
      return {
        name: 'waveform-playlist-webpack',
        configureWebpack(config, isServer, utils) {
          return {
            module: {
              rules: [
                {
                  test: /\.tsx?$/,
                  include: [
                    /packages[\\/]browser[\\/]src/,
                    /packages[\\/]core[\\/]src/,
                    /packages[\\/]playout[\\/]src/,
                    /packages[\\/]ui-components[\\/]src/,
                    /packages[\\/]annotations[\\/]src/,
                  ],
                  use: [
                    {
                      loader: 'babel-loader',
                      options: {
                        presets: [
                          '@babel/preset-react',
                          '@babel/preset-typescript',
                        ],
                      },
                    },
                  ],
                },
              ],
            },
            resolve: {
              symlinks: true,
              extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
              alias: {
                // These packages we transpile from source
                '@waveform-playlist/browser': path.resolve(__dirname, '../packages/browser/src'),
                '@waveform-playlist/core': path.resolve(__dirname, '../packages/core/src'),
                '@waveform-playlist/playout': path.resolve(__dirname, '../packages/playout/src'),
                '@waveform-playlist/ui-components': path.resolve(__dirname, '../packages/ui-components/src'),
                '@waveform-playlist/annotations': path.resolve(__dirname, '../packages/annotations/src'),
                // recording, loaders, and webaudio-peaks use their built dist versions via node_modules

                // Force single instance of styled-components to avoid "several instances" warning
                // and ensure styles work correctly across all packages
                'styled-components': path.resolve(__dirname, 'node_modules/styled-components'),
                // Force single instance of @dnd-kit/core so DndContext works across packages
                '@dnd-kit/core': path.resolve(__dirname, 'node_modules/@dnd-kit/core'),
                '@dnd-kit/modifiers': path.resolve(__dirname, 'node_modules/@dnd-kit/modifiers'),
              },
            },
          };
        },
      };
    },
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Waveform Playlist',
      logo: {
        alt: 'Waveform Playlist Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/examples', label: 'Examples', position: 'left'},
        {
          href: 'pathname:///waveform-playlist/storybook/',
          label: 'Storybook',
          position: 'left',
        },
        {
          href: 'https://github.com/naomiaro/waveform-playlist',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/naomiaro/waveform-playlist/discussions',
            },
            {
              label: 'Issues',
              href: 'https://github.com/naomiaro/waveform-playlist/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Examples',
              to: '/examples',
            },
            {
              label: 'Storybook',
              href: 'pathname:///waveform-playlist/storybook/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/naomiaro/waveform-playlist',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Waveform Playlist. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
