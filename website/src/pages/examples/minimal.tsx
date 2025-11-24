import React from 'react';
import Layout from '@theme/Layout';
import { MinimalExample } from '../../components/examples/MinimalExample';

export default function MinimalExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Minimal Example"
      description="Basic waveform display with playback controls"
    >
      <main className="container margin-vert--lg">
        <h1>Minimal Example</h1>
        <p>
          Basic waveform display with playback controls. This example demonstrates
          the core functionality of Waveform Playlist with minimal configuration.
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
          <MinimalExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This minimal example shows:
          </p>
          <ul>
            <li>Loading audio files</li>
            <li>Waveform visualization</li>
            <li>Basic playback controls (play, pause, stop)</li>
            <li>Audio position display</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
