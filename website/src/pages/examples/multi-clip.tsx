import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyMultiClipExample = createLazyExample(
  () => import('../../components/examples/MultiClipExample').then(m => ({ default: m.MultiClipExample }))
);

export default function MultiClipExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Multi-Clip Editing"
      description="Advanced multi-clip editing with drag & drop"
    >
      <main className="container margin-vert--lg">
        <h1>Multi-Clip Editing Example</h1>
        <p>
          Advanced multi-track, multi-clip editing with drag-and-drop. Move clips along the timeline,
          split clips, and arrange multiple clips per track.
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
            <li>Split clips at playhead (S key)</li>
            <li>Visual clip headers with track names</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
