import React, { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { usePlaylistSources } from '@waveform-playlist/browser';
import { isLoadingClip, type PlaylistTrack } from '@waveform-playlist/core';

export interface FailedDrop {
  /** The file name without its extension. */
  name: string;
  /** The error's message, shown as it is. */
  message: string;
}

const fileName = (blob: Blob): string =>
  typeof File !== 'undefined' && blob instanceof File
    ? blob.name.replace(/\.[^/.]+$/, '')
    : 'Untitled';

/**
 * A dropped or picked file that cannot be decoded is removed again, as the
 * example pages always did, and reported through `onFailed` (the page lists
 * it). Only tracks whose loading clip names a `File` / `Blob` are touched: a
 * URL from the page's own tracks that fails stays, and the page shows its error.
 *
 * Call it INSIDE `WaveformPlaylistProvider` (it reads `usePlaylistSources()`).
 * Each failed file is handled once, also under a StrictMode double effect.
 */
export function useRemoveFailedDrops(
  setTracks: Dispatch<SetStateAction<PlaylistTrack[]>>,
  onFailed: (failure: FailedDrop) => void
): void {
  const { sources } = usePlaylistSources();
  const handledRef = useRef(new WeakSet<Blob>());
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  useEffect(() => {
    const failed: Blob[] = [];
    const failures: FailedDrop[] = [];
    for (const [src, entry] of sources) {
      if (entry.status !== 'failed' || !(src instanceof Blob)) continue;
      if (handledRef.current.has(src)) continue;
      handledRef.current.add(src);
      failed.push(src);
      failures.push({ name: fileName(src), message: entry.error?.message ?? 'Unknown error' });
    }
    if (failed.length === 0) return;
    setTracks((prev) =>
      prev.filter(
        (track) =>
          !track.clips.some(
            (clip) => isLoadingClip(clip) && clip.src instanceof Blob && failed.includes(clip.src)
          )
      )
    );
    failures.forEach((failure) => onFailedRef.current(failure));
  }, [sources, setTracks]);
}

/** `Failed to load "name": message`, for a page's own error slot. */
export const failedDropText = (failure: FailedDrop): string =>
  `Failed to load "${failure.name}": ${failure.message}`;

/** `useRemoveFailedDrops` as a child that draws nothing. */
export function RemoveFailedDrops({
  setTracks,
  onFailed,
}: {
  setTracks: Dispatch<SetStateAction<PlaylistTrack[]>>;
  onFailed: (failure: FailedDrop) => void;
}): null {
  useRemoveFailedDrops(setTracks, onFailed);
  return null;
}

/** The list of failed files, in the style of the NewTracks page's alert. */
export function FailedDropsAlert({ failures }: { failures: readonly FailedDrop[] }) {
  if (failures.length === 0) return null;
  return (
    <div
      role="alert"
      style={{
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        background: 'var(--ifm-color-danger-contrast-background, #fdf0ef)',
        border: '1px solid var(--ifm-color-danger-dark, #c0392b)',
        borderRadius: '0.5rem',
        color: 'var(--ifm-color-danger-darkest, #7f1d1d)',
        fontSize: '0.875rem',
      }}
    >
      {failures.map((failure, i) => (
        <div key={i}>{failedDropText(failure)}</div>
      ))}
    </div>
  );
}
