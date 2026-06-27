import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '@waveform-playlist/playout';

/** Adapters that accept a SoundFontCache (e.g. the Tone.js adapter). */
interface SoundFontCapableAdapter {
  setSoundFontCache(cache: SoundFontCache | undefined): void;
}

/**
 * Structural check for soundfont support — avoids a runtime import of
 * `@waveform-playlist/playout`. `isToneAdapter` from playout does the same
 * structural check (via optional chaining); our local `supportsSoundFont`
 * adds an explicit `adapter != null` guard. Keeping it structural lets the
 * core barrel stay engine-free (#510) and works for any custom adapter that
 * exposes `setSoundFontCache`.
 */
function supportsSoundFont(
  adapter: PlayoutAdapter | null
): adapter is PlayoutAdapter & SoundFontCapableAdapter {
  return (
    adapter != null &&
    typeof (adapter as Partial<SoundFontCapableAdapter>).setSoundFontCache === 'function'
  );
}

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
  if (!supportsSoundFont(adapter)) return;
  adapter.setSoundFontCache(cache);
}
