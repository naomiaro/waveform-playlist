import { useSyncExternalStore } from 'react';
import type { ValueSource } from '@waveform-playlist/core';
import type { ActiveEffect } from '../effects/effectsRack';

/**
 * The effects of one chain, as React state: `effects` from
 * `useDynamicEffects()`, or `getTrackEffects(trackId)` from
 * `useTrackDynamicEffects()`. The calling component re-renders when that
 * chain changes (an effect added, removed, moved, bypassed, or a parameter
 * set), so call it in the component that draws the chain, not at the root of
 * the page.
 */
export function useActiveEffects(effects: ValueSource<ActiveEffect[]>): ActiveEffect[] {
  return useSyncExternalStore(effects.subscribe, effects.getSnapshot, effects.getSnapshot);
}
