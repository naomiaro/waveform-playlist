/**
 * Source Load Error
 *
 * What the example pages show when an audio file of their arrangement failed
 * to load: the error message and a Retry button, inline next to the page's
 * controls. Nothing while every source is pending or loaded.
 *
 * Only files the page declares (a URL) are offered a Retry. A dropped file (a
 * File or Blob source) that failed is never shown here: its track is removed
 * and the file listed by `useFailedDrops` / `FailedDropsAlert`.
 */

import React from 'react';
import { useArrangementSources } from '@waveform-playlist/browser';
import type { Arrangement, ArrangementSourcesValue } from '@waveform-playlist/engine';

export interface FailedSource {
  /** A declared source: always a URL. */
  src: string;
  message: string;
}

const FALLBACK_MESSAGE = 'The audio could not be loaded';

const ERROR_STYLE = { fontSize: '0.875rem', color: 'red' } as const;

/** The first declared (URL) source of `value` whose load failed, or null. Dropped files are skipped. */
export function findFailedSource(value: ArrangementSourcesValue): FailedSource | null {
  for (const [src, state] of value.sources) {
    if (typeof src === 'string' && state.status === 'failed') {
      return { src, message: state.error?.message ?? FALLBACK_MESSAGE };
    }
  }
  return null;
}

interface SourceLoadErrorProps {
  arrangement: Arrangement;
}

export const SourceLoadError: React.FC<SourceLoadErrorProps> = ({ arrangement }) => {
  const failed = findFailedSource(useArrangementSources(arrangement));
  if (!failed) return null;
  return (
    <span style={ERROR_STYLE}>
      Error loading audio: {failed.message}{' '}
      <button type="button" onClick={() => arrangement.retry(failed.src)}>
        Retry
      </button>
    </span>
  );
};
