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
 * Also the value of `RecordingTrackContext`: which track a take is recording
 * onto, read from the arrangement's `recordingTrackIds`.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Arrangement, MixerChangeOptions } from '@waveform-playlist/engine';
import type { DragGuard } from './dragGuard';
import { warnOnce } from '../components/partWarnings';
import type { RecordingTrackContextValue } from '../contexts/playlistContexts';

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
  setRecordingActive: (active: boolean, recordingTrackId?: string | null) => void;
  /** True while a recording session is active: the animation loop and `seekTo` read it. */
  recordingActiveRef: React.RefObject<boolean>;
  /** The value of `RecordingTrackContext`; a new object only when the take's track changes. */
  recordingTrack: RecordingTrackContextValue;
}

/** The first recording track of the arrangement, or null: React records onto one at a time. */
const readRecordingTrackId = (arrangement: Arrangement): string | null => {
  for (const id of arrangement.recordingTrackIds) return id;
  return null;
};

/** Clear the take's mute on every recording track of the arrangement but `keep`. */
function clearRecordingTracks(arrangement: Arrangement, keep: string | null = null): void {
  // A copy: each change gives the arrangement another Set.
  for (const id of [...arrangement.recordingTrackIds]) {
    if (id !== keep) arrangement.setTrackRecording(id, false);
  }
}

/**
 * Recording session state. While active:
 * 1. the animation loop's end-of-audio auto-stop is suppressed, so overdub
 *    playback runs past the end of existing material (#589/#590);
 * 2. the track the take is recording onto is marked in the arrangement
 *    (`setTrackRecording`, #843): punch-in replaces whatever the take
 *    overlaps (#579), so that material must not play under the overdub. The
 *    take's mute is outside the history: the track plays and shows as muted
 *    while `getMixer()` keeps its own mute, which nothing writes, so a mute
 *    changed during the take stays after it. React records onto one track
 *    at a time: marking one clears every other.
 * Called by useRecordingSession for the length of a take; overdub flows also
 * call it eagerly before play(), because a render round-trip loses the race
 * against the first animation frame (play() does nothing before the first
 * ready, so a take started during the first load records without playback).
 * The provider also clears it in its own cleanup (below) when a track is
 * still recording.
 *
 * The owner is the arrangement (`recordingTrackIds`); the provider holds
 * no copy and renders `recordingTrackId` from it with `useSyncExternalStore`.
 */
function useRecordingActive(arrangement: Arrangement) {
  const recordingActiveRef = useRef(false);
  const setRecordingActive = useCallback(
    (active: boolean, recordingTrackId?: string | null) => {
      recordingActiveRef.current = active;
      if (active && recordingTrackId) {
        clearRecordingTracks(arrangement, recordingTrackId);
        arrangement.setTrackRecording(recordingTrackId, true); // the same value changes nothing
      } else if (!active) {
        clearRecordingTracks(arrangement);
      }
    },
    [arrangement]
  );
  // The arrangement outlives the provider (maintainer, F1): when the provider
  // goes (unmount, an <Activity> hide, a StrictMode or Fast Refresh remount)
  // with a track still recording, its take's mute is cleared and the session
  // ends. Nothing happens when the session was already released (by
  // useRecordingSession's own cleanup) or never named a track; a session
  // started again after a remount or a reveal works as before.
  useEffect(
    () => () => {
      if (arrangement.recordingTrackIds.size > 0) setRecordingActive(false);
    },
    [arrangement, setRecordingActive]
  );
  const subscribe = useCallback(
    (listener: () => void) => arrangement.subscribe(listener),
    [arrangement]
  );
  const getRecordingTrackId = useCallback(() => readRecordingTrackId(arrangement), [arrangement]);
  const recordingTrackId = useSyncExternalStore(
    subscribe,
    getRecordingTrackId,
    getRecordingTrackId
  );
  const recordingTrack = useMemo(() => ({ recordingTrackId }), [recordingTrackId]);
  return { setRecordingActive, recordingActiveRef, recordingTrack };
}

export function useArrangementEditing(
  arrangement: Arrangement,
  dragGuard: DragGuard
): ArrangementEditing {
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
  // Undo and redo do nothing while a clip or track drag is in progress (#848).
  const undo = useCallback(() => {
    if (!dragGuard.active) arrangement.undo();
  }, [arrangement, dragGuard]);
  const redo = useCallback(() => {
    if (!dragGuard.active) arrangement.redo();
  }, [arrangement, dragGuard]);
  const { setRecordingActive, recordingActiveRef, recordingTrack } =
    useRecordingActive(arrangement);
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
    recordingTrack,
  };
}
