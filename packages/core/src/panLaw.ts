/**
 * A track's pan law (#684).
 *
 * - `'mono'`: equal power, −3 dB per side at centre; the channels are never
 *   mixed.
 * - `'stereo'`: unity at centre; panning folds one channel into the other.
 * - `'auto'`: not decided yet. It is the default, and the first decoded
 *   audio a track holds decides it (an arrangement stores the result as a
 *   mixer value, and a track's clips never change it afterwards).
 *
 * The law says how a track is panned. It converts nothing: a stereo clip on
 * a `'mono'` track still plays in stereo.
 */
export type PanLaw = 'auto' | 'mono' | 'stereo';

/** A law a pan stage can apply: every `PanLaw` except `'auto'`. */
export type DecidedPanLaw = Exclude<PanLaw, 'auto'>;

export const DEFAULT_PAN_LAW: PanLaw = 'auto';

/** True for `'mono'` and `'stereo'` only; any other value, of any type, is not a decided law. */
export function isDecidedPanLaw(value: unknown): value is DecidedPanLaw {
  return value === 'mono' || value === 'stereo';
}

/** The part of a track `trackPanLaw` reads: `ClipTrack` satisfies it. */
export interface TrackPanLawSource {
  panLaw?: PanLaw;
  clips: ReadonlyArray<{ audioBuffer?: { numberOfChannels: number } }>;
}

/**
 * The law of the decoded audio a track holds: `'stereo'` when any clip's
 * buffer has two or more channels, `'mono'` when at least one clip has a
 * buffer, `null` when none has (an empty track, loading clips, MIDI clips,
 * clips made from peaks alone).
 */
export function audioPanLaw(track: Pick<TrackPanLawSource, 'clips'>): DecidedPanLaw | null {
  let law: DecidedPanLaw | null = null;
  for (const clip of track.clips) {
    const channels = clip.audioBuffer?.numberOfChannels;
    if (channels === undefined) continue;
    if (channels >= 2) return 'stereo';
    law = 'mono';
  }
  return law;
}

/**
 * The law a renderer pans a track with: the track's own when it is decided;
 * else (`'auto'`, no field, or a value that is not a law) the law of its
 * audio; else `'mono'`.
 */
export function trackPanLaw(track: TrackPanLawSource): DecidedPanLaw {
  if (isDecidedPanLaw(track.panLaw)) return track.panLaw;
  return audioPanLaw(track) ?? 'mono';
}
