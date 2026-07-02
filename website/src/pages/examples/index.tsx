import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {
  CircleNotchIcon,
  PaletteIcon,
  PlusCircleIcon,
  StackIcon,
  WaveTriangleIcon,
  SlidersHorizontalIcon,
  MicrophoneIcon,
  RowsIcon,
  TextAaIcon,
  LightningIcon,
  InfinityIcon,
  HeadphonesIcon,
  DeviceMobileIcon,
  GaugeIcon,
  WaveformIcon,
  MusicNotesIcon,
  MetronomeIcon,
  PlugsConnectedIcon,
} from '@phosphor-icons/react';
import styles from './examples.module.css';

// Example categories with icons and descriptions
const examples = [
  {
    title: 'Minimal',
    description: 'Pure essence. No distractions.',
    path: 'minimal',
    category: 'foundation',
    icon: <CircleNotchIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Styling',
    description: 'Shape the waveform. Own the aesthetic.',
    path: 'styling',
    category: 'foundation',
    icon: <PaletteIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'New Tracks',
    description: 'Dynamic. Ever-evolving.',
    path: 'newtracks',
    category: 'foundation',
    icon: <PlusCircleIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Stem Tracks',
    description: 'Layers upon layers. The full spectrum.',
    path: 'stem-tracks',
    category: 'playback',
    icon: <StackIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Fades',
    description: 'Smooth transitions. Controlled energy.',
    path: 'fades',
    category: 'playback',
    icon: <WaveTriangleIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Media Element',
    description: 'Stream audio. Control speed. Pitch preserved.',
    path: 'media-element',
    category: 'playback',
    icon: <GaugeIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Effects',
    description: 'Transform. Distort. Elevate.',
    path: 'effects',
    category: 'effects',
    icon: <SlidersHorizontalIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'WAM! Kick It Up a Notch',
    description: 'Community plugins. Native GUIs. Plugged in.',
    path: 'wam-effects',
    category: 'effects',
    icon: <PlugsConnectedIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Recording',
    description: 'Capture the moment. Live.',
    path: 'recording',
    category: 'advanced',
    icon: <MicrophoneIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Multi-Clip',
    description: 'Arrange. Rearrange. Create.',
    path: 'multi-clip',
    category: 'advanced',
    icon: <RowsIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Beats & Bars',
    description: 'Tempo-locked. Snap to the grid.',
    path: 'beats-and-bars',
    category: 'advanced',
    icon: <MetronomeIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Annotations',
    description: 'Mark the drops. Remember the builds.',
    path: 'annotations',
    category: 'tools',
    icon: <TextAaIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'BBC Waveform',
    description: 'Pre-computed peaks. Instant load.',
    path: 'waveform-data',
    category: 'tools',
    icon: <LightningIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Flexible API',
    description: 'Total control. Unlimited possibilities.',
    path: 'flexible-api',
    category: 'tools',
    icon: <InfinityIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Stereo',
    description: 'Left and right. The full dimension.',
    path: 'stereo',
    category: 'foundation',
    icon: <HeadphonesIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Mobile Multi-Clip',
    description: 'Touch-optimized. Swipe to scroll, hold to drag.',
    path: 'mobile-multi-clip',
    category: 'mobile',
    icon: <DeviceMobileIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'Mobile Annotations',
    description: 'Tap to play. Hold to resize boundaries.',
    path: 'mobile-annotations',
    category: 'mobile',
    icon: <TextAaIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'MIDI Playback',
    description: 'Notes become sound. Synthesized live.',
    path: 'midi',
    category: 'playback',
    icon: <MusicNotesIcon weight="light" aria-hidden="true" />,
  },
  {
    title: 'MIR Spectrogram',
    description: 'Frequency domain. Full spectrum analysis.',
    path: 'mir-spectrogram',
    category: 'tools',
    icon: <WaveformIcon weight="light" aria-hidden="true" />,
  },
];

// Floating particle component
const Particle: React.FC<{ delay: number; duration: number; size: number }> = ({
  delay,
  duration,
  size,
}) => (
  <div
    className={styles.particle}
    style={
      {
        '--delay': `${delay}s`,
        '--duration': `${duration}s`,
        '--size': `${size}px`,
        left: `${Math.random() * 100}%`,
      } as React.CSSProperties
    }
  />
);

// Waveform SVG decoration
const WaveformDecoration: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`${styles.waveformSvg} ${className || ''}`}
    viewBox="0 0 200 60"
    preserveAspectRatio="none"
  >
    <defs>
      <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--ifm-color-primary)" stopOpacity="0.1" />
        <stop offset="50%" stopColor="var(--ifm-color-primary)" stopOpacity="0.4" />
        <stop offset="100%" stopColor="var(--ifm-color-primary)" stopOpacity="0.1" />
      </linearGradient>
    </defs>
    {[...Array(40)].map((_, i) => {
      const height = Math.max(2, 10 + Math.sin(i * 0.5) * 20 + Math.random() * 15);
      return (
        <rect
          key={i}
          x={i * 5}
          y={30 - height / 2}
          width="3"
          height={height}
          fill="url(#waveGradient)"
          className={styles.waveBar}
          style={{ '--bar-delay': `${i * 0.02}s` } as React.CSSProperties}
        />
      );
    })}
  </svg>
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
    <circle
      cx="100"
      cy="100"
      r="60"
      fill="none"
      stroke="var(--ifm-color-primary)"
      strokeWidth="0.5"
      opacity="0.2"
      className={styles.pulseCircle}
    />
    <circle
      cx="100"
      cy="100"
      r="40"
      fill="none"
      stroke="var(--ifm-color-primary)"
      strokeWidth="0.5"
      opacity="0.3"
      className={styles.pulseCircle2}
    />
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

