# Component Reference

All elements are registered as custom elements when `@dawcore/components` is imported. No manual registration needed.

## Core

### `<daw-editor>`

The central orchestrator. Manages the audio engine, loads tracks, renders waveforms, handles interactions.

**Attributes:**

| Attribute             | Type    | Default | Description                                                                                                                                                    |
| --------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `samples-per-pixel`   | number  | `1024`  | Zoom level (lower = more zoomed in)                                                                                                                            |
| `wave-height`         | number  | `128`   | Track height in pixels                                                                                                                                         |
| `timescale`           | boolean | `false` | Show time ruler above tracks                                                                                                                                   |
| `mono`                | boolean | `false` | Merge channels to mono display                                                                                                                                 |
| `bar-width`           | number  | `1`     | Waveform bar width in pixels                                                                                                                                   |
| `bar-gap`             | number  | `0`     | Gap between waveform bars                                                                                                                                      |
| `rounded-bars`        | boolean | `false` | Pill-shaped bar caps (radius bar-width/2)                                                                                                                      |
| `file-drop`           | boolean | `false` | Enable drag-and-drop file loading                                                                                                                              |
| `clip-headers`        | boolean | `false` | Show clip name headers                                                                                                                                         |
| `clip-header-height`  | number  | `20`    | Height of clip headers in pixels                                                                                                                               |
| `interactive-clips`   | boolean | `false` | Enable clip move/trim/split interactions                                                                                                                       |
| `indefinite-playback` | boolean | `false` | Disable the end-of-timeline auto-stop — roll until explicit stop (DAW style). Implies `fill-viewport`. Recording sessions suppress the auto-stop automatically |
| `fill-viewport`       | boolean | `false` | Timeline fills the visible viewport even when audio is shorter (layout only)                                                                                   |
| `sample-rate`         | number  | `48000` | Sample rate hint for AudioContext and peaks matching                                                                                                           |

**JS Properties:**

| Property          | Type                   | Description                                                                      |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `audioContext`    | `AudioContext \| null` | Custom AudioContext for decode, playback, and recording. Set before tracks load. |
| `recordingStream` | `MediaStream \| null`  | Mic stream for recording. Consumer provides via `getUserMedia`.                  |
| `samplesPerPixel` | number                 | Zoom level (same as attribute, but with validation and clamping)                 |

**Methods:**

| Method                    | Returns                    | Description                       |
| ------------------------- | -------------------------- | --------------------------------- |
| `loadFiles(files)`        | `Promise<LoadFilesResult>` | Load audio files as new tracks    |
| `startRecording(stream?)` | `Promise<void>`            | Start recording on selected track |
| `stopRecording()`         | `void`                     | Stop recording                    |
| `pauseRecording()`        | `void`                     | Pause recording                   |
| `resumeRecording()`       | `void`                     | Resume recording                  |

**Events:**

| Event                    | Detail                                        | Description                                     |
| ------------------------ | --------------------------------------------- | ----------------------------------------------- |
| `daw-play`               | —                                             | Playback started                                |
| `daw-pause`              | —                                             | Playback paused                                 |
| `daw-stop`               | —                                             | Playback stopped                                |
| `daw-seek`               | `{ time: number }`                            | Cursor position changed                         |
| `daw-selection`          | `{ start, end }`                              | Selection region changed                        |
| `daw-track-select`       | `{ trackId }`                                 | Track selected                                  |
| `daw-track-connected`    | `{ trackId }`                                 | Track element connected to DOM                  |
| `daw-track-ready`        | `{ trackId }`                                 | Track audio loaded and peaks rendered           |
| `daw-track-error`        | `{ trackId, error }`                          | Track failed to load                            |
| `daw-track-control`      | `{ trackId, property, value }`                | Track control changed (volume, pan, mute, solo) |
| `daw-track-remove`       | `{ trackId }`                                 | Track removed                                   |
| `daw-clip-move`          | `{ clipId, trackId, deltaSamples }`           | Clip moved                                      |
| `daw-clip-trim`          | `{ clipId, trackId, boundary, deltaSamples }` | Clip boundary trimmed                           |
| `daw-clip-split`         | `{ originalClipId, leftClipId, rightClipId }` | Clip split at playhead                          |
| `daw-error`              | `{ operation, error }`                        | Playback or engine error                        |
| `daw-recording-start`    | `{ trackId }`                                 | Recording started                               |
| `daw-recording-complete` | `{ trackId, audioBuffer, channelCount }`      | Recording finished (cancelable)                 |
| `daw-recording-error`    | `{ trackId, error }`                          | Recording failed                                |
| `daw-files-load-error`   | `{ file, error }`                             | File drop failed for a specific file            |

---

## Data Elements

