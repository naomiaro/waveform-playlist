/**
 * Waveform Playlist Theme
 *
 * This file defines the theme interface and default values for the waveform playlist components.
 */

export interface WaveformPlaylistTheme {
  // Waveform colors
  waveOutlineColor: string;
  waveFillColor: string;
  waveProgressColor: string;

  // Selected track colors
  selectedWaveOutlineColor: string;
  selectedWaveFillColor: string;
  selectedTrackControlsBackground: string;

  // Timescale colors
  timeColor: string;
  timescaleBackgroundColor: string;

  // Playback UI colors
  playheadColor: string;
  selectionColor: string;

  // Clip header colors (for multi-clip editing)
  clipHeaderBackgroundColor: string;
  clipHeaderBorderColor: string;
  clipHeaderTextColor: string;

  // Selected clip header colors
  selectedClipHeaderBackgroundColor: string;
}

export const defaultTheme: WaveformPlaylistTheme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  selectedWaveOutlineColor: '#0099ff', // Brighter blue for selected track waveforms
  selectedWaveFillColor: '#FFD500', // Same as waveFillColor - keep consistent on selection
  selectedTrackControlsBackground: '#d9e9ff', // Light blue background for selected track controls
  timeColor: '#000',
  timescaleBackgroundColor: '#fff',
  playheadColor: '#f00',
  selectionColor: 'rgba(0, 255, 0, 0.3)',
  clipHeaderBackgroundColor: 'rgba(0, 0, 0, 0.1)',
  clipHeaderBorderColor: 'rgba(0, 0, 0, 0.2)',
  clipHeaderTextColor: '#333',
  selectedClipHeaderBackgroundColor: '#b3d9ff', // Brighter blue for selected track clip headers
};

export const darkTheme: WaveformPlaylistTheme = {
  waveOutlineColor: '#4A9EFF', // Lighter blue for dark backgrounds
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff4444', // Slightly brighter red
  selectedWaveOutlineColor: '#66B3FF', // Even lighter blue for selected tracks
  selectedWaveFillColor: '#FFD500', // Keep same yellow
  selectedTrackControlsBackground: '#1a3a5c', // Dark blue for selected track controls
  timeColor: '#e0e0e0', // Light gray for text on dark background
  timescaleBackgroundColor: '#1e1e1e', // Dark background
  playheadColor: '#ff4444',
  selectionColor: 'rgba(0, 255, 0, 0.2)', // Slightly less opaque for dark mode
  clipHeaderBackgroundColor: 'rgba(255, 255, 255, 0.1)', // Light overlay for dark mode
  clipHeaderBorderColor: 'rgba(255, 255, 255, 0.2)',
  clipHeaderTextColor: '#e0e0e0', // Light text
  selectedClipHeaderBackgroundColor: '#2a4a6c', // Darker blue for selected clip headers
};
