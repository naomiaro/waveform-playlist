/**
 * Failed Drops
 *
 * For the example pages that take dropped audio files: a dropped file whose
 * audio could not be loaded is taken out of the arrangement again (not an
 * undo step, so no undo brings it back) and listed by name with its error.
 * Only dropped files (a File or Blob source) are removed; a file the page
 * declares (a URL) stays, and <SourceLoadError> offers a Retry for it.
 */

import React, { useEffect, useState } from 'react';
import { useArrangementSources } from '@waveform-playlist/browser';
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipSource, LoadingClip } from '@waveform-playlist/core';
import type { Arrangement, ArrangementSourceState } from '@waveform-playlist/engine';

export interface FailedDrop {
  name: string;
  message: string;
}

const FALLBACK_MESSAGE = 'The audio could not be loaded';

const ALERT_STYLE = {
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  background: 'var(--ifm-color-danger-contrast-background, #fdf0ef)',
  border: '1px solid var(--ifm-color-danger-dark, #c0392b)',
  borderRadius: '0.5rem',
  color: 'var(--ifm-color-danger-darkest, #7f1d1d)',
  fontSize: '0.875rem',
} as const;

const isDroppedFile = (src: ClipSource): boolean => typeof src !== 'string';

/** The clip of `track` that waits for a source in `failed`, if any. */
const clipWaitingFor = (
  track: ArrangementTrack,
  failed: ReadonlyMap<ClipSource, ArrangementSourceState>
): LoadingClip | undefined =>
  track.clips.find((c): c is LoadingClip => isLoadingClip(c) && failed.has(c.src));

/**
 * Removes every track of `arrangement` that waits for a dropped file whose
 * load failed, from an effect over the arrangement's sources (never from a
 * subscribe listener), and returns the files removed so far.
 */
export function useFailedDrops(arrangement: Arrangement): readonly FailedDrop[] {
  const sources = useArrangementSources(arrangement);
  const [drops, setDrops] = useState<readonly FailedDrop[]>([]);

  useEffect(() => {
    const failed = new Map(
      Array.from(sources.sources).filter(
        ([src, state]) => state.status === 'failed' && isDroppedFile(src)
      )
    );
    if (failed.size === 0) return;
    const removed = arrangement.getTracks().flatMap((track) => {
      const clip = clipWaitingFor(track, failed);
      return clip ? [{ track, clip }] : [];
    });
    if (removed.length === 0) return;
    const newDrops = removed.map(({ track, clip }) => ({
      name: track.name,
      message: failed.get(clip.src)?.error?.message ?? FALLBACK_MESSAGE,
    }));
    removed.forEach(({ track }) => arrangement.removeTrack(track.id, { undoable: false }));
    setDrops((prev) => [...prev, ...newDrops]);
  }, [arrangement, sources]);

  return drops;
}

interface FailedDropsAlertProps {
  drops: readonly FailedDrop[];
}

/** The list of dropped files that could not be loaded; nothing while there are none. */
export const FailedDropsAlert: React.FC<FailedDropsAlertProps> = ({ drops }) => {
  if (drops.length === 0) return null;
  return (
    <div role="alert" style={ALERT_STYLE}>
      {drops.map((drop, i) => (
        <div key={i}>
          Failed to load &quot;{drop.name}&quot;: {drop.message}
        </div>
      ))}
    </div>
  );
};
