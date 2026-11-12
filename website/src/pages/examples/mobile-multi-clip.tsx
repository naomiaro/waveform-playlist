import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyMobileMultiClipExample = createLazyExample(
  () => import('../../components/examples/MobileMultiClipExample').then(m => ({ default: m.MobileMultiClipExample }))
);

export default function MobileMultiClipExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Mobile Multi-Clip Editing"
      description="Touch-optimized multi-clip audio editing for mobile devices"
    >
      <Head>
        <meta property="og:title" content="Mobile Multi-Clip Editing - Waveform Playlist" />
        <meta property="og:description" content="Touch-optimized multi-clip audio editing for mobile devices" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mobile-multi-clip.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mobile Multi-Clip Editing - Waveform Playlist" />
        <meta name="twitter:description" content="Touch-optimized multi-clip audio editing for mobile devices" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-mobile-multi-clip.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Mobile Multi-Clip Editing</h1>
        <p style={{ marginBottom: '1rem' }}>
          Touch-optimized clip editing for phones and tablets. Uses delay-based touch activation
          to distinguish between scroll gestures and drag operations.
        </p>

        <LazyMobileMultiClipExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>Mobile Optimizations</h2>
          <p>
            This example uses special settings for better mobile experience:
          </p>
          <ul>
            <li><strong>Touch delay (250ms)</strong> - Touch and hold to start dragging, quick swipes scroll normally</li>
            <li><strong>Larger touch targets (24px)</strong> - Clip boundaries are wider for easier targeting</li>
            <li><strong>Simplified layout</strong> - Fewer tracks and controls for smaller screens</li>
            <li><strong>No automatic scroll</strong> - Prevents scroll conflicts during drag</li>
          </ul>

          <h3>Implementation</h3>
          <p>
            Enable mobile optimization with two props:
          </p>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
          }}>
{`// 1. Configure drag sensors with touch delay
const sensors = useDragSensors({ touchOptimized: true });

// 2. Enable larger touch targets on Waveform
<Waveform
  showClipHeaders
  interactiveClips
  touchOptimized  // Enables wider clip boundaries
/>`}
          </pre>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
