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
      title="Browser Audio Recording with React — Live Waveform & Multi-Track"
      description="Record audio in the browser with React using AudioWorklet. Live waveform preview, multi-track layering, VU meter, drag-and-drop import, and WAV export — all client-side."
    >
      <Head>
        <meta property="og:title" content="Browser Audio Recording with React — Waveform Playlist" />
        <meta property="og:description" content="Record audio in the browser with React using AudioWorklet. Live waveform preview, multi-track layering, VU meter, and WAV export — all client-side." />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-recording.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Browser Audio Recording with React — Waveform Playlist" />
        <meta name="twitter:description" content="Record audio in the browser with React using AudioWorklet. Live waveform preview, multi-track layering, VU meter, and WAV export — all client-side." />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-recording.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1><MicrophoneIcon size={32} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Multi-Track Audio Recording</h1>
        <p>
          Record audio directly in the browser with real-time waveform visualization. Layer multiple
          tracks by recording or importing audio files, then export the mix as WAV.
        </p>

        <div style={{ marginTop: '1.5rem' }}>
          <LazyRecordingExample />
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <h2>About This Example</h2>
          <p>
            This example uses the <code>useIntegratedRecording</code> hook from <code>@waveform-playlist/recording</code> to
            capture microphone audio via an <a href="https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet">AudioWorklet</a>.
            Audio is processed in a dedicated thread to avoid blocking the main thread, and peaks are
            generated in real time for a live waveform preview as you record.
          </p>

          <h3 style={{ marginTop: '1.5rem' }}>Features</h3>
          <ul>
            <li><strong>Live waveform preview</strong> — see your audio rendered in real time as you record, powered by AudioWorklet peak generation</li>
            <li><strong>Multi-track layering</strong> — record multiple takes on separate tracks and play them back together</li>
            <li><strong>Mono and stereo recording</strong> — channel count is auto-detected from your microphone</li>
            <li><strong>Drag-and-drop import</strong> — drop audio files (WAV, MP3, FLAC, etc.) onto the timeline to add backing tracks</li>
            <li><strong>VU meter</strong> — real-time input level monitoring with peak hold indicator</li>
            <li><strong>Device selection</strong> — choose between available microphones without restarting</li>
            <li><strong>Smart recording position</strong> — recording starts from the cursor or the end of the last clip, whichever is later</li>
            <li><strong>Auto-scroll</strong> — the timeline scrolls to keep the recording head in view</li>
            <li><strong>WAV export</strong> — export your multitrack mix as a WAV file, entirely client-side</li>
          </ul>

          <h3>How It Works</h3>
          <p>
            The recording pipeline uses the Web Audio API's <code>AudioWorkletNode</code> connected
            to a <code>MediaStreamSource</code> from <code>getUserMedia</code>. The worklet buffers
            raw PCM samples and sends them to the main thread at ~60fps intervals. On the main
            thread, peaks are incrementally appended and rendered via HTML Canvas — the same rendering
            pipeline used for loaded audio files. When recording stops, the accumulated samples are
            assembled into an <code>AudioBuffer</code> and added as a clip at the record-start position on
            the selected track, replacing any clip content it overlaps (punch-in).
          </p>
        </div>
      </main>
    </Layout>
  );
}
