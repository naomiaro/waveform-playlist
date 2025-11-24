import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function StemTracksExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/stem-tracks-bundle.js');

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
