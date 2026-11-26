# Component Reference

All elements are registered as custom elements when `@dawcore/components` is imported. No manual registration needed.

## Core

### `<daw-editor>`

The central orchestrator. Manages the audio engine, loads tracks, renders waveforms, handles interactions.

**Attributes:**

| Attribute               | Type    | Default | Description                                                                                                                                                    |
| ----------------------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `samples-per-pixel`     | number  | `1024`  | Zoom level (lower = more zoomed in)                                                                                                                            |
| `wave-height`           | number  | `128`   | Track height in pixels                                                                                                                                         |
| `timescale`             | boolean | `false` | Show time ruler above tracks                                                                                                                                   |
| `mono`                  | boolean | `false` | Merge channels to mono display                                                                                                                                 |
| `bar-width`             | number  | `1`     | Waveform bar width in pixels                                                                                                                                   |
| `bar-gap`               | number  | `0`     | Gap between waveform bars                                                                                                                                      |
| `rounded-bars`          | boolean | `false` | Pill-shaped bar caps (radius bar-width/2)                                                                                                                      |
| `gain-scaled-waveforms` | boolean | `false` | Draw each clip's waveform scaled by its `gain` (clamped to the channel height) instead of at source level                                                      |
| `file-drop`             | boolean | `false` | Enable drag-and-drop file loading                                                                                                                              |
| `clip-headers`          | boolean | `false` | Show clip name headers                                                                                                                                         |
| `clip-header-height`    | number  | `20`    | Height of clip headers in pixels                                                                                                                               |
| `interactive-clips`     | boolean | `false` | Enable clip move/trim/split interactions                                                                                                                       |
| `indefinite-playback`   | boolean | `false` | Disable the end-of-timeline auto-stop — roll until explicit stop (DAW style). Implies `fill-viewport`. Recording sessions suppress the auto-stop automatically |
| `fill-viewport`         | boolean | `false` | Timeline fills the visible viewport even when audio is shorter (layout only)                                                                                   |
| `track-reordering`      | boolean | `false` | Show a drag grip + move up/down buttons on `<daw-track-controls>` for vertical track reordering (drag and buttons both undoable)                               |

**JS Properties:**

