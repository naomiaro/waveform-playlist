import {
  type ClipTrack,
  type MidiNoteData,
  createClipFromSeconds,
  createTrack,
} from '@waveform-playlist/core';
import { parseMidiFile, parseMidiUrl, type ParsedMidi } from '@dawcore/midi';

/** What a MIDI track needs besides its notes. */
export interface MidiTrackShape {
  /** Sample rate for sample-based timeline positioning. */
  sampleRate: number;
  /** Clip position on the timeline, in seconds (default 0). */
  startTime?: number;
  /** Clip duration in seconds; default is the track's own duration. */
  duration?: number;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
}

/** End of the last note, in seconds. A loop, not `Math.max(...)`: a spread of a
 * very large note list exceeds the engine's argument limit. */
export function lastNoteEnd(notes: MidiNoteData[]): number {
  let end = 0;
  for (const note of notes) {
    const noteEnd = note.time + note.duration;
    if (noteEnd > end) end = noteEnd;
  }
  return end;
}

/**
 * The one place a MIDI track is built: one clip holding `notes`, on a
 * `kind: 'midi'` track. Every call makes new track and clip ids.
 * Shared by `loadMidiTracks` and `useMidiTracks`; not exported from the package.
 */
export function createMidiTrack(
  shape: MidiTrackShape,
  notes: MidiNoteData[],
  name: string,
  noteDuration: number,
  midiChannel?: number,
  midiProgram?: number
): ClipTrack {
  const clipDuration = shape.duration ?? noteDuration;
  const clip = createClipFromSeconds({
    startTime: shape.startTime ?? 0,
    duration: clipDuration,
    sampleRate: shape.sampleRate,
    sourceDuration: clipDuration,
    midiNotes: notes,
    midiChannel,
    midiProgram,
    name,
  });
  return createTrack({
    name,
    kind: 'midi',
    clips: [clip],
    muted: shape.muted ?? false,
    soloed: shape.soloed ?? false,
    volume: shape.volume ?? 1.0,
    pan: shape.pan ?? 0,
    color: shape.color,
  });
}

/** One track per parsed MIDI track, in file order. Does not change `parsed`. */
export function buildMidiTracks(parsed: ParsedMidi, shape: MidiTrackShape): ClipTrack[] {
  return parsed.tracks.map((track) =>
    createMidiTrack(
      shape,
      track.notes,
      track.name,
      track.duration,
      track.channel,
      track.programNumber
    )
  );
}

export interface LoadMidiTracksOptions {
  /**
   * Sample rate of the timeline, usually `AudioContext.sampleRate`. Required:
   * clip positions are integer samples and MIDI has no rate of its own, so no
   * default would be right on every device.
   */
  sampleRate: number;
  /** Merge all MIDI tracks of the file into one track (default false). */
  flatten?: boolean;
  /** Where the clips start on the timeline, in seconds (default 0). */
  start?: number;
  /** Clip duration in seconds (default: the end of the track's last note). */
  duration?: number;
  /**
   * Names the track and its clip when the file yields exactly one (a
   * single-track file, or `flatten`). Several tracks keep their own MIDI names.
   */
  name?: string;
  /** Aborts the fetch and the load; the promise rejects with the signal's reason. */
  signal?: AbortSignal;
}

/**
 * Load a MIDI file (a URL, a `File` or a `Blob`) as `kind: 'midi'` tracks,
 * one per MIDI track of the file (one in all with `flatten`). Each clip holds
 * the notes in `midiNotes`, positioned at `start` seconds and as long as
 * `duration` seconds (default: the track's last note), both converted to
 * samples at `sampleRate`. Each call makes new track and clip ids, so two calls
 * on one file never share an id.
 *
 * If `signal` aborts, the promise rejects with the signal's reason (an
 * `AbortError` for `controller.abort()`) and no tracks are returned, wherever
 * in the load the abort lands.
 *
 * @example
 * const tracks = await loadMidiTracks('/song.mid', { sampleRate: ctx.sampleRate });
 */
export async function loadMidiTracks(
  src: string | File | Blob,
  options: LoadMidiTracksOptions
): Promise<ClipTrack[]> {
  const { sampleRate, flatten, start, duration, name, signal } = options;
  signal?.throwIfAborted();
  const parsed =
    typeof src === 'string'
      ? await parseMidiUrl(src, { flatten }, signal)
      : parseMidiFile(await src.arrayBuffer(), { flatten });
  signal?.throwIfAborted();
  const tracks = buildMidiTracks(parsed, { sampleRate, startTime: start, duration });
  if (name === undefined || tracks.length !== 1) return tracks;
  const [only] = tracks;
  return [{ ...only, name, clips: only.clips.map((clip) => ({ ...clip, name })) }];
}
