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
  waveProgressColor: 'rgba(0, 0, 0, 0.15)', // Subtle dark overlay for light mode
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
  // Warm amber gradient - matches the "low watt bulb" text aesthetic
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#c49a6c' },    // Muted amber at top
      { offset: 0.5, color: '#a07850' },  // Deeper amber in middle
      { offset: 1, color: '#c49a6c' },    // Muted amber at bottom
    ],
  },
  waveFillColor: '#1a1612', // Very dark warm brown background
  waveProgressColor: 'rgba(60, 40, 20, 0.5)', // Darker warm overlay - more visible contrast
  // Selected: brighter warm amber
  selectedWaveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#e8c090' },    // Brighter amber at top
      { offset: 0.5, color: '#d4a070' },  // Warm amber in middle
      { offset: 1, color: '#e8c090' },    // Brighter amber at bottom
    ],
  },
  selectedWaveFillColor: '#241c14', // Slightly lighter warm brown when selected
  selectedTrackControlsBackground: '#2a2218', // Dark warm brown for selected track controls
  timeColor: '#d8c0a8', // Warm amber for timescale text
  timescaleBackgroundColor: '#1a1612', // Dark warm brown background
  playheadColor: '#e07040', // Warm orange-red playhead
  selectionColor: 'rgba(224, 160, 100, 0.5)', // Warm amber selection
  clipHeaderBackgroundColor: 'rgba(200, 160, 120, 0.15)', // Warm overlay for dark mode
  clipHeaderBorderColor: 'rgba(200, 160, 120, 0.25)',
  clipHeaderTextColor: '#d8c0a8', // Warm amber text
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#3a2c20', // Darker warm brown for selected clip headers

  // Fade overlay colors
  fadeOverlayColor: 'rgba(200, 100, 80, 0.5)', // Warm red-orange overlay visible on dark backgrounds

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

  // Annotation colors (dark mode - warm amber theme)
  annotationBoxBackground: 'rgba(40, 32, 24, 0.9)',
  annotationBoxActiveBackground: 'rgba(50, 40, 30, 0.95)',
  annotationBoxHoverBackground: 'rgba(60, 48, 36, 0.98)',
  annotationBoxBorder: '#c49a6c',
  annotationBoxActiveBorder: '#d4a87c',
  annotationLabelColor: '#d8c0a8',
  annotationResizeHandleColor: 'rgba(200, 160, 120, 0.5)',
  annotationResizeHandleActiveColor: 'rgba(220, 180, 140, 0.8)',
  annotationTextItemHoverBackground: 'rgba(200, 160, 120, 0.08)',

  // Spacing and sizing
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};
