import { ArrangementImpl } from './Arrangement';
import type { Arrangement, CreateArrangementOptions } from './types';

export type {
  Arrangement,
  ClipBounds,
  CreateArrangementOptions,
  RemoveTrackOptions,
} from './types';
export type { TrackMixerValues } from './mixer';

/**
 * Make an arrangement: the owner of the tracks, the mix and the undo
 * history. It needs no engine; give it to `new PlaylistEngine({ arrangement })`
 * to play it, and to the next engine when that one is disposed.
 */
export function createArrangement(options: CreateArrangementOptions = {}): Arrangement {
  return new ArrangementImpl(options);
}
