import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyFadesExample = createLazyExample(
  () => import('../../components/examples/FadesExample').then(m => ({ default: m.FadesExample }))
);

export default function FadesExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Fades Example"
      description="Compare audio fade curve types - linear, logarithmic, exponential, and S-curve with visual overlays"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-fades.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-fades.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Fade Types Comparison</h1>
        <p style={{ marginBottom: '2rem' }}>
          Listen to the same audio clip with different fade curves applied.
          Each player uses a 1.5 second fade in and fade out on a 5.85 second clip.
        </p>

        <LazyFadesExample />

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
