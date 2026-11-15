import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ValueSource } from '@waveform-playlist/core';
import { useTrimPreviewOptional, useTrimPreviewPeaksOptional } from '../contexts/playlistContexts';
import type { TrimPreview } from '../providerInternals/useTrimPreview';
import type { ClipPeaks } from '../WaveformPlaylistContext';
import { RECORDING_EXTENT_STEP_SECONDS } from './useRecordingLayout';

/**
 * How far the view is extended at a time while a trim is dragged past the
 * end of the timeline: the previewed end rounded UP to the next multiple (0 to
 * 10 seconds spare; not the recording layout's 10 to 20).
 */
const TRIM_EXTENT_STEP_SECONDS = RECORDING_EXTENT_STEP_SECONDS;

const NO_UNSUBSCRIBE = () => {};
/** Where there is no preview source: subscribed to nothing. */
const subscribeToNothing = () => NO_UNSUBSCRIBE;

/** `subscribe` for `useSyncExternalStore` over the trim preview, or over nothing. */
function useSubscribe(source: ValueSource<TrimPreview | null> | undefined) {
  // Called as a method (not detached), so a source written as a class works.
  return useMemo(
    () => (source ? (onChange: () => void) => source.subscribe(onChange) : subscribeToNothing),
    [source]
  );
}

/**
 * The clip to draw: `clip`, or while a trim of this clip is dragged, its
 * record for the previewed geometry (computed by `clipPeaksFor`, as every
 * clip's is). The snapshot is `null` unless the preview names this clip, so a
 * move renders the dragged clip's view and no other. Under the MediaElement
 * provider, or outside a provider, there is no preview and `clip` is drawn.
 */
export function usePreviewedClipPeaks(clip: ClipPeaks, trackId: string): ClipPeaks {
  const source = useTrimPreviewOptional()?.source;
  const peaks = useTrimPreviewPeaksOptional();
  const subscribe = useSubscribe(source);
  const clipId = clip.clipId;
  const getSnapshot = useCallback(() => {
    const preview = source?.getSnapshot() ?? null;
    return preview !== null && preview.clipId === clipId && preview.trackId === trackId
      ? preview
      : null;
  }, [source, clipId, trackId]);
  const preview = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // One record per preview object (and per committed record: a zoom or new
  // peaks during the drag change `clip`).
  return useMemo(
    () => (preview && peaks ? (peaks.peaksFor(preview) ?? clip) : clip),
    [preview, peaks, clip]
  );
}

/**
 * Where the view must end for a trim dragged past the end of the timeline, in
 * seconds: the previewed end rounded up to the next 10 seconds, or 0 when no
 * trim is dragged or it ends within `durationSeconds`. A selector that returns
 * the stepped number, so the caller renders once per step and not per move.
 */
export function useTrimPreviewExtent(sampleRate: number, durationSeconds: number): number {
  const source = useTrimPreviewOptional()?.source;
  const subscribe = useSubscribe(source);
  const getSnapshot = useCallback(() => {
    const preview = source?.getSnapshot() ?? null;
    if (preview === null || !(sampleRate > 0)) return 0;
    const endSeconds = (preview.startSample + preview.durationSamples) / sampleRate;
    if (endSeconds <= durationSeconds) return 0;
    return Math.ceil(endSeconds / TRIM_EXTENT_STEP_SECONDS) * TRIM_EXTENT_STEP_SECONDS;
  }, [source, sampleRate, durationSeconds]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