Data elements use light DOM. They declare timeline content as HTML.

### `<daw-track>`

Declares a track. Must be a direct child of `<daw-editor>`.

**Attributes:**

| Attribute     | Type    | Default      | Description                                                                                                                       |
| ------------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `src`         | string  | —            | Audio file URL (single-clip shorthand)                                                                                            |
| `peaks-src`   | string  | —            | Pre-computed peaks URL (`.dat` or `.json`)                                                                                        |
| `name`        | string  | `''`         | Track display name                                                                                                                |
| `volume`      | number  | `1`          | Track volume (0.0 to 1.0+)                                                                                                        |
| `pan`         | number  | `0`          | Stereo pan (-1.0 left, 0 center, 1.0 right)                                                                                       |
| `muted`       | boolean | `false`      | Whether track is muted                                                                                                            |
| `soloed`      | boolean | `false`      | Whether track is soloed                                                                                                           |
| `render-mode` | string  | `'waveform'` | `'waveform'` or `'piano-roll'`. Piano-roll mode mounts `<daw-piano-roll>` for each clip in the track instead of `<daw-waveform>`. |

When `src` is set without child `<daw-clip>` elements, a single clip spanning the full audio is created automatically.

### `<daw-clip>`

Declares a clip within a track. Must be a direct child of `<daw-track>`.

**Attributes:**

| Attribute           | Type   | Default | Description                                                             |
| ------------------- | ------ | ------- | ----------------------------------------------------------------------- |
| `src`               | string | —       | Audio file URL                                                          |
| `peaks-src`         | string | —       | Pre-computed peaks URL                                                  |
| `start`             | number | `0`     | Start position on timeline (seconds)                                    |
| `duration`          | number | —       | Clip duration (seconds). Defaults to full audio length.                 |
| `offset`            | number | `0`     | Offset into the audio file (seconds)                                    |
| `gain`              | number | `1`     | Clip volume multiplier                                                  |
| `fade-in-type`      | string | —       | Fade in curve type                                                      |
| `fade-in-duration`  | number | —       | Fade in duration (seconds)                                              |
| `fade-out-type`     | string | —       | Fade out curve type                                                     |
| `fade-out-duration` | number | —       | Fade out duration (seconds)                                             |
| `midi-channel`      | number | —       | MIDI channel (0-indexed). Channel 9 = GM percussion.                    |
| `midi-program`      | number | —       | GM program (0-127). Used by `SoundFontToneTrack` for instrument lookup. |

**JS-only properties:**

| Property    | Type                     | Description                                                                                                                                                                                                                                            |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `midiNotes` | `MidiNoteData[] \| null` | MIDI notes for this clip. Not reflected as an attribute (note arrays are too large). Setting this dispatches `daw-clip-update`, which propagates to the engine via `<daw-editor>._applyClipUpdate`. A clip is treated as MIDI iff `midiNotes != null`. |

---

## Annotation Elements

Annotation elements let you attach a timeline of labeled regions (lyrics, chapter markers, transcription segments) to a `<daw-editor>`, with a synchronized timeline-lane view and text-panel view over the same underlying data.

### `<daw-annotation-track>`

Declarative annotation track (light DOM). Owns the ephemeral selection state and the keyboard/navigation API. Children are `<daw-annotation>` elements — their attributes are the single source of truth; the editor renders the timeline lane and `<daw-annotation-list>` renders the text panel from the same elements.

**Attributes:**

