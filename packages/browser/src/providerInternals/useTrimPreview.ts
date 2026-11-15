import { useRef, useState } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { ClipTrack, ValueSourceHandle } from '@waveform-playlist/core';
import { clipPeaksFor, type DerivePeaksOptions, type PeaksCache } from '../utils/derivePeaks';
import type { ClipPeaks } from '../WaveformPlaylistContext';

/**
 * A clip trim drag in progress (#812): where the dragged clip would be if the
 * pointer were released now. View-only: the tracks are not changed until the
 * release, which commits the same geometry through one `engine.trimClip`.
 */
export interface TrimPreview {
  trackId: string;
  clipId: string;
  startSample: number;
  durationSamples: number;
  offsetSamples: number;
}

/** The one place a trim drag in progress is kept: written by the drag handlers. */
export type TrimPreviewHandle = ValueSourceHandle<TrimPreview | null>;

/**
 * The drawing record of the clip a preview names, with the previewed
 * geometry. A stable object: reading it never re-renders; `peaksFor` reads the
 * provider's latest tracks and peak inputs when it is called.
 */
export interface TrimPreviewPeaksValue {
  /** `null` when no track or clip has the preview's ids. */
  peaksFor: (preview: TrimPreview) => ClipPeaks | null;
}

/** What `peaksFor` derives a previewed clip from: the provider's, as of its last render. */
export interface TrimPreviewInputs {
  /** The loaded tracks (no loading clip: a placeholder is never trimmed). */
  tracks: readonly ClipTrack[];
  peaksOptions: DerivePeaksOptions;
  /** The last pass of `derivePeaks`, so an unchanged geometry reuses its record. */
  peaksCacheRef: React.RefObject<PeaksCache>;
}

/** The previewed clip's record, by the same per-clip step as every other clip. */
export function previewedClipPeaks(
  preview: TrimPreview,
  { tracks, peaksOptions, peaksCacheRef }: TrimPreviewInputs
): ClipPeaks | null {
  const track = tracks.find((t) => t.id === preview.trackId);
  const clip = track?.clips.find((c) => c.id === preview.clipId);
  if (!track || !clip) return null;
  const previewed = {
    ...clip,
    startSample: preview.startSample,
    durationSamples: preview.durationSamples,
    offsetSamples: preview.offsetSamples,
  };
  const previous = peaksCacheRef.current.clips.get(clip.id);
  return clipPeaksFor(previewed, track.name, peaksOptions, previous).clipPeaks;
}

export interface TrimPreviewState {
  trimPreview: TrimPreviewHandle;
  trimPreviewPeaks: TrimPreviewPeaksValue;
}

/**
 * The trim preview of `WaveformPlaylistProvider`: the source, made once, and
 * the stable function that draws a previewed clip. Both are put in internal
 * contexts (`TrimPreviewContext`, `TrimPreviewPeaksContext`), read by
 * `useClipDragHandlers`, the clip view and the root.
 */
export function useTrimPreview(inputs: TrimPreviewInputs): TrimPreviewState {
  const [trimPreview] = useState<TrimPreviewHandle>(() =>
    createValueSource<TrimPreview | null>(null)
  );
  // The latest inputs, read when the dragged clip's view asks; a projection
  // of the provider's own values, never written back.
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const [trimPreviewPeaks] = useState<TrimPreviewPeaksValue>(() => ({
    peaksFor: (preview) => previewedClipPeaks(preview, inputsRef.current),
  }));
  return { trimPreview, trimPreviewPeaks };
}
