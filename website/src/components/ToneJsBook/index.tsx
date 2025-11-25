import React from 'react';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function ToneJsBook(): React.ReactNode {
  return (
    <section className={styles.bookSection}>
      <div className="container">
        <div className={styles.bookContent}>
          <Heading as="h2">Learn More About Tone.js</Heading>
          <a
            href="https://masteringtonejs.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={useBaseUrl('/img/title_page.png')}
              alt="Mastering Tone.js Book"
              width={200}
              className={styles.bookCover}
            />
          </a>
          <p className={styles.bookDescription}>
            Want to dive deeper into Web Audio? Check out{' '}
            <a
              href="https://masteringtonejs.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>Mastering Tone.js</strong>
            </a>{' '}
            - a comprehensive guide to building interactive audio applications
            with Tone.js.
          </p>
        </div>
      </div>
    </section>
  );
}
