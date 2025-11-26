import React from 'react';

type TrackName = 'ubiquitous' | 'whiptails' | 'both';

interface AudioCreditsProps {
  track?: TrackName;
}

/**
 * Audio credits component for example pages
 * Links to Cambridge Music Technology multitrack library
 */
export function AudioCredits({ track = 'both' }: AudioCreditsProps): React.ReactElement {
  const trackInfo = {
    ubiquitous: '"Ubiquitous"',
    whiptails: '"Whiptails"',
    both: '"Ubiquitous" and "Whiptails"',
  };

  return (
    <div
      style={{
        marginTop: '3rem',
        padding: '1rem 1.5rem',
        background: 'var(--ifm-color-emphasis-100)',
        borderRadius: '6px',
        borderLeft: '3px solid var(--ifm-color-primary)',
        fontSize: '0.9rem',
        color: 'var(--ifm-color-emphasis-700)',
      }}
    >
      <strong style={{ color: 'var(--ifm-color-emphasis-800)' }}>Audio Credits:</strong>{' '}
      {trackInfo[track]} by{' '}
      <a
        href="https://cambridge-mt.com/ms3/mtk/#AlbertKader"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontWeight: 500 }}
      >
        Albert Kader
      </a>
      {' '}— Minimal Techno stems from the{' '}
      <a
        href="https://cambridge-mt.com/ms3/mtk/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Cambridge Music Technology
      </a>
      {' '}multitrack library. Licensed under{' '}
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noopener noreferrer"
      >
        CC BY 4.0
      </a>.
    </div>
  );
}
