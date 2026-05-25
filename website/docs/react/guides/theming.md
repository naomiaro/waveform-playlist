---
sidebar_position: 8
description: "Customize Waveform Playlist appearance with theme tokens, dark mode, and styled-components"
---

# Theming

Customize the appearance of Waveform Playlist with the built-in theming system.

## Theme Structure

Themes are applied at the provider level:

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

## Built-in Themes

### Light Theme (Default)

```tsx
import { defaultTheme } from '@waveform-playlist/ui-components';

// defaultTheme values
const lightTheme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  selectedWaveOutlineColor: '#0099ff',
  selectedWaveFillColor: '#FFD500',
  selectedTrackControlsBackground: '#d9e9ff',
  timeColor: '#000',
  timescaleBackgroundColor: '#fff',
  playheadColor: '#f00',
  selectionColor: 'rgba(255, 105, 180, 0.7)',
  clipHeaderBackgroundColor: 'rgba(0, 0, 0, 0.1)',
  clipHeaderBorderColor: 'rgba(0, 0, 0, 0.2)',
  clipHeaderTextColor: '#333',
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#b3d9ff',
  // ... UI and annotation properties
};
```

### Dark Theme

```tsx
import { darkTheme } from '@waveform-playlist/ui-components';

// darkTheme values
const dark = {
  waveOutlineColor: '#4A9EFF',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff4444',
  selectedWaveOutlineColor: '#66B3FF',
  selectedWaveFillColor: '#FFD500',
  selectedTrackControlsBackground: '#1a3a5c',
  timeColor: '#e0e0e0',
  timescaleBackgroundColor: '#1e1e1e',
  playheadColor: '#ff4444',
  selectionColor: 'rgba(255, 105, 180, 0.7)',
  clipHeaderBackgroundColor: 'rgba(255, 255, 255, 0.1)',
  clipHeaderBorderColor: 'rgba(255, 255, 255, 0.2)',
  clipHeaderTextColor: '#e0e0e0',
  clipHeaderFontFamily: 'inherit',
  selectedClipHeaderBackgroundColor: '#2a4a6c',
  // ... UI and annotation properties
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
  useAudioTracks,
} from '@waveform-playlist/browser';

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
      <Waveform timescale />
    </WaveformPlaylistProvider>
  );
}
```

## Full Theme Type Definition

```typescript
interface WaveformPlaylistTheme {
  // Waveform colors
  waveOutlineColor: string;      // Color of waveform bars/outline
  waveFillColor: string;         // Background color behind waveform
  waveProgressColor: string;     // Fill color behind played portion (SoundCloud-style)
  selectedWaveOutlineColor: string;
  selectedWaveFillColor: string;
  selectedTrackControlsBackground: string;

  // Timescale colors
  timeColor: string;
  timescaleBackgroundColor: string;

  // Playback UI colors
  playheadColor: string;         // Vertical line showing current position
  selectionColor: string;

  // Clip header colors
  clipHeaderBackgroundColor: string;
  clipHeaderBorderColor: string;
  clipHeaderTextColor: string;
  clipHeaderFontFamily: string;    // Font family for clip header text
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
  annotationTextItemHoverBackground: string;

  // Spacing and sizing
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  fontSizeSmall: string;
}
```

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
- `waveProgressColor`

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

- [Custom Playhead](/docs/api/components#custom-playhead) - Create a custom playhead component
- [API Reference: Provider](/docs/api/providers/waveform-playlist-provider) - Full provider configuration
- [Examples](/examples) - See themed examples in action
