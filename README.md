# Waveform Playlist

A multi-track audio editor and player built with React, Tone.js, and the Web Audio API. Features canvas-based waveform visualization, drag-and-drop clip editing, and professional audio effects.

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
- **MIDI playback** - MIDI file parsing with piano roll visualization and SoundFont sample playback
- **TypeScript** - Full type definitions included

## Quick Start

```bash
npm install @waveform-playlist/browser tone @dnd-kit/react
```

> **Note**: `tone` and `@dnd-kit/react` are peer dependencies and must be installed separately. `@dnd-kit/dom` and `@dnd-kit/abstract` are transitive dependencies of `@dnd-kit/react`.

> **v14:** the playout engines are optional peers. Install the one(s) you use:
> - WebAudio/Tone path: `npm install @waveform-playlist/browser @waveform-playlist/playout tone`
> - MediaElement path: `npm install @waveform-playlist/browser @waveform-playlist/media-element-playout`
> - Custom adapter: `npm install @waveform-playlist/browser` and pass `createAdapter` (no `tone`).
>
> The `Tone` convenience re-export was removed in v14 — `import * as Tone from 'tone'` directly.
>
> **v14:** effects, WAV export, output metering, and the `useAudioTracks`/`useDynamicTracks` loaders import from `@waveform-playlist/browser/tone`.

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
| [MIDI](https://naomiaro.github.io/waveform-playlist/examples/midi) | MIDI file playback with piano roll and SoundFont samples |
| [Beats & Bars](https://naomiaro.github.io/waveform-playlist/examples/beats-and-bars) | Tempo-synced timescale with beats and bars ruler |
| [Fades](https://naomiaro.github.io/waveform-playlist/examples/fades) | Fade in/out with configurable curves |
| [Stereo](https://naomiaro.github.io/waveform-playlist/examples/stereo) | Stereo waveform rendering and pan controls |
| [Spectrogram](https://naomiaro.github.io/waveform-playlist/examples/mir-spectrogram) | FFT-based spectrogram visualization |
| [Media Element](https://naomiaro.github.io/waveform-playlist/examples/media-element) | HTMLMediaElement playout with playback rate |
| [Styling](https://naomiaro.github.io/waveform-playlist/examples/styling) | Bar width, gaps, gradients, and theme colors |
| [Flexible API](https://naomiaro.github.io/waveform-playlist/examples/flexible-api) | Custom playheads, timestamps, and full UI customization |

## Packages

| Package | Description |
|---------|-------------|
| `@waveform-playlist/browser` | Main React components, hooks, and context |
| `@waveform-playlist/core` | Types, utilities, and clip/track creation |
| `@waveform-playlist/engine` | Framework-agnostic timeline engine with pure operations |
| `@waveform-playlist/ui-components` | Styled UI components (buttons, sliders, etc.) |
| `@waveform-playlist/playout` | Tone.js audio engine |
| `@waveform-playlist/webaudio-peaks` | Peak extraction from AudioBuffer or sample arrays |
| `@waveform-playlist/loaders` | Audio loaders |

**Optional packages:**

| Package | Description |
|---------|-------------|
| `@waveform-playlist/midi` | React `useMidiTracks` hook + piano roll visualization with SoundFont/PolySynth playback. Re-exports the parser from `@dawcore/midi`. |
| `@waveform-playlist/annotations` | Time-synced text annotations with drag editing |
| `@waveform-playlist/recording` | AudioWorklet recording with live waveform preview (requires [setup](https://naomiaro.github.io/waveform-playlist/docs/guides/recording#audioworklet-setup)) |
| `@waveform-playlist/worklets` | Shared AudioWorklet processors for metering and recording (auto-installed with recording) |
| `@waveform-playlist/spectrogram` | React `SpectrogramProvider` + UI (menu items, settings modal). Computation/worker/orchestrator are imported from `@dawcore/spectrogram`. |
| `@waveform-playlist/media-element-playout` | HTMLMediaElement-based playout with pitch-preserving playback rate |

## Key Hooks

```tsx
// Load audio files into tracks
const { tracks, loading, error } = useAudioTracks([
  { src: '/audio/vocals.mp3', name: 'Vocals' },
  { src: '/audio/drums.mp3', name: 'Drums' },
]);

// Playback controls
const { play, pause, stop, seekTo } = usePlaylistControls();

// Playback animation (60fps updates)
const { currentTime, isPlaying } = usePlaybackAnimation();

// Zoom controls
const { zoomIn, zoomOut, samplesPerPixel } = useZoomControls();

// Master effects chain
const { masterEffects, toggleBypass, updateParameter } = useDynamicEffects();

// WAV export
const { exportWav, isExporting, progress } = useExportWav();

// Recording
const { startRecording, stopRecording, isRecording } = useIntegratedRecording();
```

## Web Components (Experimental)

`@dawcore/components` provides framework-agnostic Web Components for multi-track audio editing — no React required. Built with Lit, adapter-pluggable: choose between `@dawcore/transport` (native Web Audio) or `@waveform-playlist/playout` (Tone.js).

```bash
npm install @dawcore/components @waveform-playlist/core @waveform-playlist/engine
```

Audio backend (choose one):
```bash
npm install @dawcore/transport          # Native Web Audio (multi-tempo, multi-meter, metronome)
# or
npm install @waveform-playlist/playout tone  # Tone.js (effects, MIDI synths)
```

```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  const adapter = new NativePlayoutAdapter(new AudioContext());
  editor.adapter = adapter;
</script>

<daw-editor id="editor" clip-headers interactive-clips timescale>
  <daw-track name="Vocals">
    <daw-clip src="/audio/vocals.mp3" start="0" duration="10"></daw-clip>
  </daw-track>
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-record-button></daw-record-button>
</daw-transport>
```

**Features:**
- Declarative `<daw-track>` and `<daw-clip>` elements with auto-loading
- Imperative API for programmatic mutation — `editor.addTrack/removeTrack/updateTrack/addClip/removeClip/updateClip` and `editor.ready()` for engine bootstrap before any track loads
- Adapter-pluggable — choose Native Web Audio or Tone.js backend
- Clip move, trim, and split with collision detection
- Undo/redo with transaction-based grouping
- Keyboard shortcuts (Space=play/pause, S=split, Cmd/Ctrl+Z=undo)
- File drop for adding tracks
- Frozen-panes layout — height-constrained editors scroll vertically with a pinned ruler and row-locked track controls; controls adapt to short rows
- Recording with overdub and latency compensation
- Metronome with mixed meters and tempo changes
- Tempo automation — linear ramps and Möbius-Ease curves with exact integration
- Pre-computed peaks for fast initial render
- `indefinite-playback` attribute fills the viewport when no audio is loaded — ruler renders before any track

**Packages:**

| Package | Description |
|---------|-------------|
| `@dawcore/components` | Lit Web Components for multi-track editing |
| `@dawcore/transport` | Native Web Audio transport — scheduling, looping, tempo automation, time signatures, metronome |
| `@dawcore/spectrogram` | Framework-agnostic spectrogram orchestrator, FFT worker pool, and color maps — used by `render-mode="spectrogram"` |
| `@dawcore/midi` | Framework-agnostic MIDI parser (`parseMidiFile`, `parseMidiUrl`) — used by `editor.loadMidi()` and re-exported by `@waveform-playlist/midi` |

Run the examples locally:

```bash
pnpm example:dawcore-native  # Native Web Audio — localhost:5173
pnpm example:dawcore-tone    # Tone.js backend — localhost:5174
pnpm example:dawcore-wam     # WAM 2.0 plugins + Faust — localhost:5175
```

**dawcore-native** example pages:

- [`basic.html`](examples/dawcore-native/basic.html) — Basic playback with timescale and file drop
- [`multiclip.html`](examples/dawcore-native/multiclip.html) — Multi-clip editing with move, trim, and split
- [`programmatic.html`](examples/dawcore-native/programmatic.html) — Imperative `editor.addTrack` / `addClip` / `updateClip` / `removeClip` plus declarative DOM mutation, side-by-side
- [`beats-grid.html`](examples/dawcore-native/beats-grid.html) — Beats & bars grid mode with snap-to-grid
- [`beat-map-grid.html`](examples/dawcore-native/beat-map-grid.html) — Variable tempo from beat maps with metronome
- [`record.html`](examples/dawcore-native/record.html) — Recording with overdub
- [`metronome.html`](examples/dawcore-native/metronome.html) — Metronome with mixed meters, tempo presets, and looping sequences
- [`automation.html`](examples/dawcore-native/automation.html) — Tempo automation with step, linear, and curve presets
- [`analyser.html`](examples/dawcore-native/analyser.html) — Spectrum analyser connected to master output
- [`spectrogram.html`](examples/dawcore-native/spectrogram.html) — Per-track FFT spectrograms via `render-mode="spectrogram"` with color-map and frequency-scale controls
- [`effects.html`](examples/dawcore-native/effects.html) — Per-track and master insert effects (`native-*` registry) with live parameter sliders, bypass, and `daw-effect-*` event log

**dawcore-tone** example pages:

- [`basic.html`](examples/dawcore-tone/basic.html) — Basic playback with Tone.js adapter
- [`multiclip.html`](examples/dawcore-tone/multiclip.html) — Multi-clip editing with Tone.js
- [`programmatic.html`](examples/dawcore-tone/programmatic.html) — Imperative `editor.addTrack` / `addClip` / `updateClip` / `removeClip` plus declarative DOM mutation, with the Tone.js adapter
- [`beats-grid.html`](examples/dawcore-tone/beats-grid.html) — Beats & bars grid with Tone.js
- [`record.html`](examples/dawcore-tone/record.html) — Mic recording with overdub
- [`analyser.html`](examples/dawcore-tone/analyser.html) — Spectrum analyser connected to master output
- [`spectrogram.html`](examples/dawcore-tone/spectrogram.html) — Per-track FFT spectrograms with the Tone.js adapter
- [`midi.html`](examples/dawcore-tone/midi.html) — Programmatic MIDI clips with piano-roll render mode and Tone.js PolySynth
- [`midi-load.html`](examples/dawcore-tone/midi-load.html) — Load `.mid` files (URL or file picker) via `editor.loadMidi()` and play them through Tone.js PolySynth
- [`soundfont.html`](examples/dawcore-tone/soundfont.html) — MIDI through SoundFont samples: `SoundFontCache.fromUrl()` + `createToneAdapter({ soundFontCache })`, with PolySynth fallback when the `.sf2` fails to load

**dawcore-wam** example pages:

- [`index.html`](examples/dawcore-wam/index.html) — WAM 2.0 plugin hosting end to end: load community plugins by URL or from the [webaudiomodules.com](https://www.webaudiomodules.com/) library, open plugin GUIs, reorder/bypass chains, save and restore chains (including state) via localStorage, export the mix to WAV through `exportAudio()`, and compile Faust DSP to a live effect in the browser (`@dawcore/faust`) — plus pre-compiled Faust effects served from this repo

**Spec & roadmap:** [`docs/specs/web-components-migration.md`](docs/specs/web-components-migration.md) — full element catalogue, attribute/property/event tables, programmatic API contracts, theming tokens, and migration phases.

## Browser Support

Requires Web Audio API support: Chrome, Firefox, Safari, Edge (modern versions).

See [Can I Use: Web Audio API](https://caniuse.com/audio-api)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm website

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

## Sponsors

<p align="center">
  <a href="https://moises.ai/" target="_blank">
    <img width="222px" src="https://raw.githubusercontent.com/naomiaro/waveform-playlist/main/website/static/img/logos/moises-ai.svg" alt="Moises.ai">
  </a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/naomiaro">Become a sponsor</a>
</p>

## Partners

<p align="center">
  <a href="https://www.telecom-paris.fr/" target="_blank">
    <img width="120px" src="https://raw.githubusercontent.com/naomiaro/waveform-playlist/main/website/static/img/logos/telecom-paris.svg" alt="Télécom Paris">
  </a>
</p>
