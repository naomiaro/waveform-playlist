import React, { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {
  WaveformIcon,
  SlidersHorizontalIcon,
  MicrophoneIcon,
  ExportIcon,
  TextAaIcon,
  PaletteIcon,
} from '@phosphor-icons/react';

import styles from './index.module.css';

// Floating particle component
const Particle: React.FC<{ delay: number; duration: number; size: number }> = ({ delay, duration, size }) => (
  <div
    className={styles.particle}
    style={{
      '--delay': `${delay}s`,
      '--duration': `${duration}s`,
      '--size': `${size}px`,
      left: `${Math.random() * 100}%`,
    } as React.CSSProperties}
  />
);

// Equalizer bars SVG
const EqualizerBars: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${styles.equalizer} ${className || ''}`} viewBox="0 0 100 100">
    {[...Array(8)].map((_, i) => (
      <rect
        key={i}
        x={i * 12 + 4}
        y="20"
        width="8"
        height="60"
        fill="var(--ifm-color-primary)"
        opacity="0.3"
        className={styles.eqBar}
        style={{ '--eq-delay': `${i * 0.1}s` } as React.CSSProperties}
      />
    ))}
  </svg>
);

// Circular visualizer
const CircularVisualizer: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${styles.circularViz} ${className || ''}`} viewBox="0 0 200 200">
    <defs>
      <radialGradient id="circleGrad">
        <stop offset="0%" stopColor="var(--ifm-color-primary)" stopOpacity="0.3" />
        <stop offset="100%" stopColor="var(--ifm-color-primary)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="80" fill="none" stroke="url(#circleGrad)" strokeWidth="1" />
    <circle cx="100" cy="100" r="60" fill="none" stroke="var(--ifm-color-primary)" strokeWidth="0.5" opacity="0.2" className={styles.pulseCircle} />
    <circle cx="100" cy="100" r="40" fill="none" stroke="var(--ifm-color-primary)" strokeWidth="0.5" opacity="0.3" className={styles.pulseCircle2} />
    {[...Array(24)].map((_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      const innerR = 85;
      const outerR = 95 + Math.sin(i * 2) * 5;
      return (
        <line
          key={i}
          x1={100 + Math.cos(angle) * innerR}
          y1={100 + Math.sin(angle) * innerR}
          x2={100 + Math.cos(angle) * outerR}
          y2={100 + Math.sin(angle) * outerR}
          stroke="var(--ifm-color-primary)"
          strokeWidth="2"
          opacity="0.4"
          className={styles.vizLine}
          style={{ '--line-delay': `${i * 0.05}s` } as React.CSSProperties}
        />
      );
    })}
  </svg>
);

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={clsx('hero', styles.heroBanner)}>
      {/* Background layers */}
      <div className={styles.heroBackground}>
        <div
          className={styles.parallaxLayer1}
          style={{ transform: mounted ? `translateY(${scrollY * 0.3}px)` : 'none' }}
        />
        <div
          className={styles.parallaxLayer2}
          style={{ transform: mounted ? `translateY(${scrollY * 0.15}px)` : 'none' }}
        />

        {/* Floating particles */}
        <div className={styles.particleContainer}>
          {mounted && [...Array(15)].map((_, i) => (
            <Particle
              key={i}
              delay={Math.random() * 10}
              duration={15 + Math.random() * 10}
              size={2 + Math.random() * 3}
            />
          ))}
        </div>

        {/* SVG decorations */}
        <CircularVisualizer className={styles.heroCircle} />
        <EqualizerBars className={styles.heroEq} />
      </div>

      <div className={styles.heroContent}>
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>
          Multi-track audio editor for the web.<br />
          Built with React & Tone.js.
        </p>
        <div className={styles.buttons}>
          <Link
            className={styles.primaryButton}
            to="/examples/stem-tracks">
            Try the Demo
          </Link>
          <Link
            className={styles.secondaryButton}
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
  icon: React.ReactNode;
  link?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Multi-Track Editing',
    icon: <WaveformIcon weight="light" />,
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
    icon: <SlidersHorizontalIcon weight="light" />,
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
    icon: <MicrophoneIcon weight="light" />,
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
    icon: <ExportIcon weight="light" />,
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
    icon: <TextAaIcon weight="light" />,
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
    icon: <PaletteIcon weight="light" />,
    link: '/examples/styling',
    description: (
      <>
        Complete control over colors, fonts, and styling.
        Dark mode support out of the box.
      </>
    ),
  },
];

function Feature({ title, description, icon, link }: FeatureItem) {
  const content = (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
      <span className={styles.featureArrow}>→</span>
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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>01</span>
          <h2 className={styles.sectionTitle}>Features</h2>
          <span className={styles.sectionSubtitle}>What you can build</span>
        </div>
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
        <div className={styles.sectionHeader}>
          <span className={styles.sectionNumber}>02</span>
          <h2 className={styles.sectionTitle}>Simple API</h2>
          <span className={styles.sectionSubtitle}>Get started in minutes</span>
        </div>
        <div className="row">
          <div className="col col--6">
            <p className={styles.codeDescription}>
              Load tracks, control playback, add effects — all with clean React hooks.
              No complex configuration required.
            </p>
            <Link
              className={styles.primaryButton}
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

export default function Home(): ReactNode {
  return (
    <Layout
      title="Multi-track Web Audio Editor"
      description="A multi-track audio editor and player built with React and Tone.js. Features canvas-based waveform visualization, drag-and-drop clip editing, and professional audio effects.">
      <HomepageHeader />
      <main>
        <Screenshot />
        <HomepageFeatures />
        <CodeExample />
      </main>
    </Layout>
  );
}
