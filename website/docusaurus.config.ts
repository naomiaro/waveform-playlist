import fs from 'fs';
import path from 'path';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type {PrismTheme} from 'prism-react-renderer';
import remarkNextInstallTag from './src/remark/nextInstallTag';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Custom night vision Prism theme - warm amber/red for dark mode
const nightVisionTheme: PrismTheme = {
  plain: {
    color: '#d8c0a8',
    backgroundColor: '#12100e',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#7a6858', fontStyle: 'italic' },
    },
    {
      types: ['punctuation'],
      style: { color: '#a89078' },
    },
    {
      types: ['namespace'],
      style: { opacity: 0.7 },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'],
      style: { color: '#e8a060' }, // Warm orange
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: '#c49a6c' }, // Amber
    },
    {
      types: ['operator', 'entity', 'url', 'variable'],
      style: { color: '#d08070' }, // Muted red
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: '#c87060' }, // Red like headings
    },
    {
      types: ['function', 'class-name'],
      style: { color: '#e8c090' }, // Bright amber
    },
    {
      types: ['regex', 'important'],
      style: { color: '#d4a070' },
    },
    {
      types: ['important', 'bold'],
      style: { fontWeight: 'bold' },
    },
    {
      types: ['italic'],
      style: { fontStyle: 'italic' },
    },
    {
      types: ['deleted'],
      style: { color: '#c87060' },
    },
  ],
};

// One GitHub Pages deployment holds two builds of this site
// (.github/workflows/deploy-website.yml):
//
//   stable  the branch `main`, what npm `latest` ships   /waveform-playlist/
//   next    the branch `dev`, the current work           /waveform-playlist/next/
//
// A release has one number: `version` in the root package.json, bumped at the
// release (.claude/skills/release/SKILL.md). The workflow passes in what a
// build cannot know from its own checkout:
//
//   DOCS_CHANNEL         which of the two this build is (default: next)
//   DOCS_BASE_URL        where it is served (default: the stable base URL)
//   DOCS_STABLE_VERSION  the release on `main` (default: this checkout's)
type DocsChannel = 'stable' | 'next';
const DOCS_CHANNELS: readonly DocsChannel[] = ['stable', 'next'];
const STABLE_BASE_URL = '/waveform-playlist/';
const NEXT_BASE_URL = `${STABLE_BASE_URL}next/`;

const readChannel = (value: string | undefined): DocsChannel => {
  if (value === undefined || value === '') return 'next';
  const channel = DOCS_CHANNELS.find((name) => name === value);
  if (!channel) {
    throw new Error(`DOCS_CHANNEL must be one of ${DOCS_CHANNELS.join(', ')} (got "${value}")`);
  }
  return channel;
};

