import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">
          Multi-track audio editor for the web.<br />
          Built with React, Tone.js & Web Audio API.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/examples/stem-tracks">
            Try the Demo
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/installation">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Screenshot() {
  return (
    <section className={styles.screenshotSection}>
      <div className="container">
        <img
          src="/waveform-playlist/img/waveform-playlist.png"
          alt="Waveform Playlist Editor"
          className={styles.screenshot}
        />
      </div>
    </section>
  );
}

type FeatureItem = {
  title: string;
  description: ReactNode;
  icon: string;
  link?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Multi-Track Editing',
    icon: '🎛️',
    link: '/examples/multi-clip',
    description: (
      <>
        Drag clips, trim boundaries, split at playhead. Full timeline control
        with sample-accurate positioning and real-time collision detection.
      </>
    ),
  },
  {
    title: '20+ Audio Effects',
    icon: '🎚️',
    link: '/examples/effects',
    description: (
      <>
        Reverb, delay, chorus, phaser, distortion, filters and more.
        Real-time parameter tweaking with bypass controls.
      </>
    ),
  },
  {
    title: 'Recording',
    icon: '🎙️',
    link: '/examples/recording',
    description: (
      <>
        AudioWorklet-based recording with live waveform preview,
        VU meter, and automatic track creation.
      </>
    ),
  },
  {
    title: 'Export to WAV',
    icon: '💾',
    link: '/examples/effects',
    description: (
      <>
        Offline rendering with full effects. Export individual tracks
        or the complete mix as WAV files.
      </>
    ),
  },
  {
    title: 'Annotations',
    icon: '📝',
    link: '/examples/annotations',
    description: (
      <>
        Time-synced text annotations with keyboard navigation.
        Perfect for transcription and podcast editing.
      </>
    ),
  },
  {
    title: 'Fully Themeable',
    icon: '🎨',
    link: '/examples/styling',
    description: (
      <>
        Complete control over colors, fonts, and styling.
        Dark mode support out of the box.
      </>
    ),
  },
];

function Feature({title, description, icon, link}: FeatureItem) {
  const content = (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
    </div>
  );

  return (
    <div className={clsx('col col--4')}>
      {link ? (
        <Link to={link} className={styles.featureLink}>
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section className={styles.codeSection}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">Simple API</Heading>
            <p>
              Load tracks, control playback, add effects — all with clean React hooks.
              No complex configuration required.
            </p>
            <Link
              className="button button--primary"
              to="/docs/api/provider">
              View API Docs
            </Link>
          </div>
          <div className="col col--6">
            <pre className={styles.codeBlock}>
              <code>{`import { WaveformPlaylistProvider, Waveform }
  from '@waveform-playlist/browser';

function App() {
  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <PlayButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sponsors() {
  return (
    <section className={styles.sponsors}>
      <div className="container">
        <Heading as="h2" className={styles.sponsorsTitle}>Sponsors</Heading>
        <a href="https://moises.ai/" target="_blank" rel="noopener noreferrer">
          <img
            src="/waveform-playlist/img/logos/moises-ai.svg"
            alt="Moises.ai"
            className={styles.sponsorLogo}
          />
        </a>
        <p className={styles.sponsorCta}>
          <a href="https://github.com/sponsors/naomiaro" target="_blank" rel="noopener noreferrer">
            Become a sponsor →
          </a>
        </p>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Multi-track Web Audio Editor"
      description="A multi-track audio editor and player built with React, Tone.js, and the Web Audio API. Features canvas-based waveform visualization, drag-and-drop clip editing, and professional audio effects.">
      <HomepageHeader />
      <main>
        <Screenshot />
        <HomepageFeatures />
        <CodeExample />
        <Sponsors />
      </main>
    </Layout>
  );
}
