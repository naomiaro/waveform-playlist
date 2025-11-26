import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyAnnotationsExample = createLazyExample(
  () => import('../../components/examples/AnnotationsExample').then(m => ({ default: m.AnnotationsExample }))
);

export default function AnnotationsExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Annotations Example"
      description="Time-synced audio annotations with regions, text labels, keyboard navigation, and JSON export for transcription"
    >
      <Head>
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-annotations.png" />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-annotations.png" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Annotations Example</h1>
        <p>
          Create and edit annotations on the audio timeline. Add regions with text labels to mark
          important sections, segments, or timestamps.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <LazyAnnotationsExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Adding New Annotations</h2>
          <p>
            Click the <strong>"+ Add Annotation"</strong> button or press the <strong>A</strong> key
            to create a new annotation at the current playhead position.
          </p>
          <h3>How It Works</h3>
          <ul>
            <li><strong>Default duration:</strong> New annotations are 3 seconds long by default</li>
            <li><strong>Smart sizing:</strong> If another annotation is nearby, the new annotation
                will shrink to fit the available space</li>
            <li><strong>Minimum size:</strong> Annotations require at least 0.5 seconds of space</li>
            <li><strong>Smart placement:</strong> If the playhead is inside an existing annotation,
                the new annotation will be created at the next available gap</li>
          </ul>
          <h3>After Creating</h3>
          <p>
            Once created, you can resize annotations by dragging their edges, or use the keyboard
            shortcuts to fine-tune the boundaries.
          </p>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Keyboard Shortcuts</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ifm-color-emphasis-300)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Key</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>A</code></td>
                <td style={{ padding: '0.5rem' }}>Add new annotation at playhead or next available gap</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>↑</code> / <code>←</code></td>
                <td style={{ padding: '0.5rem' }}>Select previous annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>↓</code> / <code>→</code></td>
                <td style={{ padding: '0.5rem' }}>Select next annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>Home</code> <span style={{ opacity: 0.6, fontSize: '0.85em' }}>(Fn+←)</span></td>
                <td style={{ padding: '0.5rem' }}>Select first annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>End</code> <span style={{ opacity: 0.6, fontSize: '0.85em' }}>(Fn+→)</span></td>
                <td style={{ padding: '0.5rem' }}>Select last annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>Escape</code></td>
                <td style={{ padding: '0.5rem' }}>Deselect annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>Enter</code></td>
                <td style={{ padding: '0.5rem' }}>Play selected annotation</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>[</code></td>
                <td style={{ padding: '0.5rem' }}>Move selected annotation start earlier</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>]</code></td>
                <td style={{ padding: '0.5rem' }}>Move selected annotation start later</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>Shift + [</code></td>
                <td style={{ padding: '0.5rem' }}>Move selected annotation end earlier</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>
                <td style={{ padding: '0.5rem' }}><code>Shift + ]</code></td>
                <td style={{ padding: '0.5rem' }}>Move selected annotation end later</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Features</h2>
          <ul>
            <li><strong>Editable mode:</strong> Toggle to enable/disable annotation editing</li>
            <li><strong>Link endpoints:</strong> When enabled, moving one annotation's edge automatically
                adjusts the adjacent annotation</li>
            <li><strong>Continuous play:</strong> Automatically advance to the next annotation during playback</li>
            <li><strong>Download JSON:</strong> Export annotations in JSON format for saving or processing</li>
            <li><strong>Upload JSON:</strong> Import previously saved annotations</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
