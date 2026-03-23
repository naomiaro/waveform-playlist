import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyWaveformDataExample = createLazyExample(
  () => import('../../components/examples/WaveformDataExample').then(m => ({ default: m.WaveformDataExample }))
);

export default function WaveformDataExamplePage(): React.ReactElement {
  return (
    <Layout
      title="BBC Waveform Data Example"
      description="Instant waveform display with BBC audiowaveform pre-computed peaks - reduce load times from seconds to milliseconds"
    >
      <Head>
        <meta property="og:title" content="BBC Waveform Data Example - Waveform Playlist" />
        <meta property="og:description" content="Instant waveform display with BBC audiowaveform pre-computed peaks - reduce load times from seconds to milliseconds" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-waveform-data.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BBC Waveform Data Example - Waveform Playlist" />
        <meta name="twitter:description" content="Instant waveform display with BBC audiowaveform pre-computed peaks - reduce load times from seconds to milliseconds" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-waveform-data.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>BBC Waveform Data Example</h1>
        <p>
          This example demonstrates fast waveform loading using BBC's pre-computed peaks format.
          Waveforms appear almost instantly while audio loads in the background.
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
          <LazyWaveformDataExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About BBC Waveform Data</h2>
          <p>
            BBC's <a href="https://github.com/bbc/audiowaveform" target="_blank" rel="noopener noreferrer">audiowaveform</a> tool
            generates pre-computed peak data from audio files. This enables:
          </p>
          <ul>
            <li><strong>Instant waveform display</strong> - peaks files are ~50KB vs ~3MB for audio</li>
            <li><strong>Reduced server load</strong> - no need to decode audio for visualization</li>
            <li><strong>Consistent rendering</strong> - same peaks regardless of browser/platform</li>
            <li><strong>Progressive loading</strong> - show waveforms while audio loads in background</li>
          </ul>
          <p>
            <strong>Sample rate note:</strong> Pre-computed peaks embed the source audio's sample rate.
            The browser's AudioContext typically runs at 48000 Hz. If the rates don't match (e.g., peaks
            generated from 44100 Hz audio on a 48000 Hz device), waveform-playlist falls back to generating
            peaks from the decoded audio. For best results, generate peaks from 48000 Hz audio or resample first.
          </p>

          <h3>Generating BBC Peaks Files</h3>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto'
          }}>
{`# Install audiowaveform (macOS)
brew install audiowaveform

# Generate from Opus (recommended — always 48000 Hz, matching most hardware)
audiowaveform -i audio.opus -o peaks.dat -z 256 -b 8

# Generate from MP3 or WAV
audiowaveform -i audio.mp3 -o peaks.dat -z 256 -b 8

# If source is 44100 Hz, encode to Opus first (resamples to 48000 Hz)
ffmpeg -i audio.wav -c:a libopus audio.opus
audiowaveform -i audio.opus -o peaks.dat -z 256 -b 8`}
          </pre>

          <p>
            For a complete code walkthrough of progressive loading with BBC peaks, see the{' '}
            <a href="/waveform-playlist/docs/guides/loading-audio#immediate-mode-progressive-loading">
              Immediate Mode guide
            </a>.
          </p>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
