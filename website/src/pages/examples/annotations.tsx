import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyAnnotationsExample = createLazyExample(
  () => import('../../components/examples/AnnotationsExample').then(m => ({ default: m.AnnotationsExample }))
);

export default function AnnotationsExamplePage(): React.ReactElement {
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

        <div style={{ marginTop: '2rem' }}>
          <LazyAnnotationsExample />
        </div>

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
