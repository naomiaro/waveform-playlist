import React from 'react';
import { WaveformPlaylistControls } from '../hooks';

export interface DefaultPlaylistControlsProps {
  controls: WaveformPlaylistControls;
}

/**
 * Default control component that demonstrates how to use the playlist controls
 * Users can replace this with their own custom component
 */
export const DefaultPlaylistControls: React.FC<DefaultPlaylistControlsProps> = ({ controls }) => {
  const { playback, timeFormat, zoom, state } = controls;

  const handlePlayPause = async () => {
    if (state.isPlaying) {
      playback.pause();
    } else {
      // If there's a selection, play the selection, otherwise play from current time
      if (state.selectionStart !== state.selectionEnd) {
        const duration = state.selectionEnd - state.selectionStart;
        await playback.play(state.selectionStart, duration);
      } else {
        await playback.play(state.currentTime);
      }
    }
  };

  return (
    <div className="playlist-controls" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button
        className="btn btn-play-pause"
        onClick={handlePlayPause}
      >
        {state.isPlaying ? 'Pause' : 'Play'}
      </button>

      <button
        className="btn btn-stop"
        onClick={playback.stop}
      >
        Stop
      </button>

      <button
        className="btn btn-rewind"
        onClick={() => {
          const newTime = Math.max(0, state.currentTime - 5);
          playback.seekTo(newTime);
        }}
        disabled={state.currentTime === 0}
      >
        ⏪ -5s
      </button>

      <button
        className="btn btn-fast-forward"
        onClick={() => {
          const newTime = Math.min(state.duration, state.currentTime + 5);
          playback.seekTo(newTime);
        }}
        disabled={state.currentTime >= state.duration}
      >
        ⏩ +5s
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-zoom-in"
          onClick={zoom.zoomIn}
          disabled={!zoom.canZoomIn}
          title="Zoom In"
        >
          🔍+
        </button>

        <button
          className="btn btn-zoom-out"
          onClick={zoom.zoomOut}
          disabled={!zoom.canZoomOut}
          title="Zoom Out"
        >
          🔍-
        </button>

        <span className="current-time" style={{ fontFamily: 'monospace', minWidth: '100px' }}>
          {timeFormat.formatTime(state.currentTime)}
        </span>
      </div>
    </div>
  );
};
