import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyWamEffectsExample = createLazyExample(() =>
  import('../../components/examples/WamEffectsExample').then((m) => ({
    default: m.WamEffectsExample,
  }))
);

const DESCRIPTION =
  'Host Web Audio Modules (WAM 2.0) plugins — community plugin browser, native plugin GUIs, per-track and master chains';

export default function WamEffectsExamplePage(): React.ReactElement {
  return (
    <Layout title="WAM! Kick It Up a Notch" description={DESCRIPTION}>
      <Head>
        <meta property="og:title" content="WAM! Kick It Up a Notch - Waveform Playlist" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta
          property="og:image"
          content="https://naomiaro.github.io/waveform-playlist/img/social/example-effects.png"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="WAM! Kick It Up a Notch - Waveform Playlist" />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta
          name="twitter:image"
          content="https://naomiaro.github.io/waveform-playlist/img/social/example-effects.png"
        />
      </Head>
      <main className="container margin-vert--lg">
        <h1>WAM! Kick It Up a Notch</h1>
        <p style={{ marginBottom: '2rem' }}>
          Kick your mix up a notch: host{' '}
          <a href="https://www.webaudiomodules.com/">Web Audio Modules (WAM 2.0)</a> plugins in a
          multitrack session. Browse the community registry, mount each plugin&apos;s native GUI,
          and mix WAM plugins with built-in Tone.js effects in per-track and master chains.
        </p>

        <LazyWamEffectsExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>This example demonstrates:</p>
          <ul>
            <li>WAM 2.0 plugin hosting on a native AudioContext</li>
            <li>Browsing and inserting plugins from the webaudiomodules.com community library</li>
            <li>Mixed effect chains — Tone.js reverb/delay alongside hosted WAM plugins</li>
            <li>Native plugin GUIs with generic-panel fallback for headless plugins</li>
            <li>Per-track and master effect racks with bypass and remove</li>
          </ul>
          <p>
            See the <Link to="/docs/wam-plugins">WAM Plugins guide</Link> for the full API
            walkthrough (the guide ships alongside this page).
          </p>
        </div>

        <AudioCredits track="whiptails" />
      </main>
    </Layout>
  );
}
