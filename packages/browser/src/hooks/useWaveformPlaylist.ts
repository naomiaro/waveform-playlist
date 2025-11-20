import { usePlaybackControls, PlaybackControls } from './usePlaybackControls';
import { useTimeFormat, TimeFormatControls } from './useTimeFormat';
import { useZoomControls, ZoomControls } from './useZoomControls';
import { TonePlayout } from '@waveform-playlist/playout';

export interface WaveformPlaylistControls {
  playback: PlaybackControls;
  timeFormat: TimeFormatControls;
  zoom: ZoomControls;
  state: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    selectionStart: number;
    selectionEnd: number;
  };
}

export interface UseWaveformPlaylistProps {
  playoutRef: React.RefObject<TonePlayout | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  selectionStart: number;
  selectionEnd: number;
  initialSamplesPerPixel: number;
  onPlayStart?: () => void;
  onPause?: (pauseTime: number) => void;
  onStop?: () => void;
  onTimeUpdate?: (time: number) => void;
}

/**
 * High-level hook that provides all controls and state for a waveform playlist
 * This can be used with custom UI components via render props
 */
export function useWaveformPlaylist({
  playoutRef,
  isPlaying,
  currentTime,
  duration,
  selectionStart,
  selectionEnd,
  initialSamplesPerPixel,
  onPlayStart,
  onPause,
  onStop,
  onTimeUpdate,
}: UseWaveformPlaylistProps): WaveformPlaylistControls {

  const playback = usePlaybackControls({
    playoutRef,
    onPlayStart,
    onPause,
    onStop,
    onTimeUpdate,
  });

  const timeFormat = useTimeFormat();

  const zoom = useZoomControls({
    initialSamplesPerPixel,
  });

  return {
    playback,
    timeFormat,
    zoom,
    state: {
      isPlaying,
      currentTime,
      duration,
      selectionStart,
      selectionEnd,
    },
  };
}
