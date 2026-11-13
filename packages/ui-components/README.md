# @waveform-playlist/ui-components

React UI components for waveform-playlist — canvas-rendered waveform/spectrogram/piano-roll channels, track controls, VU metering, and the styled-components theming layer.

Used internally by [`@waveform-playlist/browser`](https://www.npmjs.com/package/@waveform-playlist/browser), which composes these components into a full multitrack editor. Most users get this package transitively and never install it directly — reach for it standalone if you're building custom playlist UI (e.g. a bespoke VU meter or a themed control) without the full editor.

## Features

- **Canvas waveform rendering** — `Channel` draws peaks as bars, with an optional `roundedBars` mode
- **Spectrogram & piano-roll channels** — `SpectrogramChannel` and `PianoRollChannel` render alongside waveform as alternate track visualizations
- **Track controls** — mute/solo/volume, track menu, and other transport-adjacent controls
- **Theming** — `ThemeProvider` + `WaveformPlaylistTheme` (with `defaultTheme` and `darkTheme`) drive every styled component from a single theme object
- **Virtual scrolling** — chunked canvases and viewport tracking so long timelines don't render off-screen content
- **`SegmentedVUMeter`** — standalone level meter with configurable color stops, orientation, and scale
- **`PlaylistErrorBoundary`** — catches render errors without depending on `ThemeProvider`

## Installation

```bash
npm install @waveform-playlist/ui-components
```

Peer dependencies (install alongside):

```bash
npm install react react-dom styled-components
```

`@dnd-kit/react` and `@dnd-kit/dom` are optional peers — only needed if you use the drag/trim-enabled clip components.

## Usage

Most components expect the context providers from `@waveform-playlist/browser`, but standalone pieces like `SegmentedVUMeter` work with just props:

```tsx
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function TrackMeter({ levels }: { levels: number[] }) {
  return (
    <SegmentedVUMeter
      levels={levels}
      channelLabels={['L', 'R']}
      orientation="vertical"
      showScale
    />
  );
}
```

For a live meter, pass the `meter` source returned by `useOutputMeter` (`@waveform-playlist/browser/tone`) or `useMicrophoneLevel` (`@waveform-playlist/recording`). The component draws each reading straight to the DOM and does not re-render for it:

```tsx
import { SegmentedVUMeter, useMeterLevels } from '@waveform-playlist/ui-components';
import type { MeterSource } from '@waveform-playlist/core';

function LiveMeter({ meter }: { meter: MeterSource }) {
  return <SegmentedVUMeter meter={meter} channelLabels={['L', 'R']} />;
}

// The numbers as React state, at most 10 times a second by default.
function PeakReadout({ meter }: { meter: MeterSource }) {
  const { peakLevels } = useMeterLevels(meter);
  return <span>{Math.round(Math.max(...peakLevels) * 100)}%</span>;
}
```

## The drawing context: `usePlaylistInfo()`

The drawing primitives (`Track`, `SmartChannel`, `SmartScale`, `TimeScale`) read what they need from the view they are drawn in through `PlaylistInfoContext`. The roots of `@waveform-playlist/browser` publish it once per view, from the options of its `<WaveformViewOptions>`; without one above, the context's defaults apply.

```tsx
import { usePlaylistInfo, type PlaylistInfo } from '@waveform-playlist/ui-components';

const {
  sampleRate,
  samplesPerPixel,
  waveHeight, // px of one channel; default 80
  timeScaleHeight, // px of the timescale strip; 0 when a view has none
  barWidth, // default 1
  barGap, // default 0
  roundedBars, // default false
  progressBarWidth, // px of the playhead line; default barWidth + barGap
}: PlaylistInfo = usePlaylistInfo();
```

If you render `PlaylistInfoContext.Provider` yourself, give it every field of `PlaylistInfo` (`roundedBars` and `progressBarWidth` are required; `controls` and `zoomLevels` are no longer part of it). `DEFAULT_WAVE_HEIGHT` (80), `DEFAULT_BAR_WIDTH` (1) and `DEFAULT_BAR_GAP` (0) are exported.

`Channel` never steps less than one pixel from one bar to the next: a `barWidth + barGap` under 1 is drawn with a step of 1.

## Theming

Wrap your tree in styled-components' `ThemeProvider` with a `WaveformPlaylistTheme` object — `defaultTheme` and `darkTheme` are exported as starting points and can be partially overridden:

```tsx
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '@waveform-playlist/ui-components';

<ThemeProvider theme={{ ...defaultTheme, waveOutlineColor: '#ff6600' }}>
  {/* playlist components */}
</ThemeProvider>;
```

`@waveform-playlist/browser`'s `WaveformPlaylistProvider` sets this up for you via its own `theme` prop — you only need `ThemeProvider` directly when using `ui-components` outside that provider.

## Examples & Documentation

Full guides, API reference, and live examples: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
