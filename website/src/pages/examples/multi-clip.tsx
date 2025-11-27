import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyMultiClipExample = createLazyExample(
  () => import('../../components/examples/MultiClipExample').then(m => ({ default: m.MultiClipExample }))
);

export default function MultiClipExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Multi-Clip Editing"
      description="Advanced multi-clip audio editing with drag & drop, clip splitting, trimming, and collision detection"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-multi-clip.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-multi-clip.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Multi-Clip Editing Example</h1>
        <p style={{ marginBottom: '2rem' }}>
          Advanced multi-track, multi-clip editing inspired by Audacity. Move clips along the timeline
          with drag-and-drop, split clips at the playhead, trim boundaries, and arrange multiple clips per track.
        </p>

        <LazyMultiClipExample />

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
            <li>Visual clip headers with track names</li>
          </ul>

          <h3>Keyboard Shortcuts</h3>
          <ul>
            <li><code>Space</code> - Play/Pause</li>
            <li><code>Escape</code> - Stop</li>
            <li><code>0</code> - Rewind to start</li>
            <li><code>S</code> - Split clip at playhead (select a track first)</li>
          </ul>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
