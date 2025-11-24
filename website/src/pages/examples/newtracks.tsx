import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function NewTracksExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/newtracks-bundle.js');

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
      title="New Tracks Example"
      description="Dynamically add and remove tracks"
    >
      <main className="container margin-vert--lg">
        <h1>New Tracks Example</h1>
        <p>
          Dynamically add and remove tracks from the playlist. Load audio files and manage
          multiple tracks in real-time.
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
