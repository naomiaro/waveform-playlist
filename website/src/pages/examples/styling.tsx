import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyStylingExample = createLazyExample(
  () => import('../../components/examples/StylingExample').then(m => ({ default: m.StylingExample }))
);

export default function StylingExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Styling Example"
      description="Customize waveform appearance with barWidth, barGap, gradients, and theme colors for dark mode support"
    >
      <Head>
        <meta property="og:title" content="Styling Example - Waveform Playlist" />
        <meta property="og:description" content="Customize waveform appearance with barWidth, barGap, gradients, and theme colors for dark mode support" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-styling.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Styling Example - Waveform Playlist" />
        <meta name="twitter:description" content="Customize waveform appearance with barWidth, barGap, gradients, and theme colors for dark mode support" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-styling.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Waveform Styling</h1>
        <p>
          Customize the visual appearance of waveforms using <code>barWidth</code> and <code>barGap</code> props,
          combined with theme colors.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <LazyStylingExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Style Guide</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--ifm-color-emphasis-300)' }}>Style</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--ifm-color-emphasis-300)' }}>barWidth</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--ifm-color-emphasis-300)' }}>barGap</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--ifm-color-emphasis-300)' }}>Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Continuous</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>1</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>0</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Classic waveform look, detailed editing</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Thin bars</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>1</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>1-2</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Modern, minimalist UI</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>SoundCloud</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>3</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>1</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Social media players, overview displays</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Bold</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>4-5</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>2</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>Mobile displays, high-contrast needs</td>
              </tr>
            </tbody>
          </table>
        </div>

        <AudioCredits track="whiptails" />
      </main>
    </Layout>
  );
}
