# Waveform Playlist

[![npm](https://img.shields.io/npm/dm/waveform-playlist.svg)](https://www.npmjs.com/package/waveform-playlist)

A multi-track audio editor and player built with React, Tone.js, and the Web Audio API. Features canvas-based waveform visualization, drag-and-drop clip editing, and professional audio effects.

> **⚠️ v5 Alpha**: This is a complete React rewrite. For the stable v4 release, see [waveform-playlist@4.x](https://www.npmjs.com/package/waveform-playlist).

## Sponsors

<p align="center">
  <a href="https://moises.ai/" target="_blank">
    <img width="222px" src="https://raw.githubusercontent.com/naomiaro/waveform-playlist/main/website/static/img/logos/moises-ai.svg" alt="Moises.ai">
  </a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/naomiaro">Become a sponsor</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/naomiaro/waveform-playlist/main/website/static/img/waveform-playlist.png" alt="Waveform Playlist Screenshot" width="800">
</p>

## Features

- **Multi-track editing** - Multiple clips per track with drag-to-move and trim
- **Waveform visualization** - Canvas-based rendering with zoom controls
- **20+ audio effects** - Reverb, delay, filters, distortion, and more via Tone.js
- **Recording** - AudioWorklet-based recording with live waveform preview
- **Export** - WAV export with effects, individual tracks or full mix
- **Annotations** - Time-synced text annotations with keyboard navigation
- **Theming** - Full theme customization with dark/light mode support
- **TypeScript** - Full type definitions included

## Quick Start

```bash
npm install @waveform-playlist/browser@next @waveform-playlist/core@next @waveform-playlist/ui-components@next
```

```tsx
import { WaveformPlaylistProvider, Waveform, PlayButton, PauseButton, StopButton } from '@waveform-playlist/browser';
import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';

function App() {
  const [tracks, setTracks] = useState([]);

  // Load audio and create tracks
  useEffect(() => {
    async function loadAudio() {
      const response = await fetch('/audio/song.mp3');
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const track = createTrack({
        name: 'My Track',
        clips: [createClipFromSeconds({ audioBuffer, startTime: 0 })],
      });

      setTracks([track]);
    }
    loadAudio();
  }, []);

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <div>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Documentation

- [**Live Examples**](https://naomiaro.github.io/waveform-playlist/examples/stem-tracks) - Interactive demos
- [**Getting Started**](https://naomiaro.github.io/waveform-playlist/docs/getting-started/installation) - Installation and basic usage
- [**Guides**](https://naomiaro.github.io/waveform-playlist/docs/guides/loading-audio) - In-depth tutorials
- [**API Reference**](https://naomiaro.github.io/waveform-playlist/docs/api/provider) - Component and hook documentation

## Examples

| Example | Description |
|---------|-------------|
| [Stem Tracks](https://naomiaro.github.io/waveform-playlist/examples/stem-tracks) | Multi-track playback with mute/solo/volume controls |
| [Effects](https://naomiaro.github.io/waveform-playlist/examples/effects) | 20 Tone.js effects with real-time parameter control |
| [Recording](https://naomiaro.github.io/waveform-playlist/examples/recording) | Live recording with VU meter and waveform preview |
| [Multi-Clip](https://naomiaro.github.io/waveform-playlist/examples/multi-clip) | Drag-and-drop clip editing with trim handles |
| [Annotations](https://naomiaro.github.io/waveform-playlist/examples/annotations) | Time-synced text with keyboard navigation |
| [Waveform Data](https://naomiaro.github.io/waveform-playlist/examples/waveform-data) | Pre-computed peaks for fast loading |

## Packages

All v5 packages are published under the `next` tag (install with `@next`):

| Package | Description |
|---------|-------------|
| `@waveform-playlist/browser` | Main React components, hooks, and context |
| `@waveform-playlist/core` | Types, utilities, and clip/track creation |
| `@waveform-playlist/ui-components` | Styled UI components (buttons, sliders, etc.) |
| `@waveform-playlist/playout` | Tone.js audio engine |
| `@waveform-playlist/annotations` | Optional annotation support |
| `@waveform-playlist/recording` | Optional recording support |

## Key Hooks

```tsx
// Load audio files into tracks
const { tracks, loading, error } = useAudioTracks([
  { src: '/audio/vocals.mp3', name: 'Vocals' },
  { src: '/audio/drums.mp3', name: 'Drums' },
]);

// Playback controls
const { play, pause, stop, seek, isPlaying } = usePlaylistControls();

// Zoom controls
const { zoomIn, zoomOut, samplesPerPixel } = useZoomControls();

// Master effects chain
const { masterEffectsFunction, toggleEffect, updateParameter } = useDynamicEffects();

// WAV export
const { exportWav, isExporting, progress } = useExportWav();

// Recording
const { startRecording, stopRecording, isRecording } = useIntegratedRecording();
```

## Browser Support

Requires Web Audio API support: Chrome, Firefox, Safari, Edge (modern versions).

See [Can I Use: Web Audio API](https://caniuse.com/audio-api)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm start

# Run tests
pnpm test

# Build all packages
pnpm build
```

Visit http://localhost:3000/waveform-playlist to see the examples.

## Books

Currently writing: [Mastering Tone.js](https://leanpub.com/masteringtonejs)

<p align="center">
  <a href="https://leanpub.com/masteringtonejs" target="_blank">
    <img src="https://masteringtonejs.com/title_page.png" title="Mastering Tone.js Cover" width="360" alt="Mastering Tone.js">
  </a>
</p>

## Credits

Originally created for the [Airtime](https://www.sourcefabric.org/software/airtime/) project at [Sourcefabric](https://www.sourcefabric.org/).

## License

[MIT License](http://doge.mit-license.org)
