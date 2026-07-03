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

`@dnd-kit/react` is an optional peer — only needed if you use the drag/trim-enabled clip components.

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
