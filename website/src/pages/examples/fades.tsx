import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyFadesExample = createLazyExample(
  () => import('../../components/examples/FadesExample').then(m => ({ default: m.FadesExample }))
);

export default function FadesExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Fades Example"
      description="Compare the four fade curve types: linear, logarithmic, exponential, and S-curve"
    >
      <main className="container margin-vert--lg">
        <h1>Fade Types Comparison</h1>
        <p>
          Listen to the same audio clip with different fade curves applied.
          Each player uses a 1.5 second fade in and fade out on a 5.85 second clip.
        </p>

        <LazyFadesExample />
      </main>
    </Layout>
  );
}
