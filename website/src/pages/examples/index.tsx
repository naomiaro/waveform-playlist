import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const examples = [
  {
    title: 'Minimal',
    description: 'Basic waveform display with playback controls',
    path: 'minimal',
  },
  {
    title: 'New Tracks',
    description: 'Add and remove tracks dynamically',
    path: 'newtracks',
  },
  {
    title: 'Annotations',
    description: 'Interactive waveform annotations',
    path: 'annotations',
  },
  {
    title: 'Stem Tracks',
    description: 'Multi-track stem playback',
    path: 'stem-tracks',
  },
  {
    title: 'Effects',
    description: 'Audio effects and processing',
    path: 'effects',
  },
  {
    title: 'Recording',
    description: 'Multi-track recording with microphone input',
    path: 'recording',
  },
  {
    title: 'Multi-Clip',
    description: 'Multiple clips per track with drag and drop',
    path: 'multi-clip',
  },
  {
    title: 'Flexible API',
    description: 'Advanced API usage and customization',
    path: 'flexible-api',
  },
];

export default function Examples(): React.ReactElement {
  return (
    <Layout
      title="Examples"
      description="Interactive examples of Waveform Playlist features"
    >
      <main className="container margin-vert--lg">
        <h1>Examples</h1>
        <p>
          Explore interactive examples showcasing different features of Waveform Playlist.
          Each example demonstrates specific functionality and can be used as a starting point
          for your own implementation.
        </p>

        <div className="row">
          {examples.map((example) => (
            <div key={example.path} className="col col--4 margin-bottom--lg">
              <div className="card">
                <div className="card__header">
                  <h3>{example.title}</h3>
                </div>
                <div className="card__body">
                  <p>{example.description}</p>
                </div>
                <div className="card__footer">
                  <Link
                    className="button button--primary button--block"
                    to={`/examples/${example.path}`}
                  >
                    View Example
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
