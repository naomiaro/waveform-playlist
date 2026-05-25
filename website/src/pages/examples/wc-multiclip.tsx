import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyWcMulticlip = createLazyExample(
  () => import('../../components/examples/WcMulticlipExample').then((m) => ({ default: m.default })),
);

export default function WcMulticlipPage(): React.ReactElement {
  return (
    <Layout
      title="Web Components — Multiclip"
      description="Multiple clips per track with drag, trim, split, and pre-computed peaks via <daw-clip>"
    >
      <main className="container margin-vert--lg">
        <h1>Web Components — Multiclip</h1>
        <p>
          Multiple <code>&lt;daw-clip&gt;</code> elements per track with{' '}
          <code>interactive-clips</code> enabled — drag to move, drag clip edges to trim,
          press <kbd>S</kbd> at the playhead to split. Each clip loads its own
          pre-computed peaks (<code>.dat</code> file) for instant rendering.
        </p>
        <LazyWcMulticlip />
        <div style={{ marginTop: '2rem' }}>
          <h2>Keyboard shortcuts</h2>
          <ul>
            <li><kbd>Space</kbd> — play/pause</li>
            <li><kbd>Esc</kbd> — stop</li>
            <li><kbd>S</kbd> — split selected clip at playhead</li>
            <li><kbd>Cmd/Ctrl+Z</kbd> / <kbd>Cmd/Ctrl+Shift+Z</kbd> — undo/redo</li>
          </ul>
          <p>
            Shortcuts are provided by the <code>&lt;daw-keyboard-shortcuts&gt;</code>{' '}
            element. Same pattern as React's <code>&lt;KeyboardShortcuts /&gt;</code>{' '}
            component but framework-agnostic.
          </p>
          <h2>Run it locally</h2>
          <p>
            <code>pnpm example:dawcore-native</code> → opens{' '}
            <code>examples/dawcore-native/multiclip.html</code> (with an additional
            event-log panel showing every <code>daw-*</code> event the editor emits).
          </p>
        </div>
      </main>
    </Layout>
  );
}
