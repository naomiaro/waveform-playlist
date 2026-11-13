---
sidebar_position: 8
description: "Customize Waveform Playlist appearance with theme tokens, dark mode, and styled-components"
---

# Theming

Customize the appearance of Waveform Playlist with the built-in theming system.

## Theme Structure

Themes are applied at the provider level, under both `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

const myTheme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  playheadColor: '#ff0000',
  // ... more properties
};

function ThemedPlaylist() {
  return (
    <WaveformPlaylistProvider tracks={tracks} theme={myTheme}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The theme is a provider prop and not one of the [view options](/docs/react/guides/composing-the-view#view-options): it is not an option of one view. The transport controls, the checkboxes and the annotation list are drawn outside a view and read it too.

The provider renders styled-components' `ThemeProvider` with `{ ...defaultTheme, ...theme }`. styled-components merges that object over the theme of a `ThemeProvider` above it, so a `ThemeProvider` of your application above the library's provider cannot set a key that `defaultTheme` defines: inside the provider those keys come from `defaultTheme` and the `theme` prop. Pass them in the `theme` prop. Keys of your own theme that `defaultTheme` does not define stay readable below the provider.

## Built-in Themes

### Light Theme (Default)

```tsx
import { defaultTheme } from '@waveform-playlist/ui-components';

// defaultTheme values
const lightTheme = {
  waveformDrawMode: 'inverted',
  waveOutlineColor: '#ffffff',
  waveFillColor: '#1a7f8e',
  waveProgressColor: 'rgba(0, 0, 0, 0.10)',
  selectedWaveOutlineColor: '#ffffff',
  selectedWaveFillColor: '#00b4d8',
  selectedTrackControlsBackground: '#d9e9ff',
  selectedTrackBackground: '#e8f0fe',
  timeColor: '#000',
  timescaleBackgroundColor: '#fff',
  playheadColor: '#f00',
  selectionColor: 'rgba(255, 105, 180, 0.7)',
  loopRegionColor: 'rgba(59, 130, 246, 0.3)',
  loopMarkerColor: '#3b82f6',
  clipHeaderBackgroundColor: 'rgba(0, 0, 0, 0.1)',
  clipHeaderBorderColor: 'rgba(0, 0, 0, 0.2)',
  clipHeaderTextColor: '#333',
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#b3d9ff',
  fadeOverlayColor: 'rgba(0, 0, 0, 0.4)',
  backgroundColor: '#ffffff',
  surfaceColor: '#f5f5f5',
  borderColor: '#ddd',
  textColor: '#333',
  textColorMuted: '#666',
  inputBackground: '#ffffff',
  inputBorder: '#ccc',
  inputText: '#333',
  inputPlaceholder: '#999',
  inputFocusBorder: '#0066cc',
  buttonBackground: '#0091ff',
  buttonText: '#ffffff',
  buttonBorder: '#0081e6',
  buttonHoverBackground: '#0081e6',
  sliderTrackColor: '#ddd',
  sliderThumbColor: '#daa520',
  annotationBoxBackground: 'rgba(255, 255, 255, 0.85)',
  annotationBoxActiveBackground: 'rgba(255, 255, 255, 0.95)',
  annotationBoxHoverBackground: 'rgba(255, 255, 255, 0.98)',
  annotationBoxBorder: '#ff9800',
  annotationBoxActiveBorder: '#d67600',
  annotationLabelColor: '#2a2a2a',
  annotationResizeHandleColor: 'rgba(0, 0, 0, 0.4)',
  annotationResizeHandleActiveColor: 'rgba(0, 0, 0, 0.8)',
  annotationTextItemHoverBackground: 'rgba(0, 0, 0, 0.03)',
  annotationTextItemActiveColor: '#ff9800',
  pianoRollNoteColor: '#2a7070',
  pianoRollSelectedNoteColor: '#3d9e9e',
  pianoRollBackgroundColor: '#1a1a2e',
  spectrogramBackgroundColor: '#000',
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};
```

### Dark Theme

```tsx
import { darkTheme } from '@waveform-playlist/ui-components';

