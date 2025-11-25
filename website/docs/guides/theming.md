---
sidebar_position: 6
---

# Theming

Customize the appearance of Waveform Playlist with the built-in theming system.

## Theme Structure

Themes are applied at the provider level:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

const myTheme = {
  waveBackgroundColor: '#ffffff',
  waveColor: '#0066cc',
  waveOutlineColor: '#003366',
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

## Theme Properties

### Waveform Colors

```typescript
interface WaveformTheme {
  // Background behind waveforms
  waveBackgroundColor: string;

  // Fill color of the waveform
  waveColor: string;

  // Outline/stroke color of the waveform
  waveOutlineColor: string;

  // Selected track waveform outline (brighter)
  selectedWaveOutlineColor: string;
}
```

### Track Controls

```typescript
interface TrackControlsTheme {
  // Controls panel background
  trackControlsBackground: string;

  // Selected track controls background
  selectedTrackControlsBackground: string;

  // Track name text color
  trackNameColor: string;
}
```

### Clip Headers

```typescript
interface ClipHeaderTheme {
  // Clip header background
  clipHeaderBackgroundColor: string;

  // Selected clip header background
  selectedClipHeaderBackgroundColor: string;

  // Clip header text color
  clipHeaderTextColor: string;
}
```

### Cursor and Selection

```typescript
interface CursorTheme {
  // Playhead cursor color
  cursorColor: string;

  // Selection highlight color
  selectionColor: string;
}
```

### Timeline

```typescript
interface TimelineTheme {
  // Timescale background
  timescaleBackgroundColor: string;

  // Timescale text color
  timescaleTextColor: string;

  // Timescale tick marks color
  timescaleTickColor: string;
}
```

## Built-in Themes

### Light Theme (Default)

```tsx
import { defaultTheme } from '@waveform-playlist/browser';

// defaultTheme values
const lightTheme = {
  waveBackgroundColor: '#ffffff',
  waveColor: '#337ab7',
  waveOutlineColor: '#005BBB',
  selectedWaveOutlineColor: '#0099ff',
  trackControlsBackground: '#f5f5f5',
  selectedTrackControlsBackground: '#d9e9ff',
  clipHeaderBackgroundColor: '#dce9f5',
  selectedClipHeaderBackgroundColor: '#b3d9ff',
  cursorColor: '#ff0000',
  selectionColor: 'rgba(0, 102, 204, 0.3)',
  timescaleBackgroundColor: '#f0f0f0',
  timescaleTextColor: '#333333',
};
```

### Dark Theme

```tsx
const darkTheme = {
  waveBackgroundColor: '#1e1e1e',
  waveColor: '#5c9fd4',
  waveOutlineColor: '#3a7fc2',
  selectedWaveOutlineColor: '#66b3ff',
  trackControlsBackground: '#2d2d2d',
  selectedTrackControlsBackground: '#3a4a5c',
  clipHeaderBackgroundColor: '#3a3a3a',
  selectedClipHeaderBackgroundColor: '#4a5a6a',
  clipHeaderTextColor: '#ffffff',
  trackNameColor: '#ffffff',
  cursorColor: '#ff6666',
  selectionColor: 'rgba(100, 150, 200, 0.4)',
  timescaleBackgroundColor: '#2a2a2a',
  timescaleTextColor: '#cccccc',
};
```

## Partial Themes

You can provide partial themes that override only specific properties:

```tsx
const customTheme = {
  waveColor: '#00ff00',      // Only change waveform color
  cursorColor: '#ff00ff',    // And cursor color
};

// Other properties use defaults
<WaveformPlaylistProvider tracks={tracks} theme={customTheme}>
```

## Docusaurus Integration

Automatically sync with Docusaurus theme:

```tsx
import { useColorMode } from '@docusaurus/theme-common';
import { defaultTheme } from '@waveform-playlist/browser';

const darkTheme = {
  waveBackgroundColor: '#1e1e1e',
  waveColor: '#5c9fd4',
  // ...
};

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
import { defaultTheme } from '@waveform-playlist/browser';

function useCustomTheme(isDark: boolean) {
  return useMemo(() => {
    if (isDark) {
      return {
        ...defaultTheme,
        waveBackgroundColor: '#1e1e1e',
        waveColor: '#5c9fd4',
        waveOutlineColor: '#3a7fc2',
        trackControlsBackground: '#2d2d2d',
        clipHeaderBackgroundColor: '#3a3a3a',
        clipHeaderTextColor: '#ffffff',
        timescaleBackgroundColor: '#2a2a2a',
        timescaleTextColor: '#cccccc',
      };
    }
    return defaultTheme;
  }, [isDark]);
}
```

## CSS Variables Integration

Use CSS variables for dynamic theming:

```tsx
const cssVarTheme = {
  waveBackgroundColor: 'var(--wfpl-wave-bg, #ffffff)',
  waveColor: 'var(--wfpl-wave-color, #337ab7)',
  waveOutlineColor: 'var(--wfpl-wave-outline, #005BBB)',
  cursorColor: 'var(--wfpl-cursor, #ff0000)',
  selectionColor: 'var(--wfpl-selection, rgba(0, 102, 204, 0.3))',
};

// In your CSS
// :root {
//   --wfpl-wave-bg: #ffffff;
//   --wfpl-wave-color: #337ab7;
// }
// :root[data-theme='dark'] {
//   --wfpl-wave-bg: #1e1e1e;
//   --wfpl-wave-color: #5c9fd4;
// }
```

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
  waveBackgroundColor: '#e8f4f8',
  waveColor: '#0077b6',
  waveOutlineColor: '#023e8a',
  selectedWaveOutlineColor: '#00b4d8',

  // Track controls
  trackControlsBackground: '#caf0f8',
  selectedTrackControlsBackground: '#90e0ef',
  trackNameColor: '#03045e',

  // Clip headers
  clipHeaderBackgroundColor: '#ade8f4',
  selectedClipHeaderBackgroundColor: '#48cae4',
  clipHeaderTextColor: '#023e8a',

  // Cursor and selection
  cursorColor: '#ff6b6b',
  selectionColor: 'rgba(0, 119, 182, 0.3)',

  // Timeline
  timescaleBackgroundColor: '#caf0f8',
  timescaleTextColor: '#03045e',
  timescaleTickColor: '#0077b6',
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
      timescale
      controls={{ show: true, width: 180 }}
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

## Theme Type Definition

Full TypeScript type for themes:

```typescript
interface WaveformPlaylistTheme {
  // Waveform
  waveBackgroundColor: string;
  waveColor: string;
  waveOutlineColor: string;
  selectedWaveOutlineColor: string;

  // Track controls
  trackControlsBackground: string;
  selectedTrackControlsBackground: string;
  trackNameColor: string;

  // Clip headers
  clipHeaderBackgroundColor: string;
  selectedClipHeaderBackgroundColor: string;
  clipHeaderTextColor: string;

  // Cursor and selection
  cursorColor: string;
  selectionColor: string;

  // Timeline
  timescaleBackgroundColor: string;
  timescaleTextColor: string;
  timescaleTickColor: string;
}
```

## Best Practices

1. **Contrast** - Ensure sufficient contrast between waveform and background
2. **Selection visibility** - Make selected states clearly distinguishable
3. **Cursor visibility** - Use a high-contrast color for the playhead
4. **Consistency** - Match your application's overall design system
5. **Accessibility** - Test themes with color blindness simulators

## Next Steps

- [API Reference: Provider](/api/provider) - Full provider configuration
- [Examples](/examples) - See themed examples in action
