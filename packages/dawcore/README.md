# @dawcore/components

Framework-agnostic Web Components for multi-track audio editing. Drop `<daw-editor>` into any HTML page — no React, no build step required.

## Features

- **Pure Web Components** — Works with vanilla HTML, React, Vue, Svelte, or any framework
- **Declarative tracks** — `<daw-track>` and `<daw-clip>` elements define your timeline in HTML
- **Canvas waveforms** — Chunked rendering with virtual scrolling for large timelines
- **Drag interactions** — Move clips, trim boundaries, split at playhead
- **Keyboard shortcuts** — Play/pause, split, undo/redo via `<daw-keyboard-shortcuts>`
- **Undo/redo** — Full transaction-based undo with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
- **File drop** — Drag audio files onto the editor to add tracks
- **Recording** — Live mic recording with waveform preview, pause/resume, cancelable clip creation
- **Pre-computed peaks** — Instant waveform rendering from `.dat` files before audio decodes
- **MIDI tracks** — Programmatic MIDI clips render as piano-roll via `<daw-piano-roll>`. Playback via Tone.js adapter (native MIDI synth deferred). See [MIDI Tracks](#midi-tracks).
- **Track controls** — Volume, pan, mute, solo per track via `<daw-track-controls>`
- **Transport access** — Tempo, metronome, count-in, meter, effects via `@dawcore/transport`
- **CSS theming** — Dark mode by default, fully customizable via CSS custom properties
- **Native Web Audio** — Uses `@dawcore/transport` for playback scheduling. No Tone.js dependency.

## Installation

```bash
npm install @dawcore/components
```

Peer dependencies:
```bash
npm install @waveform-playlist/core @waveform-playlist/engine
```

Audio backend (choose one — see [Choosing an Audio Backend](#choosing-an-audio-backend)):
```bash
npm install @dawcore/transport          # Native Web Audio (recommended)
# or
npm install @waveform-playlist/playout tone  # Tone.js
```

Optional (for recording):
```bash
npm install @waveform-playlist/worklets
```

## Quick Start

```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  const adapter = new NativePlayoutAdapter(new AudioContext());
  editor.adapter = adapter;
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

The editor loads audio, generates waveforms, and handles playback.

## Choosing an Audio Backend

### Native Web Audio (recommended for most use cases)

No Tone.js dependency. Supports multi-tempo, multi-meter, metronome, count-in, and effects hooks.

```bash
npm install @dawcore/transport
```

```javascript
import { NativePlayoutAdapter } from '@dawcore/transport';

const ctx = new AudioContext({ sampleRate: 48000 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;

// Transport-specific features via adapter reference
adapter.transport.setMetronomeEnabled(true);
adapter.transport.setCountIn(true);
```

### Tone.js (effects, MIDI synths)

Uses Tone.js for audio processing. Single tempo/meter only. **Required for MIDI playback** — the native adapter has no MIDI synth yet, so MIDI clips render as piano-roll but are silent.

```bash
npm install @waveform-playlist/playout tone
```

```javascript
import { createToneAdapter } from '@waveform-playlist/playout';

const adapter = createToneAdapter();
editor.adapter = adapter;
```

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

## MIDI Tracks

Programmatic MIDI clips render as piano-roll. Playback requires the Tone.js adapter (the native adapter has no MIDI synth yet). Use the `editor.addTrack({ midi })` sugar for the simplest path:

```javascript
import { createToneAdapter } from '@waveform-playlist/playout';

const editor = document.querySelector('daw-editor');
editor.adapter = createToneAdapter({ ppqn: 960 });

await editor.addTrack({
  name: 'Lead',
  midi: {
    notes: [
      { midi: 60, name: 'C4', time: 0.0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      { midi: 67, name: 'G4', time: 1.0, duration: 0.5, velocity: 0.8 },
    ],
    channel: 0,        // optional — 9 = GM percussion
    program: 24,       // optional — GM instrument 0-127 (used by SoundFontToneTrack)
  },
});
```

This expands to a `<daw-track render-mode="piano-roll">` containing a `<daw-clip>` whose `midiNotes` JS property is set to the notes array. Equivalent declarative form:

```html
<daw-track render-mode="piano-roll" name="Lead">
  <daw-clip midi-channel="0" midi-program="24"></daw-clip>
</daw-track>
<script>
  document.querySelector('daw-clip').midiNotes = [
    { midi: 60, name: 'C4', time: 0.0, duration: 0.5, velocity: 0.8 },
    // ...
  ];
</script>
```

A clip is treated as MIDI iff `clip.midiNotes != null`. MIDI clips skip audio fetch + decode + peak generation. Trim handles and split-at-playhead are inert on MIDI clips for now (note slicing is a follow-up). Move drag works.

**Theming:** the piano-roll honors `--daw-piano-roll-note-color` (default `#2a7070`), `--daw-piano-roll-selected-note-color` (default `#3d9e9e`), and `--daw-piano-roll-background` (default `#1a1a2e`).

See `examples/dawcore-tone/midi.html` for a runnable demo (C major scale, PolySynth playback).

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

## Transport Access

Transport-specific APIs are on the `NativePlayoutAdapter` reference:

```javascript
// Transport-specific APIs are on the NativePlayoutAdapter
adapter.transport.setTempo(140);
adapter.transport.setMeter(3, 4);
adapter.transport.setMetronomeEnabled(true);
adapter.transport.setCountIn(true);
adapter.transport.setCountInBars(1);
adapter.transport.setCountInMode('always');
adapter.transport.on('countIn', ({ beat, totalBeats }) => {
  console.log('Count-in: ' + beat + '/' + totalBeats);
});
adapter.transport.connectTrackOutput('track-id', reverbNode);
```

## Programmatic File Loading

```javascript
const editor = document.getElementById('editor');
const result = await editor.loadFiles(fileList);
// result: { loaded: string[], failed: Array<{ file, error }> }
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
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: { ideal: 2 } }  // request stereo when available
  });
  editor.recordingStream = stream;

  // Cancelable — prevent default to handle the AudioBuffer yourself
  editor.addEventListener('daw-recording-complete', (e) => {
    // e.preventDefault(); // skip automatic clip creation
    console.log('recorded:', e.detail.audioBuffer);
  });
</script>
```

## Keyboard Shortcuts

Add `<daw-keyboard-shortcuts>` as a child of `<daw-editor>`:

```html
<daw-editor id="editor">
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>
  <!-- ... tracks ... -->
</daw-editor>
```

| Attribute | Shortcuts |
|-----------|-----------|
| `playback` | Space (play/pause), Enter (stop) |
| `splitting` | S (split at playhead) |
| `undo` | Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo) |

Custom shortcuts via JS properties: `playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`, `customShortcuts`.

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
  --daw-piano-roll-note-color: #2a7070;
  --daw-piano-roll-selected-note-color: #3d9e9e;
  --daw-piano-roll-background: #1a1a2e;
}
```

## Elements

### `<daw-editor>`

Core orchestrator. Attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `samples-per-pixel` | number | `1024` | Zoom level |
| `sample-rate` | number | `48000` | AudioContext sample rate hint |
| `wave-height` | number | `100` | Track waveform height in pixels |
| `timescale` | boolean | `false` | Show time ruler |
| `clip-headers` | boolean | `false` | Show clip name headers |
| `interactive-clips` | boolean | `false` | Enable drag/trim/split |
| `mono` | boolean | `false` | Merge stereo to mono display |
| `eager-resume` | boolean | `false` | Resume AudioContext on first user gesture |

JS properties: `audioContext`, `recordingStream`, `engine`.

Methods: `loadFiles(fileList)`, `splitAtPlayhead()`.

### `<daw-track>`

Declarative track data. Attributes: `src`, `name`, `volume`, `pan`, `muted`, `soloed`, `mono`, `render-mode` (`'waveform' | 'piano-roll'`, default `'waveform'`).

### `<daw-clip>`

Declarative clip data. Attributes: `src`, `peaks-src`, `start`, `duration`, `offset`, `gain`, `midi-channel`, `midi-program`. JS-only property: `midiNotes: MidiNoteData[] | null` (note arrays are too large for attributes).

### `<daw-piano-roll>`

Visual element for MIDI note rendering. Mounted automatically when the parent track has `render-mode="piano-roll"` — you don't usually instantiate it directly. See [MIDI Tracks](#midi-tracks).

### `<daw-transport for="editor-id">`

Container that resolves target editor. Children: `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`, `<daw-record-button>`.

### `<daw-track-controls>`

Per-track UI for volume, pan, mute, solo. Receives state from editor, dispatches `daw-track-control` and `daw-track-remove` events.

### `<daw-keyboard-shortcuts>`

Render-less child of `<daw-editor>`. Boolean attributes: `playback`, `splitting`, `undo`.

## Events

```javascript
const editor = document.getElementById('editor');

// Playback
editor.addEventListener('daw-play', () => {});
editor.addEventListener('daw-pause', () => {});
editor.addEventListener('daw-stop', () => {});
editor.addEventListener('daw-seek', (e) => console.log(e.detail.time));

// Selection & tracks
editor.addEventListener('daw-selection', (e) => console.log(e.detail));
editor.addEventListener('daw-track-select', (e) => console.log(e.detail.trackId));

// Clip interactions
editor.addEventListener('daw-clip-move', (e) => console.log(e.detail));
editor.addEventListener('daw-clip-trim', (e) => console.log(e.detail));
editor.addEventListener('daw-clip-split', (e) => console.log(e.detail));

// Recording
editor.addEventListener('daw-recording-start', (e) => console.log(e.detail));
editor.addEventListener('daw-recording-complete', (e) => {
  // e.preventDefault() to skip automatic clip creation
  console.log(e.detail.audioBuffer);
});

// Errors
editor.addEventListener('daw-track-error', (e) => console.error(e.detail));
editor.addEventListener('daw-error', (e) => console.error(e.detail));
editor.addEventListener('daw-files-load-error', (e) => console.error(e.detail));
```

## Custom AudioContext

Pass a custom `AudioContext` via the adapter:

```javascript
const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;
```

Set the adapter before tracks load. The provided context is used for decoding, playback, and recording.

## License

MIT
