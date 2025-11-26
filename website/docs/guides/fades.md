---
sidebar_position: 4
---

# Fades

Add fade in and fade out effects to your audio clips for smooth transitions. Waveform Playlist supports four different fade curve types to suit different audio scenarios.

## Fade Types

### Linear

Volume changes at a constant rate, creating a straight-line transition.

**Best for:** General purpose fading, predictable behavior

```
Volume
  |    ╱
  |   ╱
  |  ╱
  | ╱
  |╱_________ Time
```

### Logarithmic

Fast initial change that gradually slows down. Mimics human hearing perception.

**Best for:** Natural-sounding fade outs, music endings

```
Volume
  |    ___
  |   ╱
  |  ╱
  | ╱
  |╱_________ Time
```

### Exponential

Slow initial change that accelerates toward the end.

**Best for:** Fade ins, dramatic builds

```
Volume
  |        ╱
  |       ╱
  |     ╱
  |___╱
  |__________ Time
```

### S-Curve

Smooth, gradual start and end with faster transition in the middle. Provides the smoothest perceived transition.

**Best for:** Crossfades, seamless transitions, professional audio work

```
Volume
  |      ___
  |     ╱
  |    │
  |   ╱
  |__╱_______ Time
```

## Basic Usage

### Using useAudioTracks Hook

The simplest way to add fades is through the `useAudioTracks` hook:

```tsx
import { useAudioTracks, WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

function MyPlaylist() {
  const { tracks, loading } = useAudioTracks([
    {
      src: '/audio/vocals.mp3',
      name: 'Vocals',
      fadeIn: { duration: 2, type: 'linear' },
      fadeOut: { duration: 2, type: 'logarithmic' },
    },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

### Fade Configuration

Each fade is defined with just two properties:

```typescript
interface Fade {
  /** Duration of the fade in seconds */
  duration: number;
  /** Type of fade curve (default: 'linear') */
  type?: FadeType;   // 'linear' | 'logarithmic' | 'exponential' | 'sCurve'
}
```

**For fade in:** The fade starts at the beginning of the clip and lasts for the specified duration.

**For fade out:** The fade ends at the end of the clip, starting `duration` seconds before the clip ends.

## Fade Type Comparison

| Type | Fade In | Fade Out | Use Case |
|------|---------|----------|----------|
| `linear` | Good | Good | General purpose |
| `logarithmic` | Acceptable | Excellent | Music endings, natural decay |
| `exponential` | Excellent | Acceptable | Dramatic intros, builds |
| `sCurve` | Excellent | Excellent | Crossfades, seamless edits |

## Advanced Usage

### Creating Clips with Fades Programmatically

For more control, create clips directly using the core library:

```tsx
import { createClipFromSeconds, createTrack } from '@waveform-playlist/core';

// Create a clip with fades
const clip = createClipFromSeconds({
  audioBuffer,
  startTime: 0,
  duration: audioBuffer.duration,
  offset: 0,
  name: 'My Clip',
  fadeIn: { duration: 1.5, type: 'exponential' },
  fadeOut: { duration: 3, type: 'logarithmic' },
});

// Create a track with the clip
const track = createTrack({
  name: 'My Track',
  clips: [clip],
  volume: 1,
  pan: 0,
  muted: false,
  soloed: false,
});
```

### Different Fade Types per Track

Apply different fade curves to different tracks for varied effects:

```tsx
const { tracks, loading } = useAudioTracks([
  {
    src: '/audio/intro.mp3',
    name: 'Intro',
    fadeIn: { duration: 3, type: 'exponential' },   // Dramatic build
    fadeOut: { duration: 1, type: 'sCurve' },       // Smooth transition
  },
  {
    src: '/audio/main.mp3',
    name: 'Main Section',
    fadeIn: { duration: 0.5, type: 'sCurve' },      // Quick smooth fade in
    fadeOut: { duration: 4, type: 'logarithmic' },  // Natural fade out
  },
  {
    src: '/audio/outro.mp3',
    name: 'Outro',
    fadeIn: { duration: 1, type: 'linear' },
    fadeOut: { duration: 5, type: 'logarithmic' },  // Long natural ending
  },
]);
```

### Fade In Only or Fade Out Only

You can apply just a fade in or just a fade out:

```tsx
// Fade in only (no fade out)
{
  src: '/audio/track.mp3',
  name: 'Track',
  fadeIn: { duration: 2, type: 'exponential' },
  // fadeOut is undefined - no fade out
}

// Fade out only (no fade in)
{
  src: '/audio/track.mp3',
  name: 'Track',
  // fadeIn is undefined - no fade in
  fadeOut: { duration: 3, type: 'logarithmic' },
}
```

## Common Fade Durations

| Context | Recommended Duration |
|---------|---------------------|
| Quick transition | 0.25 - 0.5 seconds |
| Standard fade | 1 - 2 seconds |
| Smooth transition | 2 - 4 seconds |
| Dramatic fade out | 4 - 8 seconds |
| Ambient/slow music | 8+ seconds |

## Choosing the Right Fade Type

### For Fade Ins

- **Exponential**: Creates anticipation, dramatic effect
- **S-Curve**: Smooth, professional, unnoticeable
- **Linear**: Predictable, mechanical

### For Fade Outs

- **Logarithmic**: Natural decay, mimics acoustic instruments
- **S-Curve**: Smooth, seamless
- **Linear**: Even, steady decline

### For Crossfades

When overlapping clips (one fading out while another fades in):

- Use **S-Curve** on both for the smoothest transition
- Ensure fade durations match the overlap duration
- Consider using slightly longer fade outs than fade ins

## Complete Example

```tsx
import React from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';

function FadesDemo() {
  const { tracks, loading, error } = useAudioTracks([
    {
      src: '/audio/vocals.mp3',
      name: 'Linear Fade',
      fadeIn: { duration: 2, type: 'linear' },
      fadeOut: { duration: 2, type: 'linear' },
    },
    {
      src: '/audio/drums.mp3',
      name: 'Logarithmic Fade',
      fadeIn: { duration: 2, type: 'logarithmic' },
      fadeOut: { duration: 2, type: 'logarithmic' },
    },
    {
      src: '/audio/guitar.mp3',
      name: 'Exponential Fade',
      fadeIn: { duration: 2, type: 'exponential' },
      fadeOut: { duration: 2, type: 'exponential' },
    },
    {
      src: '/audio/synth.mp3',
      name: 'S-Curve Fade',
      fadeIn: { duration: 2, type: 'sCurve' },
      fadeOut: { duration: 2, type: 'sCurve' },
    },
  ]);

  if (loading) return <div>Loading audio...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

export default FadesDemo;
```

## TypeScript Types

```typescript
import type { Fade, FadeType } from '@waveform-playlist/core';

// FadeType is a union type
type FadeType = 'linear' | 'logarithmic' | 'exponential' | 'sCurve';

// Fade interface - simple duration-based API
interface Fade {
  /** Duration of the fade in seconds */
  duration: number;
  /** Type of fade curve (default: 'linear') */
  type?: FadeType;
}

// AudioTrackConfig with fades
interface AudioTrackConfig {
  src: string;
  name?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  // ... other properties
}
```

## Next Steps

- [Effects](/docs/guides/effects) - Add audio effects like reverb and delay
- [Playback Controls](/docs/guides/playback-controls) - Control playback with play, pause, and stop
- [Track Management](/docs/guides/track-management) - Manage tracks dynamically
