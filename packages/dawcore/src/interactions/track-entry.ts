/**
 * How a track the page (or an editor method) declared becomes a track of the
 * editor's arrangement (#848): each audio clip a `LoadingClip` that the
 * arrangement loads, each MIDI clip a loaded clip built at the editor's
 * sample rate, a clip of the wrong kind refused. Pure functions; the editor
 * calls the arrangement.
 */
import { createClip, createTrack } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  LoadingClip,
  MidiNoteData,
  TrackKind,
} from '@waveform-playlist/core';
import type { TrackMixerValues } from '@waveform-playlist/engine';
import type { ClipDescriptor, StoredTrackDescriptor } from '../types';
import { isDomClip } from '../types';

/**
 * Keep only notes with finite, in-range fields; warn for each one dropped.
 * Prevents NaN reaching the timeline.
 */
export function validMidiNotes(notes: MidiNoteData[]): MidiNoteData[] {
  return notes.filter((n) => {
    const ok =
      Number.isFinite(n.time) &&
      n.time >= 0 &&
      Number.isFinite(n.duration) &&
      n.duration > 0 &&
      Number.isInteger(n.midi) &&
      n.midi >= 0 &&
      n.midi <= 127 &&
      Number.isFinite(n.velocity) &&
      n.velocity >= 0 &&
      n.velocity <= 1;
    if (!ok) {
      console.warn('[dawcore] dropping malformed MIDI note: ' + JSON.stringify(n));
    }
    return ok;
  });
}

/** What a clip descriptor loads: its `File` (a dropped file) or its `src` URL; '' for none. */
export function clipSourceOf(clipDesc: ClipDescriptor): ClipSource | '' {
  return (!isDomClip(clipDesc) && clipDesc.file) || clipDesc.src;
}

/**
 * A clip descriptor is MIDI when it has nothing to load. Includes placeholder
 * MIDI clips (no notes, no duration yet: a 1 s span; notes arrive through a
 * clip update). Warns when a clip has both a source and notes: it is audio,
 * and the notes are ignored.
 */
export function isMidiDescriptor(clipDesc: ClipDescriptor): boolean {
  if (clipSourceOf(clipDesc)) {
    if (clipDesc.midiNotes != null) {
      console.warn(
        '[dawcore] clip "' +
          (clipDesc.name || (isDomClip(clipDesc) ? clipDesc.clipId : '?')) +
          '" has both src and midiNotes — treating as audio (notes will be ignored)'
      );
    }
    return false;
  }
  return true;
}

/**
 * The error for a clip whose kind is not its track's (#756), or null. A clip
 * with nothing to load is a MIDI clip (see isMidiDescriptor).
 */
export function clipKindError(
  trackName: string,
  kind: TrackKind,
  clipIsMidi: boolean,
  clipLabel: string
): Error | null {
  if (clipIsMidi === (kind === 'midi')) return null;
  return new Error(
    clipIsMidi
      ? 'clip "' +
        clipLabel +
        '" is a MIDI clip (no src) on audio track "' +
        trackName +
        '". A track holds one kind of clip: set kind="midi" on the <daw-track>' +
        " (or kind: 'midi' in addTrack) for a track of MIDI clips."
      : 'clip "' +
        clipLabel +
        '" is an audio clip on MIDI track "' +
        trackName +
        '". A track holds one kind of clip: put the clip on an audio track.'
  );
}

/**
 * A MIDI clip from its descriptor, at `sampleRate`. Always a clip: no notes
 * or no declared duration give a 1 s placeholder span, so later notes find it.
 */
export function buildMidiClip(clipDesc: ClipDescriptor, sampleRate: number): AudioClip {
  const notes = validMidiNotes(clipDesc.midiNotes ?? []);
  const noteSpanSeconds = notes.length
    ? notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0)
    : 0;
  const sourceDurationSamples = Math.ceil(
    Math.max(noteSpanSeconds, clipDesc.duration, 1) * sampleRate
  );
  const requestedDurationSamples =
    clipDesc.duration > 0 ? Math.round(clipDesc.duration * sampleRate) : sourceDurationSamples;
  const clip = createClip({
    startSample: Math.round(clipDesc.start * sampleRate),
    durationSamples: requestedDurationSamples,
    offsetSamples: Math.round(clipDesc.offset * sampleRate),
    sampleRate,
    sourceDurationSamples,
    gain: clipDesc.gain,
    name: clipDesc.name,
    midiNotes: notes,
    midiChannel: clipDesc.midiChannel ?? undefined,
    midiProgram: clipDesc.midiProgram ?? undefined,
  });
  if (clipDesc.clipId) clip.id = clipDesc.clipId;
  return clip;
}

