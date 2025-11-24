import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function AnnotationsExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/annotations-bundle.js');

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
      title="Annotations Example"
      description="Audio annotations with regions and text labels"
    >
      <main className="container margin-vert--lg">
        <h1>Annotations Example</h1>
        <p>
          Create and edit annotations on the audio timeline. Add regions with text labels to mark
          important sections, segments, or timestamps.
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
            <li>Add annotations with start/end times</li>
            <li>Edit annotation text and timestamps</li>
            <li>Visual regions on the waveform</li>
            <li>Continuous play mode</li>
            <li>Link endpoints option</li>
            <li>Keyboard shortcuts for navigation</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
