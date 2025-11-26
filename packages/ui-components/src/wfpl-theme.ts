/**
 * Waveform Playlist Theme
 *
 * This file defines the theme interface and default values for the waveform playlist components.
 */

/**
 * Gradient color stop for waveform gradients
 */
export interface GradientStop {
  offset: number; // 0 to 1
  color: string;
}

/**
 * Gradient configuration for waveforms
 * Can be applied vertically (top to bottom) or horizontally (left to right)
 */
export interface WaveformGradient {
  type: 'linear';
  direction: 'vertical' | 'horizontal';
  stops: GradientStop[];
}

/**
 * Waveform color can be a simple string or a gradient configuration
 */
export type WaveformColor = string | WaveformGradient;

/**
 * Type guard to check if a WaveformColor is a gradient
 */
export function isWaveformGradient(color: WaveformColor): color is WaveformGradient {
  return typeof color === 'object' && color !== null && 'type' in color;
}

/**
 * Converts WaveformColor to a CSS background value
 */
export function waveformColorToCss(color: WaveformColor): string {
  if (!isWaveformGradient(color)) {
    return color;
  }

  const direction = color.direction === 'vertical' ? 'to bottom' : 'to right';
  const stops = color.stops
    .map((stop) => `${stop.color} ${stop.offset * 100}%`)
    .join(', ');

  return `linear-gradient(${direction}, ${stops})`;
}

export interface WaveformPlaylistTheme {
  // Waveform colors - can be solid colors or gradients
  waveOutlineColor: WaveformColor;
  waveFillColor: WaveformColor;
  waveProgressColor: string; // Progress stays solid for simplicity

  // Selected track colors - can also be gradients
  selectedWaveOutlineColor: WaveformColor;
  selectedWaveFillColor: WaveformColor;
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
  clipHeaderFontFamily: string;

  // Selected clip header colors
  selectedClipHeaderBackgroundColor: string;

  // Fade overlay colors
  fadeOverlayColor: string;

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
  annotationTextItemHoverBackground: string;

  // Spacing and sizing
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  fontSizeSmall: string;
}

export const defaultTheme: WaveformPlaylistTheme = {
  // Vertical gradient: deep blue to teal (Berlin underground vibe)
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#0a4f6d' },
      { offset: 0.5, color: '#1a7f8e' },
      { offset: 1, color: '#0a4f6d' },
    ],
  },
  waveFillColor: '#e8f4f8', // Light teal-gray background
  waveProgressColor: '#ff6b6b',
  // Selected: brighter cyan gradient
  selectedWaveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#00b4d8' },
      { offset: 0.5, color: '#48cae4' },
      { offset: 1, color: '#00b4d8' },
    ],
  },
  selectedWaveFillColor: '#caf0f8', // Lighter cyan background when selected
  selectedTrackControlsBackground: '#d9e9ff', // Light blue background for selected track controls
  timeColor: '#000',
  timescaleBackgroundColor: '#fff',
  playheadColor: '#f00',
  selectionColor: 'rgba(255, 105, 180, 0.7)', // hot pink - high contrast on light backgrounds
  clipHeaderBackgroundColor: 'rgba(0, 0, 0, 0.1)',
  clipHeaderBorderColor: 'rgba(0, 0, 0, 0.2)',
  clipHeaderTextColor: '#333',
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#b3d9ff', // Brighter blue for selected track clip headers

  // Fade overlay colors
  fadeOverlayColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent overlay for fade regions

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
  annotationTextItemHoverBackground: 'rgba(0, 0, 0, 0.03)',

  // Spacing and sizing
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};

export const darkTheme: WaveformPlaylistTheme = {
  // Vertical gradient: cyan → magenta → cyan (synthwave/Berlin club vibe)
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#00ffcc' },    // Bright cyan at top
      { offset: 0.5, color: '#ff00aa' },  // Hot magenta in middle
      { offset: 1, color: '#00ffcc' },    // Bright cyan at bottom
    ],
  },
  waveFillColor: '#0d0d1a', // Very dark blue-black background
  waveProgressColor: '#ff6b6b',
  // Selected: electric gold/orange gradient
  selectedWaveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#ffcc00' },    // Gold at top
      { offset: 0.5, color: '#ff6600' },  // Orange in middle
      { offset: 1, color: '#ffcc00' },    // Gold at bottom
    ],
  },
  selectedWaveFillColor: '#1a1000', // Very dark amber when selected
  selectedTrackControlsBackground: '#1a3a5c', // Dark blue for selected track controls
  timeColor: '#e0e0e0', // Light gray for text on dark background
  timescaleBackgroundColor: '#1e1e1e', // Dark background
  playheadColor: '#ff4444',
  selectionColor: 'rgba(255, 105, 180, 0.7)', // hot pink - high contrast on dark backgrounds
  clipHeaderBackgroundColor: 'rgba(255, 255, 255, 0.1)', // Light overlay for dark mode
  clipHeaderBorderColor: 'rgba(255, 255, 255, 0.2)',
  clipHeaderTextColor: '#e0e0e0', // Light text
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#2a4a6c', // Darker blue for selected clip headers

  // Fade overlay colors
  fadeOverlayColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent overlay for fade regions

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
  annotationTextItemHoverBackground: 'rgba(255, 255, 255, 0.05)',

  // Spacing and sizing
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};
