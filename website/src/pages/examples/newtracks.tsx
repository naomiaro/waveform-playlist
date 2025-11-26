import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyNewTracksExample = createLazyExample(
  () => import('../../components/examples/NewTracksExample').then(m => ({ default: m.NewTracksExample }))
);

export default function NewTracksExamplePage(): React.ReactElement {
  return (
    <Layout
      title="New Tracks Example"
      description="Dynamically add and remove tracks"
    >
      <main className="container margin-vert--lg">
        <h1>New Tracks Example</h1>
        <p>
          Dynamically add and remove tracks from the playlist. Load audio files and manage
          multiple tracks in real-time.
        </p>

        <LazyNewTracksExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This example shows:
          </p>
          <ul>
            <li>Add new tracks dynamically</li>
            <li>Remove tracks from playlist</li>
            <li>Load audio files on demand</li>
            <li>Track management controls</li>
            <li>Multi-track playback</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
