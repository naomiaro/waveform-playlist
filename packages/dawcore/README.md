# @dawcore/components

Framework-agnostic Web Components for multi-track audio editing. Drop `<daw-editor>` into any HTML page — no React, no build step required.

## Features

- **Pure Web Components** — Works with vanilla HTML, React, Vue, Svelte, or any framework
- **Declarative tracks** — `<daw-track>` and `<daw-clip>` elements define your timeline in HTML
- **Canvas waveforms** — Chunked rendering with virtual scrolling for large timelines
- **Drag interactions** — Move clips, trim boundaries, split at playhead
- **Keyboard shortcuts** — Play/pause, split, undo/redo via `<daw-keyboard-shortcuts>`
- **File drop** — Drag audio files onto the editor to add tracks
- **Recording** — Live mic recording with waveform preview (optional)
- **Pre-computed peaks** — Instant waveform rendering from `.dat` files before audio decodes
- **CSS theming** — Dark mode by default, fully customizable via CSS custom properties
- **Native Web Audio** — Uses `@dawcore/transport` for playback scheduling. No Tone.js dependency.

## Installation

```bash
npm install @dawcore/components
```

Peer dependencies:
```bash
npm install @waveform-playlist/core @waveform-playlist/engine @dawcore/transport
```

Optional (for recording):
```bash
npm install @waveform-playlist/recording @waveform-playlist/worklets
```

## Quick Start

```html
<script type="module">
  import '@dawcore/components';
</script>

<daw-editor id="editor" samples-per-pixel="1024" wave-height="100" timescale>
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
  <daw-track src="/audio/bass.opus" name="Bass"></daw-track>
  <daw-track src="/audio/synth.opus" name="Synth"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

That's it. The editor loads audio, generates waveforms, and handles playback.

## Multi-Clip Timeline

For multiple clips per track with independent positioning:

```html
<daw-editor id="editor" samples-per-pixel="1024" wave-height="80"
            timescale clip-headers interactive-clips>
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>

  <daw-track name="Drums">
    <daw-clip src="/audio/drums.opus" start="0" duration="8"></daw-clip>
    <daw-clip src="/audio/drums.opus" start="12" duration="8" offset="8"></daw-clip>
  </daw-track>

  <daw-track name="Bass">
    <daw-clip src="/audio/bass.opus" start="0" duration="20"></daw-clip>
  </daw-track>
</daw-editor>
```

## Pre-Computed Peaks

For instant waveform rendering before audio finishes decoding:

```html
<daw-track name="Drums">
  <daw-clip src="/audio/drums.opus"
            peaks-src="/audio/drums.dat"
            start="0" duration="8"></daw-clip>
</daw-track>
```

The `.dat` file renders the waveform immediately. Audio decodes in the background for playback.

## CSS Theming

Style with CSS custom properties on `<daw-editor>` or any ancestor:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-playhead-color: #d08070;
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-ruler-color: #c49a6c;
  --daw-ruler-background: #0f0f1a;
  --daw-selection-color: rgba(99, 199, 95, 0.3);
  --daw-controls-background: #1a1a2e;
  --daw-controls-text: #e0d4c8;
  --daw-clip-header-background: rgba(0, 0, 0, 0.4);
  --daw-clip-header-text: #e0d4c8;
  --daw-controls-width: 180px;
  --daw-min-height: 200px;
}
```

## Recording

```html
<daw-editor id="editor" samples-per-pixel="1024" wave-height="100">
  <daw-track name="Recording"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-record-button></daw-record-button>
</daw-transport>

<script type="module">
  const editor = document.getElementById('editor');
  // Consumer provides the mic stream
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  editor.recordingStream = stream;
</script>
```

## Events

Listen for editor events on the `<daw-editor>` element:

```javascript
const editor = document.getElementById('editor');

editor.addEventListener('daw-play', () => console.log('playing'));
editor.addEventListener('daw-pause', () => console.log('paused'));
editor.addEventListener('daw-stop', () => console.log('stopped'));
editor.addEventListener('daw-seek', (e) => console.log('seek:', e.detail.time));
editor.addEventListener('daw-selection', (e) => console.log('selection:', e.detail));
editor.addEventListener('daw-track-select', (e) => console.log('track:', e.detail.trackId));
editor.addEventListener('daw-clip-move', (e) => console.log('move:', e.detail));
editor.addEventListener('daw-clip-trim', (e) => console.log('trim:', e.detail));
editor.addEventListener('daw-clip-split', (e) => console.log('split:', e.detail));
editor.addEventListener('daw-track-error', (e) => console.error('error:', e.detail));
```

## Custom AudioContext

By default, `<daw-editor>` creates its own `AudioContext` using the `sample-rate` attribute. To provide your own:

```javascript
const editor = document.getElementById('editor');
editor.audioContext = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
```

Set this before tracks load. The provided context is used for decoding, playback, and recording.

## API

See [COMPONENTS.md](./COMPONENTS.md) for the full element and attribute reference.

## License

MIT
