import React from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

export default function Sponsors(): React.ReactNode {
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