| Property          | Type                   | Description                                                                                                                                                              |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter`         | `PlayoutAdapter \| null` | The audio backend (`NativePlayoutAdapter` from `@dawcore/transport`, or `createToneAdapter()` from `@waveform-playlist/playout`). The engine is built as soon as the editor is connected with one; tracks wait for it, silently (`play()` without one warns and fires `daw-error` with `operation: 'play'` and the no-adapter error). `null` after the editor is removed from the document once an engine had been built (the engine disposed it): set a fresh one when the editor is inserted again. |
| `arrangement`     | `Arrangement` (set: `Arrangement \| null`) | The arrangement the editor plays: one handed in, or else the editor's own, whose content the `<daw-track>` children declare. Set an arrangement (`createArrangement()` from `@waveform-playlist/engine`) to play it alone, `null` to go back to the own one. See [The Arrangement](#the-arrangement). |
| `audioContext`    | `AudioContext`         | Read-only: the adapter's AudioContext, used for decoding and recording. Throws when no adapter is set.                                                   |
| `recordingStream` | `MediaStream \| null`  | Mic stream for recording. Consumer provides via `getUserMedia`.                                                                                                          |
| `tracks`          | `TrackWithId[]`        | Read-only. Every track of the arrangement played, in its order, read from it (name, kind, mix, clips as it holds them; a clip's times in seconds; `kind: 'dom'` when a `<daw-clip>` declares it, else `'drop'`), then the tracks waiting for `editor.adapter` (the page's, as their elements declare them, and those from `addTrack()`; while a handed-in arrangement is played, the page's are not listed). It follows Undo and Redo; a track an Undo took out is not listed until a Redo brings it back. |
| `samplesPerPixel` | number                 | Zoom level (same as attribute, but with validation and clamping)                                                                                                         |

**Methods:**

| Method                           | Returns                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addTrack(config)`               | `Promise<string>`          | Add a track built from `config` (`name`, `kind`, the mix, `renderMode`, `spectrogramConfig`, `clips`, `midi`) to the arrangement played; no element is created. Resolves with its id once it has entered, before its audio has loaded. Add a `daw-track-ready` / `daw-track-error` listener BEFORE calling it: for a track with nothing to fetch, or whose audio is already loaded, the event fires before the promise resolves. Waits for `editor.adapter` when none is set; rejects when the engine cannot be built. An undo step. |
| `removeTrack(trackId)`           | `void`                     | Remove a track: its `<daw-track>` when it has one (as `select.remove(i)` removes an option), else the track itself. An undo step; Undo brings the track back with no element. |
| `addClip(trackId, config)`       | `Promise<string>`          | Add a clip (`src` required, times in seconds, `gain`, `name`, `peaksSrc`) to any track; no `<daw-clip>` is created. Resolves with its id once its audio has loaded; rejects when it fails, is refused, or leaves the arrangement first. An undo step. |
| `updateClip(trackId, clipId, partial)` | `void`               | Change a clip's `start`, `duration`, `offset`, `gain`, `name` or MIDI fields: one undo step on the arrangement. A `<daw-clip>`'s properties show the change, its attributes do not. Fades are a `<daw-clip>` declaration only (no engine fades yet): `fadeIn` / `fadeOut` / `fadeType` here change nothing. |
| `removeClip(trackId, clipId)`    | `void`                     | Remove a clip: its `<daw-clip>` when it has one, else the clip itself. An undo step. |
| `retryTrack(trackId)`            | `void`                     | Load again every source of the track whose load failed. `daw-track-ready` follows when it loads. A source that loaded but could not make a clip (an offset past its end) is not loaded again. |
| `loadFiles(files)`               | `Promise<LoadFilesResult>` | Add each audio file as a track with no `<daw-track>` element (its clip's source is the `File`), one after another, and resolve once each has loaded or failed. A file that cannot be loaded is removed again, with no undo step. When the editor is removed from the document meanwhile, it resolves at once: a file whose track has entered and is still loading is kept and listed in `loaded` (it loads after a reparent), a file still waiting to enter and the files not started are listed in `failed`. |
| `startRecording(stream?)`        | `Promise<void>`            | Start recording on selected track                                                                                                                                                                                                                                                                                                                                                                                                 |
| `stopRecording()`                | `void`                     | Stop recording                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pauseRecording()`               | `void`                     | Pause recording                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `resumeRecording()`              | `void`                     | Resume recording                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `updateTrack(trackId, partial)`  | `void`                     | Change a track's `name`, `volume`, `pan`, `muted`, `soloed` (on the arrangement: the mixer fields of one call are one undo step, a rename another), `renderMode` or `spectrogramConfig`. No element is written: a `<daw-track>`'s properties show the change, its attributes do not. On a track still waiting to enter, it changes what the track enters with. |
| `reorderTrack(trackId, toIndex)` | `void`                     | Move a track to a 0-based position in the arrangement's order, every track counted (those with no element too; `trackEl.index` and `editor.tracks` give the positions). No element moves. Undoable.                                                                                                                                                                                    |

**Events:**

| Event                    | Detail                                                                  | Description                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `daw-play`               | —                                                                       | Playback started                                                                                               |
| `daw-pause`              | —                                                                       | Playback paused                                                                                                |
| `daw-stop`               | —                                                                       | Playback stopped                                                                                               |
| `daw-seek`               | `{ time: number }`                                                      | Cursor position changed                                                                                        |
| `daw-selection`          | `{ start, end }`                                                        | Selection region changed                                                                                       |
| `daw-track-select`       | `{ trackId }`                                                           | Track selected                                                                                                 |
| `daw-track-connected`    | `{ trackId }`                                                           | Track element connected to DOM                                                                                 |
| `daw-track-ready`        | `{ trackId }`                                                           | The track's audio has loaded (its peaks are drawn a moment later), or the track asked for no audio. Fires again each time the track has loaded again after loading or failing (a clip added later, `retryTrack`) |
| `daw-track-error`        | `{ trackId, error }`                                                    | Every clip of the track failed to load (or was refused for its kind). The track stays in the editor; its clip is drawn failed where its length is known |
| `daw-clip-ready`         | `{ trackId, clipId }`                                                   | A clip's audio has loaded |
| `daw-clip-error`         | `{ trackId, clipId, error }`                                            | A clip's audio failed to load, or the clip was refused (a clip of the other kind than its track) |
| `daw-track-control`      | `{ trackId, prop, value, gesture? }`                                    | Volume, pan, mute or solo changed; `gesture`: the slider's id (one drag or key press is one undo step)         |
| `daw-track-remove`       | `{ trackId }`                                                           | Track removed                                                                                                  |
| `daw-track-reorder`      | `{ trackId, fromIndex, toIndex }`                                       | Move up/down button clicked on `<daw-track-controls>` (bubbles to the editor, which calls `reorderTrack`)      |
| `daw-track-reorder-grab` | `{ trackId, pointerEvent, gripElement }`                                | Drag grip pointerdown on `<daw-track-controls>` (bubbles to the editor, which starts the pointer-drag handler) |
| `daw-clip-move`          | `{ clipId, trackId, deltaSamples }`                                     | Clip moved                                                                                                     |
| `daw-clip-trim`          | `{ clipId, trackId, boundary, deltaSamples }`                           | Clip boundary trimmed                                                                                          |
| `daw-clip-split`         | `{ originalClipId, leftClipId, rightClipId }`                           | Clip split at playhead. The left half keeps the clip's id (`leftClipId === originalClipId`), so a `<daw-clip>` follows its left half; `rightClipId` is the new clip |
| `daw-error`              | `{ operation, error }`                                                  | Playback or engine error                                                                                       |
| `daw-recording-start`    | `{ trackId }`                                                           | Recording started                                                                                              |
| `daw-recording-complete` | `{ trackId, audioBuffer, startSample, durationSamples, offsetSamples }` | Recording finished, before the clip exists (cancelable)                                                        |
| `daw-recording-clip-add` | `{ trackId, clipId }`                                                   | The take's clip is in the engine — address it with `updateClip` / `removeClip`                                 |
| `daw-recording-error`    | `{ trackId, error }`                                                    | Recording failed                                                                                               |
| `daw-files-load-error`   | `{ file, error }`                                                       | File drop failed for a specific file                                                                           |

---

## Data Elements

Data elements use light DOM. They declare timeline content as HTML.

### `<daw-track>`

Declares a track. Must be a direct child of `<daw-editor>`.

**Attributes:**

| Attribute     | Type    | Default      | Description                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`         | string  | —            | Audio file URL (single-clip shorthand)                                                                                                                                                                                                                                                                                                                    |
| `name`        | string  | `''`         | Track display name                                                                                                                                                                                                                                                                                                                                        |
| `volume`      | number  | `1`          | Track volume (0.0 to 1.0+)                                                                                                                                                                                                                                                                                                                                |
| `pan`         | number  | `0`          | Stereo pan (-1.0 left, 0 center, 1.0 right)                                                                                                                                                                                                                                                                                                               |
| `muted`       | boolean | `false`      | Whether track is muted                                                                                                                                                                                                                                                                                                                                    |
| `soloed`      | boolean | `false`      | Whether track is soloed                                                                                                                                                                                                                                                                                                                                   |
| `kind`        | string  | `'audio'`    | `'audio'` or `'midi'`. What the track holds: every `<daw-clip>` must be of this kind (a clip with `src` is audio, a clip without is MIDI). A clip of the other kind is not added and is reported with `daw-clip-error`. A MIDI track mounts `<daw-piano-roll>` for each clip. Set it before the track is added; a later change is ignored with a warning. |
| `render-mode` | string  | `'waveform'` | How an audio track is drawn: `'waveform'` or `'spectrogram'`. Ignored on a MIDI track, which is always a piano roll. Any other value (the former `'piano-roll'` included) warns and is treated as `'waveform'`.                                                                                                                                           |

When `src` is set without child `<daw-clip>` elements, a single clip spanning the full audio is created automatically.

**Attributes are the declaration; properties are live (#848).** The attributes say what the track starts with and are never written by the editor, like `<input value>`. While the arrangement played holds the track, the properties `name`, `volume`, `pan`, `muted` (the stored mute; a take's mute is not shown) and `soloed` read it, and setting one, or changing its attribute, is a request to it, one undo step: `trackEl.volume = 0.5` reads back 0.5 at once, and the `volume` attribute keeps what the page wrote. Mix changes made together (in one synchronous run, before the next microtask) are one step; a rename is a step of its own; a value the arrangement already holds changes nothing. A property set before the track has entered is the value it enters with. `src`, `render-mode` and `spectrogramConfig` are the page's declaration only (`updateTrack()` changes what is drawn; read it from `editor.tracks`). `kind` is live: once the track has entered, `trackEl.kind` reads the kind it entered with, which cannot change; a later change of the property or the attribute logs a warning, and the attribute keeps what the page wrote.

**JS-only properties:** `index` (number): the track's position in the arrangement played (as `option.index`), `-1` when it is not in it.

**Detached.** An element is linked to its track by id. When the arrangement no longer holds that id (an Undo of its arrival, an `arrangement.removeTrack` made by the app, a refusal) or a handed-in arrangement is set, the element is detached: it is not drawn, not in `editor.tracks`, its properties read its declaration, and a change on it changes nothing in the arrangement and logs a warning that names the element and the reason (an attribute change still updates the declaration, which the property then reads). It carries the custom state `detached`: `daw-track:state(detached) { … }` in CSS, `el.matches(':state(detached)')` in script (nothing is written to the DOM). The editor never adds it again; a Redo of its arrival makes it live again. Removing it and inserting it again declares a new track.

**The children of a detached `<daw-track>`.** A `<daw-clip>` (or the `<daw-track>` itself) that the page removes while the arrangement does not hold it is gone for good: it is taken out of the undo and redo states too, so no Redo brings it back, and no Redo is lost. A `<daw-clip>` added to a detached `<daw-track>` never enters, also after a Redo: it logs a warning and carries `:state(detached)`. The same holds for a `<daw-clip>` whose own arrival an Undo took away. (The rule follows `<track>` in `<video>`: removing the element removes what it declared.)

**Events:** `daw-track-update` `{ trackId, changed }` after a reflected property changes (not on the first render). `changed` names the properties of that update.

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
| `name`              | string | `''`    | Clip name (shown in the clip header)                                    |
| `fade-in`           | number | `0`     | Fade in duration (seconds); declared only, not played yet               |
| `fade-out`          | number | `0`     | Fade out duration (seconds); declared only, not played yet              |
| `fade-type`         | string | `linear`| Fade curve type; declared only                                          |
| `midi-channel`      | number | —       | MIDI channel (0-indexed). Channel 9 = GM percussion.                    |
| `midi-program`      | number | —       | GM program (0-127). Used by `SoundFontToneTrack` for instrument lookup. |

**JS-only properties:**

| Property    | Type                     | Description                                                                                                                                                                                                                                            |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `midiNotes` | `MidiNoteData[] \| null` | MIDI notes for this clip. Not reflected as an attribute (note arrays are too large). Live like the other properties (below): while the clip is in the arrangement it returns the arrangement's notes array (set a new array to change them; do not edit it in place), and setting it changes the clip, one undo step. A clip is treated as MIDI iff `midiNotes != null`. |

**Properties are live (#848).** As for `<daw-track>`: `start`, `duration`, `offset`, `gain`, `name`, `midiNotes`, `midiChannel` and `midiProgram` read the arrangement while it holds the clip (after a drag, `clipEl.start` is where the clip is; the `start` attribute keeps what the page wrote), and setting one is a request, one undo step (a clip still loading has its loading clip changed, and its audio loads into it). The attributes are the declaration. A split keeps the clip's id on its LEFT half, so the element follows the left half. A detached `<daw-clip>` (its clip removed from the arrangement, or a handed-in arrangement set) carries `:state(detached)`, as above. Removing a `<daw-clip>` removes its clip, one undo step. Moving it into another `<daw-track>` of the editor (`appendChild`, or `moveBefore()`, which keeps the element's state) moves its clip there as it is (its times and audio), one undo step; moved out of the editor, its clip goes. A track of the other kind refuses it: nothing changes (no undo step), `daw-clip-error` fires and a warning is logged. The editor moves no element, also on an Undo or Redo of a move: a `<daw-clip>` is linked to its clip by id wherever it sits, so after an Undo of a move it stays in the new track's element and its properties read (and change) the clip in the old track; removing it removes that clip.

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

Renders MIDI notes on canvas — alternative to `<daw-waveform>` for clips on MIDI tracks (`<daw-track kind="midi">`). Auto-mounted by `<daw-editor>`; rarely instantiated directly.

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

It draws the arrangement's mix, so its sliders and buttons follow Undo and Redo. Each change dispatches `daw-track-control` `{ trackId, prop, value, gesture? }`, which the editor sends to the arrangement. One pointer drag on a slider, or one key press (a held key included), is one undo step: the slider's `gesture` id stays the same until the input's `change`, the key's `keyup` or a blur. Each Mute or Solo click is one step. Keyboard Undo (`<daw-keyboard-shortcuts undo>`) does not fire while a slider has focus; click elsewhere or press `Tab` first (#730).

**JS Properties (set by `<daw-editor>`, not attributes):**

| Property      | Type      | Default | Description                                                                                                                                        |
| ------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recording`   | `boolean` | `false` | A take is recording onto the track (the editor passes `engine.recordingTrackIds.has(trackId)`): the M button is disabled and a click sends nothing |
| `reorderable` | `boolean` | `false` | Mirrors the editor's `track-reordering` attribute — shows the drag grip + move up/down buttons                                                     |
| `trackIndex`  | `number`  | `0`     | This track's 0-based position, for computing move-button disabled state                                                                            |
| `trackCount`  | `number`  | `1`     | Total track count, for computing move-button disabled state (down disabled at the last index)                                                      |

Dispatches `daw-track-reorder` (move buttons) and `daw-track-reorder-grab` (drag grip pointerdown) — see the `<daw-editor>` events table above.

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
| `playback`  | boolean | `false` | Enable default playback shortcuts (Space = play/pause, Escape = stop, 0 = rewind to start) |
| `splitting` | boolean | `false` | Enable split shortcut (S = split at playhead)          |
| `undo`      | boolean | `false` | Enable undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z); they do nothing while a clip or track drag is in progress |

**JS Properties (for custom key bindings):**

| Property             | Type                   | Description                   |
| -------------------- | ---------------------- | ----------------------------- |
| `playbackShortcuts`  | `PlaybackShortcutMap`  | Custom playback key bindings  |
| `splittingShortcuts` | `SplittingShortcutMap` | Custom splitting key bindings |
| `undoShortcuts`      | `UndoShortcutMap`      | Custom undo/redo key bindings |
| `customShortcuts`    | `KeyBinding[]`         | Additional custom shortcuts   |

**Focused controls keep their keys.** A shortcut does not fire when the focused control uses the key itself, however it got focus: text fields, sliders, `<select>` and `contenteditable` keep every key; `Escape` closes an open modal dialog; `Space` and `Enter` go to a focused `<button>` or `<summary>`, and `Enter` to a focused link. While a slider or other input has focus no shortcut fires at all, including `S` (split) and undo/redo. A control you clicked still has focus: after clicking M, `Space` toggles M again, and after clicking `<daw-play-button>`, `Space` presses Play again and does not pause. `Space` is play/pause when focus is not on a control (click the timeline, or press `Tab`). The check looks through shadow DOM, so it covers the controls inside `<daw-track-controls>` and the transport buttons, and `<daw-annotation-track keyboard-controls>` applies the same rule to its own shortcuts.

---

## Architecture

```
<daw-editor>                    ← Orchestrator (Shadow DOM)
  ├── <daw-keyboard-shortcuts>  ← Render-less, light DOM
  ├── <daw-track>               ← Data element, light DOM
  │     └── <daw-clip>          ← Data element, light DOM
  ├── <daw-track-controls>      ← Visual, Shadow DOM (auto-generated)
  ├── <daw-waveform>            ← Visual, Shadow DOM (auto-generated; render-mode="waveform")
  ├── <daw-piano-roll>          ← Visual, Shadow DOM (auto-generated; kind="midi")
  ├── <daw-playhead>            ← Visual, Shadow DOM (auto-generated)
  ├── <daw-ruler>               ← Visual, Shadow DOM (auto-generated)
  └── <daw-selection>           ← Visual, Shadow DOM (auto-generated)

<daw-transport for="editor">    ← Light DOM container
  ├── <daw-play-button>         ← Walks up to <daw-transport>
  ├── <daw-pause-button>
  ├── <daw-stop-button>
  └── <daw-record-button>
```

**Data elements** (`<daw-track>`, `<daw-clip>`) use light DOM. They declare the editor's own arrangement: the editor reads them when a track enters, never writes their attributes and never moves them (a DOM move of a `<daw-track>` is a reorder request: it is placed after the track of the `<daw-track>` before it, one undo step; an Undo of a reorder moves no element). Their properties read the arrangement. They don't render anything visible.

**Visual elements** (`<daw-waveform>`, `<daw-piano-roll>`, `<daw-playhead>`, `<daw-ruler>`, `<daw-selection>`, `<daw-track-controls>`) use Shadow DOM and are created internally by the editor. Consumers don't create these directly. The editor mounts `<daw-waveform>` or `<daw-piano-roll>` per clip based on the parent `<daw-track>`'s `render-mode` attribute.

**The `hidden` attribute** hides `<daw-editor>`, `<daw-track-controls>`, `<daw-player>` and `<daw-annotation-list>`: each sets `display` on `:host`, which would override the browser's `[hidden] { display: none }`, so each also has `:host([hidden]) { display: none; }` (#848).

**Transport elements** are light DOM. The `<daw-transport>` container resolves the target editor via `document.getElementById(this.getAttribute('for'))`. Button elements walk up to the closest `<daw-transport>` to find their target.

## Engine Lifecycle

1. Import `@dawcore/components` registers all custom elements. A `<daw-editor>` owns an arrangement (`createArrangement()` from `@waveform-playlist/engine`) from the moment it is created.
2. Setting `editor.adapter` on a connected editor (or connecting an editor that has one) builds the `PlaylistEngine` on that arrangement. Without an adapter, tracks wait.
3. `<daw-track>` connects to the DOM → dispatches `daw-track-connected` → enters the arrangement at its DOM position, each audio `<daw-clip>` as a loading clip. The arrangement fetches and decodes; `daw-clip-ready` / `daw-track-ready` (or `daw-clip-error` / `daw-track-error`) follow.
4. A clip still loading is drawn dimmed where its length is known (a `duration`, or its `peaks-src` `.dat`); a clip whose audio failed stays, drawn failed where its length is known, until `retryTrack(trackId)` loads it or the app removes the track.
5. Waveforms render from peaks as each clip loads (no play required)
6. First play click resumes `AudioContext` (user gesture requirement)

## Undo and Escape During a Drag

**Undo and redo do nothing while a drag is in progress (#848).** From the moment a clip move or trim has moved past the 3 px drag threshold, or a track-reorder grip is grabbed, until the pointer is released or the drag is cancelled, `editor.undo()` and `editor.redo()` return without doing anything, and so do the `<daw-keyboard-shortcuts undo>` keys. The drag does not change `editor.canUndo` / `canRedo`: an Undo button stays enabled, and pressing it does nothing. A clip that is pressed but not yet moved is not a drag: undo works, and a drag that follows starts from the clip as the undo left it and is one undo step. An annotation edge drag does not block undo either: annotations are not in the undo history. `editor.engine.undo()` is not blocked.

**Escape cancels a drag and does nothing else.** During a clip move, a clip trim, a track-reorder drag or an annotation edge drag, Escape puts everything back as it was when the drag began, as a `pointercancel` does, and the rest of the pointer's travel is ignored. The editor listens on `window` in the capture phase and calls `preventDefault()` on that Escape, so `<daw-keyboard-shortcuts playback>` does not also stop playback and `<daw-annotation-track keyboard-controls>` does not deselect. With no drag left, Escape works as it does without one: a selected annotation is deselected first, then Escape stops. A clip or annotation pressed but not yet moved is not a drag, so Escape goes to the shortcuts then. An Escape your own code calls `preventDefault()` on before the library's listeners run switches off Stop (`<daw-keyboard-shortcuts>`, a `document` listener) and the annotation deselect (`<daw-annotation-track keyboard-controls>`, a `document` capture listener) the same way. Disconnecting the editor in the middle of a drag, or of a press, cancels it.

**A change made elsewhere cancels a drag when it changes what is dragged.** A drag writes nothing to the arrangement until its release (a move is one `moveClip`, a trim one `trimClip`, a reorder one `reorderTrack`). When the app or an agent changes the arrangement during the drag (`arrangement.undo()`, `reorderTrack`, `removeTrack`), the change goes through, and the drag is cancelled, as a `pointercancel` would, when the dragged clip is gone or no longer where it was when the drag began, or the dragged track is gone, a track came or went, or the track order changed (so a track that enters during a track drag cancels it). A mix change, another clip loading or an edit of another clip let the drag go on.

## The Arrangement

`editor.arrangement` is the one object an app or an AI agent needs to drive the editor: the tracks, the clips, the mix, undo and loading (see the engine guide, "The Arrangement"). Reading it returns the arrangement the editor plays. By default that is the editor's own: the `<daw-track>` children declare its content, and the editor's methods (`addTrack`, `updateTrack`, `reorderTrack`, `addClip`, `updateClip`, `removeTrack`, `removeClip`) change it as calls on the arrangement.

**Handing one in** (`editor.arrangement = createArrangement({ tracks })`) plays it alone, as `video.srcObject` replaces `<source>` children: the children are not added to it, they are detached while it is set, and a `<daw-track>` the page adds meanwhile waits for the own arrangement. The editor's methods change the arrangement handed in. `editor.arrangement = null` goes back to the own arrangement with what it held, its history included. The editor never disposes or clears an arrangement it was handed. A value that is not an arrangement throws a `TypeError`.

**A swap keeps the adapter.** Setting it once an engine exists cancels a drag in progress, stops playback when it is playing (one `daw-stop`), lets the engine go without disposing the adapter (`engine.dispose({ keepAdapter: true })`, which empties it), disposes the effects chains of the tracks the new arrangement does not hold, and builds a new engine on the new arrangement with the same adapter. The playhead goes back to 0, and `daw-track-ready` fires for each track of the arrangement swapped in (a new load cycle). During a take the swap is refused with a warning: set it after `stopRecording()` resolves. Set before an adapter, the arrangement is played once the adapter arrives.

## Undo and the Mix

Mixer moves are undo steps, like clip and track edits: a control gesture, a `<daw-track>` attribute update and an `editor.updateTrack()` call are one step each, and Undo brings back the volume, pan, mute and solo of the state it returns to. `editor.tracks` and `<daw-track-controls>` report the arrangement's mix.

**A take mutes the track it records onto.** During a take the recorded track plays muted (`engine.setTrackRecording`): its controls and `editor.tracks` show it muted, and `exportAudio()` during the take leaves it out. The take's mute is not an undo step and does not change the track's own mute: a mute set during the take (through the element, `updateTrack` or the engine) stays after it, and the take's end only clears the take's mute.

**Loading does not clear the history (#848).** A track is in the arrangement while its audio loads, so a step made meanwhile, a mixer move included, stays undoable. A `<daw-track>` element of the page that enters while the history is empty is not an undo step (Undo right after load removes nothing); one the page adds once the history has steps, a track from `editor.addTrack()` or `loadMidi()` (no element), and a file drop are one undo step each. A page that adds its starting content with `addTrack()` calls `editor.engine.clearHistory()` after it if Undo right after load should remove nothing.

## File Drop

When `file-drop` is enabled, drag audio files onto the editor:

- Each file creates a new track with no `<daw-track>` element (its clip's source is the `File`); a file that cannot be loaded is removed again, with no undo step
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
