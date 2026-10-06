import React from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

export default function Partners(): React.ReactNode {
  return (
    <section className={styles.partners}>
      <div className="container">
        <Heading as="h2" className={styles.partnersTitle}>In Partnership With</Heading>
        <a href="https://www.telecom-paris.fr/" target="_blank" rel="noopener noreferrer">
          <img
            src="/waveform-playlist/img/logos/telecom-paris.svg"
            alt="Télécom Paris"
            className={styles.partnerLogo}
          />
        </a>
      </div>
    </section>
  );
}
