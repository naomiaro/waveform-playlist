import type { Panner } from 'tone';

/**
 * Let a track's panner follow the channel layout of what feeds it.
 *
 * Tone's `Panner` is `channelCountMode: 'explicit'` with a fixed
 * `channelCount`, sized from the track's SOURCE material (1 for mono clips
 * and synth voices). With pre-fader effects (#660) the panner is fed by the
 * effects chain instead, and a mono track with a stereo effect (reverb,
 * ping-pong delay, most WAM plugins) would have that effect downmixed to
 * mono before panning.
 *
 * `clamped-max` with a count of 2 keeps a mono signal mono (same equal-power
 * pan law and level as before) and passes a stereo signal through as stereo —
 * the behaviour of a plain native `StereoPannerNode`, and of
 * `@dawcore/transport`'s track node.
 *
 * Only possible on a NATIVE context (`configureGlobalContext({
 * nativeAudioContext: true })`). standardized-audio-context — Tone's default —
 * locks a StereoPanner's channelCountMode to 'explicit' (its Safari polyfill
 * cannot implement clamped-max) and throws NotSupportedError on any change.
 * There the panner keeps its source-sized layout: levels and pan law are
 * exactly as without effects, but a stereo effect on a mono track is summed
 * to mono. Forcing an explicit count of 2 instead would preserve the width
 * at the cost of re-lawing EVERY mono track with effects (+3 dB at centre,
 * +6 dB hard-panned), which is the worse trade.
 *
 * @returns whether the layout was switched (false on standardized-audio-context)
 */
export function followInsertChannelLayout(panNode: Panner): boolean {
  try {
    // Mode first: it is the assignment that can throw, and a count of 2 under
    // the still-explicit mode would upmix (and re-law) mono tracks.
    panNode.channelCountMode = 'clamped-max';
  } catch {
    return false;
  }
  panNode.channelCount = 2;
  return true;
}

/** Undo `followInsertChannelLayout`: back to Tone's fixed, source-sized layout. */
export function restoreSourceChannelLayout(panNode: Panner, channelCount: number): void {
  // Count first, so the explicit mode never sees the widened count.
  panNode.channelCount = channelCount;
  panNode.channelCountMode = 'explicit';
}