| Attribute           | Type    | Default  | Description                                                                                                                                                                                                                            |
| ------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editable`          | boolean | `false`  | Allow drag/resize of annotation boxes and boundary-editing shortcuts                                                                                                                                                                   |
| `link-endpoints`    | boolean | `false`  | Snap adjacent annotation boundaries together; boundary moves cascade to linked neighbors                                                                                                                                               |
| `continuous-play`   | boolean | `false`  | `playActive()` plays past the annotation's end instead of stopping there                                                                                                                                                               |
| `keyboard-controls` | boolean | `false`  | Enable keyboard navigation and boundary-editing shortcuts (capture-phase, see Key Patterns below)                                                                                                                                      |
| `box-label`         | string  | `'text'` | Lane box label mode: `'text'` (all text lines joined with spaces), `'id'` (`id` attribute or 1-based position fallback), `'none'` (bare region bars). Only affects the timeline lane — `<daw-annotation-list>` always shows full text. |
| `name`              | string  | `''`     | Display label for the editor's controls-column lane row (mirrors `<daw-track name>`). Empty renders a blank spacer.                                                                                                                    |

**JS-only properties:**

| Property              | Type                                 | Description                                                                                                          |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `activeAnnotationId`  | `string \| null`                     | Currently selected annotation id. Setting an unknown id warns and is ignored. Setting fires `daw-annotation-select`. |
| `annotationShortcuts` | `AnnotationShortcutMap \| null`      | Key remap (`null` = defaults from `@waveform-playlist/core`)                                                         |
| `annotations`         | `AnnotationData[]` (read-only)       | Derived from child `<daw-annotation>` elements, sorted by `start`                                                    |
| `annotationElements`  | `DawAnnotationElement[]` (read-only) | Child elements, sorted by `start`                                                                                    |

**Methods:**

| Method                                                    | Description                                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `selectNext()`                                            | Select next annotation. No selection → selects first. Wraps at the end.                                                |
| `selectPrevious()`                                        | Select previous annotation. No selection → selects last. Wraps at the start.                                           |
| `selectFirst()` / `selectLast()`                          | Select first/last annotation                                                                                           |
| `clearSelection()`                                        | Deselect (sets `activeAnnotationId = null`)                                                                            |
| `playActive()`                                            | `editor.play(start, continuousPlay ? undefined : end)` for the active annotation; warns if no parent `<daw-editor>`    |
| `moveStartBoundary(deltaMs)` / `moveEndBoundary(deltaMs)` | Shift the active annotation's boundary by `deltaMs` milliseconds (requires `editable`; no-op with a warning otherwise) |

**Events:** `daw-annotation-track-connected` (`{element}`), `daw-annotation-select` (`{annotation: AnnotationData \| null}`), `daw-error` (`{operation: 'annotation-shortcut', key, error}`) — all bubble + compose.

Boundary edits (drag or `moveEndBoundary`) clamp `end` to the parent `<daw-editor>`'s timeline duration by default. Setting `<daw-editor indefinite-playback>` lifts that end bound entirely, so annotations may extend past the audio; in temporal mode (not beats mode) the editor's timeline width also extends to cover the furthest annotation end, keeping such annotations reachable/scrollable.

### `<daw-annotation>`

Declarative annotation data element (light DOM). Its `start`/`end` attributes and text content ARE the single source of truth — must be a child of `<daw-annotation-track>`.

**Attributes:**

| Attribute    | Type           | Default | Description                                                                                                               |
| ------------ | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `start`      | number         | `0`     | Start time (seconds). Reflected. Rejects negative/non-finite values with a warning (ignored, previous value kept).        |
| `end`        | number         | `0`     | End time (seconds). Reflected. Same validation as `start`.                                                                |
| `start-tick` | number \| null | `null`  | Musical start position (ticks). Reflected as `start-tick`. Rejects non-finite/non-integer/negative values with a warning. |
| `end-tick`   | number \| null | `null`  | Musical end position (ticks). Reflected as `end-tick`. Same validation as `start-tick`.                                   |
| `id`         | string         | —       | Standard HTML `id`. Used as the stable `annotationId` when present; otherwise a generated UUID is used.                   |

**Tick authority rule:** the annotation is tick-based (`isTickBased` returns `true`) iff BOTH `start-tick` and `end-tick` are set — `start`/`end` seconds then become a derived cache the host editor keeps fresh (clip `startTick` pattern; the editor's `AnnotationController.deriveSecondsCaches` sweep does the work). Setting only one of the two tick attributes is a half-configured state, treated as seconds-based and logged with a one-time warning per annotation. Tick-based boundary edits (drag, `moveStartBoundary`/`moveEndBoundary`) require a parent `<daw-editor>` for tempo conversion — without one, the edit is ignored with a warning.

Text content (light-DOM children) is the annotation's label — read via `.trim()`, split on `\n` into `AnnotationData.lines`.

**JS-only properties:**

| Property       | Type                 | Description                                                 |
| -------------- | -------------------- | ----------------------------------------------------------- |
| `annotationId` | `string` (read-only) | `id` attribute if set, else a generated `annotation-<uuid>` |

**Events:** `daw-annotation-connected` (`{annotationId, element}`, deferred one tick), `daw-annotation-update` (`{annotationId}`, fires on `start`/`end`/`start-tick`/`end-tick` change after the initial render — not on mount) — both bubble + compose.

**Rendering:** self-hides (`display: none`) on connect — it's a data container, not a visual element. The editor's annotation lane and `<daw-annotation-list>` render views derived from it.

### `<daw-annotation-list>`

Scrollable text panel (Shadow DOM) over a `<daw-annotation-track>`'s children. Linked via the `for` attribute (the track element's `id`) — reads the same `<daw-annotation>` elements the editor's timeline lane renders; no duplicate data.

**Attributes:**

| Attribute      | Type   | Default  | Description                                                                                                                                                                                                                             |
| -------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `for`          | string | `''`     | `id` of the target `<daw-annotation-track>`. Warns once if missing or pointing at the wrong tag; warning resets when `for` changes.                                                                                                     |
| `time-display` | string | `'time'` | `'time'`: m:ss.mmm clock times (unchanged). `'bars'`: `B.b – B.b` bar.beat ranges from the host editor's meter map (`this.track.closest('daw-editor')`). Falls back to time display, and warns once, when no host editor is resolvable. |

**Behavior:** each row shows the formatted time range and annotation text. Clicking a row selects it (`track.activeAnnotationId = id`) and seeks the editor to the annotation's start. When the target track is `editable`, row text becomes `contenteditable` — `Enter` commits (blur), `Escape` cancels and restores the original text; committing writes back to the `<daw-annotation>` element's `textContent`. Auto-scrolls the active row into view on `daw-annotation-select`.

CSS custom properties: `--daw-annotation-list-max-height` (default `240px`), `--daw-annotation-list-background`, `--daw-annotation-text-color`, `--daw-annotation-active-background`.

```html
<daw-editor id="my-editor">
  <daw-annotation-track id="lyrics" editable link-endpoints keyboard-controls>
    <daw-annotation start="0.0" end="2.5">First line of lyrics</daw-annotation>
    <daw-annotation start="2.5" end="5.1">Second line of lyrics</daw-annotation>
  </daw-annotation-track>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
