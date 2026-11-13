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
 * past the end of the audio and mutes what the armed track already holds for
 * the take, so a punch-in replaces what it overlaps; the track's own mute
 * state is restored when the take ends or the component unmounts.
 *
 * Call it in the component that calls `useIntegratedRecording`, under
 * `WaveformPlaylistProvider`. `<WaveformRecordingPreview>` only draws the
 * take: without this hook the armed track is not muted.
 *
 * A handler that starts playback together with the recording should also call
 * `setRecordingActive(true, trackId)` (from `useEditorControls()`) before
 * `play()`: this effect runs after the render that follows, which is too late
 * for the first animation frame.
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
