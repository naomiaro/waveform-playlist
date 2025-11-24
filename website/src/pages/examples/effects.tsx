import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function EffectsExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/effects-bundle.js');

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
      title="Effects Example"
      description="Real-time audio effects with Tone.js"
    >
      <main className="container margin-vert--lg">
        <h1>Effects Example</h1>
        <p>
          Apply real-time audio effects to tracks using Tone.js. Experiment with reverb, delay,
          auto-wah, and other effects.
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
            <li>Real-time audio effects processing</li>
            <li>Reverb with configurable decay time</li>
            <li>Auto-wah effect</li>
            <li>Master analyzer for visualization</li>
            <li>Per-track effects</li>
            <li>Live effect parameter adjustment</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
