import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyStemTracksExample = createLazyExample(
  () => import('../../components/examples/StemTracksExample').then(m => ({ default: m.StemTracksExample }))
);

export default function StemTracksExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Stem Tracks Example"
      description="Multi-track audio with independent volume and pan controls"
    >
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
      </main>
    </Layout>
  );
}
