---
sidebar_position: 15
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

By default, the `SegmentedVUMeter` component displays peak levels. Pass `rmsLevels` as its `levels` prop if you want an RMS meter (see [Choosing Peak vs RMS](#choosing-peak-vs-rms)).

## Levels Are a Source, Not State

Levels change about 60 times a second. If the hooks returned them as React state, the component that calls the hook, and everything it renders, would re-render at that rate. So `useMicrophoneLevel`, `useOutputMeter` and `useIntegratedRecording` return a `meter` instead: an object with a stable identity that publishes each new reading. The hook's component does not re-render when levels change.

```typescript
// From @waveform-playlist/core
interface MeterLevels {
  levels: number[];     // Per-channel peak levels (0–1)
  peakLevels: number[]; // Per-channel held peak levels (0–1)
  rmsLevels: number[];  // Per-channel RMS levels (0–1)
}

interface MeterSource {
  subscribe(listener: (levels: MeterLevels) => void): () => void; // returns unsubscribe
  getSnapshot(): MeterLevels;
}
```

There are four ways to read a meter:

| How | Re-renders | Use for |
|-----|-----------|---------|
| `<SegmentedVUMeter meter={meter} />` | None | The built-in meter. It writes each reading straight to the DOM |
| `useMeterLevels(meter, { updateRate })` | At most `updateRate` a second (default 10) | Values you need in render: text readouts, clipping indicators, simple custom bars |
| `useSyncExternalStore(meter.subscribe, meter.getSnapshot)` | Every reading (~60 a second) | Full-rate state, when a small component really needs it |
| `meter.subscribe(callback)` in an effect | None | Drawing to the DOM or a canvas yourself |

`useMeterLevels` is exported from `@waveform-playlist/ui-components`. `useSyncExternalStore` is React's own hook.

## Built-In Components

### SegmentedVUMeter

A professional LED-segment style meter with multi-channel support:

```tsx
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

// Live: pass the meter from a hook. The component does not re-render per reading.
<SegmentedVUMeter meter={meter} />

// Or drive it with values you hold yourself.
<SegmentedVUMeter levels={[leftLevel, rightLevel]} peakLevels={[leftPeak, rightPeak]} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `meter` | `MeterSource` | — | A live meter from `useMicrophoneLevel`, `useOutputMeter` or `useIntegratedRecording`. Takes precedence over `levels` / `peakLevels` |
| `levels` | `number[]` | — | Per-channel levels (0–1), for a meter driven by props |
| `peakLevels` | `number[]` | — | Per-channel peak levels (0–1), used with `levels` |
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

The `useMicrophoneLevel` hook meters a microphone stream. Set `channelCount: 2` to get per-channel stereo data:

```tsx
import {
  useMicrophoneAccess,
  useMicrophoneLevel,
} from '@waveform-playlist/recording';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function InputMeter() {
  const { stream, hasPermission, requestAccess } = useMicrophoneAccess();
  const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });

  if (!hasPermission) {
    return <button onClick={() => requestAccess()}>Enable Microphone</button>;
  }

  return <SegmentedVUMeter meter={meter} />;
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
| `meter` | `MeterSource` | The live levels; see [Levels Are a Source, Not State](#levels-are-a-source-not-state) |
| `resetPeak` | `() => void` | Reset all held peak levels to 0 |
| `error` | `Error \| null` | Meter setup error (worklet failed to load, for example) |

Each reading from `meter` holds:

| Field | Type | Description |
|-------|------|-------------|
| `levels` | `number[]` | Per-channel true peak levels (0–1) |
| `peakLevels` | `number[]` | Per-channel held peak levels (0–1) — highest value seen since last reset |
| `rmsLevels` | `number[]` | Per-channel RMS levels (0–1) — average signal power |

## Output Metering

The `useOutputMeter` hook monitors playback output levels. It must be used inside a `WaveformPlaylistProvider`:

```tsx
import { useOutputMeter } from '@waveform-playlist/browser/tone';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function OutputMeter() {
  const { meter } = useOutputMeter({ channelCount: 2 });
  return <SegmentedVUMeter meter={meter} />;
}
```

### useOutputMeter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channelCount` | `number` | `2` | Number of channels to meter |
| `updateRate` | `number` | `60` | Update frequency in Hz |
| `isPlaying` | `boolean` | `false` | Pass the playlist's `isPlaying`. When it turns false, all levels reset to zero |

The hook returns `meter`, `resetPeak` and `error`, with the same shapes as `useMicrophoneLevel`.

## Choosing Peak vs RMS

Every reading holds both peak and RMS — choose based on your use case. `<SegmentedVUMeter meter={meter} />` draws peak with the held-peak marker. For an RMS meter, read the values with `useMeterLevels` and pass `rmsLevels` as `levels`:

```tsx
import { SegmentedVUMeter, useMeterLevels } from '@waveform-playlist/ui-components';

// Peak meter (default) — best for recording and clipping detection
<SegmentedVUMeter meter={meter} />

// RMS meter — best for showing perceived loudness
function RmsMeter({ meter }) {
  const { rmsLevels } = useMeterLevels(meter, { updateRate: 30 });
  return <SegmentedVUMeter levels={rmsLevels} />;
}

// Both side by side — useful for dynamics processing UI
<div style={{ display: 'flex', gap: '1rem' }}>
  <SegmentedVUMeter meter={meter} />
  <RmsMeter meter={meter} />
</div>
```

Keep `useMeterLevels` in a small component of its own, as `RmsMeter` does, so only that component re-renders.

## Building a Custom Meter

Each reading's `levels` is an array of normalized 0–1 values per channel. You can convert these to dB using `normalizedToDb` from `@waveform-playlist/core`. This meter reads the values in render through `useMeterLevels`:

```tsx
import { useMicrophoneLevel, useMicrophoneAccess } from '@waveform-playlist/recording';
import { useMeterLevels } from '@waveform-playlist/ui-components';
import { normalizedToDb } from '@waveform-playlist/core';

function CustomMeter() {
  const { stream } = useMicrophoneAccess();
  const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });
  const { levels } = useMeterLevels(meter, { updateRate: 20 });
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

For a meter that should move on every reading, skip React state and draw from a subscription:

```tsx
function BarMeter({ meter }: { meter: MeterSource }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      meter.subscribe(({ levels }) => {
        if (barRef.current) {
          barRef.current.style.transform = `scaleY(${Math.max(...levels)})`;
        }
      }),
    [meter]
  );

  return (
    <div style={{ width: 20, height: 200, background: '#333' }}>
      <div
        ref={barRef}
        style={{ height: '100%', background: 'green', transformOrigin: 'bottom', transform: 'scaleY(0)' }}
      />
    </div>
  );
}
```

`MeterSource` is a type from `@waveform-playlist/core`.

## Customizing SegmentedVUMeter

### Custom Color Scheme

Override the default color stops with your own:

```tsx
<SegmentedVUMeter
  meter={meter}
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
<SegmentedVUMeter meter={meter} coloredInactive />
```

### Horizontal Orientation

```tsx
<SegmentedVUMeter meter={meter} orientation="horizontal" />
```

### Sizing and Scale

```tsx
<SegmentedVUMeter
  meter={meter}
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
const { meter } = useMicrophoneLevel(stream, { channelCount: 4 });

// SegmentedVUMeter auto-labels channels as 1, 2, 3, 4
<SegmentedVUMeter
  meter={meter}
  channelLabels={['Front L', 'Front R', 'Rear L', 'Rear R']}
/>
```

There is no single scalar level any more (the `level` and `peakLevel` return values were removed). For one number across all channels, take the maximum: `Math.max(...levels)` and `Math.max(...peakLevels)`.

## Next Steps

- [Recording](/docs/react/guides/recording) — Record audio with level monitoring
- [Audio Effects](/docs/react/guides/effects) — Apply effects to tracks and master output
