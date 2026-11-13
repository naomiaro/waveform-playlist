import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyMobileAnnotationsExample = createLazyExample(
  () => import('../../components/examples/MobileAnnotationsExample').then(m => ({ default: m.MobileAnnotationsExample }))
);

export default function MobileAnnotationsExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Mobile Annotations"
      description="Touch-optimized annotation editing for mobile devices"
    >
      <Head>
        <meta property="og:title" content="Mobile Annotations - Waveform Playlist" />
        <meta property="og:description" content="Touch-optimized annotation editing for mobile devices" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mobile-annotations.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mobile Annotations - Waveform Playlist" />
        <meta name="twitter:description" content="Touch-optimized annotation editing for mobile devices" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mobile-annotations.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Mobile Annotations</h1>
        <p style={{ marginBottom: '1rem' }}>
          Touch-optimized annotation editing for phones and tablets. Resize annotation boundaries
          with touch-and-hold gestures. Linked endpoints keep adjacent annotations connected.
        </p>

        <LazyMobileAnnotationsExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>Mobile Optimizations</h2>
          <p>
            This example uses the same touch optimizations as the multi-clip example:
          </p>
          <ul>
            <li><strong>Touch delay (250ms)</strong> - Distinguishes scroll from drag</li>
            <li><strong>Linked endpoints</strong> - Adjacent annotation boundaries move together</li>
            <li><strong>Larger action buttons</strong> - 44px minimum touch targets</li>
            <li><strong>Streamlined annotations</strong> - Fewer annotations for performance</li>
          </ul>

          <h3>Implementation</h3>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
          }}>
{`// The annotation boxes wire the drag of their edges themselves.
// touchOptimized: a touch is held for 250 ms before it drags an edge,
// so a swipe still scrolls the waveform.
<ClipInteractionOptions touchOptimized>
  {/* No track controls column on a narrow screen: leave the part out */}
  <WaveformRoot>
    <WaveformTimescale />
    <WaveformLoopRegion />
    <WaveformTracks />
    <WaveformAnnotationBoxes />
    <WaveformSelection />
    <WaveformPlayhead />
  </WaveformRoot>
  <AnnotationList actions={annotationActions} height={200} />
</ClipInteractionOptions>`}
          </pre>
        </div>
      </main>
    </Layout>
  );
}
