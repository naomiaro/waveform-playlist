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
