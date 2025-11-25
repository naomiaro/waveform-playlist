import React from 'react';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function Sponsors(): React.ReactNode {
  return (
    <section className={styles.sponsors}>
      <div className="container">
        <Heading as="h2">Sponsors</Heading>
        <div className={styles.sponsorLogos}>
          <a
            href="https://moises.ai/"
            target="_blank"
            rel="sponsored noopener noreferrer"
          >
            <img
              src={useBaseUrl('/img/logos/moises-ai.svg')}
              alt="Moises AI"
              width={120}
              className={styles.sponsorLogo}
            />
          </a>
        </div>
      </div>
    </section>
  );
}
