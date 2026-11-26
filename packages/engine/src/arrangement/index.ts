import { ArrangementImpl } from './Arrangement';
import type { Arrangement, CreateArrangementOptions } from './types';

export type {
  Arrangement,
  ClipBounds,
  CreateArrangementOptions,
  MixerChangeOptions,
  RemoveClipOptions,
  RemoveTrackOptions,
  AddTrackOptions,
} from './types';
export type { TrackMixerValues } from './mixer';
export type { ArrangementSourceState, ArrangementSourcesValue } from './sources';
export { attachDecodeContext, isArrangement } from './attach';
export { defaultLoadSource } from './loadSource';
export type { LoadSource } from './loadSource';

/**
 * Make an arrangement: the owner of the tracks, the mix and the undo
 * history. It needs no engine; give it to `new PlaylistEngine({ arrangement })`
 * to play it, and to the next engine when that one is disposed.
 */
export function createArrangement(options: CreateArrangementOptions = {}): Arrangement {
  return new ArrangementImpl(options);
}
