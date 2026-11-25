/**
 * The two points where something attaches to an arrangement: a context to
 * decode audio with, and an engine's time base.
 *
 * They are reached through `Symbol.for` keys, not through `instanceof` or a
 * method name. An app whose own version of this package differs from the one
 * a library pins has two copies installed, and an arrangement made by one
 * copy must be playable by an engine of the other: `Symbol.for` gives both
 * copies the same key.
 *
 * The keys carry a version. An engine that finds the time-base key treats
 * the object as an arrangement of this version and uses it BY NAME: the
 * whole public `Arrangement` interface (every track, clip, mixer, arm and
 * history method it delegates to, `getTracks`, `getMixer`, `armedTrackIds`,
 * the two version counters) and the internal `onChange(listener)` (with the
 * `ArrangementChange` and `ArrangementVersions` shapes of this version),
 * `recomputeStartSamples()` and `undoLimit`. A change to any of that needs a
 * new key, so that copies which do not agree refuse each other instead of
 * misreading each other.
 *
 * v2 (#843): the mixer setters take options and are undo steps, the history
 * holds the mix (`'restoreMix'`), and the arrangement has the recording arm
 * (`setTrackArmed`, `armedTrackIds`, `'arm'`).
 */

import type { Arrangement } from './types';

export const ARRANGEMENT_ATTACH_DECODE = Symbol.for(
  '@waveform-playlist/engine/arrangement/attach-decode/v2'
);
export const ARRANGEMENT_ATTACH_TIME_BASE = Symbol.for(
  '@waveform-playlist/engine/arrangement/time-base/v2'
);

/** How the arrangement converts time. The engine provides it from its adapter and tempo. */
export interface ArrangementTimeBase {
  sampleRate: number;
  /** The unit of the ticks this time base converts to and from: ticks per quarter note. */
  ppqn: number;
  secondsToTicks(seconds: number): number;
  ticksToSeconds(tick: number): number;
}

export type GetDecodeContext = () => Promise<BaseAudioContext>;

interface AttachPoints {
  [ARRANGEMENT_ATTACH_DECODE]?: (getContext: GetDecodeContext) => () => void;
  [ARRANGEMENT_ATTACH_TIME_BASE]?: (timeBase: ArrangementTimeBase) => () => void;
}

function attachPoints(value: unknown): AttachPoints {
  return (typeof value === 'object' && value !== null ? value : {}) as AttachPoints;
}

/** True for an arrangement made by `createArrangement()`, of this copy of the package or another. */
export function isArrangement(value: unknown): boolean {
  return typeof attachPoints(value)[ARRANGEMENT_ATTACH_TIME_BASE] === 'function';
}

/**
 * Give an arrangement the audio context its sources are decoded with.
 * Nothing is fetched before; the sources its clips name are pending
 * meanwhile. `getContext` is called for each load, so it may resume or
 * create the context when the first one is needed.
 *
 * Returns the function that takes the context away again: the loads in
 * flight are aborted and start again at the next attach; what is loaded
 * stays. One context at a time: a second attach warns and replaces the first.
 *
 * A `PlaylistEngine` with an adapter does this itself with the adapter's
 * context (see its `attachDecodeContext` option).
 */
export function attachDecodeContext(
  arrangement: Arrangement,
  getContext: GetDecodeContext
): () => void {
  const attach = attachPoints(arrangement)[ARRANGEMENT_ATTACH_DECODE];
  if (typeof attach !== 'function') {
    throw new Error(
      '[waveform-playlist] attachDecodeContext: the first argument must be an arrangement ' +
        'made by createArrangement().'
    );
  }
  return attach.call(arrangement, getContext);
}

/**
 * Internal, for the engine: give an arrangement (one `isArrangement` is true
 * for) its time base. Returns the function that detaches.
 */
export function attachTimeBase(arrangement: object, timeBase: ArrangementTimeBase): () => void {
  const attach = (arrangement as Required<AttachPoints>)[ARRANGEMENT_ATTACH_TIME_BASE];
  return attach.call(arrangement, timeBase);
}
