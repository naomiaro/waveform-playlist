/**
 * This is an example showing how users can create their own custom controls
 * using the useWaveformPlaylist hook
 */

import React from 'react';
import { WaveformPlaylistControls } from '../hooks';

export const CustomControlsExample: React.FC<{ controls: WaveformPlaylistControls }> = ({ controls }) => {
  const { playback, timeFormat, zoom, state } = controls;

  return (
    <div style={{
      background: '#f5f5f5',
      padding: '20px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      {/* Custom playback controls with icons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => playback.play(state.currentTime)}
          disabled={state.isPlaying}
          style={{
            background: state.isPlaying ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: state.isPlaying ? 'not-allowed' : 'pointer',
          }}
        >
          ▶ Play
        </button>

        <button
          onClick={playback.pause}
          disabled={!state.isPlaying}
          style={{
            background: !state.isPlaying ? '#ccc' : '#FF9800',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: !state.isPlaying ? 'not-allowed' : 'pointer',
          }}
        >
          ⏸ Pause
        </button>

        <button
          onClick={playback.stop}
          style={{
            background: '#f44336',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ⏹ Stop
        </button>
      </div>

      {/* Custom time display with progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
            {timeFormat.formatTime(state.currentTime)}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>
            {timeFormat.formatTime(state.duration)}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '4px',
          background: '#ddd',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(state.currentTime / state.duration) * 100}%`,
            height: '100%',
            background: '#2196F3',
            transition: 'width 0.1s linear'
          }} />
        </div>
      </div>

      {/* Custom zoom controls with slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>Zoom:</span>
        <button
          onClick={zoom.zoomOut}
          disabled={!zoom.canZoomOut}
          style={{
            background: zoom.canZoomOut ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '18px',
            cursor: zoom.canZoomOut ? 'pointer' : 'not-allowed',
          }}
        >
          −
        </button>
        <div style={{
          flex: 1,
          background: '#ddd',
          height: '4px',
          borderRadius: '2px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            background: '#2196F3',
            borderRadius: '50%'
          }} />
        </div>
        <button
          onClick={zoom.zoomIn}
          disabled={!zoom.canZoomIn}
          style={{
            background: zoom.canZoomIn ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '18px',
            cursor: zoom.canZoomIn ? 'pointer' : 'not-allowed',
          }}
        >
          +
        </button>
      </div>

      {/* Selection info */}
      {state.selectionStart !== state.selectionEnd && (
        <div style={{
          background: 'rgba(33, 150, 243, 0.1)',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>Selection:</strong>{' '}
          {timeFormat.formatTime(state.selectionStart)} → {timeFormat.formatTime(state.selectionEnd)}
          {' '}
          ({timeFormat.formatTime(state.selectionEnd - state.selectionStart)} duration)
        </div>
      )}
    </div>
  );
};