const readVersion = (value: string, source: string): string => {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${source} must be a release number like 16.0.1 (got "${value}")`);
  }
  return value;
};

const docsChannel = readChannel(process.env.DOCS_CHANNEL);
const baseUrl = process.env.DOCS_BASE_URL || STABLE_BASE_URL;
if (!baseUrl.startsWith('/') || !baseUrl.endsWith('/')) {
  throw new Error(`DOCS_BASE_URL must start and end with "/" (got "${baseUrl}")`);
}

// The release on `main`. On `dev` the root package.json holds the same number
// until a release bumps it, so it is the default when the workflow gives none.
const stableVersion = process.env.DOCS_STABLE_VERSION
  ? readVersion(process.env.DOCS_STABLE_VERSION, 'DOCS_STABLE_VERSION')
  : readVersion(
      JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version,
      'version in the root package.json'
    );

// The two builds are separate apps, so a link between them is a full page load
// to a path outside this build's base URL: `pathname://` keeps the router out
// of it, `autoAddBaseUrl: false` stops the link from being put under baseUrl,
// `target: '_self'` keeps the tab. Docusaurus draws such a link as external;
// `docs-channel-link` (custom.css) hides its "opens in new tab" icon.
const versionLink = (channel: DocsChannel, label: string, channelBaseUrl: string) => ({
  label,
  href: `pathname://${channelBaseUrl}`,
  autoAddBaseUrl: false,
  target: '_self',
  className:
    channel === docsChannel ? 'docs-channel-link dropdown__link--active' : 'docs-channel-link',
});

// "Edit this page" goes to the branch the build was made from.
const SOURCE_BRANCH: Record<DocsChannel, string> = {
  stable: 'main',
  next: 'dev',
};

const DROPDOWN_LABEL: Record<DocsChannel, string> = {
  stable: `v${stableVersion}`,
  next: 'Next',
};

const versionDropdown = {
  type: 'dropdown' as const,
  position: 'right' as const,
  label: DROPDOWN_LABEL[docsChannel],
  className: 'navbar__item--docs-channel',
  items: [
    versionLink('next', 'Next — in development', NEXT_BASE_URL),
    versionLink('stable', `v${stableVersion} — stable`, STABLE_BASE_URL),
  ],
};

const releaseAnnouncement = {
  id: 'v16_release',
  content:
    '🎉 <strong>v16 Released!</strong> — <code>@dnd-kit</code> 0.5 support with self-contained drag components; <code>noDropAnimationPlugins</code> is gone. See the <a href="https://github.com/naomiaro/waveform-playlist/releases/tag/dnd-kit-0-5">release notes</a>.',
  isCloseable: true,
};

const ANNOUNCEMENT: Record<DocsChannel, typeof releaseAnnouncement> = {
  stable: releaseAnnouncement,
  next: {
    id: 'docs_channel_next',
    content: `These docs are for the prereleases on npm <code>next</code>. For the release on npm <code>latest</code>, see the <a href="${STABLE_BASE_URL}" target="_self">stable docs</a>.`,
    isCloseable: false,
  },
};

const config: Config = {
  title: 'Waveform Playlist',
  tagline: 'Multitrack Web Audio editor and player with canvas waveform visualizations',
  favicon: 'img/favicon.ico',

  // GoatCounter analytics
  headTags: [
    {
      tagName: 'script',
      attributes: {
        'data-goatcounter': 'https://waveformplaylist.goatcounter.com/count',
        async: 'true',
        src: '//gc.zgo.at/count.js',
      },
    },
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Waveform Playlist',
        description: 'Multitrack Web Audio editor and player with canvas waveform visualizations',
        url: 'https://naomiaro.github.io/waveform-playlist/',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        programmingLanguage: 'TypeScript',
        license: 'https://opensource.org/licenses/MIT',
      }),
    },
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://naomiaro.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl,

  // One copy of each page in search engines: the stable one.
  noIndex: docsChannel !== 'stable',

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
          // The next docs install the prereleases they describe: `@next` on our packages
          remarkPlugins: docsChannel === 'next' ? [remarkNextInstallTag] : [],
          editUrl: `https://github.com/naomiaro/waveform-playlist/tree/${SOURCE_BRANCH[docsChannel]}/website/`,
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        // Offline/local search — index baked into the static build, no backend.
        indexBlog: false,
        indexPages: true,
        language: ['en'],
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  plugins: [
    function (context, options) {
      return {
        name: 'waveform-playlist-webpack',
        configureWebpack(config, isServer, utils) {
          return {
            // Suppress postcss-calc parse warnings from @radix-ui/themes CSS
            // (nested calc() + var() fallbacks that the browser handles fine)
            ignoreWarnings: [
              { message: /postcss-calc/ },
            ],
            module: {
              rules: [
                {
                  test: /\.tsx?$/,
                  include: [
                    /packages[\\/]browser[\\/]src/,
                    /packages[\\/]core[\\/]src/,
                    /packages[\\/]engine[\\/]src/,
                    /packages[\\/]playout[\\/]src/,
                    /packages[\\/]ui-components[\\/]src/,
                    /packages[\\/]annotations[\\/]src/,
                    /packages[\\/]midi[\\/]src/,
                    /packages[\\/]recording[\\/]src/,
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
                // The website never uses Faust compilation, and
                // @shren/faust2wam's single dist bundle references Node
                // builtins (fs, url) that webpack 5 won't polyfill. Keep the
                // whole ~8MB chain out of the bundle; dawcore reaches it only
                // through a guarded dynamic import (addFaustEffect).
                '@dawcore/faust': false,
                // These packages we transpile from source
                '@waveform-playlist/browser': path.resolve(__dirname, '../packages/browser/src'),
                '@waveform-playlist/core': path.resolve(__dirname, '../packages/core/src'),
                '@waveform-playlist/playout': path.resolve(__dirname, '../packages/playout/src'),
                '@waveform-playlist/engine': path.resolve(__dirname, '../packages/engine/src'),
                '@waveform-playlist/ui-components': path.resolve(__dirname, '../packages/ui-components/src'),
                '@waveform-playlist/annotations': path.resolve(__dirname, '../packages/annotations/src'),
                '@waveform-playlist/spectrogram': path.resolve(__dirname, '../packages/spectrogram/src'),
                '@waveform-playlist/midi': path.resolve(__dirname, '../packages/midi/src'),
                '@waveform-playlist/recording': path.resolve(__dirname, '../packages/recording/src'),
                // worklets, loaders, webaudio-peaks, and the @dawcore/* family use their built dist versions via node_modules
                // (@dawcore/components uses Lit decorators which babel-loader doesn't parse without extra config)

                // Force single instance of styled-components to avoid "several instances" warning
                // and ensure styles work correctly across all packages
                'styled-components': path.resolve(__dirname, 'node_modules/styled-components'),
                // Force single instance of @dnd-kit packages so DragDropProvider context
                // works across source-aliased packages (prevents React 18/19 copy split)
                '@dnd-kit/react': path.resolve(__dirname, 'node_modules/@dnd-kit/react'),
                '@dnd-kit/abstract': path.resolve(__dirname, 'node_modules/@dnd-kit/abstract'),
                '@dnd-kit/dom': path.resolve(__dirname, 'node_modules/@dnd-kit/dom'),
                '@dnd-kit/state': path.resolve(__dirname, 'node_modules/@dnd-kit/state'),
              },
            },
          };
        },
      };
    },
  ],

  themeConfig: {
    announcementBar: ANNOUNCEMENT[docsChannel],
    // Social card image for Open Graph and Twitter
    image: 'img/social/waveform-playlist-social.png',
    // SEO metadata
    metadata: [
      { name: 'keywords', content: 'waveform, audio editor, web audio, react, web components, multitrack, daw, audio visualization, tone.js' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@waveplaylist' },
      { name: 'og:type', content: 'website' },
    ],
    colorMode: {
      defaultMode: 'dark',
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
          href: `pathname://${baseUrl}storybook/`,
          label: 'Storybook',
          position: 'left',
        },
        versionDropdown,
        {
          href: 'https://www.buymeacoffee.com/naomiaro',
          label: '☕ Support',
          position: 'right',
          className: 'navbar__link--bmc',
        },
        {
          href: 'https://discord.gg/dsZZBpmD7k',
          label: 'Discord',
          position: 'right',
        },
        {
          href: 'https://github.com/naomiaro/waveform-playlist',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/dsZZBpmD7k',
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
              href: `pathname://${baseUrl}storybook/`,
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
      darkTheme: nightVisionTheme,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
