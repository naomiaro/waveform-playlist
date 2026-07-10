/**
 * Tone.js-specific fade helpers. Pure fade utilities (curves, applyFadeIn/
 * applyFadeOut) live in @waveform-playlist/core — import them from there
 * directly (repo rule: no cross-package re-exports).
 */

/**
 * Access the underlying Web Audio AudioParam from a Tone.js Signal/Param wrapper.
 *
 * Tone.js wraps native AudioParam in its Signal class, but sometimes we need
 * direct access to the raw AudioParam for setValueAtTime/cancelScheduledValues
 * (e.g., when the AudioContext is suspended and Tone.js Signal doesn't propagate).
 *
 * This uses `_param` which is a private Tone.js 15.x internal.
 * Pin the Tone.js version carefully if upgrading.
 *
 * @param signal - A Tone.js Signal or Param wrapper (e.g., `gain.gain`)
 * @returns The underlying AudioParam, or undefined if not found
 */
let hasWarned = false;

export function getUnderlyingAudioParam(signal: unknown): AudioParam | undefined {
  const param = (signal as { _param?: AudioParam } | null | undefined)?._param;
  if (!param && !hasWarned) {
    hasWarned = true;
    console.warn(
      '[waveform-playlist] Unable to access Tone.js internal _param. ' +
        'This likely means the Tone.js version is incompatible. ' +
        'Mute scheduling may not work correctly.'
    );
  }
  return param;
}
