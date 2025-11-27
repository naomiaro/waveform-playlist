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

/**
 * Waveform drawing mode determines how colors are applied:
 * - 'inverted': Canvas draws waveOutlineColor in areas WITHOUT audio (current default).
 *               waveFillColor shows through where audio peaks are. Good for gradient bars.
 * - 'normal': Canvas draws waveFillColor bars where audio peaks ARE.
 *             waveOutlineColor is used as background. Good for gradient backgrounds.
 */
export type WaveformDrawMode = 'inverted' | 'normal';

export interface WaveformPlaylistTheme {
  // Waveform drawing mode - controls how colors are applied
  waveformDrawMode?: WaveformDrawMode;

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
  waveformDrawMode: 'inverted',
  waveOutlineColor: '#ffffff',
  waveFillColor: '#1a7f8e', // White background for crisp look
  waveProgressColor: 'rgba(0, 0, 0, 0.10)', // Subtle dark overlay for light mode

  selectedWaveOutlineColor: '#ffffff',
  selectedWaveFillColor: '#00b4d8',   // Selected: brighter cyan
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

  // Button colors - blue to match common UI patterns
  buttonBackground: '#0091ff',
  buttonText: '#ffffff',
  buttonBorder: '#0081e6',
  buttonHoverBackground: '#0081e6',

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
  // Normal mode: waveOutlineColor = bars, waveFillColor = background
  waveformDrawMode: 'inverted',
  // Dark bars on warm amber background
  waveOutlineColor: '#c49a6c', // Solid warm amber for background
  waveFillColor: '#1a1612', // Very dark warm brown for bars
  waveProgressColor: 'rgba(100, 70, 40, 0.6)', // Warm brown progress overlay
  // Selected: slightly lighter bars on brighter amber background
  selectedWaveFillColor: '#241c14', // Slightly lighter warm brown bars when selected
  selectedWaveOutlineColor: '#e8c090', // Brighter amber background when selected
  selectedTrackControlsBackground: '#2a2218', // Dark warm brown for selected track controls
  timeColor: '#d8c0a8', // Warm amber for timescale text
  timescaleBackgroundColor: '#1a1612', // Dark warm brown background
  playheadColor: '#3a8838', // Darker Ampelmännchen green playhead
  selectionColor: 'rgba(224, 160, 100, 0.5)', // Warm amber selection
  clipHeaderBackgroundColor: 'rgba(20, 16, 12, 0.85)', // Dark background for clip headers
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

  // Button colors - Ampelmännchen green (#63C75F) with black text
  buttonBackground: '#63C75F',
  buttonText: '#0a0a0f',
  buttonBorder: '#52b84e',
  buttonHoverBackground: '#78d074',

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
