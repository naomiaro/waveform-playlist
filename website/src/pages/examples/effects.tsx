import React from 'react';
import Layout from '@theme/Layout';
import { EffectsExample } from '../../components/examples/EffectsExample';

export default function EffectsExamplePage(): React.ReactElement {
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

        <EffectsExample />

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