/**
 * The loading clip of an audio clip descriptor (its `clipId` must be set):
 * the source, the times in seconds and the gain. A duration of 0 means the
 * whole source from the offset. Fades are not carried: the load path never
 * applied `<daw-clip>` fades (engine-side fades are #489).
 */
export function buildLoadingClip(clipDesc: ClipDescriptor & { clipId: string }): LoadingClip {
  return {
    id: clipDesc.clipId,
    src: clipSourceOf(clipDesc) as ClipSource,
    start: clipDesc.start,
    offset: clipDesc.offset,
    gain: clipDesc.gain,
    ...(clipDesc.duration > 0 && { duration: clipDesc.duration }),
    ...(clipDesc.name && { name: clipDesc.name }),
  };
}

/** A clip descriptor with an id: a drop descriptor without one gets a new id. */
export function withClipId(clipDesc: ClipDescriptor): ClipDescriptor & { clipId: string } {
  if (clipDesc.clipId) return clipDesc as ClipDescriptor & { clipId: string };
  return { ...clipDesc, clipId: crypto.randomUUID() };
}

/** A clip of the descriptor that was refused for its kind. */
export interface RefusedClip {
  clipId: string;
  error: Error;
}

export interface BuiltTrack {
  track: ArrangementTrack;
  /** The descriptor with an id on every clip (the same object when none was missing). */
  descriptor: StoredTrackDescriptor;
  refused: RefusedClip[];
}

/**
 * The arrangement track for a declared track: `trackId`, its name, kind and
 * the mix it enters with; a loading clip per audio clip and a loaded clip per
 * MIDI clip. A clip of the wrong kind is left out and listed in `refused`
 * (the arrangement throws for a track that holds both kinds).
 */
export function buildArrangementTrack(
  trackId: string,
  descriptor: StoredTrackDescriptor,
  mix: TrackMixerValues,
  sampleRate: number
): BuiltTrack {
  const clips: (AudioClip | LoadingClip)[] = [];
  const refused: RefusedClip[] = [];
  let changed = false;
  const descClips = descriptor.clips.map((clipDesc) => {
    const identified = withClipId(clipDesc);
    if (identified !== clipDesc) changed = true;
    const isMidi = isMidiDescriptor(identified);
    const source = clipSourceOf(identified);
    const sourceName =
      typeof source === 'string' ? source : source instanceof File ? source.name : '';
    const label = identified.name || sourceName || identified.clipId;
    const kindError = clipKindError(descriptor.name, descriptor.kind, isMidi, label);
    if (kindError) refused.push({ clipId: identified.clipId, error: kindError });
    else clips.push(isMidi ? buildMidiClip(identified, sampleRate) : buildLoadingClip(identified));
    return identified;
  });
  const base = createTrack({ name: descriptor.name, kind: descriptor.kind, clips: [], ...mix });
  const track: ArrangementTrack = { ...base, id: trackId, clips };
  return { track, descriptor: changed ? { ...descriptor, clips: descClips } : descriptor, refused };
}

/**
 * Where a `<daw-track>` enters among the arrangement's tracks: after the
 * arrangement track of the nearest `<daw-track>` before it (in document
 * order) that has entered; first when there is none.
 */
export function entryIndex(
  trackEls: readonly { trackId: string }[],
  trackId: string,
  arrangementIds: readonly string[]
): number {
  const at = trackEls.findIndex((el) => el.trackId === trackId);
  for (let i = at - 1; i >= 0; i--) {
    const position = arrangementIds.indexOf(trackEls[i].trackId);
    if (position !== -1) return position + 1;
  }
  return 0;
}
