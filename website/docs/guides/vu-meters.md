---
sidebar_position: 14
title: VU Meters
description: Real-time audio level monitoring with built-in and custom VU meter components
---

# VU Meters

Waveform-playlist provides VU metering for both recording input and playback output, with built-in components and hooks for custom visualizations.

## Built-In Components

### VUMeter

A simple horizontal bar meter for single-channel level display:

```tsx
import { VUMeter } from '@waveform-playlist/recording';

<VUMeter level={level} peakLevel={peakLevel} width={200} height={20} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `number` | — | Current audio level (0–1) |
| `peakLevel` | `number` | — | Peak level with indicator (0–1) |
| `width` | `number` | `200` | Meter width in pixels |
| `height` | `number` | `20` | Meter height in pixels |

The meter uses color-coded zones: green below 60%, yellow from 60–85%, and red above 85%.

### SegmentedVUMeter

A professional LED-segment style meter with multi-channel support:

```tsx
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

<SegmentedVUMeter levels={[leftLevel, rightLevel]} peakLevels={[leftPeak, rightPeak]} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `levels` | `number[]` | — | Per-channel levels (0–1) |
| `peakLevels` | `number[]` | — | Per-channel peak levels (0–1) |
| `channelLabels` | `string[]` | Auto | Labels per channel (auto: M, L/R, 1/2/3...) |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Meter orientation |
| `segmentCount` | `number` | `24` | Number of LED segments |
| `dBRange` | `[number, number]` | `[-50, 5]` | dB scale range |
| `showScale` | `boolean` | `true` | Show dB scale labels |
| `colorStops` | `ColorStop[]` | Built-in | Custom color scheme |
| `segmentWidth` | `number` | `20` | Segment width in pixels |
| `segmentHeight` | `number` | `8` | Segment height in pixels |

## Input Metering

The `useMicrophoneLevel` hook provides real-time microphone input levels. Set `channelCount: 2` to get per-channel stereo data:

```tsx
import {
  useMicrophoneAccess,
  useMicrophoneLevel,
} from '@waveform-playlist/recording';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function InputMeter() {
  const { stream, hasAccess, requestAccess } = useMicrophoneAccess();
  const { levels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 2 });

  if (!hasAccess) {
    return <button onClick={requestAccess}>Enable Microphone</button>;
  }

  return <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;
}
```

### useMicrophoneLevel Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channelCount` | `number` | `1` | Number of channels to meter |
| `updateRate` | `number` | `60` | Update frequency in Hz |
| `smoothingTimeConstant` | `number` | `0.8` | Smoothing (0–1, higher = smoother) |

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `levels` | `number[]` | Per-channel levels (0–1), array length matches `channelCount` |
| `peakLevels` | `number[]` | Per-channel peak levels (0–1) |
| `level` | `number` | Single scalar level (channel 0 for mono, max across channels for multi) |
| `peakLevel` | `number` | Single scalar peak level |
| `resetPeak` | `() => void` | Reset all peak levels to 0 |

## Output Metering

The `useOutputMeter` hook monitors playback output levels. It must be used inside a `WaveformPlaylistProvider`:

```tsx
import { useOutputMeter } from '@waveform-playlist/browser';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function OutputMeter() {
  const { levels, peakLevels } = useOutputMeter({ channelCount: 2 });
  return <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;
}
```

### useOutputMeter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channelCount` | `number` | `2` | Number of channels to meter |
| `updateRate` | `number` | `60` | Update frequency in Hz |
| `smoothingTimeConstant` | `number` | `0.8` | Smoothing (0–1, higher = smoother) |

The hook connects a Tone.js Meter to the audio Destination node. It returns `levels`, `peakLevels`, and `resetPeak` with the same shape as `useMicrophoneLevel`.

## Building a Custom Meter

Both hooks return `levels` as an array of normalized 0–1 values per channel. You can convert these to dB using `normalizedToDb` from `@waveform-playlist/core`:

```tsx
import { useMicrophoneLevel, useMicrophoneAccess } from '@waveform-playlist/recording';
import { normalizedToDb } from '@waveform-playlist/core';

function CustomMeter() {
  const { stream } = useMicrophoneAccess();
  const { levels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 2 });
  const channelLabels = ['L', 'R'];

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      {levels.map((level, i) => {
        const dB = normalizedToDb(level);
        const color = dB > -2 ? 'red' : dB > -10 ? 'yellow' : 'green';
        return (
          <div key={channelLabels[i]}>
            <div>{channelLabels[i]}</div>
            <div style={{
              width: '20px',
              height: '200px',
              background: '#333',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: `${level * 100}%`,
                background: color,
                transition: 'height 50ms',
              }} />
            </div>
            <div style={{ fontSize: '10px' }}>{dB.toFixed(0)} dB</div>
          </div>
        );
      })}
    </div>
  );
}
```

This pattern works identically with `useOutputMeter` for playback metering.

## Customizing SegmentedVUMeter

### Custom Color Scheme

Override the default color stops with your own:

```tsx
<SegmentedVUMeter
  levels={levels}
  peakLevels={peakLevels}
  colorStops={[
    { dB: 0, color: '#ff0000' },
    { dB: -6, color: '#ffaa00' },
    { dB: -18, color: '#00ff00' },
    { dB: -50, color: '#004400' },
  ]}
/>
```

### Horizontal Orientation

```tsx
<SegmentedVUMeter
  levels={levels}
  peakLevels={peakLevels}
  orientation="horizontal"
/>
```

### Sizing and Scale

```tsx
<SegmentedVUMeter
  levels={levels}
  peakLevels={peakLevels}
  segmentCount={16}
  segmentWidth={30}
  segmentHeight={6}
  dBRange={[-60, 3]}
  showScale={false}
/>
```

## Multi-Channel

The `channelCount` option maps directly to Tone.js Meter channels. The default is `1` for input metering (most microphones are mono) and `2` for output metering (stereo playback).

For multi-channel audio interfaces, set `channelCount` higher:

```tsx
// 4-channel input metering
const { levels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 4 });

// SegmentedVUMeter auto-labels channels as 1, 2, 3, 4
<SegmentedVUMeter
  levels={levels}
  peakLevels={peakLevels}
  channelLabels={['Front L', 'Front R', 'Rear L', 'Rear R']}
/>
```

When `channelCount` is 1, the scalar `level` and `peakLevel` return values are identical to `levels[0]` and `peakLevels[0]`. When `channelCount` is greater than 1, the scalar values are the maximum across all channels.

## Next Steps

- [Recording](/docs/guides/recording) — Record audio with level monitoring
- [Audio Effects](/docs/guides/effects) — Apply effects to tracks and master output
