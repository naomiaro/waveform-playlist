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

  // UI component colors
  backgroundColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  textColorMuted: string;

  // Interactive element colors
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  inputFocusBorder: string;

  // Button colors
  buttonBackground: string;
  buttonText: string;
  buttonBorder: string;
  buttonHoverBackground: string;

  // Slider colors
  sliderTrackColor: string;
  sliderThumbColor: string;

  // Annotation colors
  annotationBoxBackground: string;
  annotationBoxActiveBackground: string;
  annotationBoxHoverBackground: string;
  annotationBoxBorder: string;
  annotationBoxActiveBorder: string;
  annotationLabelColor: string;
  annotationResizeHandleColor: string;
  annotationResizeHandleActiveColor: string;

  // Spacing and sizing
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  fontSizeSmall: string;
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
  selectionColor: 'rgba(255, 105, 180, 0.7)', // hot pink - high contrast on light backgrounds
  clipHeaderBackgroundColor: 'rgba(0, 0, 0, 0.1)',
  clipHeaderBorderColor: 'rgba(0, 0, 0, 0.2)',
  clipHeaderTextColor: '#333',
  selectedClipHeaderBackgroundColor: '#b3d9ff', // Brighter blue for selected track clip headers

  // UI component colors
  backgroundColor: '#ffffff',
  surfaceColor: '#f5f5f5',
  borderColor: '#ddd',
  textColor: '#333',
  textColorMuted: '#666',

  // Interactive element colors
  inputBackground: '#ffffff',
  inputBorder: '#ccc',
  inputText: '#333',
  inputPlaceholder: '#999',
  inputFocusBorder: '#0066cc',

  // Button colors
  buttonBackground: '#f0f0f0',
  buttonText: '#333',
  buttonBorder: '#ccc',
  buttonHoverBackground: '#e0e0e0',

  // Slider colors
  sliderTrackColor: '#ddd',
  sliderThumbColor: '#daa520', // goldenrod

  // Annotation colors
  annotationBoxBackground: 'rgba(255, 255, 255, 0.85)',
  annotationBoxActiveBackground: 'rgba(255, 255, 255, 0.95)',
  annotationBoxHoverBackground: 'rgba(255, 255, 255, 0.98)',
  annotationBoxBorder: '#ff9800',
  annotationBoxActiveBorder: '#d67600',
  annotationLabelColor: '#2a2a2a',
  annotationResizeHandleColor: 'rgba(0, 0, 0, 0.4)',
  annotationResizeHandleActiveColor: 'rgba(0, 0, 0, 0.8)',

  // Spacing and sizing
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
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
  selectionColor: 'rgba(255, 105, 180, 0.7)', // hot pink - high contrast on dark backgrounds
  clipHeaderBackgroundColor: 'rgba(255, 255, 255, 0.1)', // Light overlay for dark mode
  clipHeaderBorderColor: 'rgba(255, 255, 255, 0.2)',
  clipHeaderTextColor: '#e0e0e0', // Light text
  selectedClipHeaderBackgroundColor: '#2a4a6c', // Darker blue for selected clip headers

  // UI component colors
  backgroundColor: '#1e1e1e',
  surfaceColor: '#2d2d2d',
  borderColor: '#444',
  textColor: '#e0e0e0',
  textColorMuted: '#999',

  // Interactive element colors
  inputBackground: '#2d2d2d',
  inputBorder: '#555',
  inputText: '#e0e0e0',
  inputPlaceholder: '#777',
  inputFocusBorder: '#4A9EFF',

  // Button colors
  buttonBackground: '#3d3d3d',
  buttonText: '#e0e0e0',
  buttonBorder: '#555',
  buttonHoverBackground: '#4d4d4d',

  // Slider colors
  sliderTrackColor: '#555',
  sliderThumbColor: '#f0c040', // brighter goldenrod for dark mode

  // Annotation colors (dark mode)
  annotationBoxBackground: 'rgba(45, 45, 45, 0.9)',
  annotationBoxActiveBackground: 'rgba(55, 55, 55, 0.95)',
  annotationBoxHoverBackground: 'rgba(65, 65, 65, 0.98)',
  annotationBoxBorder: '#ffb74d',
  annotationBoxActiveBorder: '#ffa726',
  annotationLabelColor: '#e0e0e0',
  annotationResizeHandleColor: 'rgba(255, 255, 255, 0.4)',
  annotationResizeHandleActiveColor: 'rgba(255, 255, 255, 0.8)',

  // Spacing and sizing
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};
