import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyEffectsExample = createLazyExample(
  () => import('../../components/examples/EffectsExample').then(m => ({ default: m.EffectsExample }))
);

export default function EffectsExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Effects Example"
      description="Apply 20+ real-time audio effects including reverb, delay, chorus, phaser, and distortion with Tone.js"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-effects.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-effects.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Effects Example</h1>
        <p style={{ marginBottom: '2rem' }}>
          Apply real-time audio effects to tracks using Tone.js. Experiment with reverb, delay,
          auto-wah, and other effects.
        </p>

        <LazyEffectsExample />

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

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
