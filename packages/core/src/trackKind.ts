import type { AudioClip, ClipTrack, TrackKind } from './types';

/**
 * What a clip is: MIDI when it carries `midiNotes` (an empty array included),
 * audio otherwise (decoded, or peaks-only before the decode finishes).
 */
export function clipKind(clip: Pick<AudioClip, 'midiNotes'>): TrackKind {
  return clip.midiNotes != null ? 'midi' : 'audio';
}

/**
 * A track's kind. `kind` is required by the type; a track built in plain
 * JavaScript without it is read as audio.
 */
export function trackKind(track: Pick<ClipTrack, 'kind'>): TrackKind {
  return track.kind ?? 'audio';
}

function label(named: { id: string; name?: string }): string {
  return '"' + (named.name || named.id) + '"';
}

/**
 * Throws unless every clip on the track is of the track's kind. A track holds
 * audio clips or MIDI clips, never both (#756): the engine calls this wherever
 * a track enters it, so a mixed track cannot reach a playout adapter.
 */
export function assertTrackKind(track: ClipTrack): void {
  const kind = trackKind(track);
  if (kind !== 'audio' && kind !== 'midi') {
    throw new Error(
      '[waveform-playlist] Track ' +
        label(track) +
        ' has kind "' +
        String(kind) +
        "\"; a track's kind is 'audio' or 'midi'."
    );
  }
  const stray = track.clips.find((clip) => clipKind(clip) !== kind);
  if (!stray) return;

  const strayKind = clipKind(stray);
  const fix =
    track.kind === undefined
      ? "The track has no kind, which is read as 'audio': set kind: 'midi' on a track of MIDI clips."
      : 'A track holds one kind of clip: put the clip on a track of its own kind' +
        ' (splitTrackByKind() splits a track that has both).';
  throw new Error(
    '[waveform-playlist] Track ' +
      label(track) +
      ' is an ' +
      kind +
      ' track but its clip ' +
      label(stray) +
      ' is ' +
      (strayKind === 'audio' ? 'an audio' : 'a midi') +
      ' clip. ' +
      fix
  );
}

/**
 * Splits a track by the kind of its clips, for data from before tracks had a
 * kind. A track whose clips are all of one kind comes back as one track with
 * that kind (an empty track keeps the kind it has). A track holding both comes
 * back as two: the audio track keeps the id, the MIDI track gets `midiTrackId`
 * (default: the id + '-midi') and copies of the name, volume, pan, mute and solo.
 */
export function splitTrackByKind(
  track: ClipTrack,
  midiTrackId: string = track.id + '-midi'
): ClipTrack[] {
  const audioClips = track.clips.filter((clip) => clipKind(clip) === 'audio');
  const midiClips = track.clips.filter((clip) => clipKind(clip) === 'midi');

  if (midiClips.length === 0) {
    return [{ ...track, kind: track.clips.length === 0 ? trackKind(track) : 'audio' }];
  }
  if (audioClips.length === 0) {
    return [{ ...track, kind: 'midi' }];
  }
  return [
    { ...track, kind: 'audio', clips: audioClips },
    { ...track, id: midiTrackId, kind: 'midi', clips: midiClips },
  ];
}
