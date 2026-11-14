import { usePlaylistSources } from '@waveform-playlist/browser';

export interface LoadingProgress {
  /** Sources that have loaded (or failed: they are done too). */
  settledCount: number;
  /** Every source the tracks name. */
  totalCount: number;
  isLoading: boolean;
  /**
   * The message of the first URL source that failed, or null. It is the
   * error's message as it is, shown verbatim on the page: an app with its own
   * `loadSource` must not put a URL with a token in its errors. A dropped file
   * that fails is not counted here: `useRemoveFailedDrops` removes and lists it.
   */
  errorMessage: string | null;
}

/**
 * "Loading: 3/7" for the example pages, from the provider's source status.
 * Call it in a component INSIDE `WaveformPlaylistProvider`.
 */
export function useLoadingProgress(): LoadingProgress {
  const { sources, pendingCount, isLoading } = usePlaylistSources();
  let errorMessage: string | null = null;
  for (const [src, entry] of sources) {
    if (entry.status === 'failed' && typeof src === 'string') {
      errorMessage = entry.error?.message ?? 'unknown error';
      break;
    }
  }
  return {
    settledCount: sources.size - pendingCount,
    totalCount: sources.size,
    isLoading,
    errorMessage,
  };
}
