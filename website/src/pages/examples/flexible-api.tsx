import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { GearIcon } from '@phosphor-icons/react';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyFlexibleApiExample = createLazyExample(
  () => import('../../components/examples/FlexibleApiExample').then(m => ({ default: m.FlexibleApiExample }))
);

export default function FlexibleApiExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Flexible API Example"
      description="Build custom audio UI with the flexible hooks-based API - full control over rendering with any component library"
    >
      <Head>
        <meta property="og:title" content="Flexible API Example - Waveform Playlist" />
        <meta property="og:description" content="Build custom audio UI with the flexible hooks-based API - full control over rendering with any component library" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-flexible-api.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Flexible API Example - Waveform Playlist" />
        <meta name="twitter:description" content="Build custom audio UI with the flexible hooks-based API - full control over rendering with any component library" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-flexible-api.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1><GearIcon size={32} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Flexible API Example</h1>
        <p>
          Demonstrates advanced customization with the flexible hooks-based API. Build your own
          custom UI with any component library while the library handles the audio engine.
        </p>

        <h3>Keyboard Shortcuts</h3>
        <ul>
          <li><code>Space</code> - Play/Pause</li>
          <li><code>Escape</code> - Stop</li>
          <li><code>0</code> - Rewind to start</li>
          <li><code>S</code> - Split clip at playhead (select a track first)</li>
          <li><code>Cmd/Ctrl+Z</code> - Undo</li>
          <li><code>Cmd/Ctrl+Shift+Z</code> - Redo</li>
        </ul>

        <div style={{ marginTop: '2rem' }}>
          <LazyFlexibleApiExample />
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
