/**
 * useArrangementEditing
 *
 * The editor actions of `WaveformPlaylistProvider` that change the
 * arrangement (#812): the four mixer setters, `reorderTrack`, `undo`, `redo`
 * and `setRecordingActive`. Each asks the arrangement, which owns the tracks,
 * the mix and the history, and works whether an engine is attached or not;
 * the engine follows the arrangement. Every function keeps its identity for
 * the life of the provider (the arrangement does not change within a mount).
 * Also the value of `RecordingArmContext`: which track is armed for a take.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';
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
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  reorderTrack: (trackId: string, toIndex: number) => void;
  undo: () => void;
  redo: () => void;
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
  /** True while a recording session is active: the animation loop and `seekTo` read it. */
  recordingActiveRef: React.RefObject<boolean>;
  /** The value of `RecordingArmContext`; a new object only when the armed track changes. */
  recordingArm: RecordingArmContextValue;
}

/** The armed track and its mute from before the session. */
interface ArmedTrack {
  trackId: string;
  prevMuted: boolean;
}

/**
 * Recording session state. While active:
 * 1. the animation loop's end-of-audio auto-stop is suppressed, so overdub
 *    playback runs past the end of existing material (#589/#590);
 * 2. the armed track is muted in the arrangement: punch-in replaces whatever
 *    the take overlaps (#579), so that material must not play under the
 *    overdub. Its mute from before the session is written back when the
 *    session ends or the armed track changes, whatever was set in between
 *    (QJ, #812); the arrangement's setter does nothing for a track that is gone.
 * Called by useRecordingSession for the length of a take; overdub flows also
 * call it eagerly before play(), because a render round-trip loses the race
 * against the first animation frame.
 *
 * The armed track is one value source, its owner: the setter reads and
 * writes it synchronously (a start and an end in one handler), and the
 * provider renders from it, so the armed track's panel follows.
 */
function useRecordingActive(arrangement: Arrangement) {
  const recordingActiveRef = useRef(false);
  const [armed] = useState(() => createValueSource<ArmedTrack | null>(null));
  const setRecordingActive = useCallback(
    (active: boolean, armedTrackId?: string | null) => {
      recordingActiveRef.current = active;
      const current = armed.source.getSnapshot();
      if (active && armedTrackId) {
        if (current?.trackId === armedTrackId) return; // already armed
        // Armed track changed mid-session: restore the previous one first.
        if (current) arrangement.setTrackMute(current.trackId, current.prevMuted);
        const prevMuted = arrangement.getMixer().get(armedTrackId)?.muted ?? false;
        armed.publish({ trackId: armedTrackId, prevMuted });
        arrangement.setTrackMute(armedTrackId, true);
      } else if (!active && current) {
        arrangement.setTrackMute(current.trackId, current.prevMuted);
        armed.publish(null);
      }
    },
    [arrangement, armed]
  );
  // The arrangement outlives the provider (maintainer, F1): when the provider
  // goes (unmount, an <Activity> hide, a StrictMode or Fast Refresh remount)
  // with a track still armed, its mute from before the take is written back
  // and the session ends. Nothing happens when the session was already
  // released (by useRecordingSession's own cleanup) or never armed a track;
  // a session armed again after a remount or a reveal works as before.
  useEffect(
    () => () => {
      if (armed.source.getSnapshot()) setRecordingActive(false);
    },
    [armed, setRecordingActive]
  );
  const getArmedTrackId = useCallback(() => armed.source.getSnapshot()?.trackId ?? null, [armed]);
  const armedTrackId = useSyncExternalStore(armed.source.subscribe, getArmedTrackId);
  const recordingArm = useMemo(() => ({ armedTrackId }), [armedTrackId]);
  return { setRecordingActive, recordingActiveRef, recordingArm };
}

export function useArrangementEditing(arrangement: Arrangement): ArrangementEditing {
  const setTrackMute = useCallback(
    (trackId: string, muted: boolean) => {
      if (isTrackId('setTrackMute', trackId)) arrangement.setTrackMute(trackId, muted);
    },
    [arrangement]
  );
  const setTrackSolo = useCallback(
    (trackId: string, soloed: boolean) => {
      if (isTrackId('setTrackSolo', trackId)) arrangement.setTrackSolo(trackId, soloed);
    },
    [arrangement]
  );
  const setTrackVolume = useCallback(
    (trackId: string, volume: number) => {
      if (isTrackId('setTrackVolume', trackId)) arrangement.setTrackVolume(trackId, volume);
    },
    [arrangement]
  );
  const setTrackPan = useCallback(
    (trackId: string, pan: number) => {
      if (isTrackId('setTrackPan', trackId)) arrangement.setTrackPan(trackId, pan);
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
