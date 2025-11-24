import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function RecordingExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/recording-bundle.js');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = bundleSrc;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [bundleSrc]);

  return (
    <Layout
      title="Recording Example"
      description="Multi-track recording with live waveform visualization"
    >
      <main className="container margin-vert--lg">
        <h1>🎙️ Multi-Track Recording</h1>
        <p>
          Record multiple audio tracks with live waveform visualization. Drop audio files to create tracks,
          or click "New Track" to record on an empty track.
        </p>

        <div
          id="playlist"
          style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--ifm-color-emphasis-300)'
          }}
        ></div>

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
