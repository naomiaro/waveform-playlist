---
sidebar_position: 14
title: VU Meters
description: Real-time audio level monitoring with built-in and custom VU meter components
---

# VU Meters

Waveform-playlist provides VU metering for both recording input and playback output, with built-in components and hooks for custom visualizations.

## Peak vs RMS Metering

Both metering hooks provide **true peak** and **RMS** (root mean square) levels. They measure different things and are useful in different contexts:

| Meter | Measures | Use for |
|-------|----------|---------|
| **Peak** (`levels`) | Highest sample value per frame | Clipping detection, setting compressor thresholds, recording levels |
| **RMS** (`rmsLevels`) | Average signal power over time | Perceived loudness, mix balance, identifying instruments eating headroom |

Peak responds instantly to transients — if a drum hit clips, you'll see it. RMS is smoother and closer to how loud something *sounds*. A large gap between peak and RMS indicates dynamic audio; a small gap indicates heavy compression.

Both hooks use an AudioWorklet processor that measures every audio sample — no transient is missed, even between animation frames. This guarantees accurate clipping detection for recording.

By default, the `SegmentedVUMeter` component displays peak levels. Pass `rmsLevels` instead of `levels` if you want an RMS meter.

## Built-In Components

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
| `dBRange` | `[number, number]` | `[-50, 5]` | dB scale range (supports above 0 dB for output meters) |
| `showScale` | `boolean` | `true` | Show dB scale labels |
| `colorStops` | `ColorStop[]` | Built-in | Custom color scheme |
| `segmentWidth` | `number` | `20` | Segment width in pixels |
| `segmentHeight` | `number` | `8` | Segment height in pixels |
| `segmentGap` | `number` | `2` | Gap between segments in pixels |
| `coloredInactive` | `boolean` | `false` | Show inactive segments in dimmed color instead of flat dark |
| `labelColor` | `string` | `'#888'` | Color for scale labels and channel labels |

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

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `levels` | `number[]` | Per-channel true peak levels (0–1) |
| `peakLevels` | `number[]` | Per-channel held peak levels (0–1) — highest value seen since last reset |
| `rmsLevels` | `number[]` | Per-channel RMS levels (0–1) — average signal power |
| `level` | `number` | Single scalar peak level (channel 0 for mono, max across channels for multi) |
| `peakLevel` | `number` | Single scalar held peak level |
| `resetPeak` | `() => void` | Reset all held peak levels to 0 |

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

The hook returns `levels` (true peak), `peakLevels` (held peak), `rmsLevels`, and `resetPeak` with the same shape as `useMicrophoneLevel`.

## Choosing Peak vs RMS

Both hooks expose peak and RMS — choose based on your use case:

```tsx
// Peak meter (default) — best for recording and clipping detection
<SegmentedVUMeter levels={levels} peakLevels={peakLevels} />

// RMS meter — best for showing perceived loudness
<SegmentedVUMeter levels={rmsLevels} />

// Both side by side — useful for dynamics processing UI
<div style={{ display: 'flex', gap: '1rem' }}>
  <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />
  <SegmentedVUMeter levels={rmsLevels} />
</div>
```

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
    { dB: -1, color: '#ff0000' },
    { dB: -6, color: '#ffaa00' },
    { dB: -18, color: '#00ff00' },
    { dB: -50, color: '#004400' },
  ]}
/>
```

:::tip
The default `dBRange` is `[-50, 5]`, allowing above-0 dB display for output meters where mixed tracks can exceed 0 dB. Microphone input is clamped to 0 dB by the audio driver, so input meters won't show above-0 values. The default color stops include a +2 dB "over" indicator in bright red.
:::

### Colored Inactive Segments

By default, inactive segments are a flat dark color. Enable `coloredInactive` to show them in their dimmed color at 15% opacity — this gives a visual preview of the full color scale:

```tsx
<SegmentedVUMeter levels={levels} coloredInactive />
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
  dBRange={[-60, 5]}
  showScale={false}
/>
```

## Multi-Channel

The `channelCount` option controls how many channels to meter. The default is `1` for input metering (most microphones are mono) and `2` for output metering (stereo playback).

When a mono microphone is used with `channelCount: 2`, the single channel level is automatically mirrored to both L/R channels for consistent visual display.

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
