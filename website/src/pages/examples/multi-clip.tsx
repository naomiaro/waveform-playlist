import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function MultiClipExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/multi-clip-bundle.js');

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
      title="Multi-Clip Editing"
      description="Advanced multi-clip editing with drag & drop"
    >
      <main className="container margin-vert--lg">
        <h1>Multi-Clip Editing Example</h1>
        <p>
          Advanced multi-track, multi-clip editing with drag-and-drop. Move clips along the timeline,
          split clips, and arrange multiple clips per track.
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
            <li>Multiple clips per track</li>
            <li>Drag clips to reposition on timeline</li>
            <li>Real-time collision detection</li>
            <li>Trim clips by dragging boundaries</li>
            <li>Split clips at playhead (S key)</li>
            <li>Visual clip headers with track names</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
