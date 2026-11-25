/**
 * useArrangementEditing
 *
 * The editor actions of `WaveformPlaylistProvider` that change the
 * arrangement (#812): the four mixer setters, `reorderTrack`, `undo`, `redo`
 * and `setRecordingActive`. Each asks the arrangement, which owns the tracks,
 * the mix and the history, and works whether an engine is attached or not;
 * the engine follows the arrangement. The mixer setters pass the
 * arrangement's `MixerChangeOptions` on (#843: each call is an undo step, a
 * gesture id makes many calls one). Every function keeps its identity for
 * the life of the provider (the arrangement does not change within a mount).
 * Also the value of `RecordingArmContext`: which track is armed for a take,
 * read from the arrangement's arm.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Arrangement, MixerChangeOptions } from '@waveform-playlist/engine';
import { warnOnce } from '../components/partWarnings';
import type { RecordingArmContextValue } from '../contexts/playlistContexts';

type MixerSetter = 'setTrackMute' | 'setTrackSolo' | 'setTrackVolume' | 'setTrackPan';

/** A call with anything but a string id is a call from before #687: ignored, once said. */
function isTrackId(setter: MixerSetter, trackId: unknown): trackId is string {
  if (typeof trackId === 'string') return true;
  warnOnce(
    `${setter}() takes a track id since the track controls became parts: ` +
      `${setter}(tracks[index].id, value). A call with anything but a string is ignored.`
  );
  return false;
}

export interface ArrangementEditing {
  setTrackMute: (trackId: string, muted: boolean, options?: MixerChangeOptions) => void;
  setTrackSolo: (trackId: string, soloed: boolean, options?: MixerChangeOptions) => void;
  setTrackVolume: (trackId: string, volume: number, options?: MixerChangeOptions) => void;
  setTrackPan: (trackId: string, pan: number, options?: MixerChangeOptions) => void;
  reorderTrack: (trackId: string, toIndex: number) => void;
  undo: () => void;
  redo: () => void;
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
  /** True while a recording session is active: the animation loop and `seekTo` read it. */
  recordingActiveRef: React.RefObject<boolean>;
  /** The value of `RecordingArmContext`; a new object only when the armed track changes. */
  recordingArm: RecordingArmContextValue;
}

/** The first armed track of the arrangement, or null: React arms one at a time. */
const readArmedTrackId = (arrangement: Arrangement): string | null => {
  for (const id of arrangement.armedTrackIds) return id;
  return null;
};

/** Disarm every armed track of the arrangement but `keep`. */
function disarmAll(arrangement: Arrangement, keep: string | null = null): void {
  // A copy: each disarm gives the arrangement another Set.
  for (const id of [...arrangement.armedTrackIds]) {
    if (id !== keep) arrangement.setTrackArmed(id, false);
  }
}

/**
 * Recording session state. While active:
 * 1. the animation loop's end-of-audio auto-stop is suppressed, so overdub
 *    playback runs past the end of existing material (#589/#590);
 * 2. the armed track is armed in the arrangement (#843): punch-in replaces
 *    whatever the take overlaps (#579), so that material must not play under
 *    the overdub. The arm is an override outside the history: the track
 *    plays and shows as muted while `getMixer()` keeps its own mute, which
 *    nothing writes, so a mute changed during the take stays after it. React
 *    arms one track at a time: arming one disarms every other.
 * Called by useRecordingSession for the length of a take; overdub flows also
 * call it eagerly before play(), because a render round-trip loses the race
 * against the first animation frame (play() does nothing before the first
 * ready, so a take started during the first load records without playback).
 * The provider also disarms in its own cleanup (below) when a track is
 * still armed.
 *
 * The arm's owner is the arrangement (`armedTrackIds`); the provider holds
 * no copy and renders `armedTrackId` from it with `useSyncExternalStore`.
 */
function useRecordingActive(arrangement: Arrangement) {
  const recordingActiveRef = useRef(false);
  const setRecordingActive = useCallback(
    (active: boolean, armedTrackId?: string | null) => {
      recordingActiveRef.current = active;
      if (active && armedTrackId) {
        disarmAll(arrangement, armedTrackId);
        arrangement.setTrackArmed(armedTrackId, true); // the same value changes nothing
      } else if (!active) {
        disarmAll(arrangement);
      }
    },
    [arrangement]
  );
  // The arrangement outlives the provider (maintainer, F1): when the provider
  // goes (unmount, an <Activity> hide, a StrictMode or Fast Refresh remount)
  // with a track still armed, it is disarmed and the session ends. Nothing
  // happens when the session was already released (by useRecordingSession's
  // own cleanup) or never armed a track; a session armed again after a
  // remount or a reveal works as before.
  useEffect(
    () => () => {
      if (arrangement.armedTrackIds.size > 0) setRecordingActive(false);
    },
    [arrangement, setRecordingActive]
  );
  const subscribe = useCallback(
    (listener: () => void) => arrangement.subscribe(listener),
    [arrangement]
  );
  const getArmedTrackId = useCallback(() => readArmedTrackId(arrangement), [arrangement]);
  const armedTrackId = useSyncExternalStore(subscribe, getArmedTrackId, getArmedTrackId);
  const recordingArm = useMemo(() => ({ armedTrackId }), [armedTrackId]);
  return { setRecordingActive, recordingActiveRef, recordingArm };
}

export function useArrangementEditing(arrangement: Arrangement): ArrangementEditing {
  const setTrackMute = useCallback(
    (trackId: string, muted: boolean, options?: MixerChangeOptions) => {
      if (isTrackId('setTrackMute', trackId)) arrangement.setTrackMute(trackId, muted, options);
    },
    [arrangement]
  );
  const setTrackSolo = useCallback(
    (trackId: string, soloed: boolean, options?: MixerChangeOptions) => {
      if (isTrackId('setTrackSolo', trackId)) arrangement.setTrackSolo(trackId, soloed, options);
    },
    [arrangement]
  );
  const setTrackVolume = useCallback(
    (trackId: string, volume: number, options?: MixerChangeOptions) => {
      if (isTrackId('setTrackVolume', trackId))
        arrangement.setTrackVolume(trackId, volume, options);
    },
    [arrangement]
  );
  const setTrackPan = useCallback(
    (trackId: string, pan: number, options?: MixerChangeOptions) => {
      if (isTrackId('setTrackPan', trackId)) arrangement.setTrackPan(trackId, pan, options);
    },
    [arrangement]
  );
  const reorderTrack = useCallback(
    (trackId: string, toIndex: number) => arrangement.reorderTrack(trackId, toIndex),
    [arrangement]
  );
  const undo = useCallback(() => arrangement.undo(), [arrangement]);
  const redo = useCallback(() => arrangement.redo(), [arrangement]);
  const { setRecordingActive, recordingActiveRef, recordingArm } = useRecordingActive(arrangement);
  return {
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    setTrackPan,
    reorderTrack,
    undo,
    redo,
    setRecordingActive,
    recordingActiveRef,
    recordingArm,
  };
}
