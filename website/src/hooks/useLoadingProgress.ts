import { usePlaylistSources } from '@waveform-playlist/browser';

export interface LoadingProgress {
  /** Sources that have loaded (or failed: they are done too). */
  settledCount: number;
  /** Every source the tracks name. */
  totalCount: number;
  isLoading: boolean;
  /** The message of the first source that failed, or null. */
  errorMessage: string | null;
}

/**
 * "Loading: 3/7" for the example pages, from the provider's source status.
 * Call it in a component INSIDE `WaveformPlaylistProvider`.
 */
export function useLoadingProgress(): LoadingProgress {
  const { sources, pendingCount, isLoading } = usePlaylistSources();
  let errorMessage: string | null = null;
  for (const entry of sources.values()) {
    if (entry.status === 'failed') {
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
