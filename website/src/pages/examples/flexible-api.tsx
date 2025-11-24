import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function FlexibleApiExample(): React.ReactElement {
  const bundleSrc = useBaseUrl('/js/flexible-example-bundle.js');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = bundleSrc;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [bundleSrc]);

  return (
    <Layout
      title="Flexible API Example"
      description="Advanced customization with the flexible API"
    >
      <main className="container margin-vert--lg">
        <h1>Flexible API Example</h1>
        <p>
          Demonstrates advanced customization options with custom track controls, timestamps,
          and complete UI control.
        </p>

        <div
          id="playlist"
          style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--ifm-color-emphasis-300)'
          }}
        ></div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>
            This example demonstrates:
          </p>
          <ul>
            <li>Custom track control rendering</li>
            <li>Custom timestamp formatting</li>
            <li>Custom UI components</li>
            <li>Advanced drag-and-drop</li>
            <li>Full theming customization</li>
            <li>Complete control over playlist behavior</li>
          </ul>
        </div>
      </main>
    </Layout>
  );
}
