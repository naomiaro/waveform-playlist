import { useEffect } from 'react';
import { useEditorControls } from '../contexts/playlistContexts';

export interface RecordingSessionOptions {
  /** True while a take is being recorded. */
  isRecording: boolean;
  /** The track being recorded into, or null when there is none. */
  trackId: string | null | undefined;
}

/**
 * Tells the playlist that a take is being recorded into a track, for as long
 * as `isRecording` is true (#685). The provider then keeps playback running
 * past the end of the audio and arms the track in the arrangement for the
 * take (`setTrackArmed`, #843), which plays it muted, so what it already
 * holds does not play under a punch-in that replaces it (`trackStates` shows
 * the track muted, its built-in Mute button is disabled and
 * `useTrack().isRecordingArmed` is true). The track's own mute is not
 * written, so a mute changed during the take stays after it. The track is
 * disarmed when the take ends, the track changes or the component unmounts;
 * the provider also disarms in its own cleanup (its unmount or an
 * `<Activity>` hide) while a track is still armed. An `<Activity>` hide of
 * the component ends the session the same way, and the reveal arms the
 * track again.
 *
 * Call it in the component that calls `useIntegratedRecording`, under
 * `WaveformPlaylistProvider`. `<WaveformRecordingPreview>` only draws the
 * take: without this hook the track is not armed and plays as it is.
 *
 * A handler that starts playback together with the recording should also call
 * `setRecordingActive(true, trackId)` (from `useEditorControls()`) before
 * `play()`: this effect runs after the render that follows, which is too late
 * for the first animation frame. `play()` does nothing before the playlist's
 * first ready (`usePlaylistTimeline().isReady`), so a take started during the
 * first load records without playback.
 */
export function useRecordingSession({ isRecording, trackId }: RecordingSessionOptions): void {
  const { setRecordingActive } = useEditorControls();
  const armedTrackId = trackId ?? null;
  useEffect(() => {
    if (!isRecording) return undefined;
    setRecordingActive(true, armedTrackId);
    return () => setRecordingActive(false);
  }, [isRecording, armedTrackId, setRecordingActive]);
}
