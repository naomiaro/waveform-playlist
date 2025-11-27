import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { MicrophoneIcon } from '@phosphor-icons/react';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyRecordingExample = createLazyExample(
  () => import('../../components/examples/RecordingExample').then(m => ({ default: m.RecordingExample }))
);

export default function RecordingExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Recording Example"
      description="Multi-track audio recording with live waveform visualization, VU meter, and AudioWorklet processing"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-recording.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-recording.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1><MicrophoneIcon size={32} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Multi-Track Recording</h1>
        <p>
          Record multiple audio tracks with live waveform visualization. Drop audio files to create tracks,
          or click "New Track" to record on an empty track.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <LazyRecordingExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This example demonstrates:
          </p>
          <ul>
            <li>Live microphone recording with real-time waveform</li>
            <li>Multiple track recording</li>
            <li>Drag & drop audio file import</li>
            <li>VU meter for input level monitoring</li>
            <li>Recording starts from max(cursor position, last clip end)</li>
            <li>Auto-scroll keeps recording in view</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
