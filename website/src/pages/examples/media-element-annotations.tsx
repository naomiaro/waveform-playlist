import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyMediaElementAnnotationsExample = createLazyExample(() =>
  import('../../components/examples/MediaElementAnnotationsExample').then((m) => ({
    default: m.MediaElementAnnotationsExample,
  }))
);

const TITLE = 'Media Element Annotations Example';
const DESCRIPTION =
  'Time-synced annotations on a streamed audio file, using HTMLAudioElement playback and pre-computed peaks';
const IMAGE =
  'https://naomiaro.github.io/waveform-playlist/img/social/example-media-element-annotations.png';

export default function MediaElementAnnotationsExamplePage(): React.ReactElement {
  return (
    <Layout title={TITLE} description={DESCRIPTION}>
      <Head>
        <meta property="og:title" content={`${TITLE} - Waveform Playlist`} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={IMAGE} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${TITLE} - Waveform Playlist`} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={IMAGE} />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Media Element Annotations</h1>
        <p style={{ marginBottom: '1rem' }}>
          Time-synced annotations with <code>MediaElementPlaylistProvider</code>: the audio is
          streamed by an <code>HTMLAudioElement</code> (no Tone.js, no decoding of the whole file)
          and the waveform comes from pre-computed peaks. The boxes under the waveform and the
          text list follow playback; click a box to play its annotation.
        </p>

        <LazyMediaElementAnnotationsExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>What to try</h2>
          <ul>
            <li>
              <strong>Continuous play</strong> on: playback runs through the annotations and the
              highlight follows it. Off: a clicked annotation plays to its end and stops.
            </li>
            <li>
              <strong>Editable</strong>: drag the edges of a box to move an annotation boundary,
              and edit the text in the list.
            </li>
            <li>
              <strong>Link endpoints</strong>: dragging a boundary also moves the boundary of the
              annotation next to it.
            </li>
          </ul>
        </div>

        <p style={{ marginTop: '1.5rem' }}>
          See the{' '}
          <a href="/waveform-playlist/docs/react/guides/media-element-playout">
            Media Element Playout guide
          </a>{' '}
          and the <a href="/waveform-playlist/docs/react/guides/annotations">Annotations guide</a>.
        </p>
      </main>
    </Layout>
  );
}
