import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyCustomDragSetupExample = createLazyExample(
  () => import('../../components/examples/CustomDragSetupExample').then(m => ({ default: m.CustomDragSetupExample }))
);

const DESCRIPTION =
  'Clip dragging and trimming with your own DragDropProvider: the library’s sensors, drag handlers and collision modifier, and ClipInteractionOptions to tell the clips what they may do';

export default function CustomDragSetupExamplePage(): React.ReactElement {
  return (
    <Layout title="Custom Drag Setup" description={DESCRIPTION}>
      <Head>
        <meta property="og:title" content="Custom Drag Setup - Waveform Playlist" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-custom-drag-setup.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Custom Drag Setup - Waveform Playlist" />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-custom-drag-setup.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Custom Drag Setup Example</h1>
        <p style={{ marginBottom: '2rem' }}>
          Most apps wrap the playlist in <code>ClipInteractionProvider</code> and are done. This page does
          the same job by hand, with its own <code>DragDropProvider</code>, which is what you need when
          clips share the drag context with something else of yours.
        </p>

        <LazyCustomDragSetupExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <ul>
            <li>Drag a clip header to move the clip; it stops at its neighbours</li>
            <li>Drag a clip edge to trim it</li>
            <li>Untick the first box: the trim handles go away and headers no longer drag</li>
            <li>Tick the second box: trim handles widen from 8px to 24px, and a touch has to hold for 250ms before it drags</li>
          </ul>

          <h3>How it is wired</h3>
          <p>
            The drag behaviour comes from three pieces of the library placed in your own provider. The clips
            are told what they may do by <code>ClipInteractionOptions</code>; <code>Waveform</code> takes no
            prop for it.
          </p>
          <pre style={{
            background: 'var(--ifm-code-background)',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
          }}>
{`const sensors = useDragSensors({ touchOptimized });
const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({ /* … */ });

<DragDropProvider
  sensors={sensors}
  onDragStart={onDragStart}
  onDragMove={onDragMove}
  onDragEnd={onDragEnd}
  modifiers={[RestrictToHorizontalAxis, ClipCollisionModifier.configure({ tracks, samplesPerPixel })]}
>
  <ClipInteractionOptions enabled={interactive} touchOptimized={touchOptimized}>
    <Waveform showClipHeaders />
  </ClipInteractionOptions>
</DragDropProvider>`}
          </pre>
          <p>
            This is shortened: the page also selects the track of a clip when its drag starts, and gives
            the collision modifier a function for <code>tracks</code> so it is not rebuilt while trimming.
            The full walkthrough, with snap-to-grid and annotation dragging, is in the{' '}
            <Link to="/docs/react/guides/custom-drag-setup">Custom Drag Setup guide</Link>.
          </p>
        </div>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