// darkTheme values
const dark = {
  waveformDrawMode: 'inverted',
  waveOutlineColor: '#c49a6c',
  waveFillColor: '#1a1612',
  waveProgressColor: 'rgba(100, 70, 40, 0.6)',
  selectedWaveFillColor: '#241c14',
  selectedWaveOutlineColor: '#e8c090',
  selectedTrackControlsBackground: '#2a2218',
  selectedTrackBackground: '#e8c090',
  timeColor: '#d8c0a8',
  timescaleBackgroundColor: '#1a1612',
  playheadColor: '#3a8838',
  selectionColor: 'rgba(60, 140, 58, 0.6)',
  loopRegionColor: 'rgba(96, 165, 250, 0.35)',
  loopMarkerColor: '#60a5fa',
  clipHeaderBackgroundColor: 'rgba(20, 16, 12, 0.85)',
  clipHeaderBorderColor: 'rgba(200, 160, 120, 0.25)',
  clipHeaderTextColor: '#d8c0a8',
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#3a2c20',
  fadeOverlayColor: 'rgba(200, 100, 80, 0.5)',
  backgroundColor: '#1e1e1e',
  surfaceColor: '#2d2d2d',
  borderColor: '#444',
  textColor: '#e0e0e0',
  textColorMuted: '#999',
  inputBackground: '#2d2d2d',
  inputBorder: '#555',
  inputText: '#e0e0e0',
  inputPlaceholder: '#777',
  inputFocusBorder: '#4A9EFF',
  buttonBackground: '#63C75F',
  buttonText: '#0a0a0f',
  buttonBorder: '#52b84e',
  buttonHoverBackground: '#78d074',
  sliderTrackColor: '#555',
  sliderThumbColor: '#f0c040',
  annotationBoxBackground: 'rgba(40, 32, 24, 0.9)',
  annotationBoxActiveBackground: 'rgba(50, 40, 30, 0.95)',
  annotationBoxHoverBackground: 'rgba(60, 48, 36, 0.98)',
  annotationBoxBorder: '#ff9800',
  annotationBoxActiveBorder: '#d4a87c',
  annotationLabelColor: '#d8c0a8',
  annotationResizeHandleColor: 'rgba(200, 160, 120, 0.5)',
  annotationResizeHandleActiveColor: 'rgba(220, 180, 140, 0.8)',
  annotationTextItemHoverBackground: 'rgba(200, 160, 120, 0.08)',
  annotationTextItemActiveColor: '#ff9800',
  pianoRollNoteColor: '#c49a6c',
  pianoRollSelectedNoteColor: '#e8c090',
  pianoRollBackgroundColor: '#0d0d14',
  spectrogramBackgroundColor: '#000',
  borderRadius: '4px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: '14px',
  fontSizeSmall: '12px',
};
```

## Partial Themes

You can provide partial themes that override only specific properties:

```tsx
const customTheme = {
  waveFillColor: '#00ff00',     // Only change waveform fill
  playheadColor: '#ff00ff',     // And playhead color
};

// Other properties use defaults
<WaveformPlaylistProvider tracks={tracks} theme={customTheme}>
```

## Docusaurus Integration

Automatically sync with Docusaurus theme:

```tsx
import { useColorMode } from '@docusaurus/theme-common';
import { defaultTheme, darkTheme } from '@waveform-playlist/ui-components';

