import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyStereoExample = createLazyExample(
  () => import('../../components/examples/StereoExample').then(m => ({ default: m.StereoExample }))
);

export default function StereoExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Stereo Example"
      description="Stereo waveform display with separate left and right channels"
    >
      <Head>
        <meta property="og:title" content="Stereo Waveforms Example - Waveform Playlist" />
        <meta property="og:description" content="Stereo waveform display with separate left and right channel visualization" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-stereo.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Stereo Waveforms Example - Waveform Playlist" />
        <meta name="twitter:description" content="Stereo waveform display with separate left and right channel visualization" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-stereo.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Stereo Example</h1>
        <p>
          Demonstrates stereo waveform rendering with separate left and right channels.
          Each stereo track displays two waveforms - one for each channel.
        </p>

        {/* Container for the waveform playlist */}
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
          <LazyStereoExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This stereo example shows:
          </p>
          <ul>
            <li>Loading stereo audio files (2 channels)</li>
            <li>Separate left (L) and right (R) channel waveforms per track</li>
            <li>Each track displays two waveform rows - top for left, bottom for right</li>
            <li>Standard playback controls</li>
          </ul>

          <h3>Mono vs Stereo</h3>
          <p>
            By default, Waveform Playlist renders stereo audio with separate channels.
            To collapse stereo to mono (single waveform), use the <code>mono</code> prop:
          </p>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
{`// Stereo rendering (default)
<WaveformPlaylistProvider tracks={tracks}>

// Mono rendering (collapsed)
<WaveformPlaylistProvider tracks={tracks} mono>`}
          </pre>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
