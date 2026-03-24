# Component Reference

All elements are registered as custom elements when `@dawcore/components` is imported. No manual registration needed.

## Core

### `<daw-editor>`

The central orchestrator. Manages the audio engine, loads tracks, renders waveforms, handles interactions.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `samples-per-pixel` | number | `1024` | Zoom level (lower = more zoomed in) |
| `wave-height` | number | `128` | Track height in pixels |
| `timescale` | boolean | `false` | Show time ruler above tracks |
| `mono` | boolean | `false` | Merge channels to mono display |
| `bar-width` | number | `1` | Waveform bar width in pixels |
| `bar-gap` | number | `0` | Gap between waveform bars |
| `file-drop` | boolean | `false` | Enable drag-and-drop file loading |
| `clip-headers` | boolean | `false` | Show clip name headers |
| `clip-header-height` | number | `20` | Height of clip headers in pixels |
| `interactive-clips` | boolean | `false` | Enable clip move/trim/split interactions |
| `sample-rate` | number | `48000` | Sample rate hint for AudioContext and peaks matching |

**JS Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `audioContext` | `AudioContext \| null` | Custom AudioContext for decode, playback, and recording. Set before tracks load. |
| `recordingStream` | `MediaStream \| null` | Mic stream for recording. Consumer provides via `getUserMedia`. |
| `samplesPerPixel` | number | Zoom level (same as attribute, but with validation and clamping) |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `loadFiles(files)` | `Promise<LoadFilesResult>` | Load audio files as new tracks |
| `startRecording(stream?)` | `Promise<void>` | Start recording on selected track |
| `stopRecording()` | `void` | Stop recording |
| `pauseRecording()` | `void` | Pause recording |
| `resumeRecording()` | `void` | Resume recording |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `daw-play` | — | Playback started |
| `daw-pause` | — | Playback paused |
| `daw-stop` | — | Playback stopped |
| `daw-seek` | `{ time: number }` | Cursor position changed |
| `daw-selection` | `{ start, end }` | Selection region changed |
| `daw-track-select` | `{ trackId }` | Track selected |
| `daw-track-connected` | `{ trackId }` | Track element connected to DOM |
| `daw-track-ready` | `{ trackId }` | Track audio loaded and peaks rendered |
| `daw-track-error` | `{ trackId, error }` | Track failed to load |
| `daw-track-control` | `{ trackId, property, value }` | Track control changed (volume, pan, mute, solo) |
| `daw-track-remove` | `{ trackId }` | Track removed |
| `daw-clip-move` | `{ clipId, trackId, deltaSamples }` | Clip moved |
| `daw-clip-trim` | `{ clipId, trackId, boundary, deltaSamples }` | Clip boundary trimmed |
| `daw-clip-split` | `{ originalClipId, leftClipId, rightClipId }` | Clip split at playhead |
| `daw-error` | `{ operation, error }` | Playback or engine error |
| `daw-recording-start` | `{ trackId }` | Recording started |
| `daw-recording-complete` | `{ trackId, audioBuffer, channelCount }` | Recording finished (cancelable) |
| `daw-recording-error` | `{ trackId, error }` | Recording failed |
| `daw-files-load-error` | `{ file, error }` | File drop failed for a specific file |

---

## Data Elements

Data elements use light DOM. They declare timeline content as HTML.

### `<daw-track>`

Declares a track. Must be a direct child of `<daw-editor>`.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | — | Audio file URL (single-clip shorthand) |
| `peaks-src` | string | — | Pre-computed peaks URL (`.dat` or `.json`) |
| `name` | string | `''` | Track display name |
| `volume` | number | `1` | Track volume (0.0 to 1.0+) |
| `pan` | number | `0` | Stereo pan (-1.0 left, 0 center, 1.0 right) |
| `muted` | boolean | `false` | Whether track is muted |
| `soloed` | boolean | `false` | Whether track is soloed |

When `src` is set without child `<daw-clip>` elements, a single clip spanning the full audio is created automatically.

### `<daw-clip>`

Declares a clip within a track. Must be a direct child of `<daw-track>`.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | — | Audio file URL |
| `peaks-src` | string | — | Pre-computed peaks URL |
| `start` | number | `0` | Start position on timeline (seconds) |
| `duration` | number | — | Clip duration (seconds). Defaults to full audio length. |
| `offset` | number | `0` | Offset into the audio file (seconds) |
| `gain` | number | `1` | Clip volume multiplier |
| `fade-in-type` | string | — | Fade in curve type |
| `fade-in-duration` | number | — | Fade in duration (seconds) |
| `fade-out-type` | string | — | Fade out curve type |
| `fade-out-duration` | number | — | Fade out duration (seconds) |

---

## Visual Elements

Visual elements use Shadow DOM with canvas rendering.

### `<daw-waveform>`

