import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyStemTracksExample = createLazyExample(
  () => import('../../components/examples/StemTracksExample').then(m => ({ default: m.StemTracksExample }))
);

export default function StemTracksExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Stem Tracks Example"
      description="Multi-track audio player with independent volume, pan, mute and solo controls for each stem"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-stem-tracks.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-stem-tracks.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Stem Tracks Example</h1>
        <p>
          This example demonstrates multi-track audio playback with independent controls for each track.
          Adjust volume and pan for each stem independently.
        </p>

        <div
          style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--ifm-color-emphasis-300)'
          }}
        >
          <LazyStemTracksExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This example shows:
          </p>
          <ul>
            <li>Multiple audio tracks (stems)</li>
            <li>Independent volume controls per track</li>
            <li>Independent pan controls per track</li>
            <li>Mute/solo functionality</li>
            <li>Synchronized playback</li>
          </ul>
        </div>

        <AudioCredits track="whiptails" />
      </main>
    </Layout>
  );
}
