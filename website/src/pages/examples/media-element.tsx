import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyMediaElementExample = createLazyExample(
  () => import('../../components/examples/MediaElementExample').then(m => ({ default: m.MediaElementExample }))
);

export default function MediaElementExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Media Element Playout Example"
      description="Single-track playback with pitch-preserving playback rate control using HTMLAudioElement"
    >
      <Head>
        <meta property="og:title" content="Media Element Playout Example - Waveform Playlist" />
        <meta property="og:description" content="Single-track playback with pitch-preserving playback rate control using HTMLAudioElement" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-media-element.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Media Element Playout Example - Waveform Playlist" />
        <meta name="twitter:description" content="Single-track playback with pitch-preserving playback rate control using HTMLAudioElement" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-media-element.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Media Element Playout</h1>
        <p style={{ marginBottom: '1rem' }}>
          Single-track playback using <code>HTMLAudioElement</code> instead of Tone.js.
          Streams audio without downloading the entire file, with pitch-preserving playback rate control.
          The second player demonstrates a custom playhead with a triangle marker and timescale.
          The third player shows how to bridge into a Tone.js effect chain via a native GainNode.
        </p>

        <LazyMediaElementExample />

        <p style={{ marginTop: '1.5rem' }}>
          See the{' '}
          <a href="/waveform-playlist/docs/guides/media-element-playout">
            Media Element Playout Guide
          </a>{' '}
          for usage details and API reference.
        </p>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