export default function Examples(): React.ReactElement {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const categories = [
    { id: 'foundation', title: 'Foundation', subtitle: 'Where it begins' },
    { id: 'playback', title: 'Playback', subtitle: 'Feel the flow' },
    { id: 'effects', title: 'Effects', subtitle: 'Shape the signal' },
    { id: 'advanced', title: 'Advanced', subtitle: 'Push the limits' },
    { id: 'tools', title: 'Tools', subtitle: 'Precision instruments' },
    { id: 'mobile', title: 'Smaller Screens', subtitle: 'Big vision, compact canvas' },
  ];

  return (
    <Layout
      title="Examples"
      description="Interactive demos of Waveform Playlist - multi-track editing, effects, recording, annotations, and more"
    >
      <Head>
        <meta property="og:title" content="Examples - Waveform Playlist" />
        <meta
          property="og:description"
          content="Interactive demos of Waveform Playlist - multi-track editing, effects, recording, annotations, and more"
        />
        <meta
          property="og:image"
          content="https://naomiaro.github.io/waveform-playlist/img/social/waveform-playlist-examples.png"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Examples - Waveform Playlist" />
        <meta
          name="twitter:description"
          content="Interactive demos of Waveform Playlist - multi-track editing, effects, recording, annotations, and more"
        />
        <meta
          name="twitter:image"
          content="https://naomiaro.github.io/waveform-playlist/img/social/waveform-playlist-examples.png"
        />
      </Head>
      {/* Hero Section */}
      <div className={styles.heroSection}>
        <div className={styles.heroBackground}>
          {/* Parallax layers */}
          <div
            className={styles.parallaxLayer1}
            style={{ transform: mounted ? `translateY(${scrollY * 0.5}px)` : 'none' }}
          />
          <div
            className={styles.parallaxLayer2}
            style={{ transform: mounted ? `translateY(${scrollY * 0.3}px)` : 'none' }}
          />
          <div
            className={styles.parallaxLayer3}
            style={{ transform: mounted ? `translateY(${scrollY * 0.1}px)` : 'none' }}
          />

          {/* Floating particles */}
          <div className={styles.particleContainer}>
            {mounted &&
              [...Array(20)].map((_, i) => (
                <Particle
                  key={i}
                  delay={Math.random() * 10}
                  duration={15 + Math.random() * 10}
                  size={2 + Math.random() * 4}
                />
              ))}
          </div>

          {/* SVG decorations */}
          <WaveformDecoration className={styles.heroWave1} />
          <WaveformDecoration className={styles.heroWave2} />
          <CircularVisualizer className={styles.heroCircle} />
          <EqualizerBars className={styles.heroEq} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroGlitch} data-text="EXAMPLES">
            EXAMPLES
          </div>
          <p className={styles.heroSubtitle}>
            Enter the sonic laboratory.
            <br />
            Each example is a portal to new possibilities.
          </p>
        </div>

        <div className={styles.scrollIndicator}>
          <span>Scroll to explore</span>
          <div className={styles.scrollArrow}>↓</div>
        </div>
      </div>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {categories.map((category, catIndex) => {
          const categoryExamples = examples.filter((e) => e.category === category.id);
          return (
            <section
              key={category.id}
              className={styles.categorySection}
              style={{ '--section-index': catIndex } as React.CSSProperties}
            >
              <div className={styles.categoryHeader}>
                <span className={styles.categoryNumber}>0{catIndex + 1}</span>
                <h2 className={styles.categoryTitle}>{category.title}</h2>
                <span className={styles.categorySubtitle}>{category.subtitle}</span>
              </div>

              <div className={styles.examplesGrid}>
                {categoryExamples.map((example, index) => (
                  <Link
                    key={example.path}
                    to={`/examples/${example.path}`}
                    className={styles.exampleCard}
                    style={{ '--card-index': index } as React.CSSProperties}
                  >
                    <div className={styles.cardGlow} />
                    <div className={styles.cardContent}>
                      <span className={styles.cardIcon}>{example.icon}</span>
                      <h3 className={styles.cardTitle}>{example.title}</h3>
                      <p className={styles.cardDescription}>{example.description}</p>
                      <span className={styles.cardArrow}>→</span>
                    </div>
                    <div className={styles.cardBorder} />
                  </Link>
                ))}
              </div>

              {/* Section decoration */}
              <div className={styles.sectionDecoration}>
                {catIndex % 2 === 0 ? (
                  <WaveformDecoration className={styles.sectionWave} />
                ) : (
                  <EqualizerBars className={styles.sectionEq} />
                )}
              </div>
            </section>
          );
        })}

        {/* Bottom CTA */}
        <section className={styles.ctaSection}>
          <CircularVisualizer className={styles.ctaViz} />
          <div className={styles.ctaContent}>
            <h2>Ready to create?</h2>
            <p>Start with the docs or dive straight into the code.</p>
            <div className={styles.ctaButtons}>
              <Link to="/docs" className={styles.ctaButton}>
                Read the Docs
              </Link>
              <a
                href="https://github.com/naomiaro/waveform-playlist"
                className={styles.ctaButtonSecondary}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