Renders waveform data on canvas. Receives peak data as JS properties (not attributes).

Uses chunked rendering (1000px chunks) with virtual scrolling for performance. Only visible chunks are rendered. Dirty pixel tracking enables incremental updates without full redraws.

### `<daw-playhead>`

Animated vertical line showing current playback position. Uses `requestAnimationFrame` for smooth 60fps updates.

### `<daw-ruler>`

Time ruler with tick marks above the timeline. Shows hours:minutes:seconds labels with adaptive tick density based on zoom level.

### `<daw-selection>`

Visual overlay for the selected time region.

### `<daw-track-controls>`

Per-track control panel showing track name, volume slider, pan knob, mute/solo buttons, and remove button. Fixed position — doesn't scroll with the waveforms.

---

## Transport Elements

Transport elements provide playback controls. They find their target editor via the `for` attribute on the parent `<daw-transport>`.

### `<daw-transport>`

Container for transport buttons. Resolves the target `<daw-editor>` via `for` attribute.

**Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `for` | string | ID of the target `<daw-editor>` element |

### `<daw-play-button>`

Starts playback. Must be inside a `<daw-transport>`.

### `<daw-pause-button>`

Pauses playback, preserving position.

### `<daw-stop-button>`

Stops playback and returns to the beginning.

### `<daw-record-button>`

Starts/stops recording on the selected track. Requires `recordingStream` to be set on the editor.

---

## Keyboard Shortcuts

### `<daw-keyboard-shortcuts>`

Render-less element that adds keyboard shortcuts to the editor. Must be a direct child of `<daw-editor>`.

**Attributes:**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `playback` | boolean | `false` | Enable default playback shortcuts (Space = play/pause) |
| `splitting` | boolean | `false` | Enable split shortcut (S = split at playhead) |
| `undo` | boolean | `false` | Enable undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) |

**JS Properties (for custom key bindings):**

| Property | Type | Description |
|----------|------|-------------|
| `playbackShortcuts` | `PlaybackShortcutMap` | Custom playback key bindings |
| `splittingShortcuts` | `SplittingShortcutMap` | Custom splitting key bindings |
| `undoShortcuts` | `UndoShortcutMap` | Custom undo/redo key bindings |
| `customShortcuts` | `KeyBinding[]` | Additional custom shortcuts |

---

## Architecture

```
<daw-editor>                    ← Orchestrator (Shadow DOM)
  ├── <daw-keyboard-shortcuts>  ← Render-less, light DOM
  ├── <daw-track>               ← Data element, light DOM
  │     └── <daw-clip>          ← Data element, light DOM
  ├── <daw-track-controls>      ← Visual, Shadow DOM (auto-generated)
  ├── <daw-waveform>            ← Visual, Shadow DOM (auto-generated)
  ├── <daw-playhead>            ← Visual, Shadow DOM (auto-generated)
  ├── <daw-ruler>               ← Visual, Shadow DOM (auto-generated)
  └── <daw-selection>           ← Visual, Shadow DOM (auto-generated)

<daw-transport for="editor">    ← Light DOM container
  ├── <daw-play-button>         ← Walks up to <daw-transport>
  ├── <daw-pause-button>
  ├── <daw-stop-button>
  └── <daw-record-button>
```

**Data elements** (`<daw-track>`, `<daw-clip>`) use light DOM — the editor reads their attributes and listens for events. They don't render anything visible.

**Visual elements** (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`, `<daw-selection>`, `<daw-track-controls>`) use Shadow DOM and are created internally by the editor. Consumers don't create these directly.

**Transport elements** are light DOM. The `<daw-transport>` container resolves the target editor via `document.getElementById(this.getAttribute('for'))`. Button elements walk up to the closest `<daw-transport>` to find their target.

## Engine Lifecycle

1. Import `@dawcore/components` registers all custom elements
2. `<daw-track>` connects to DOM → dispatches `daw-track-connected`
3. `<daw-editor>` receives event → fetches + decodes audio → generates peaks
4. First track load creates `PlaylistEngine` + audio adapter (lazy)
5. Waveforms render immediately from peaks (no play required)
6. First play click resumes `AudioContext` (user gesture requirement)

## File Drop

When `file-drop` is enabled, drag audio files onto the editor:
- Each file creates a new track
- Supports any format the browser can decode (mp3, wav, ogg, opus, flac, etc.)
- Files with non-audio MIME types are rejected
- `daw-files-load-error` event fired for individual failures
- `loadFiles()` returns `{ loaded: string[], failed: Array<{ file, error }> }`

## Virtual Scrolling

For long timelines, only visible waveform chunks are rendered:
- `<daw-waveform>` uses 1000px canvas chunks
- `ViewportController` tracks scroll position with 1.5x overscan
- Chunks outside the visible range are not rendered
- Controls column stays fixed while waveforms scroll
