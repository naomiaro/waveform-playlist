import React from 'react';
import Layout from '@theme/Layout';
import { FlexibleApiExample } from '../../components/examples/FlexibleApiExample';

export default function FlexibleApiExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Flexible API Example"
      description="Advanced customization with the flexible API"
    >
      <main className="container margin-vert--lg">
        <h1>⚙️ Flexible API Example</h1>
        <p>
          Demonstrates advanced customization with the flexible hooks-based API. Build your own
          custom UI with any component library while the library handles the audio engine.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <FlexibleApiExample />
        </div>
      </main>
    </Layout>
  );
}