</daw-editor>

<!-- Text list view linked to the same data via for/id -->
<daw-annotation-list for="lyrics"></daw-annotation-list>
```

---

## Visual Elements

Visual elements use Shadow DOM with canvas rendering.

### `<daw-waveform>`

Renders waveform data on canvas. Receives peak data as JS properties (not attributes).

Uses chunked rendering (1000px chunks) with virtual scrolling for performance. Only visible chunks are rendered. Dirty pixel tracking enables incremental updates without full redraws.

### `<daw-piano-roll>`

Renders MIDI notes on canvas — alternative to `<daw-waveform>` for clips on tracks with `render-mode="piano-roll"`. Auto-mounted by `<daw-editor>`; rarely instantiated directly.

Same chunked rendering pattern as `<daw-waveform>` (1000px chunks, virtual scrolling). Auto-fits the pitch range to the actual notes (± 1 note for breathing room), maps velocity to opacity (0.3 → 1.0), and respects `--daw-piano-roll-note-color` / `--daw-piano-roll-selected-note-color` / `--daw-piano-roll-background` CSS custom properties.

Properties (set by `<daw-editor>`): `midiNotes`, `length`, `waveHeight`, `samplesPerPixel`, `sampleRate`, `clipOffsetSeconds`, `visibleStart`, `visibleEnd`, `originX`, `selected`.

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

| Attribute | Type   | Description                             |
| --------- | ------ | --------------------------------------- |
| `for`     | string | ID of the target `<daw-editor>` element |

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

| Attribute   | Type    | Default | Description                                            |
| ----------- | ------- | ------- | ------------------------------------------------------ |
| `playback`  | boolean | `false` | Enable default playback shortcuts (Space = play/pause) |
| `splitting` | boolean | `false` | Enable split shortcut (S = split at playhead)          |
| `undo`      | boolean | `false` | Enable undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)        |

**JS Properties (for custom key bindings):**

| Property             | Type                   | Description                   |
| -------------------- | ---------------------- | ----------------------------- |
| `playbackShortcuts`  | `PlaybackShortcutMap`  | Custom playback key bindings  |
| `splittingShortcuts` | `SplittingShortcutMap` | Custom splitting key bindings |
| `undoShortcuts`      | `UndoShortcutMap`      | Custom undo/redo key bindings |
| `customShortcuts`    | `KeyBinding[]`         | Additional custom shortcuts   |

---

## Architecture

```
<daw-editor>                    ← Orchestrator (Shadow DOM)
  ├── <daw-keyboard-shortcuts>  ← Render-less, light DOM
  ├── <daw-track>               ← Data element, light DOM
  │     └── <daw-clip>          ← Data element, light DOM
  ├── <daw-track-controls>      ← Visual, Shadow DOM (auto-generated)
  ├── <daw-waveform>            ← Visual, Shadow DOM (auto-generated; render-mode="waveform")
  ├── <daw-piano-roll>          ← Visual, Shadow DOM (auto-generated; render-mode="piano-roll")
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

**Visual elements** (`<daw-waveform>`, `<daw-piano-roll>`, `<daw-playhead>`, `<daw-ruler>`, `<daw-selection>`, `<daw-track-controls>`) use Shadow DOM and are created internally by the editor. Consumers don't create these directly. The editor mounts `<daw-waveform>` or `<daw-piano-roll>` per clip based on the parent `<daw-track>`'s `render-mode` attribute.

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
