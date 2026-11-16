/**
 * The track a take is recorded onto, in the arrangement that owns it (#812):
 * whether a take may start there, and the track with the take added.
 */
import {
  type ArrangementTrack,
  type AudioClip,
  type LoadingClip,
  carveClipRange,
  isLoadingClip,
  trackKind,
} from '@waveform-playlist/core';
import type { Arrangement, ArrangementSourceState } from '@waveform-playlist/engine';

const PREFIX = 'Cannot start recording: ';

function label(track: ArrangementTrack): string {
  return '"' + (track.name || track.id) + '"';
}

/**
 * True when the source shows as failed because a clip of it could not be
 * made from its audio, not because its load failed. The arrangement names
 * such a failure `clip "<id>": <reason>`, after the first clip of the
 * current tracks it could not make from that source.
 */
function isUnusableClipFailure(
  arrangement: Arrangement,
  clip: LoadingClip,
  state: ArrangementSourceState
): boolean {
  const message = state.error?.message ?? '';
  return arrangement
    .getTracks()
    .some((t) =>
      t.clips.some(
        (c) => isLoadingClip(c) && c.src === clip.src && message.startsWith(`clip "${c.id}": `)
      )
    );
}

/** Why a take cannot be recorded over a clip whose audio is not loaded. */
function loadingClipRefusal(
  arrangement: Arrangement,
  track: ArrangementTrack,
  clip: LoadingClip
): Error {
  const state = arrangement.sources.getSnapshot().sources.get(clip.src);
  if (state?.status !== 'failed') {
    return new Error(
      `${PREFIX}${label(track)} holds a clip whose audio is still loading ("${clip.id}"). ` +
        'Start the take once it has loaded.'
    );
  }
  const reason = state.error?.message ?? 'unknown error';
  if (isUnusableClipFailure(arrangement, clip, state)) {
    return new Error(
      `${PREFIX}a clip on ${label(track)} cannot be made from its audio (${reason}). ` +
        'Correct or remove the clip.'
    );
  }
  return new Error(
    `${PREFIX}the audio of clip "${clip.id}" on ${label(track)} could not be loaded ` +
      `(${reason}). Retry it with arrangement.retry(), or remove the clip.`
  );
}

/**
 * Why a take cannot start on `trackId`, or `null` when it can. Read from the
 * arrangement's tracks as they are now.
 */
export function takeRefusal(arrangement: Arrangement, trackId: string): Error | null {
  const target = arrangement.getTracks().find((t) => t.id === trackId);
  if (!target) {
    return new Error(
      `${PREFIX}the selected track "${trackId}" is not in the arrangement. ` +
        'Add it with arrangement.addTrack() first.'
    );
  }
  // A track holds one kind of clip (#756): a take is audio.
  if (trackKind(target) === 'midi') {
    return new Error(
      `${PREFIX}${label(target)} is a MIDI track. Select or create an audio track first.`
    );
  }
  // A punch-in carves the clips it overlaps, and only a loaded clip can be carved.
  const loading = target.clips.find(isLoadingClip);
  return loading ? loadingClipRefusal(arrangement, target, loading) : null;
}

/**
 * The error for a take the arrangement refused at the end (its track's kind
 * changed during the take): says the recorded audio is lost, and keeps the
 * arrangement's error as `cause`.
 */
export function takeNotSaved(trackId: string, refusal: unknown): Error {
  const cause = refusal instanceof Error ? refusal : new Error(String(refusal));
  return Object.assign(
    new Error(
      `Recording completed but the take could not be saved on track "${trackId}": ` + cause.message
    ),
    { cause }
  );
}

/**
 * The track with the take added: the take owns [start, start + duration) and
 * the loaded clips it overlaps are trimmed, removed or split (#579). A clip
 * that is still loading (one an undo brought back during the take) is kept
 * as it is.
 */
export function withTake(track: ArrangementTrack, take: AudioClip): ArrangementTrack {
  const loaded = track.clips.filter((c): c is AudioClip => !isLoadingClip(c));
  const loading = track.clips.filter(isLoadingClip);
  const end = take.startSample + take.durationSamples;
  return {
    ...track,
    clips: [...carveClipRange(loaded, take.startSample, end), ...loading, take],
  };
}
