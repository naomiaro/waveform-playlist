import { useMemo, useSyncExternalStore } from 'react';
import type { Arrangement, ArrangementSourcesValue } from '@waveform-playlist/engine';

/**
 * The audio sources the clips of `arrangement` name, and whether each is
 * pending, loaded or failed. The same object until a source settles or the
 * set of sources changes.
 */
export function useArrangementSources(arrangement: Arrangement): ArrangementSourcesValue {
  const store = useMemo(
    () => ({
      subscribe: (listener: () => void) => arrangement.sources.subscribe(() => listener()),
      getSnapshot: () => arrangement.sources.getSnapshot(),
    }),
    [arrangement]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