function DocusaurusExample() {
  const { colorMode } = useColorMode();
  const theme = colorMode === 'dark' ? darkTheme : defaultTheme;

  return (
    <WaveformPlaylistProvider tracks={tracks} theme={theme}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Custom Theme Hook

Create a reusable theme hook:

```tsx
import { useMemo } from 'react';
import { defaultTheme, darkTheme } from '@waveform-playlist/ui-components';

function useCustomTheme(isDark: boolean) {
  return useMemo(() => {
    const base = isDark ? darkTheme : defaultTheme;
    return {
      ...base,
      // Custom overrides
      playheadColor: '#00ff00',
      selectionColor: 'rgba(0, 255, 0, 0.3)',
    };
  }, [isDark]);
}
```

## CSS Variables Integration (Advanced)

The library doesn't provide built-in CSS variables, but you can create your own CSS variable-based theme for dynamic theming without JavaScript:

```tsx
// Define a theme that references your CSS variables
const cssVarTheme = {
  waveOutlineColor: 'var(--wfpl-wave-outline, #005BBB)',
  waveFillColor: 'var(--wfpl-wave-fill, #FFD500)',
  playheadColor: 'var(--wfpl-playhead, #ff0000)',
  selectionColor: 'var(--wfpl-selection, rgba(255, 105, 180, 0.7))',
};

// Then define the CSS variables in your stylesheet
```

```css
/* In your CSS */
:root {
  --wfpl-wave-outline: #005BBB;
  --wfpl-wave-fill: #FFD500;
  --wfpl-playhead: #ff0000;
}

:root[data-theme='dark'] {
  --wfpl-wave-outline: #4A9EFF;
  --wfpl-wave-fill: #FFD500;
  --wfpl-playhead: #ff4444;
}
```

This approach allows theme switching without re-rendering the React component tree.

## Complete Theme Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
} from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';

const oceanTheme = {
  // Waveform
  waveOutlineColor: '#023e8a',
  waveFillColor: '#0077b6',
  waveProgressColor: '#ff6b6b',
  selectedWaveOutlineColor: '#00b4d8',
  selectedWaveFillColor: '#48cae4',

  // Track controls
  selectedTrackControlsBackground: '#90e0ef',

  // Clip headers
  clipHeaderBackgroundColor: '#ade8f4',
  clipHeaderBorderColor: '#48cae4',
  clipHeaderTextColor: '#023e8a',
  clipHeaderFontFamily: '"Courier New", monospace', // Custom font
  selectedClipHeaderBackgroundColor: '#48cae4',

  // Playhead and selection
  playheadColor: '#ff6b6b',
  selectionColor: 'rgba(0, 119, 182, 0.3)',

  // Timeline
  timeColor: '#03045e',
  timescaleBackgroundColor: '#caf0f8',

  // UI
  backgroundColor: '#e8f4f8',
  surfaceColor: '#caf0f8',
  textColor: '#03045e',
};

function OceanThemedPlaylist() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/track.mp3', name: 'Track' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      theme={oceanTheme}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Full Theme Type Definition

From `packages/ui-components/src/wfpl-theme.ts`. `WaveformColor` is a string or a gradient (see [Gradient Colors](#gradient-colors)). The optional keys have a fallback in the component that reads them: `spectrogramBackgroundColor`, the background behind a spectrogram, is `#000` in both built-in themes and when the key is missing.

```typescript
interface WaveformPlaylistTheme {
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
  selectedTrackBackground: string;

  // Timescale colors
  timeColor: string;
  timescaleBackgroundColor: string;

  // Playback UI colors
  playheadColor: string;
  selectionColor: string;

  // Loop region colors (Audacity-style loop markers)
  loopRegionColor: string;
  loopMarkerColor: string;

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
  /**
   * The active row of the annotation list (its edge, tint and glow) and the
   * list's focus rings. Optional, so a complete theme object written before
   * the key existed still type-checks; without it the colour is `#ff9800`.
   */
  annotationTextItemActiveColor?: string;

  // Playlist container background (falls back to waveOutlineColor when unset)
  playlistBackgroundColor?: string;

  // Piano roll colors (MIDI visualization)
  pianoRollNoteColor: string;
  pianoRollSelectedNoteColor: string;
  pianoRollBackgroundColor: string;

  /**
   * Background behind a spectrogram. Optional so that a complete theme
   * object written before the key existed still type-checks; without it the
   * colour is `#000`.
   */
  spectrogramBackgroundColor?: string;

  // Spacing and sizing
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  fontSizeSmall: string;
}```

## Playback Progress Styling

You have two visual indicators for playback position:

1. **Playhead** (`playheadColor`) - A vertical line showing the current position
2. **Progress fill** (`waveProgressColor`) - Fills behind the played portion of the waveform (SoundCloud-style)

You can customize how these appear:

```tsx
// Both visible (default) - playhead line + colored progress fill
const bothVisible = {
  playheadColor: '#ff0000',
  waveProgressColor: 'orange',
};

// Playhead only - set progress same as background
const playheadOnly = {
  playheadColor: '#333333',
  waveProgressColor: '#f0f0f0',  // Same as waveFillColor
  waveFillColor: '#f0f0f0',
};

// Progress only - set playhead to transparent
const progressOnly = {
  playheadColor: 'transparent',
  waveProgressColor: 'orange',
};
```

See the [Styling Example](/examples/styling) for live demonstrations.

## Gradient Colors

Waveform colors support both solid colors and linear gradients:

```tsx
const gradientTheme = {
  // Solid color (string)
  waveFillColor: '#1a1612',

  // Gradient color (object)
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',  // 'vertical' or 'horizontal'
    stops: [
      { offset: 0, color: '#d4a574' },
      { offset: 0.5, color: '#c49a6c' },
      { offset: 1, color: '#d4a574' },
    ],
  },
};
```

### Gradient Color Type

```typescript
type WaveformColor = string | {
  type: 'linear';
  direction: 'vertical' | 'horizontal';
  stops: Array<{
    offset: number;  // 0 to 1
    color: string;
  }>;
};
```

The following properties support gradients:
- `waveOutlineColor` / `selectedWaveOutlineColor`
- `waveFillColor` / `selectedWaveFillColor`

`waveProgressColor` is a plain colour string.

:::warning Gradients and Scrolling
Gradient colors work best for **non-scrolling waveforms** (single tracks that fit in the viewport). When using `automaticScroll` or horizontal scrolling, gradients will scroll with the content, which can look unnatural since the gradient position shifts as you scroll.

For scrolling playlists, prefer solid colors instead.
:::

## Best Practices

1. **Contrast** - Ensure sufficient contrast between waveform and background
2. **Selection visibility** - Make selected states clearly distinguishable
3. **Playhead visibility** - Use a high-contrast color for the playhead
4. **Progress visibility** - Consider whether you want both playhead and progress, or just one
5. **Consistency** - Match your application's overall design system
6. **Accessibility** - Test themes with color blindness simulators
7. **Gradients** - Use gradients only for non-scrolling waveforms

## Next Steps

- [Custom Playhead](/docs/react/api/components#custom-playhead) - Create a custom playhead component
- [API Reference: Provider](/docs/react/api/providers/waveform-playlist-provider) - Full provider configuration
- [Examples](/examples) - See themed examples in action
