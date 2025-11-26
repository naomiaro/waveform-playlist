import React from 'react';
import Layout from '@theme/Layout';
import { Gear } from '@phosphor-icons/react';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyFlexibleApiExample = createLazyExample(
  () => import('../../components/examples/FlexibleApiExample').then(m => ({ default: m.FlexibleApiExample }))
);

export default function FlexibleApiExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Flexible API Example"
      description="Advanced customization with the flexible API"
    >
      <main className="container margin-vert--lg">
        <h1><Gear size={32} weight="light" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />Flexible API Example</h1>
        <p>
          Demonstrates advanced customization with the flexible hooks-based API. Build your own
          custom UI with any component library while the library handles the audio engine.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <LazyFlexibleApiExample />
        </div>
      </main>
    </Layout>
  );
}
