import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { isToneAdapter, type SoundFontCache } from '@waveform-playlist/playout';

/**
 * Forward a (possibly late-loaded or swapped) SoundFontCache to the live
 * adapter. Safe no-op when the adapter is absent or doesn't support
 * soundfonts. The adapter itself skips MIDI tracks whose routing is
 * unchanged, so redundant calls (e.g. on mount) cause no rebuild churn.
 */
export function syncSoundFontCacheToAdapter(
  adapter: PlayoutAdapter | null,
  cache: SoundFontCache | undefined
): void {
  if (!isToneAdapter(adapter)) return;
  adapter.setSoundFontCache(cache);
}
