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
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-styling.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-styling.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Waveform Styling</h1>
        <p>
          Customize the visual appearance of waveforms using <code>barWidth</code> and <code>barGap</code> props,
          combined with theme colors. These props are passed to <code>WaveformPlaylistProvider</code>.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <LazyStylingExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Configuration</h2>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto'
          }}>
{`<WaveformPlaylistProvider
  tracks={tracks}
  barWidth={3}    // Width of each bar in pixels
  barGap={1}      // Gap between bars in pixels
  theme={{
    // Solid color (string)
    waveOutlineColor: '#E0EFF1',
    waveFillColor: '#4a9eff',

    // Or use a gradient for waveOutlineColor / waveFillColor:
    waveOutlineColor: {
      type: 'linear',
      direction: 'vertical',  // or 'horizontal'
      stops: [
        { offset: 0, color: '#00ffcc' },
        { offset: 0.5, color: '#ff00aa' },
        { offset: 1, color: '#00ffcc' },
      ],
    },

    waveProgressColor: 'rgba(0, 0, 0, 0.15)',  // Overlay on played portion
    playheadColor: '#ff4444',                   // Vertical playhead line

    // Selected track colors (when track is clicked)
    selectedWaveOutlineColor: '#E0EFF1',  // Also supports gradients
    selectedWaveFillColor: '#4a9eff',
  }}
>
  <Waveform />
</WaveformPlaylistProvider>`}
          </pre>
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
