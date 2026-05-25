import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyWcBasic = createLazyExample(
  () => import('../../components/examples/WcBasicExample').then((m) => ({ default: m.default })),
);

export default function WcBasicPage(): React.ReactElement {
  return (
    <Layout
      title="Web Components — Basic"
      description="Minimal <daw-editor> with native Web Audio backend. No React in the audio path."
    >
      <main className="container margin-vert--lg">
        <h1>Web Components — Basic</h1>
        <p>
          Minimal <code>&lt;daw-editor&gt;</code> with the native Web Audio adapter. These
          are pure custom elements from <code>@dawcore/components</code> — React is only
          the page shell.
        </p>
        <LazyWcBasic />
        <div style={{ marginTop: '2rem' }}>
          <h2>What's in it</h2>
          <ul>
            <li>
              <code>@dawcore/components</code> — registers <code>&lt;daw-editor&gt;</code>,{' '}
              <code>&lt;daw-track&gt;</code>, transport elements
            </li>
            <li>
              <code>@dawcore/transport</code> — <code>NativePlayoutAdapter</code> (zero deps,
              no Tone.js)
            </li>
            <li>
              Five <code>&lt;daw-track src&gt;</code> children load audio via fetch on mount
            </li>
            <li>
              <code>&lt;daw-transport for="wc-basic-editor"&gt;</code> binds the buttons to
              the editor by id
            </li>
          </ul>
          <h2>Run it locally</h2>
          <p>
            The same example as a standalone Vite app:{' '}
            <code>pnpm example:dawcore-native</code> → opens{' '}
            <code>examples/dawcore-native/basic.html</code>.
          </p>
        </div>
      </main>
    </Layout>
  );
}
