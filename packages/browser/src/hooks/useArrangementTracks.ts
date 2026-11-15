import { useMemo, useSyncExternalStore } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';
import type { ArrangementTrack } from '@waveform-playlist/core';

/**
 * The tracks of `arrangement`, loaded and loading clips alike. The same
 * array until the tracks change: a mix change (volume, mute, solo, pan)
 * does not re-render. Never write to what it returns.
 */
export function useArrangementTracks(arrangement: Arrangement): readonly ArrangementTrack[] {
  const store = useMemo(
    () => ({
      subscribe: (listener: () => void) => arrangement.subscribe(listener),
      getSnapshot: () => arrangement.getTracks(),
    }),
    [arrangement]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
