/**
 * useArrangementEditing
 *
 * The editor actions of `WaveformPlaylistProvider` that change the
 * arrangement (#812): the four mixer setters, `reorderTrack`, `undo`, `redo`
 * and `setRecordingActive`. Each asks the arrangement, which owns the tracks,
 * the mix and the history, and works whether an engine is attached or not;
 * the engine follows the arrangement. Every function keeps its identity for
 * the life of the provider (the arrangement does not change within a mount).
 */
import { useCallback, useRef } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';
import { warnOnce } from '../components/partWarnings';

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
}

/**
 * Recording session state. While active:
 * 1. the animation loop's end-of-audio auto-stop is suppressed, so overdub
 *    playback runs past the end of existing material (#589/#590);
 * 2. the armed track is muted in the arrangement: punch-in replaces whatever
 *    the take overlaps (#579), so that material must not play under the
 *    overdub. Its mute from before the session is put back when it ends.
 * Called by useRecordingSession for the length of a take; overdub flows also
 * call it eagerly before play(), because a render round-trip loses the race
 * against the first animation frame.
 */
function useRecordingActive(arrangement: Arrangement) {
  const recordingActiveRef = useRef(false);
  const armedTrackMuteRef = useRef<{ trackId: string; prevMuted: boolean } | null>(null);
  const setRecordingActive = useCallback(
    (active: boolean, armedTrackId?: string | null) => {
      recordingActiveRef.current = active;
      const armed = armedTrackMuteRef.current;
      if (active && armedTrackId) {
        if (armed?.trackId === armedTrackId) return; // already armed
        // Armed track changed mid-session: restore the previous one first.
        if (armed) arrangement.setTrackMute(armed.trackId, armed.prevMuted);
        const prevMuted = arrangement.getMixer().get(armedTrackId)?.muted ?? false;
        armedTrackMuteRef.current = { trackId: armedTrackId, prevMuted };
        arrangement.setTrackMute(armedTrackId, true);
      } else if (!active && armed) {
        arrangement.setTrackMute(armed.trackId, armed.prevMuted);
        armedTrackMuteRef.current = null;
      }
    },
    [arrangement]
  );
  return { setRecordingActive, recordingActiveRef };
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
  const { setRecordingActive, recordingActiveRef } = useRecordingActive(arrangement);
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
  };
}
