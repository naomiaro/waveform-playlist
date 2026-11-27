# Web Components Migration Spec

Migrate to native Web Components under the **dawcore** brand, making the library truly framework-agnostic — works with vanilla JS, React 19+, Vue, Svelte, Angular, or any framework that supports Custom Elements.

**Status:** Living spec — core shipped in `@dawcore/components`; remaining work tracked in epics [#452](https://github.com/naomiaro/waveform-playlist/issues/452)–[#458](https://github.com/naomiaro/waveform-playlist/issues/458). Last audited against code 2026-06-11.
**Target:** dawcore 1.0.0
**npm:** `@dawcore/*`
**GitHub:** [github.com/dawcore](https://github.com/dawcore) (repo transfer deferred — see Open Questions)

---

## Motivation

- **Framework-agnostic** — usable in vanilla JS, Lit, Svelte, Vue, Angular, or React without adapters
- **Smaller bundle** — no React/ReactDOM/styled-components runtime dependency
- **Web standard** — Custom Elements, Shadow DOM, and CSS Parts are supported in all modern browsers
- **Ecosystem alignment** — WAM plugins, Storybook, and @dnd-kit/dom all support Web Components natively
- **Simpler API** — HTML elements with attributes, properties, methods, and events

---

## Package Landscape

The original plan renamed every `@waveform-playlist/*` package into the `@dawcore/*` scope and replaced the React packages outright. **Decision (shipped): the two ecosystems coexist instead.**

- **`@waveform-playlist/*`** remains the React surface (`browser`, `ui-components`, `recording`, `annotations`, `spectrogram`) plus the shared framework-agnostic foundations (`core`, `engine`, `playout`, `worklets`, `webaudio-peaks`, `loaders`, `media-element-playout`). No renames.
- **`@dawcore/*`** is the Web Components ecosystem, versioned independently at 0.x:

| Package                | Directory                      | Description                                                                        |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `@dawcore/components`  | `packages/dawcore`             | Web Components UI layer — Lit Custom Elements with Shadow DOM                      |
| `@dawcore/transport`   | `packages/transport`           | Native Web Audio transport/scheduler (no Tone.js); provides `NativePlayoutAdapter` |
| `@dawcore/spectrogram` | `packages/dawcore-spectrogram` | Framework-agnostic spectrogram compute (worker pool)                               |
| `@dawcore/midi`        | `packages/dawcore-midi`        | Framework-agnostic MIDI parsing and `loadMidiTracks` (optional peer of components) |
| `@dawcore/wam`         | `packages/dawcore-wam`         | WAM 2.0 plugin hosting (optional peer)                                             |
| `@dawcore/faust`       | `packages/dawcore-faust`       | In-browser Faust DSP → WAM compilation (optional peer)                             |

`@dawcore/components` consumes the shared foundations as peers (`@waveform-playlist/core`, `@waveform-playlist/engine`, `@waveform-playlist/worklets`) — the engine and type layer serve both surfaces. When a React package has framework-agnostic logic worth sharing, it follows the two-flavor split convention: `@dawcore/X` core + `@waveform-playlist/X` React wrapper (precedent: spectrogram). A wrapper with no React code left is removed: `@waveform-playlist/midi` went in #807, and React apps import `loadMidiTracks` from `@dawcore/midi`.

React packages without a Web Components equivalent yet: the recording arming surface (epic #453).

---

## Custom Elements

> **Implementation status:** the core editor elements are shipped. `<daw-player>` core (#473) is implemented. Annotation elements (epic #455) are implemented. Elements listed in this spec that don't exist yet are tracked in epics: transport/control elements (#452), record arming + VU meter (#453), `<daw-player>` follow-ups — effects (#475), `<daw-playback-rate>` (#476), transport-compat tests (#474), annotation hosting in `<daw-player>` (#477) — individual track-control elements (#457).

### Core Elements

```html
<!-- Minimal setup -->
<daw-editor id="my-editor" samples-per-pixel="1024" wave-height="128" timescale>
  <daw-keyboard-shortcuts playback splitting></daw-keyboard-shortcuts>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar"></daw-track>
</daw-editor>

<!-- With transport (recording-aware by default) -->
<daw-transport for="my-editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-record-button></daw-record-button>
  <daw-rewind-button></daw-rewind-button>
  <daw-fast-forward-button></daw-fast-forward-button>
  <daw-loop-button></daw-loop-button>
  <daw-time-display></daw-time-display>
  <daw-selection-start></daw-selection-start>
  <daw-selection-end></daw-selection-end>
  <daw-time-format></daw-time-format>
  <daw-tempo></daw-tempo>
  <daw-time-signature></daw-time-signature>
  <daw-snap-to></daw-snap-to>
  <daw-scale-mode></daw-scale-mode>
  <daw-zoom-in></daw-zoom-in>
  <daw-zoom-out></daw-zoom-out>
</daw-transport>
```

### Element Registry

| Element                     | Wraps                                      | Responsibilities                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<daw-editor>`              | PlaylistEngine + external `PlayoutAdapter` | Root element. Manages engine, tracks, state. Requires a consumer-provided adapter (`editor.adapter`) — it creates no AudioContext or adapter of its own (#378).                                                                                                             |
| `<daw-track>`               | Track state                                | Declares a track. Contains `<daw-clip>` children. Attributes: `name`, `volume`, `pan`, `pan-law`, `muted`, `soloed`, `record-armed`, `input-device` (not implemented, #469), `kind`, `render-mode`. `src` is shorthand for a track with a single implicit clip.                                |
| `<daw-clip>`                | AudioClip                                  | Audio or MIDI clip within a track. Attributes: `src`, `peaks-src`, `start`, `duration`, `offset`, `gain`, `name`, `color`, `fade-in`, `fade-out`, `fade-type`. Multiple clips sharing the same `src` share one decoded AudioBuffer.                                         |
| `<daw-waveform>`            | Canvas rendering                           | Waveform visualization. Renders peaks to canvas.                                                                                                                                                                                                                            |
| `<daw-transport>`           | Transport controls container               | Groups transport buttons, links to an editor via `for` attribute.                                                                                                                                                                                                           |
| `<daw-track-controls>`      | Track mixer strip                          | Shipped composite: name, volume, pan, mute, solo for one track, rendered by the editor in the frozen controls column. Draws the arrangement's mix (follows Undo/Redo). Dispatches a unified `daw-track-control` event (`{trackId, prop, value, gesture?}`; one slider drag is one undo step, #843). Individual control elements below complement it (#457).                    |
| `<daw-play-button>`         | play()                                     | Triggers playback. If recording is armed, starts overdub recording simultaneously (arming not implemented, #470).                                                                                                                                                           |
| `<daw-pause-button>`        | pause() / togglePauseRecording()           | Pauses playback. During recording, toggles pause/resume of the worklet capture (Audacity-style). Reflects state via `data-paused` attribute; sync handled by `daw-recording-pause` / `daw-recording-resume` events so the spacebar shortcut and the button stay consistent. |
| `<daw-stop-button>`         | stop()                                     | Stops playback and recording. Finalizes any in-progress recording into a new clip.                                                                                                                                                                                          |
| `<daw-record-button>`       | record()                                   | `record()` and arming not implemented (#470): today it calls `startRecording()`. Arms/starts recording on all armed tracks. When clicked during stop, arms the selected track (or first track). When clicked during play, starts overdub on armed tracks.                   |
| `<daw-rewind-button>`       | seekTo(0)                                  | **Not implemented (#460).** Rewinds playhead to the start of the timeline.                                                                                                                                                                                                  |
| `<daw-fast-forward-button>` | seekTo(duration)                           | **Not implemented (#460).** Jumps playhead to the end of the timeline.                                                                                                                                                                                                      |
| `<daw-loop-button>`         | toggleLoop()                               | **Not implemented (#461).** Toggles loop playback for the current selection. Reflects `aria-pressed` state.                                                                                                                                                                 |
| `<daw-time-display>`        | currentTime                                | Shows formatted playback time.                                                                                                                                                                                                                                              |
| `<daw-selection-start>`     | setSelection()                             | **Not implemented (#463).** Editable input showing selection start time. Updates selection on change.                                                                                                                                                                       |
| `<daw-selection-end>`       | setSelection()                             | **Not implemented (#463).** Editable input showing selection end time. Updates selection on change.                                                                                                                                                                         |
| `<daw-time-format>`         | setTimeFormat()                            | Select for time display format (`hh:mm:ss.sss`, `hh:mm:ss`, `seconds`). Affects time display and selection inputs.                                                                                                                                                          |
| `<daw-tempo>`               | editor.bpm property                        | **Not implemented (#464).** Editable BPM input. Reflects current tempo. Drives grid/ruler musical time and snap. Display-only when consumer tick callbacks make the external tempo map authoritative (#407).                                                                |
| `<daw-time-signature>`      | editor.timeSignature property              | **Not implemented (#464).** Editable time signature (e.g., `4/4`, `3/4`, `6/8`). Drives ruler subdivisions and snap grid.                                                                                                                                                   |
| `<daw-snap-to>`             | setSnapTo()                                | **Not implemented (#465).** Select for snap granularity. Controls clip drag/trim snapping and `<daw-grid>` line density. See [Snap Subdivisions](#snap-subdivisions).                                                                                                       |
| `<daw-scale-mode>`          | setScaleMode()                             | **Not implemented (#465).** Select for ruler display mode (`beats`, `temporal`). Switches between bar:beat and minutes:seconds ruler.                                                                                                                                       |
| `<daw-zoom-in>`             | zoomIn()                                   | **Not implemented (#462).** Zoom in button. Disabled when at maximum zoom.                                                                                                                                                                                                  |
| `<daw-zoom-out>`            | zoomOut()                                  | **Not implemented (#462).** Zoom out button. Disabled when at minimum zoom.                                                                                                                                                                                                 |
| `<daw-undo-button>`         | undo()                                     | **Not implemented (#466).** Undo last structural edit. Auto-disables when `canUndo` is false.                                                                                                                                                                               |
| `<daw-redo-button>`         | redo()                                     | **Not implemented (#466).** Redo last undone edit. Auto-disables when `canRedo` is false.                                                                                                                                                                                   |
| `<daw-playback-rate>`       | setPlaybackRate()                          | **Not implemented (#476).** Playback speed control. Works with both `<daw-editor>` and `<daw-player>`.                                                                                                                                                                      |
| `<daw-player>`              | HTMLMediaElement                           | Lightweight single-track player. Uses `<audio>` element internally — no Tone.js, no engine. Supports waveform, transport, annotations, and optional effects (not implemented: transport #474, annotations #477, effects #475).                                              |
| `<daw-mute-button>`         | mute toggle                                | **Not implemented (#485).** Dispatches `daw-mute` event. Auto-wires to parent `<daw-track>` via `closest()`. Reflects `aria-pressed` state.                                                                                                                                 |
| `<daw-solo-button>`         | solo toggle                                | **Not implemented (#485).** Dispatches `daw-solo` event. Auto-wires to parent `<daw-track>`. Reflects `aria-pressed` state.                                                                                                                                                 |
| `<daw-volume-slider>`       | setTrackVolume() / setMasterVolume()       | **Not implemented (per track #485, master #467).** Volume control. When inside a `<daw-track>`, controls that track. When inside `<daw-transport>`, controls master volume.                                                                                                 |
| `<daw-pan-slider>`          | setTrackPan()                              | **Not implemented (#485).** Per-track pan control.                                                                                                                                                                                                                          |
| `<daw-vu-meter>`            | Meter worklet                              | **Not implemented (#472).** Level metering (replaces SegmentedVUMeter).                                                                                                                                                                                                     |
| `<daw-ruler>`               | Time ruler                                 | Renders time ruler above tracks. In beats & bars mode, uses adaptive label density — skips labels at coarse zoom, shows every bar/beat at fine zoom. Shares tick computation with `<daw-grid>`.                                                                             |
| `<daw-grid>`                | Beat/bar grid                              | Canvas-based background grid behind waveforms. Visible only in beats & bars scale mode. Chunked rendering with virtual scrolling (same pattern as `<daw-waveform>`). See [Beat & Bar Grid](#beat--bar-grid).                                                                |
| `<daw-playhead>`            | Playhead                                   | Animated playhead line.                                                                                                                                                                                                                                                     |
| `<daw-keyboard-shortcuts>`  | Keyboard handler                           | Render-less element inside `<daw-editor>`. Boolean attributes: `playback`, `splitting`, `undo`. Properties: `customShortcuts`, `playbackShortcuts`, `splittingShortcuts`, `undoShortcuts` (key remapping), `shortcuts` (read-only, all active). Undo/redo do nothing during a clip or track drag; Escape during a drag only cancels the drag (#848). |

### Beat & Bar Grid

`<daw-grid>` renders a striped background behind the track area, visible only in beats & bars scale mode. It helps users visually align clips to the beat/bar structure and makes snap-to-grid intuitive.

**Layer order:** `--daw-background` (editor base) → grid stripes → clips (opaque background) → waveforms → playhead. Track rows are transparent layout containers — no `--daw-track-background` fill — so grid stripes show through. Clips render with their own opaque background.

**Zoom-dependent display:**

| Zoom Level                         | Lines                                       | Striping            |
| ---------------------------------- | ------------------------------------------- | ------------------- |
| Coarse (bars too dense for labels) | Every Nth bar (matches ruler label density) | None — lines only   |
| Medium (bars visible, beats dense) | Every bar                                   | Bar-level odd/even  |
| Fine (beats visible)               | Every beat                                  | Beat-level odd/even |

Grid line spacing matches the ruler's label spacing — they share the same tick computation logic. The ruler's beats & bars mode uses adaptive label density (skip labels when they'd overlap, show every Nth bar at coarse zoom). The grid follows the same thresholds.

**CSS custom properties (shipped names — see `daw-grid.ts`):**

```css
--daw-grid-bar-highlight: rgba(255, 255, 255, 0.02); /* alternating bar fill */
--daw-grid-major-line: rgba(255, 255, 255, 0.1); /* bar lines */
--daw-grid-minor-line: rgba(255, 255, 255, 0.06); /* beat/subdivision lines */
```

Highlight stripes alternate at whatever the current granularity is (bars at medium zoom, beats at fine zoom). At coarse zoom, no stripes — just lines.

**Data source:** Reads tempo (BPM) and meter (numerator/denominator) from the editor's transport. Redraws on `tempochange`, `meterchange`, zoom, and scroll.

**Usage:**

```html
<daw-editor id="editor" samples-per-pixel="512" timescale>
  <daw-grid></daw-grid>
  <daw-keyboard-shortcuts playback splitting></daw-keyboard-shortcuts>
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
  <daw-track src="/audio/bass.opus" name="Bass"></daw-track>
</daw-editor>
```

### Snap Subdivisions

Expand `SnapTo` from `'bar' | 'beat' | 'off'` to support note subdivisions and triplets:

```typescript
type SnapTo =
  | 'bar' // ticksPerBar
  | 'beat' // ticksPerBeat (quarter in 4/4, eighth in 6/8)
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32' // straight subdivisions
  | '1/2T'
  | '1/4T'
  | '1/8T'
  | '1/16T' // triplets (2/3 of straight value)
  | 'off';
```

**Grid tick calculation** (shared by `SnapToGridModifier`, `<daw-grid>`, and `<daw-ruler>`):

| SnapTo  | Grid ticks (at 960 PPQN, 4/4) | Musical value                      |
| ------- | ----------------------------- | ---------------------------------- |
| `bar`   | 3840                          | 1 bar                              |
| `beat`  | 960                           | quarter note                       |
| `1/2`   | 1920                          | half note                          |
| `1/4`   | 960                           | quarter note (same as beat in 4/4) |
| `1/8`   | 480                           | eighth note                        |
| `1/16`  | 240                           | sixteenth note                     |
| `1/32`  | 120                           | thirty-second note                 |
| `1/4T`  | 640                           | quarter triplet (960 \* 2/3)       |
| `1/8T`  | 320                           | eighth triplet (480 \* 2/3)        |
| `1/16T` | 160                           | sixteenth triplet (240 \* 2/3)     |

The `T` suffix denotes triplet — the note value is multiplied by 2/3. For compound meters (6/8), `beat` is an eighth note (480 ticks), so `1/8T` would be 320 ticks (eighth triplet).

**`<daw-snap-to>` element** renders a select/dropdown with these options. The current value drives both clip snapping (via `SnapToGridModifier`) and grid line density (via `<daw-grid>`).

**Utility function** (shipped in `@waveform-playlist/core` — `src/utils/musicalTicks.ts`):

```typescript
function snapToTicks(snapTo: SnapTo, timeSignature: [number, number], ppqn = 960): number;
```

Single source of truth for converting `SnapTo` → tick count. Used by `SnapToGridModifier`, `<daw-grid>`, and `<daw-ruler>`. Positions snap via `snapTickToGrid`, whose grid restarts at each bar line (#643): in 7/8 a quarter-note grid is 0, 960, 1920, 2880, then the bar line at 3360 — the same lines `computeMusicalTicks` draws and `@dawcore/transport`'s `quantizeTick` snaps to.

### Multi-Track Record Arming

> Tracked in epic #453. The recording backend (worklet pipeline, per-track sessions, pause/resume, latency compensation) is shipped; the arming API below is not yet.

```html
<!-- Arm individual tracks for recording -->
<daw-editor id="my-editor">
  <daw-track src="/audio/drums.mp3" name="Drums"></daw-track>
  <daw-track name="Vocal Take" record-armed></daw-track>
  <daw-track name="Guitar Take" record-armed input-device="abc123"></daw-track>
</daw-editor>

<daw-transport for="my-editor">
  <daw-record-button></daw-record-button>
  <daw-play-button></daw-play-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

**Behavior:**

- Tracks with `record-armed` attribute will record simultaneously when recording starts
- Each armed track can have its own `input-device` for different mic inputs
- Clicking `<daw-record-button>` during stop arms the selected track if none are armed, then starts record + play
- Clicking `<daw-record-button>` during play starts overdub recording on all armed tracks
- `<daw-stop-button>` stops playback and finalizes all in-progress recordings into new clips
- Tracks without `record-armed` play back normally during overdub
- `<daw-vu-meter>` on an armed track shows input level from the mic stream before and during recording

```javascript
// Programmatic multi-track arming
const editor = document.getElementById('my-editor');
const tracks = editor.querySelectorAll('daw-track');

// Arm specific tracks
tracks[1].arm(); // Default mic
tracks[2].arm('specific-device-id'); // Specific mic

// Check armed state
console.log(editor.armedTrackIds); // ['track-2', 'track-3']
console.log(editor.isRecordArmed); // true

// Listen for recording events
editor.addEventListener('daw-recording-start', (e) => {
  console.log('Recording started on track:', e.detail.trackId);
});

editor.addEventListener('daw-recording-complete', (e) => {
  console.log('Recorded buffer:', e.detail.audioBuffer);
  // Cancelable — preventDefault() to skip automatic clip creation
});

// The take has no <daw-clip> element — this is where its clip id arrives
editor.addEventListener('daw-recording-clip-add', (e) => {
  editor.updateClip(e.detail.trackId, e.detail.clipId, { gain: 2 });
});

// Pause/resume during recording (Audacity-style: also pauses Transport when overdubbing)
editor.addEventListener('daw-recording-pause', (e) => {
  console.log('Paused track:', e.detail.trackId);
});

// Disarm all
editor.armedTrackIds.forEach((id) => {
  editor.querySelector(`daw-track[id="${id}"]`).disarm();
});
```

### Optional Elements

> Annotation elements shipped under epic #455. `parseAeneas`/`serializeAeneas` remain React-only in `@waveform-playlist/annotations` — the dawcore elements consume `<daw-annotation>` light-DOM children directly, not those parsers. Hosting `<daw-annotation-track>`/`<daw-annotation>` children inside `<daw-player>` is still open (#477); today they're documented under `<daw-editor>`.

| Element                  | Package    | Responsibilities                                                                                                                                                                                                     |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<daw-annotation-track>` | components | Timeline row containing draggable annotation boxes. Children are `<daw-annotation>` elements. Attributes: `editable`, `link-endpoints`, `continuous-play`, `keyboard-controls`, `box-label`, `name`.                 |
| `<daw-annotation>`       | components | Single annotation with `start`, `end` (seconds) attributes, optional `start-tick`, `end-tick` (musical position) attributes, and text content. Renders as a box in the track.                                        |
| `<daw-annotation-list>`  | components | Scrollable text panel. Links to a `<daw-annotation-track>` via `for` attribute — no duplicate data. `time-display` (`'time'` default \| `'bars'`) switches the times column between clock times and bar.beat ranges. |

```html
<!-- Annotations: single source of truth, dual view -->
<daw-editor id="my-editor">
  <daw-annotation-track id="lyrics" editable link-endpoints>
    <daw-annotation start="0.0" end="2.5">First line of lyrics</daw-annotation>
    <daw-annotation start="2.5" end="5.1">Second line of lyrics</daw-annotation>
    <daw-annotation start="5.1" end="8.0">Third line of lyrics</daw-annotation>
  </daw-annotation-track>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
</daw-editor>

<!-- Text list view linked to the same data via for/id -->
<daw-annotation-list for="lyrics"></daw-annotation-list>
```

Annotations are defined once as `<daw-annotation>` children. The `<daw-annotation-list>` reads from the same elements — edits in either view (dragging a box or editing text) update the shared `<daw-annotation>` attributes.

**Tick authority rule:** an annotation is tick-based iff BOTH `start-tick` and `end-tick` are set — `start`/`end` seconds then become a derived cache the host editor keeps fresh (same pattern as clip `startTick`). Setting only one of the two tick attributes is a half-configured state: it's treated as seconds-based and logs a one-time warning per annotation. Tick edits (boundary drag, `moveStartBoundary`/`moveEndBoundary`) require a host `<daw-editor>` for tempo conversion — calling them on a tick-based annotation with no parent editor warns and is ignored.

**`<daw-annotation-list time-display="bars">`:** shows each row's times span as `B.b – B.b` bar.beat ranges instead of clock times. Resolves the host editor via `this.track.closest('daw-editor')`; tick-based annotations use `startTick`/`endTick` directly, seconds-based annotations convert via `editor._secondsToTicks()`. Both edges are converted with `ticksToBarBeat(tick, editor._meterEntries, editor.ppqn)` from `@waveform-playlist/core` (1-based bar/beat, multi-meter aware). No host editor → falls back to time display and warns once.

Spectrogram is a render mode on `<daw-track>` (the `render-mode` attribute) and a piano roll is how a MIDI track (`kind="midi"`) is drawn; neither is a standalone element. See the [Spectrogram & Piano-Roll](#spectrogram--piano-roll) section.

---

## Properties, Attributes & Events

### `<daw-editor>` API

**Adapter (required):** `<daw-editor>` does not create an AudioContext or a default adapter. Set `editor.adapter` to a `PlayoutAdapter` before use — `NativePlayoutAdapter` (from `@dawcore/transport`) or `TonePlayoutAdapter` (Tone.js backend). The adapter owns the `AudioContext` and exposes a required `ppqn`; the engine aligns its tick resolution to `adapter.ppqn` on construction (#378).

**Attributes (reflected):**

```
samples-per-pixel    Number    1024     Zoom level
wave-height          Number    128      Track height in px
timescale            Boolean   false    Show time ruler
mono                 Boolean   false    Mono waveform rendering
automatic-scroll     Boolean   false    Follow playhead — not implemented (#468)
indefinite-playback  Boolean   false    Disable end-of-timeline auto-stop (DAW-style roll until explicit stop). Implies fill-viewport
fill-viewport        Boolean   false    Fill viewport when shorter than visible width (layout only) — lets the ruler render before any audio is loaded
bar-width            Number    1        Waveform bar width
bar-gap              Number    0        Waveform bar gap
rounded-bars         Boolean   false    Pill-shaped bar caps (radius bar-width/2)
gain-scaled-waveforms Boolean  false    Draw each clip's waveform scaled by its gain (clamped to channel height; draw-time only, no peak regeneration)
clip-headers         Boolean   false    Show clip name headers
file-drop            Boolean   false    Accept dropped audio/MIDI files
```

**Properties (JS only):**

```typescript
editor.adapter: PlayoutAdapter       // Required — consumer-provided audio backend (#378)
editor.tracks: TrackWithId[]         // {trackId, name, …} for every track incl. element-less (dropped/programmatic); the trackId keys the per-track APIs (addTrackEffect, removeTrack, updateTrack, …)
editor.isPlaying: boolean            // Playback state
editor.isRecording: boolean          // Recording state (any track recording)
editor.armedTrackIds: string[]       // Track IDs with record-armed attribute — not implemented (#470)
editor.isRecordArmed: boolean        // Derived: armedTrackIds.length > 0 — not implemented (#470)
editor.currentTime: number           // Current playback time
editor.duration: number              // Total duration
editor.selection: {start, end}       // Selection range
editor.selectedTrackId: string|null  // Selected track
editor.effects: EffectState[]        // Read-only. Master effects chain (see Effects section for shape)
editor.spectrogramConfig: SpectrogramConfig | null  // Global spectrogram defaults (null = built-in defaults)
editor.canUndo: boolean              // Has undo history
editor.canRedo: boolean              // Has redo history
editor.undoLimit: number             // Max undo steps (default 100) — not implemented (#466)
editor.engine: PlaylistEngine        // Direct engine access
```

**Methods:**

```typescript
editor.play(startTime?, endTime?): Promise<void>    // Starts overdub if record is armed (arming not implemented, #470). endTime disables
                                                     // looping and stops playback at that time (selection/
                                                     // annotation playback — used by annotationTrack.playActive())
editor.pause(): void                               // Pauses playback Transport (does NOT pause active recording — use togglePauseRecording for that)
editor.stop(): void                                // Stops playback
editor.record(): Promise<void>                     // Starts recording on all armed tracks — not implemented (#470)
editor.startRecording(stream): Promise<void>       // Start recording on selected track with provided MediaStream
editor.stopRecording(): Promise<void>              // Stop and finalize recording (awaits worklet's done ack)
editor.pauseRecording(): void                      // Pause worklet capture only (no Transport effect)
editor.resumeRecording(): void                     // Resume worklet capture
editor.togglePauseRecording(): void                // Audacity-style: pauses worklet AND Transport (if running); on resume restarts Transport only when it was running before
editor.isRecording: boolean                        // (getter) any track currently recording
editor.isRecordingPaused: boolean                  // (getter) capture is paused
editor.armTrack(trackId: string, deviceId?: string): Promise<void>  // Arm a track — not implemented (#470)
editor.disarmTrack(trackId: string): void           // Disarm a track — not implemented (#470)
editor.seekTo(time: number): void
editor.setSelection(start: number, end: number): void
// Track mixing changes go through updateTrack() — there are no per-property
// setTrackVolume/Pan/Mute/Solo methods:
//   editor.updateTrack(trackId, { volume: 0.8, muted: true })
editor.zoomIn(): void                              // not implemented (#462)
editor.zoomOut(): void                             // not implemented (#462)
editor.setMasterVolume(volume: number): void       // not implemented (#467)
// Programmatic track/clip mutation (see "Programmatic Track Mutation" section)
editor.ready(): Promise<PlaylistEngine>                                  // Ensure engine is built; resolves with it
editor.addTrack(config: TrackConfig, options?: EditorCallOptions): Promise<string> // Add a track to the arrangement played at the call (no element, #848; a swap before it enters rejects); resolves with its id once it has entered (before its audio loads)
editor.retryTrack(trackId: string): void                                 // Load the track's failed sources again
editor.removeTrack(trackId: string): void                                // Remove track by ID
editor.updateTrack(trackId: string, partial: Partial<TrackConfig>): void
editor.addClip(trackId: string, config: ClipConfig, options?: EditorCallOptions): Promise<string> // Returns clipId; options.signal cancels
editor.removeClip(trackId: string, clipId: string): void
editor.updateClip(trackId: string, clipId: string, partial: Partial<ClipConfig>): void
editor.setTimeFormat(format: string): void             // 'hh:mm:ss.sss' | 'hh:mm:ss' | 'seconds'
editor.setAutomaticScroll(enabled: boolean): void      // Toggle auto-scroll — not implemented (#468)
editor.bpm = 140                                       // Display/grid tempo. Forwards to the adapter's
                                                       // transport ONLY when no tick callbacks are set;
                                                       // with consumer tick callbacks the external tempo
                                                       // map is authoritative and bpm is display-only (#407)
editor.timeSignature = [3, 4]                          // Property setter ([numerator, denominator])
editor.snapTo = 'beat'                                 // Property setter (full SnapTo union — see Snap Subdivisions)
editor.scaleMode = 'beats'                             // Property setter ('beats' | 'temporal')
editor.setLoopEnabled(enabled: boolean): void          // Toggle loop playback — not implemented (#461)
editor.setLoopRegion(start: number, end: number): void // Set loop boundaries — not implemented (#461)
// Effects (master chain)
editor.addEffect(type: string, params?: Record<string, number>): string  // Returns effectId
editor.removeEffect(effectId: string): void
editor.setEffectParams(effectId: string, params: Record<string, number>): void
editor.setEffectBypassed(effectId: string, bypassed: boolean): void
editor.moveEffect(effectId: string, newIndex: number): void
editor.openEffectGui(effectId: string, container: HTMLElement): Promise<HTMLElement> // Mount a master-chain effect's GUI into a consumer-provided container
editor.closeEffectGui(effectId: string): void                                        // Detach the GUI (cached for reopen)
// Offline rendering
editor.exportAudio(options?: ExportOptions): Promise<AudioBuffer>
// MIDI loading
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>
// Undo/redo
editor.undo(): void
editor.redo(): void
editor.clearHistory(): void                        // not implemented (#466)
// File loading (audio + MIDI auto-detection)
editor.loadFiles(files: File[] | FileList, options?: EditorCallOptions): Promise<LoadFilesResult>
```

**Events:**

```typescript
'daw-ready'; // All tracks loaded — not implemented on <daw-editor> yet (#468; <daw-player> fires it); each track fires daw-track-ready
'daw-play'; // Playback started
'daw-pause'; // Playback paused
'daw-stop'; // Playback stopped
'daw-recording-start'; // Recording started on a track: detail: {trackId, stream}
'daw-recording-complete'; // Recording finalized: detail: {trackId, audioBuffer, startSample, durationSamples, offsetSamples} — cancelable; preventDefault() skips automatic clip creation
'daw-recording-clip-add'; // The take's clip now exists (skipped when daw-recording-complete was cancelled, when the take's peak generation failed, or when the track was removed meanwhile): detail: {trackId, clipId} — clipId is the engine clip id for updateClip()/removeClip()
'daw-recording-error'; // Recording failed: detail: {trackId, error}
'daw-recording-pause'; // Worklet capture paused: detail: {trackId}
'daw-recording-resume'; // Worklet capture resumed: detail: {trackId}
'daw-record-arm'; // Track armed/disarmed: detail: {trackId, armed, armedTrackIds} — not implemented (#469)
'daw-timeupdate'; // Playback time changed (RAF)
'daw-selection'; // Selection changed: detail: {start, end}
'daw-track-select'; // Track selected: detail: {trackId}
'daw-tracks-change'; // Tracks mutated: detail: {tracks} — not implemented (#468); today editor.arrangement.subscribe(listener) runs after every change (an edit, undo, redo)
'daw-zoom'; // Zoom changed: detail: {samplesPerPixel} — not implemented (#462)
// Effect events (bubble from <daw-track> for per-track, dispatched on <daw-editor> for master)
'daw-effect-add'; // Effect added: detail: {effectId, kind, type, params, index, url?, source?}
'daw-effect-remove'; // Effect removed: detail: {effectId}
'daw-effect-change'; // Params updated: detail: {effectId, params}
'daw-effect-bypass'; // Bypass toggled: detail: {effectId, bypassed}
'daw-effect-reorder'; // Effect moved: detail: {effectId, fromIndex, toIndex}
// Spectrogram
'daw-spectrogram-ready'; // Visible viewport FFT complete: detail: {trackId}
// Undo/redo
'daw-undo-state'; // canUndo/canRedo changed: detail: {canUndo, canRedo} — not implemented (#466); read editor.canUndo / editor.canRedo
// File loading
'daw-files-load-error'; // Decode/parse failed: detail: {file: File, error: string}
// Programmatic mutation
'daw-track-ready'; // Track finished loading: detail: {trackId}
'daw-track-removed'; // Track removed (DOM removal / removeTrack / controls): detail: {trackId} — fired after editor.tracks reflects the removal
'daw-track-error'; // Track failed to load: detail: {trackId, error}
'daw-clip-ready'; // Clip finished loading: detail: {trackId, clipId}
'daw-clip-error'; // Clip failed to load: detail: {trackId, clipId, error}
```

### `<daw-track>` API

**Attributes** (the page's declaration: never written by the editor, #848):

```
src              String    —        Audio source URL
name             String    —        Track display name
volume           Number    1        Track volume (0–1)
pan              Number    0        Stereo pan (-1 to 1)
pan-law          String    —        'mono' | 'stereo': the law the track enters with (default: its first decoded audio decides, #684)
muted            Boolean   false    Track is muted
soloed           Boolean   false    Track is soloed
record-armed     Boolean   false    Track is armed for recording — not implemented (#469)
input-device     String    —        MediaDeviceInfo.deviceId for mic input — not implemented (#469)
kind             String    audio    'audio' | 'midi'. What the track holds; every clip must be of this kind (#756)
render-mode      String    waveform 'waveform' | 'spectrogram' | 'split'. Audio tracks only; a MIDI track is a piano roll. 'split' not implemented (#491): it warns and draws the waveform
```

**Properties (JS only):**

```typescript
track.recordArmed: boolean       // Reflects record-armed attribute — not implemented (#469)
track.inputDevice: string|null   // Reflects input-device attribute — not implemented (#469)
track.kind: 'audio' | 'midi'     // Reflects kind attribute; a change after the track has entered is ignored with a warning
track.name / volume / pan / panLaw / muted / soloed  // Live (#848; panLaw is 'auto' until the track has audio, #684): the arrangement's values while it holds the track (muted: the stored mute); a set is one undo step and never writes the attribute; the declaration otherwise
track.index: number              // Read-only: position in the arrangement the editor plays, -1 when not in it
track.renderMode: string         // Reflects render-mode attribute
track.isRecording: boolean       // Read-only: currently recording (armed + editor.isRecording) — not implemented (#469)
track.inputStream: MediaStream   // Read-only: active mic stream when recording — not implemented (#469)
track.effects: EffectState[]     // Read-only. Per-track effects chain: [{id, type, params, bypassed}, ...]
track.spectrogramConfig: SpectrogramConfig | null  // Per-track override (null = inherit from editor)
```

**Methods:**

```typescript
track.arm(deviceId?: string): Promise<void>   // Arm for recording, request mic access — not implemented (#469)
track.disarm(): void                          // Disarm, release mic stream — not implemented (#469)
// Effects (per-track chain) — same API as editor master chain
track.addEffect(type: string, params?: Record<string, number>): string  // Returns effectId
track.removeEffect(effectId: string): void
track.setEffectParams(effectId: string, params: Record<string, number>): void
track.setEffectBypassed(effectId: string, bypassed: boolean): void
track.moveEffect(effectId: string, newIndex: number): void
track.openEffectGui(effectId: string, container: HTMLElement): Promise<HTMLElement>  // Mount a per-track effect's GUI into a consumer-provided container
track.closeEffectGui(effectId: string): void                                         // Detach the GUI (cached for reopen)
```

When `arm()` is called without a `deviceId`, it uses the default input device. The method requests mic permission via `getUserMedia()` and stores the stream for use when recording starts. Calling `arm()` on an already-armed track with a different `deviceId` switches the input device.

### `<daw-clip>` API

**Attributes** (the page's declaration: never written by the editor, #848):

```
src              String    —        Audio file URL
peaks-src        String    —        Pre-computed BBC audiowaveform peaks URL (.dat/.json)
start            Number    0        Position on timeline (seconds)
duration         Number    —        Clip duration (seconds). Defaults to source length.
offset           Number    0        Start offset within source audio (seconds) — trim start
gain             Number    1        Clip volume (0.0 to 1.0+)
name             String    —        Clip label
color            String    —        Clip color for visual distinction
fade-in          Number    0        Fade in duration (seconds)
fade-out         Number    0        Fade out duration (seconds)
fade-type        String    linear   Fade curve: 'linear' | 'logarithmic' | 'sCurve' | 'exponential'
midi-channel     Number    —        MIDI channel (0-indexed, 9 = percussion)
midi-program     Number    —        MIDI program number (0-127)
```

**Properties (JS only):**

```typescript
clip.midiNotes: MidiNoteData[] | null        // Parsed MIDI notes
clip.start / duration / offset / gain / name / midiNotes / midiChannel / midiProgram  // Live (#848): the arrangement's values while it holds the clip (after a drag, clip.start is where the clip is); a set is one undo step and never writes the attribute
```

Decoded audio is held by the editor's arrangement (#848), not exposed as properties on the element. There is no way to pass a decoded buffer or peak data through `<daw-clip>` or `addClip`; give pre-computed peaks by URL (`peaks-src`, or `peaksSrc` in `addClip`).

Attributes use seconds for human readability. The element converts to the internal sample-based model (`startSample`, `offsetSamples`, `durationSamples`) automatically.

```html
<!-- Single clip shorthand: <daw-track src="..."> expands to one implicit clip -->
<daw-track name="Vocals" src="/audio/vocals.mp3"></daw-track>

<!-- Equivalent explicit form -->
<daw-track name="Vocals">
  <daw-clip src="/audio/vocals.mp3"></daw-clip>
</daw-track>

<!-- Multi-clip with positioning, fades, and shared audio source -->
<daw-track name="Chorus Repeats">
  <daw-clip
    src="/audio/chorus.mp3"
    start="0"
    duration="8"
    fade-in="0.5"
    fade-out="1.0"
    fade-type="sCurve"
  >
  </daw-clip>
  <daw-clip src="/audio/chorus.mp3" start="20" duration="8"> </daw-clip>
  <daw-clip src="/audio/chorus.mp3" start="40" duration="4" offset="2.0" fade-in="0.3"> </daw-clip>
</daw-track>

<!-- Pre-computed peaks for large files (render before decode) -->
<daw-track name="Full Mix">
  <daw-clip src="/audio/full-mix.mp3" peaks-src="/peaks/full-mix.dat"> </daw-clip>
</daw-track>
```

### Resource Caching

`<daw-editor>` maintains a URL-keyed cache for each resource type, deduplicating fetch + decode across clips:

```
Map<string, Promise<AudioBuffer>>     // src → decoded audio
Map<string, Promise<WaveformData>>    // peaks-src → parsed peaks
```

Multiple `<daw-clip>` elements with the same `src` share one `AudioBuffer` — each clip is an independent window (start/offset/duration/fades) into the same underlying data. The same applies to `peaks-src`. Cache is scoped to the editor instance and cleared when the editor is disconnected.

### `<daw-annotation-track>` API

**Attributes (reflected):**

```
editable           Boolean   false    Allow drag/resize of annotation boxes
link-endpoints     Boolean   false    Snap adjacent annotation boundaries together
continuous-play    Boolean   false    Auto-advance playback through annotations
keyboard-controls  Boolean   false    Enable keyboard navigation and boundary editing
box-label          String    'text'   Lane box label mode: 'text' | 'id' | 'none'
name               String    ''       Display label for the editor's controls-column lane row
```

`editable`, `link-endpoints`, and `continuous-play` map directly to `AnnotationListOptions` from `@waveform-playlist/core`. `keyboard-controls` enables keyboard shortcuts for annotation navigation and boundary editing (see [Keyboard Shortcuts](#keyboard-shortcuts)). `box-label` only affects the timeline lane's box text — `'text'` shows the annotation's text lines joined with spaces (default), `'id'` shows the `id` attribute or a 1-based position fallback, `'none'` renders bare region bars; `<daw-annotation-list>` always shows full text regardless of this setting. `name` mirrors `<daw-track name>` — an empty string (default) renders a blank spacer so setting it is opt-in and doesn't shift layout.

**Properties (JS only):**

```typescript
annotationTrack.activeAnnotationId: string | null                  // Currently selected annotation
annotationTrack.annotationShortcuts: AnnotationShortcutMap | null  // Key remapping (null = defaults)
```

**Methods:**

```typescript
annotationTrack.selectNext(): void
annotationTrack.selectPrevious(): void
annotationTrack.selectFirst(): void
annotationTrack.selectLast(): void
annotationTrack.clearSelection(): void
annotationTrack.playActive(): void
annotationTrack.moveStartBoundary(deltaMs: number): void
annotationTrack.moveEndBoundary(deltaMs: number): void
```

**Navigation with no active selection:** `selectNext()` with no `activeAnnotationId` selects the FIRST annotation (not the second); `selectPrevious()` with no selection selects the LAST annotation. Both wrap normally (last→first, first→last) once a selection exists. This lets `ArrowDown`/`ArrowRight` and `ArrowUp`/`ArrowLeft` behave symmetrically as "enter the list from either end" on first press.

**Capture-phase keyboard priority:** each `<daw-annotation-track keyboard-controls>` registers its keydown listener on `document` in the **capture** phase (`addEventListener('keydown', handler, true)`), which runs before `<daw-keyboard-shortcuts>`' bubble-phase listener regardless of DOM position. A consumed key calls `e.stopImmediatePropagation()` (not `stopPropagation()`) — this is required because multiple annotation tracks each register their own capture listener on the same `document` node, and `stopPropagation()` does not stop sibling listeners on that node, only `stopImmediatePropagation()` does. The practical effect: when two or more `<daw-annotation-track keyboard-controls>` elements are present, a consumed key acts on exactly the **first-registered track (DOM connection order)** — not every track, and not the "closest" or "focused" one. Keys the track doesn't consume (`Escape` with no selection, boundary-edit keys when not `editable` or nothing selected) fall through both to sibling annotation tracks and to `<daw-keyboard-shortcuts>`.

**Beats-mode variable-tempo limitation (seconds-based annotations only):** a **seconds-based** annotation (no `start-tick`/`end-tick`) positions its lane box with `left = floor(start_seconds * sampleRate / spp)` — using the same `spp` (`_renderSpp`) the beats grid uses. Clip positions in beats mode instead derive pixels from `startTick / ticksPerPixel` directly. Under a **fixed** tempo the two mappings agree, but under **variable tempo** (consumer-supplied `secondsToTicks`/`ticksToSeconds` callbacks with tempo changes), a seconds-based annotation's box drifts out of alignment with the tick-positioned clips and grid. A **tick-based** annotation (both `start-tick` and `end-tick` set) does not have this limitation: its lane box uses the same clip-identical tick math as clips (`round(tick / ticksPerPixel)`), so it stays pixel-exact under variable tempo. Give drifting annotations first-class tick positions (`start-tick`/`end-tick`) to eliminate the limitation.

The editor keeps a tick-based annotation's seconds cache fresh via a sweep (`AnnotationController.deriveSecondsCaches`) that runs on annotation connect/update/select and whenever the engine's reported `bpm` changes on `statechange`. A variable-tempo tempo-map edit that doesn't change the engine's scalar `bpm` (e.g. editing a later tempo-map segment) does not trigger this sweep — the seconds cache re-derives lazily on the next annotation connect/update/select event instead. Temporal-mode rendering always reads this seconds cache, so it's never stale by more than one such event.

**Events (`<daw-annotation>` / `<daw-annotation-track>`):**

```typescript
'daw-annotation-connected'; // <daw-annotation> mounted: detail: {annotationId, element}
'daw-annotation-update'; // start/end or start-tick/end-tick changed (after first render, not on initial mount): detail: {annotationId}
'daw-annotation-select'; // activeAnnotationId changed on a track (incl. clear → null): detail: {annotation: AnnotationData | null}
'daw-annotation-track-connected'; // <daw-annotation-track> mounted: detail: {element}
'daw-error'; // annotation shortcut action threw: detail: {operation: 'annotation-shortcut', key, error}
```

All bubble and compose (cross Shadow DOM boundaries). `daw-annotation-select` is dispatched on the `<daw-annotation-track>` element (`e.target` identifies which track), consumed by `<daw-annotation-list for="...">` to sync its active row.

### `<daw-player>` API

> Core implemented in #473 (epic #454). Wraps `@waveform-playlist/media-element-playout`. Outstanding follow-ups: effects (#475), `<daw-playback-rate>` element (#476), transport-compat tests (#474), annotations (#477).

A lightweight single-track audio player that uses `HTMLMediaElement` (`<audio>`) internally — no Tone.js, no PlaylistEngine. Ideal for podcast players, music previews, audiobook readers, or any scenario that needs waveform visualization without multi-track editing.

**Attributes (reflected):**

```
src              String    —        Audio source URL
peaks-src        String    —        Pre-computed BBC audiowaveform peaks URL (.dat/.json)
wave-height      Number    128      Waveform height in px
timescale        Boolean   false    Show time ruler
mono             Boolean   false    Mono waveform rendering
bar-width        Number    1        Waveform bar width
bar-gap          Number    0        Waveform bar gap
rounded-bars     Boolean   false    Pill-shaped bar caps (radius bar-width/2)
automatic-scroll Boolean   false    Follow playhead — not implemented
playback-rate    Number    1        Playback speed (0.25–4.0)
```

**Properties (JS only):**

```typescript
player.isPlaying: boolean            // Read-only: playback state
player.currentTime: number           // Current playback position (seconds)
player.duration: number              // Read-only: total duration (seconds)
player.volume: number                // Volume (0–1)
player.effects: EffectState[]        // Read-only: effects chain — not implemented (#475)
player.audioElement: HTMLAudioElement // Read-only: underlying <audio> element
player.theme: DawcoreTheme           // Theme object — not implemented
```

**Methods:**

```typescript
player.play(): void
player.pause(): void
player.stop(): void
player.seekTo(time: number): void
player.setPlaybackRate(rate: number): void
player.setVolume(volume: number): void
// Effects — same API as editor/track
player.addEffect(type: string, params?: Record<string, number>): string // not implemented (#475)
player.removeEffect(effectId: string): void // not implemented (#475)
player.setEffectParams(effectId: string, params: Record<string, number>): void // not implemented (#475)
player.setEffectBypassed(effectId: string, bypassed: boolean): void // not implemented (#475)
player.moveEffect(effectId: string, newIndex: number): void // not implemented (#475)
```

**Events:**

```typescript
'daw-ready'; // Audio metadata loaded, waveform rendered
'daw-play'; // Playback started
'daw-pause'; // Playback paused
'daw-stop'; // Playback stopped (reset to 0)
'daw-timeupdate'; // Playback time changed (RAF)
'daw-ended'; // Playback reached end of audio
```

**AudioContext lifecycle:** The player uses `HTMLMediaElement` directly — no AudioContext needed for basic playback. When the first effect is added via `addEffect()`, the player lazily creates an AudioContext, connects the `<audio>` element through a `MediaElementAudioSourceNode`, routes through the effects chain, and connects to the destination. This means zero Web Audio overhead for simple playback use cases.

**Children (planned, #477):** `<daw-player>` does not yet render `<daw-annotation-track>` / `<daw-annotation>` children for lyric display, chapter markers, or transcription overlays — only `<daw-editor>` hosts the annotation lane today (see [`<daw-annotation-track>` API](#daw-annotation-track-api)). The markup below is the target shape once #477 lands.

```html
<!-- Simple player -->
<daw-player src="/audio/episode-42.mp3" wave-height="80" timescale></daw-player>

<!-- Player with transport controls (annotation children not yet supported, #477) -->
<daw-player id="my-player" src="/audio/song.mp3" wave-height="64">
  <daw-annotation-track editable>
    <daw-annotation start="0" end="30">Intro</daw-annotation>
    <daw-annotation start="30" end="120">Verse 1</daw-annotation>
    <daw-annotation start="120" end="180">Chorus</daw-annotation>
  </daw-annotation-track>
</daw-player>

<daw-transport for="my-player">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-time-display></daw-time-display>
  <daw-playback-rate></daw-playback-rate>
  <daw-volume-slider></daw-volume-slider>
</daw-transport>

<!-- Player with effects (AudioContext created lazily) -->
<script>
  const player = document.querySelector('daw-player');
  player.addEffect('tonejs-reverb', { decay: 3, wet: 0.4 });
  // AudioContext now exists, audio routed through reverb
</script>
```

### Transport Compatibility

`<daw-transport>` works with both `<daw-editor>` and `<daw-player>` via the `for` attribute. Most transport elements work with either target, but some are editor-only:

| Element                     | `<daw-editor>` | `<daw-player>` | Notes                              |
| --------------------------- | :------------: | :------------: | ---------------------------------- |
| `<daw-play-button>`         |      Yes       |      Yes       |                                    |
| `<daw-pause-button>`        |      Yes       |      Yes       |                                    |
| `<daw-stop-button>`         |      Yes       |      Yes       |                                    |
| `<daw-rewind-button>`       |      Yes       |      Yes       |                                    |
| `<daw-fast-forward-button>` |      Yes       |      Yes       |                                    |
| `<daw-time-display>`        |      Yes       |      Yes       |                                    |
| `<daw-volume-slider>`       |      Yes       |      Yes       | Master volume in transport context |
| `<daw-playback-rate>`       |      Yes       |      Yes       |                                    |
| `<daw-undo-button>`         |      Yes       |       No       | Player has no undo stack           |
| `<daw-redo-button>`         |      Yes       |       No       | Player has no undo stack           |
| `<daw-loop-button>`         |      Yes       |       No       | Player has no selection-based loop |
| `<daw-record-button>`       |      Yes       |       No       | Player doesn't support recording   |
| `<daw-selection-start>`     |      Yes       |       No       |                                    |
| `<daw-selection-end>`       |      Yes       |       No       |                                    |
| `<daw-time-format>`         |      Yes       |      Yes       |                                    |
| `<daw-tempo>`               |      Yes       |       No       |                                    |
| `<daw-time-signature>`      |      Yes       |       No       |                                    |
| `<daw-snap-to>`             |      Yes       |       No       |                                    |
| `<daw-scale-mode>`          |      Yes       |       No       |                                    |
| `<daw-zoom-in>`             |      Yes       |       No       | Player has fixed zoom              |
| `<daw-zoom-out>`            |      Yes       |       No       |                                    |

Transport elements that don't apply to `<daw-player>` render as disabled and log a warning to the console on first interaction.

Not implemented yet: `<daw-transport for>` does not accept a `<daw-player>` target, nor the disabled state and warning above (#474). Of the elements in the table only `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`, `<daw-record-button>`, `<daw-time-display>` and `<daw-time-format>` exist; the issues for the others are in the [Element Registry](#element-registry).

---

## Styling

### CSS Custom Properties (Theme)

Replace styled-components theme with CSS custom properties:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-progress-color: #63c75f; /* not implemented: defined in the theme, read by nothing */
  --daw-playhead-color: #d08070;
  --daw-selection-color: rgba(99, 199, 95, 0.3);
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-ruler-color: #c49a6c;
  --daw-ruler-background: #0f0f1a;
  --daw-controls-background: #1a1a2e;
  --daw-controls-text: #e0d4c8;
  --daw-controls-width: 180px; /* Track-controls column width */
  --daw-clip-header-background: rgba(0, 0, 0, 0.4);
  --daw-clip-header-text: #e0d4c8;
  --daw-min-height: 200px; /* Min scroll-area height for empty editor / drop zone */
}
```

### CSS Parts (External Styling)

```css
/* Style internal parts from outside */
/* Not implemented (#494): no element exposes these parts; the transport buttons have only part="button" */
daw-editor::part(timescale) {
  font-family: 'Courier New';
}
daw-editor::part(track) {
  border-bottom: 1px solid #333;
}
daw-editor::part(cursor) {
  width: 2px;
}
daw-track::part(controls) {
  width: 200px;
}
daw-track::part(waveform) {
  background: #111;
}
daw-vu-meter::part(segment) {
  border-radius: 2px;
}
```

### Slots

> **Hybrid model (decision 2026-06-11):** the shipped default is the composite `<daw-track-controls>` strip, rendered by the editor in the frozen controls column and dispatching a unified `daw-track-control` event (`{trackId, prop, value}`). The `slot="controls"` mechanism and the individual auto-wiring elements below are the power-user path, tracked in epic #457.

```html
<daw-editor>
  <!-- Default slot: tracks -->
  <daw-track src="vocals.mp3" name="Vocals">
    <!-- Named slot: custom track controls -->
    <div slot="controls">
      <daw-volume-slider></daw-volume-slider>
      <daw-pan-slider></daw-pan-slider>
      <button>FX</button>
    </div>
  </daw-track>
</daw-editor>
```

### Custom Controls & Event Bubbling

Slotted content lives in the light DOM and can't access shadow DOM internals directly. Instead of React-style context hooks, custom controls use **DOM event bubbling** — the natural Web Components pattern.

**Built-in control elements** auto-wire to their parent track via `closest()`:

```html
<daw-track src="vocals.mp3" name="Vocals">
  <div slot="controls">
    <daw-mute-button></daw-mute-button>
    <daw-volume-slider></daw-volume-slider>
    <daw-pan-slider></daw-pan-slider>
    <daw-vu-meter></daw-vu-meter>
  </div>
</daw-track>
```

**Custom controls** dispatch bubbling events that any ancestor can handle:

```html
<daw-editor id="my-editor">
  <daw-track src="vocals.mp3" name="Vocals">
    <div slot="controls">
      <daw-volume-slider></daw-volume-slider>
      <button class="fx-btn">FX</button>
      <button class="delete-btn">Delete</button>
    </div>
  </daw-track>
</daw-editor>

<script>
  const editor = document.getElementById('my-editor');

  // Custom events bubble up through the DOM tree.
  // Use composed: true to cross shadow DOM boundaries.
  document.querySelector('.fx-btn').addEventListener('click', (e) => {
    e.target.dispatchEvent(
      new CustomEvent('open-fx', {
        bubbles: true,
        composed: true,
      })
    );
  });

  // Ancestor catches the event — closest() identifies which track
  editor.addEventListener('open-fx', (e) => {
    const track = e.target.closest('daw-track');
    console.log('open FX for', track.getAttribute('name'));
  });

  // Delete track via editor method
  document.querySelector('.delete-btn').addEventListener('click', (e) => {
    const track = e.target.closest('daw-track');
    editor.removeTrack(track.id);
  });
</script>
```

**Built-in elements use the same event contract.** `<daw-mute-button>` dispatches `daw-mute`, `<daw-solo-button>` dispatches `daw-solo` — the parent `<daw-track>` listens and toggles state. Since events keep bubbling, `<daw-editor>` also sees them (needed for solo logic which spans all tracks).

```html
<daw-track src="vocals.mp3" name="Vocals">
  <div slot="controls">
    <!-- Built-in: fires daw-mute event -->
    <daw-mute-button></daw-mute-button>
    <!-- Custom: fires the same event, same behavior -->
    <button
      onclick="this.dispatchEvent(new CustomEvent('daw-mute', { bubbles: true, composed: true }))"
    >
      My Custom Mute
    </button>
  </div>
</daw-track>
```

The track doesn't care what fired the event — any element that dispatches `daw-mute` triggers the same toggle. This makes every built-in control replaceable with a custom implementation.

**Key pattern:** Instead of pulling state down via hooks (React), navigate up via `closest()` and read properties from elements. Elements are the state containers — the DOM tree is the context.

---

## Drag & Drop

**Decision (shipped):** the original plan was `@dnd-kit/dom`. The implementation instead uses **native pointer events** — no drag library at all (`packages/dawcore/src/interactions/`):

- `PointerHandler` — timeline interactions: click-to-seek, drag-to-select, track selection.
- `ClipPointerHandler` — clip move and boundary trim via `setPointerCapture`, with a small `DRAG_THRESHOLD` to distinguish clicks from drags.

Both handlers talk to the engine through narrow contracts (`moveClip`, `trimClip`, `constrainTrimDelta`, `getClipBounds`) so collision and bounds logic stays engine-side, and a drag previews in the view and makes one `moveClip` / `trimClip` call on release, which is its one undo step; a cancel writes nothing (#848). Snapping uses `snapTickToGrid` / `snapToTicks` from `@waveform-playlist/core` driven by the editor's `snapTo` value.

Note for E2E tests: synthetic `dispatchEvent(new PointerEvent(...))` cannot drive these handlers — `setPointerCapture` throws for fabricated pointerIds. Use real input (`page.mouse.*`).

---

## Effects

Effects are **imperative only** — no `<daw-effect>` element. Effects are configuration (how audio sounds), not content (what's in the track). The same API surface is available on both `<daw-editor>` (master chain) and `<daw-track>` (per-track chain).

**Decision (shipped — epics #412/#413/#414):** the original plan was 20 built-in Tone.js effects. The implementation instead ships a small **native Web Audio registry** plus **open plugin standards** (WAM 2.0 and in-browser Faust compilation) for everything richer. No Tone.js dependency in the effects path.

### Effect State

```typescript
interface EffectState {
  id: string; // Generated unique ID
  kind: string; // 'native' | 'wam'
  type: string; // Registry key (e.g., 'native-delay') or 'wam'
  params: Record<string, number>; // Current parameter values
  bypassed: boolean;
  url?: string; // WAM plugin source URL (url-loaded plugins)
  source?: { faust: string }; // Faust entries: the DSP source they were compiled from
  label?: string; // Human-readable name (e.g. a WAM descriptor's name)
  error?: string; // Set when the entry is a non-functional placeholder
}
```

Chain state round-trips via `getEffectsState()` / `setEffectsState()` — native params, WAM plugin state, and Faust sources (recompiled on restore) are all serializable (#424).

### Built-in Effects (native Web Audio)

Built-ins use a `native-` prefix and plain Web Audio nodes:

| Type                   | Label           | Category | Params                                            |
| ---------------------- | --------------- | -------- | ------------------------------------------------- |
| `native-gain`          | Gain            | dynamics | `gain`                                            |
| `native-filter`        | Lowpass Filter  | filter   | `frequency`, `q`                                  |
| `native-highpass`      | Highpass Filter | filter   | `frequency`, `q`                                  |
| `native-bandpass`      | Bandpass Filter | filter   | `frequency`, `q`                                  |
| `native-notch`         | Notch Filter    | filter   | `frequency`, `q`                                  |
| `native-peaking`       | Peaking EQ      | filter   | `frequency`, `q`, `gain` (dB)                     |
| `native-lowshelf`      | Low Shelf       | filter   | `frequency`, `gain` (dB)                          |
| `native-highshelf`     | High Shelf      | filter   | `frequency`, `gain` (dB)                          |
| `native-compressor`    | Compressor      | dynamics | `threshold`, `knee`, `ratio`, `attack`, `release` |
| `native-stereo-panner` | Stereo Panner   | spatial  | `pan`                                             |
| `native-delay`         | Delay           | delay    | `delayTime`, `feedback`, `wet`                    |

As in Web Audio, `q` means two things: for `native-filter` (lowpass) and `native-highpass` it is the resonance peak at the cutoff in dB (about −3 is a flat Butterworth response, the `native-highpass` default); for bandpass, notch and peaking it is the linear quality factor.

Each biquad shape is its own type because effect params are numeric — a filter `type` param would not fit `Record<string, number>` or the generic parameter panel. Each type exposes only the params its shape uses (Web Audio ignores `Q` on shelves and `gain` on everything but peaking/shelves).

### WAM & Faust Plugins

Richer effects come from plugin standards rather than a large built-in set:

- `addWamPlugin(url, initialState?)` loads a [WAM 2.0](https://www.webaudiomodules.com/) plugin into the chain (optional `@dawcore/wam` peer). Plugin GUIs (`createGui`/`destroyGui`), generic parameter fallback panels, state persistence, and offline export through WAM chains are supported.
- `addFaustEffect(dspCode, { name? })` compiles Faust DSP source in the browser to a WAM (optional `@dawcore/faust` peer).

Chain operations never branch on entry kind — native and plugin entries support the same bypass/reorder/remove/params surface.

### Effect GUIs

Effect editor GUIs are **host-agnostic** — the consumer supplies the container element the panel mounts into. The same two methods are available on both `<daw-editor>` (master chain) and `<daw-track>` (per-track chain):

- `openEffectGui(effectId, container)` mounts the effect's GUI into `container` and resolves with the mounted element. WAM plugins render their own GUI (`createGui`); native effects — and WAM plugins that ship no custom GUI — get a generic parameter panel built from the registry param definitions. A panel edit routes through the same path as `setEffectParams`, so it applies the change AND dispatches `daw-effect-change`.
- `closeEffectGui(effectId)` detaches the panel but **caches** it — reopening remounts the same element, preserving GUI state. The GUI is destroyed only when the effect is removed from the chain. Calling `closeEffectGui` on a never-opened id warns but never throws; an error-placeholder entry refuses to open.

```javascript
// Open a WAM plugin's GUI into your own container element
const panel = document.getElementById('plugin-panel');
await track.openEffectGui(wamId, panel);

// Detach (cached — reopen is cheap and preserves state)
track.closeEffectGui(wamId);
```

### Per-Track Effects by ID (element-less tracks)

The `<daw-track>` element methods above require a `<daw-track>` DOM element. Tracks created **without** one — drag-dropped via `<daw-editor file-drop>`, or a track an Undo brought back after its element was removed — have a `trackId` but no element to call methods on. `<daw-editor>` exposes the same per-track surface addressed by `trackId` so those tracks can carry their own insert chain:

```typescript
editor.addTrackEffect(trackId: string, type: string, params?: Record<string, number>): string
editor.addTrackWamPlugin(trackId: string, url: string, initialState?: unknown): Promise<string>
editor.addTrackFaustEffect(trackId: string, dspCode: string, options?: { name?: string }): Promise<string>
editor.removeTrackEffect(trackId: string, effectId: string): void
editor.setTrackEffectParams(trackId: string, effectId: string, params: Record<string, number>): void
editor.setTrackEffectBypassed(trackId: string, effectId: string, bypassed: boolean): void
editor.moveTrackEffect(trackId: string, effectId: string, newIndex: number): void
editor.trackEffects(trackId: string): EffectState[]
editor.openTrackEffectGui(trackId: string, effectId: string, container: HTMLElement): Promise<HTMLElement>
editor.closeTrackEffectGui(trackId: string, effectId: string): void
editor.getTrackEffectsState(trackId: string): Promise<SerializedEffectEntry[]>
editor.setTrackEffectsState(trackId: string, entries: SerializedEffectEntry[]): Promise<void>
```

`daw-effect-*` events dispatch from the track's `<daw-track>` element when one exists (so they bubble identically to the element-method path), else from the editor for element-less tracks. The `<daw-track>` element methods are thin sugar over these — `track.addEffect(type)` is `editor.addTrackEffect(track.trackId, type)` — so both entry points hit the same chain and fire the same events.

```javascript
// A stem dropped onto <daw-editor file-drop> — no <daw-track> element exists.
editor.addEventListener('daw-track-ready', async (e) => {
  const { trackId } = e.detail;
  await editor.addTrackWamPlugin(trackId, 'https://example.com/plugin/index.js');
});
```

### Effect Registry

Custom native effects register alongside the built-ins:

```typescript
import { registerEffect, getEffectDefinitions } from '@waveform-playlist/core';

registerEffect('my-highpass', {
  label: 'Highpass Filter',
  category: 'filter',
  create: (audioContext, params) => {
    const node = new BiquadFilterNode(audioContext, {
      type: 'highpass',
      frequency: params.frequency,
    });
    return {
      input: node,
      output: node,
      applyParams: (p) => {
        if (p.frequency !== undefined) node.frequency.value = p.frequency;
      },
    };
  },
  defaults: { frequency: 200 },
  params: {
    frequency: { min: 20, max: 2000, step: 1, unit: 'Hz' },
  },
});

// Query available effects (built-in + registered)
const allEffects = getEffectDefinitions();
```

**Registration shapes** (see `packages/core/src/effects/registry.ts`):

```typescript
interface NativeEffectDefinition {
  label: string;
  category: string;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
  wetParam?: string; // Name of the wet/dry param, when the effect has one
  // Optional async per-context setup (e.g. audioWorklet.addModule) — see below:
  prepare?: (audioContext: BaseAudioContext) => Promise<void>;
  // Must work on any BaseAudioContext so the same definitions serve offline rendering:
  create: (audioContext: BaseAudioContext, params: Record<string, number>) => NativeEffectInstance;
  /**
   * Set by a host library on the effects of its own catalogue (dawcore's
   * `native-*`), never by an app. A host lists its own catalogue plus what
   * the app registered: the React effect picker leaves these out. The effect
   * can still be added by id anywhere.
   */
  builtIn?: boolean;
}

interface NativeEffectInstance {
  input: AudioNode; // Chain attachment points (same node for single-node effects)
  output: AudioNode;
  applyParams: (params: Record<string, number>) => void; // In-place — chain never rebuilds for param changes
  dispose?: () => void;
}

interface EffectParamDef {
  min: number;
  max: number;
  step?: number;
  unit?: string; // 's', 'ms', 'Hz', 'dB', '%'
  label?: string; // Display name for a parameter panel; defaults to the parameter's key
}
```

The built-ins use this same shape internally — `registerEffect` adds to the same map. Calling `addEffect('unknown-type')` throws with a clear error listing available types.

**Async preparation (`prepare`, #657).** An `AudioWorkletNode`-backed effect needs `audioWorklet.addModule(url)` to have resolved on the same context before `create` runs — and `exportAudio()` renders on an `OfflineAudioContext` the consumer never sees. A definition's optional `prepare(audioContext)` hook runs once per context (memoized per type; a failed run is retried on the next call):

- `exportAudio()` awaits it on the offline context before the first `create` of that type.
- `setEffectsState()` awaits it on the live context (a failure becomes a placeholder, like any failed native restore).
- `addEffect()` / `addTrackEffect()` are synchronous and cannot — call `await editor.prepareEffect(type)` first (or `prepareEffect(type, audioContext)` from `@waveform-playlist/core`). Without it, the error thrown by `create` is rewrapped with that hint.

### Usage

```javascript
// Per-track effects
const track = document.querySelector('daw-track[name="Vocals"]');
const delayId = track.addEffect('native-delay', { delayTime: 0.25, feedback: 0.4 });
const filterId = track.addEffect('native-filter', { frequency: 800 });

// Master effects
const compId = editor.addEffect('native-compressor', { threshold: -24, ratio: 4 });

// WAM plugin (optional @dawcore/wam peer)
const wamId = await editor.addWamPlugin('https://example.com/plugin/index.js');

// Faust DSP compiled in the browser (optional @dawcore/faust peer)
const faustId = await editor.addFaustEffect(dspSource, { name: 'My Verb' });

// Real-time parameter updates (no chain rebuild)
track.setEffectParams(delayId, { delayTime: 0.5 });

// Bypass: effects with a wetParam store the original wet and set it to 0;
// effects without one are bypassed by disconnection.
track.setEffectBypassed(delayId, true);
track.setEffectBypassed(delayId, false);

// Reorder and remove
track.moveEffect(filterId, 0); // Move filter before delay
track.removeEffect(filterId);

// Read current state
console.log(track.effects); // EffectState[] (see Effect State above)
console.log(editor.effects); // Master chain, same shape
```

### Effect Events

Events are dispatched from the element that owns the chain. Per-track effect events bubble up to `<daw-editor>`, so you can listen on the editor for all effect changes.

```javascript
// Listen on a specific track
track.addEventListener('daw-effect-add', (e) => {
  console.log('Added', e.detail.type, 'at index', e.detail.index);
});

// Listen on editor to catch ALL effect changes (master + any track)
editor.addEventListener('daw-effect-bypass', (e) => {
  const track = e.target.closest('daw-track');
  if (track) {
    console.log('Track effect bypassed:', track.name, e.detail.effectId);
  } else {
    console.log('Master effect bypassed:', e.detail.effectId);
  }
});
```

### Offline Rendering / WAV Export

`editor.exportAudio()` renders offline through all effect chains (per-track + master), producing identical output to real-time playback:

```typescript
interface ExportOptions {
  format?: 'wav'; // Extensible for future formats
  sampleRate?: number; // Default: audioContext.sampleRate
  startTime?: number; // Default: 0
  duration?: number; // Default: editor.duration
  channels?: 1 | 2; // Default: 2 (stereo)
}
```

```javascript
// Basic export
const buffer = await editor.exportAudio();

// Export selection only
const { start, end } = editor.selection;
const buffer = await editor.exportAudio({
  startTime: start,
  duration: end - start,
});

// Convert to WAV blob for download
const wav = audioBufferToWav(buffer); // utility from @dawcore/core
const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
```

---

## Spectrogram & Piano-Roll

Spectrogram is a **render mode on `<daw-track>`**, not a standalone element: an audio track can display as waveform, spectrogram or split (spectrogram + waveform). A MIDI track (`kind="midi"`) is always drawn as a piano roll, and an audio track never is (#756).

### Render Modes

```html
<!-- Waveform (default) -->
<daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>

<!-- Spectrogram -->
<daw-track src="/audio/vocals.mp3" name="Vocals" render-mode="spectrogram"></daw-track>

<!-- Split: spectrogram on top, waveform on bottom -->
<daw-track src="/audio/vocals.mp3" name="Vocals" render-mode="split"></daw-track>

<!-- Piano roll: a MIDI track (kind="midi", set for tracks created by loadMidi) -->
<daw-track name="Piano" kind="midi"></daw-track>
```

`waveform` and `spectrogram` are shipped, and so is the piano roll of MIDI tracks. `split` is tracked in #491 — today it warns and draws the waveform (`both` warns and draws the spectrogram).

Switchable at runtime:

```js
track.renderMode = 'spectrogram';
// or
track.setAttribute('render-mode', 'spectrogram');
```

### Spectrogram Configuration

Complex object — JS property, not attributes. Global defaults on the editor, per-track overrides on individual tracks.

```typescript
interface SpectrogramConfig {
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192; // Default: 2048
  hopSize?: number; // Default: fftSize / 4
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'; // Default: 'mel'
  colorMap?: 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus'; // not a SpectrogramConfig field: the editor's is editor.spectrogramColorMap; per track, not implemented
  minFrequency?: number; // Default: 0
  maxFrequency?: number; // Default: sampleRate / 2
  gainDb?: number; // Default: 20
  rangeDb?: number; // Default: 80
}
```

```javascript
// Global defaults (all spectrogram/split tracks inherit)
editor.spectrogramConfig = {
  fftSize: 2048,
  frequencyScale: 'mel',
  colorMap: 'viridis',
};

// Per-track override (merged with global)
track.spectrogramConfig = { colorMap: 'magma' };

// Reset to global defaults
track.spectrogramConfig = null;
```

**Worker pool:** Created lazily when the first track uses `'spectrogram'` or `'split'` mode. Disposed when no tracks use those modes. Internal — no consumer-facing pool API.

**Event:**

```typescript
'daw-spectrogram-ready'; // Visible viewport FFT complete: detail: {trackId}
```

Useful for E2E tests and screenshot tooling.

### MIDI Loading

MIDI files are loaded imperatively via `editor.loadMidi()` because a `.mid` file can contain multiple tracks — the track count is unknowable at HTML authoring time.

```typescript
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>

interface MidiLoadOptions {
  /** Timeline position in seconds applied to every created clip (default: 0) */
  startTime?: number;
  /** Cancels the fetch, the parse and the addTrack waits; the tracks added are taken out (no undo step) */
  signal?: AbortSignal;
}

interface MidiLoadResult {
  trackIds: string[];                   // IDs of created <daw-track> elements
  bpm: number;                          // Tempo from MIDI header (or 120)
  timeSignature: [number, number];      // e.g., [4, 4]
  duration: number;                     // Total duration in seconds
  name: string;                         // Song name from header (empty if absent)
}
```

```javascript
// Load multi-track MIDI — creates N <daw-track> elements automatically
const { trackIds, bpm, timeSignature } = await editor.loadMidi('/midi/song.mid');
console.log('Created tracks:', trackIds);

// Apply tempo from MIDI file (caller decides — loadMidi never mutates editor state implicitly)
editor.bpm = bpm;
editor.timeSignature = timeSignature;

// Position on timeline
await editor.loadMidi('/midi/bridge.mid', { startTime: 30.0 });
```

Created tracks are MIDI tracks (`kind="midi"`), drawn as piano rolls. Each track's clip carries `midiNotes` data for the piano-roll renderer. Track names are derived from the MIDI file (instrument name, channel, or GM program name).

**Cleanup-on-failure:** if any of the N track creations fails, `loadMidi` removes all successfully-created tracks, with no undo step, before rejecting — the editor returns to its pre-call state. An abort of `options.signal` (or a swap of `editor.arrangement`) in any phase does the same and rejects with the signal's reason (#848).

**Deferred to future versions:**

- `flatten` option (needs a "hidden audio-only track" primitive in dawcore)
- `name` override (ambiguous semantics with multi-track files)
- Auto-applied tempo / time signature (currently caller does `editor.bpm = result.bpm`)

For programmatic MIDI (no file), set `clip.midiNotes` directly:

```javascript
const trackId = await editor.addTrack({
  name: 'Synth Lead',
  midi: {
    notes: [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
    ],
  },
}); // a MIDI track: kind="midi"
// Later: replace the notes on the clip
track.querySelector('daw-clip').midiNotes = otherNotes;
```

### Piano-Roll Theming

CSS custom properties, consistent with the overall theme system:

```css
daw-editor {
  --daw-piano-roll-note-color: #2a7070;
  --daw-piano-roll-selected-note-color: #3d9e9e;
  --daw-piano-roll-background: #1a1a2e;
}
```

Velocity maps to opacity (0.3 → 1.0). Pitch range auto-fits to actual note data. No JS configuration needed.

---

## Keyboard Shortcuts

Keyboard shortcuts are opt-in via two mechanisms: `<daw-keyboard-shortcuts>` for editor-level shortcuts, and `keyboard-controls` attribute on `<daw-annotation-track>` for annotation shortcuts.

### `<daw-keyboard-shortcuts>` Element

Render-less element placed inside `<daw-editor>`. Enables built-in shortcut presets via boolean attributes and supports custom shortcuts via JS property.

```html
<daw-editor id="my-editor">
  <daw-keyboard-shortcuts playback splitting></daw-keyboard-shortcuts>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
</daw-editor>
```

**Attributes (reflected):**

```
playback         Boolean   false    Space=play/pause, Escape=stop, 0=rewind
splitting        Boolean   false    S=split clip at playhead on selected track
undo             Boolean   false    Cmd/Ctrl+Z=undo, Cmd/Ctrl+Shift+Z=redo
```

**Properties (JS only):**

```typescript
shortcuts.customShortcuts: KeyboardShortcut[]          // Additional custom shortcuts
shortcuts.shortcuts: KeyboardShortcut[]                // Read-only. All active shortcuts (built-in + custom)
shortcuts.playbackShortcuts: PlaybackShortcutMap | null   // Remap playback keys (null = defaults)
shortcuts.splittingShortcuts: SplittingShortcutMap | null  // Remap splitting keys (null = defaults)
```

**Shortcut definition shape:**

```typescript
interface KeyboardShortcut {
  key: string; // 'Space', 's', 'Escape', 'ArrowUp', etc.
  action: () => void; // Callback
  description?: string; // Human-readable label
  ctrlKey?: boolean; // Modifier (optional — if omitted, any state matches)
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean; // Default: true
}

// from @waveform-playlist/core (dawcore no longer exports its own copy, #807)
interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}
```

**Built-in playback shortcuts:**

| Action          | Default Key | Description     |
| --------------- | ----------- | --------------- |
| `playPause`     | `Space`     | Play/Pause      |
| `stop`          | `Escape`    | Stop            |
| `rewindToStart` | `0`         | Rewind to start |

**Built-in splitting shortcuts:**

| Action            | Default Key | Description            |
| ----------------- | ----------- | ---------------------- |
| `splitAtPlayhead` | `S`         | Split clip at playhead |

**Remapping built-in shortcuts:**

```typescript
interface PlaybackShortcutMap {
  playPause?: KeyBinding;
  stop?: KeyBinding;
  rewindToStart?: KeyBinding;
}

interface SplittingShortcutMap {
  splitAtPlayhead?: KeyBinding;
}
```

```javascript
const shortcuts = document.querySelector('daw-keyboard-shortcuts');

// Remap playback keys
shortcuts.playbackShortcuts = {
  playPause: { key: 'p' },
  stop: { key: 'q' },
};

// Add custom shortcuts
shortcuts.customShortcuts = [
  { key: 'c', action: () => editor.stop(), description: 'Clear all' },
  { key: 'Delete', action: () => editor.removeTrack(id), description: 'Delete track' },
];

// Reset to defaults
shortcuts.playbackShortcuts = null;
```

**Behaviors:**

- Ignores key repeat (no rapid toggling from held keys)
- Ignores events from `<input>`, `<textarea>`, and `contentEditable` elements
- Case-insensitive key matching
- First match wins

**Priority rule:** When both `<daw-keyboard-shortcuts>` and `<daw-annotation-track keyboard-controls>` are active, annotation shortcuts run first — the annotation track's `keydown` listener registers on `document` in the **capture** phase, ahead of `<daw-keyboard-shortcuts>`' bubble-phase listener. If an annotation is selected and the key matches an annotation action, the event is consumed via `stopImmediatePropagation()` (also blocks sibling annotation-track capture listeners — see [multi-track arbitration](#daw-annotation-track-api)). Otherwise it falls through to editor-level shortcuts. This means `Escape` clears the annotation selection first; pressing `Escape` again (with no selection) stops playback.

### Annotation Keyboard Controls

Enabled via `keyboard-controls` attribute on `<daw-annotation-track>`. Shortcuts are scoped to the annotation track that owns them — multiple annotation tracks can each have independent keyboard controls.

```html
<daw-annotation-track id="lyrics" editable link-endpoints keyboard-controls>
  <daw-annotation start="0.0" end="2.5">First line</daw-annotation>
  <daw-annotation start="2.5" end="5.1">Second line</daw-annotation>
</daw-annotation-track>
```

**Properties (JS only):**

```typescript
annotationTrack.activeAnnotationId: string | null              // Currently selected annotation
annotationTrack.annotationShortcuts: AnnotationShortcutMap | null  // Key remapping (null = defaults)
```

**Default key bindings:**

| Action             | Default Key                | Description              |
| ------------------ | -------------------------- | ------------------------ |
| `selectPrevious`   | `ArrowUp` / `ArrowLeft`    | Select previous (wraps)  |
| `selectNext`       | `ArrowDown` / `ArrowRight` | Select next (wraps)      |
| `selectFirst`      | `Home`                     | Select first             |
| `selectLast`       | `End`                      | Select last              |
| `clearSelection`   | `Escape`                   | Deselect                 |
| `moveStartEarlier` | `[`                        | Start −10ms              |
| `moveStartLater`   | `]`                        | Start +10ms              |
| `moveEndEarlier`   | `{` (Shift+[)              | End −10ms                |
| `moveEndLater`     | `}` (Shift+])              | End +10ms                |
| `playActive`       | `Enter`                    | Play selected annotation |

**Remapping:**

```typescript
interface AnnotationShortcutMap {
  selectPrevious?: KeyBinding;
  selectNext?: KeyBinding;
  selectFirst?: KeyBinding;
  selectLast?: KeyBinding;
  clearSelection?: KeyBinding;
  moveStartEarlier?: KeyBinding;
  moveStartLater?: KeyBinding;
  moveEndEarlier?: KeyBinding;
  moveEndLater?: KeyBinding;
  playActive?: KeyBinding;
}
```

```javascript
// Remap to vim-style keys (partial — only override what you want)
annotationTrack.annotationShortcuts = {
  selectPrevious: { key: 'k' },
  selectNext: { key: 'j' },
};
```

**Exposed methods** (for programmatic use outside keyboard shortcuts):

```typescript
annotationTrack.selectNext(): void
annotationTrack.selectPrevious(): void
annotationTrack.selectFirst(): void
annotationTrack.selectLast(): void
annotationTrack.clearSelection(): void
annotationTrack.playActive(): void
annotationTrack.moveStartBoundary(deltaMs: number): void
annotationTrack.moveEndBoundary(deltaMs: number): void
```

**Behaviors:**

- Auto-scrolls to center the active annotation on keyboard selection change
- Respects `link-endpoints` — boundary moves cascade to adjacent annotations
- Boundary constraints: minimum 0.1s duration for seconds-based annotations, end cannot exceed timeline duration — unless `<daw-editor indefinite-playback>` is set, which lifts the end bound entirely (DAW-style unbounded timeline) so annotations may extend past the audio. In temporal mode (not beats mode) the timeline width also extends to cover the furthest annotation end, keeping such annotations reachable/scrollable regardless of `indefinite-playback`. Tick-based annotations use a tick-space minimum duration instead: `max(1, round(ppqn / 32))` ticks (a 128th note, floored at 1 tick so it's never zero even at very low PPQN) — boundary math runs entirely in tick space (`ANNOTATION_LINK_THRESHOLD_TICKS` link threshold) so edits stay tempo-independent.
- In `scale-mode="beats"` with `snapTo` set to anything other than `'off'`, dragging a tick-based annotation's boundary snaps the target tick to the grid (`snapTickToGrid`) before applying boundary/link math — same snap behavior as clip drag. Seconds-based annotations and non-drag boundary edits (`moveStartBoundary`/`moveEndBoundary`) never snap.
- Navigation shortcuts always active; boundary editing requires `editable` attribute
- `selectNext`/`selectPrevious` with no active selection jump to the first/last annotation respectively rather than a no-op (see [Navigation with no active selection](#daw-annotation-track-api))
- Multiple `keyboard-controls` tracks: a consumed key acts on the first-registered track only (capture-phase `stopImmediatePropagation` — see [Capture-phase keyboard priority](#daw-annotation-track-api))
- In `scale-mode="beats"` with variable tempo, annotation-box positions can drift from tick-positioned clips/grid (see [Beats-mode variable-tempo limitation](#daw-annotation-track-api))

---

## Element Lifecycle: Declaration and Live State (#848)

`<daw-track>` and `<daw-clip>` behave like native form elements. **The markup is the page's declaration; live state is read from properties.** The editor never writes an attribute and never moves an element. The one exception is an explicit request to remove: `editor.removeTrack()` / `removeClip()` remove the element, as `select.remove(i)` does. Everything a consumer can observe follows from that rule and from the native element each case is modelled on.

### Native precedents

| Native | What it shows | Here |
|---|---|---|
| `<input value>` / `input.value` | The attribute is the default; the property is live, and setting it never writes the attribute | `<daw-track volume>` / `trackEl.volume`, `<daw-clip start>` / `clipEl.start` |
| `<option selected>` / `option.index` | A property that reports position in the parent's list | `trackEl.index`: the position in the arrangement, -1 when not there |
| `<video>` with `<source>` children and `srcObject` | The children declare the content; `srcObject` replaces it while set, and the children are inert | `editor.arrangement = other` plays `other` alone; `null` goes back to the arrangement the children declare |
| `<track>` in `<video>` | Removing the element removes its text track; moving it moves it | Removing a `<daw-clip>` removes its clip; moving it into another `<daw-track>` moves the clip |
| Custom states (`ElementInternals.states`) | Runtime state for CSS, never written to the DOM | `:state(detached)` |
| `<details open>` (counter-example) | Writes its own attribute back on user action | Not followed: a state change shows in a property or a custom state, never in the page's attribute |

### The three states of an element

An element is linked to the arrangement by id (`trackEl.trackId`, `clipEl.clipId`).

| State | When | Properties read | A property set / attribute change |
|---|---|---|---|
| **pending** | Outside an editor, or registered and not entered yet (waiting for `editor.adapter`) | The declaration | Changes the declaration: it is the value the track enters with |
| **live** | The arrangement played holds the id | The arrangement (`name`, `volume`, `pan`, `muted`, `soloed`, `kind`; `start`, `duration`, `offset`, `gain`, `name`, the MIDI fields) | A request to the arrangement, synchronous, one undo step (mix changes in one synchronous run are one step); the attribute keeps what the page wrote |
| **detached** | The editor took it and the arrangement no longer holds its id (an Undo of its arrival, a removal made through the arrangement, a refusal), or a handed-in arrangement is set | The declaration | Changes nothing in the arrangement and logs a warning; an attribute change still updates the declaration. The element carries `:state(detached)`; a Redo of its arrival makes it live again (for a handed-in arrangement: `editor.arrangement = null`) |

`src`, `render-mode`, `spectrogramConfig`, fades and `color` are declaration-only: the arrangement has no field for them (`editor.updateTrack()` changes what is drawn; read it from `editor.tracks`). `kind` is live and cannot change after entry: a later change warns, and the attribute keeps what the page wrote. A `<daw-clip>` is linked to its clip by id wherever it sits, so after an Undo of a move it can sit in another track's element and still be live.

### What the page does, and what follows

| The page… | Result | Undo / Redo |
|---|---|---|
| appends a `<daw-track>` | It enters the arrangement at the next flush, in DOM position, its `<daw-clip>` children read then | One undo step (except at page load: tracks entering an empty history make none) |
| appends a `<daw-clip>` to a live track | A loading clip (a loaded one for MIDI) enters the track | One step |
| appends a `<daw-clip>` to a pending track | Read when the track enters | Part of the track's entry |
| appends a `<daw-clip>` to a detached track | Never enters, also after a Redo; warns; `:state(detached)` | None |
| moves a `<daw-track>` (`insertBefore`, `moveBefore()`) | A reorder request: placed after the track of the `<daw-track>` before it | One step per observer batch; an Undo moves no element |
| moves a `<daw-clip>` into another live track | Its clip moves there as it is (times, audio) | One step; an Undo moves no element: the element stays, linked by id |
| moves a `<daw-clip>` into a track of the other kind | Refused: nothing changes, `daw-clip-error`, a warning; the element stays where the page put it | None |
| moves a `<daw-clip>` into a pending track | The clip moves when the track enters, as it is (times, audio); one of the other kind stays where it is, with `daw-clip-error` | Part of the track's arrival step (none at page load, when the arrival makes none) |
| moves a `<daw-clip>` into a detached track | Refused: the clip stays in its track, `daw-clip-error`, a warning; the element shows `:state(detached)` and, once a Redo brings the track back, is live, linked to its clip by id | None |
| removes a `<daw-clip>` | Its clip leaves the track that holds it | One step |
| removes a `<daw-track>` | The track leaves, with every clip its children declared (also a clip another track holds, whose element sat inside it) | One step for the whole removal |
| removes an element whose clip or track the arrangement does not hold (an Undo, a removal made through the arrangement, a refusal) | Gone for good: taken out of the undo and redo states too, so no Redo brings it back (and no Redo is lost) | None |
| removes an element while a handed-in arrangement is set | An ordinary undo step in the editor's own arrangement | One step there |
| moves the elements with `moveBefore()` | As the moves above; `connectedMoveCallback` keeps the elements' state and announces their new place | As above |

The editor reads its children again when it is put back in the page (a `<daw-track>` or `<daw-clip>` removed meanwhile goes as the observer would have done) and shows the link states then.

## Programmatic Track Mutation

Two consumer-facing ways to mutate tracks at runtime exist by design: **declarative DOM mutation** (append/remove/update `<daw-track>` and `<daw-clip>` elements) and **imperative editor methods** (`editor.addTrack`, `editor.removeTrack`, `editor.loadFiles`). The engine API (`editor.engine.setTracks`, `editor.engine.addTrack`, …) is **internal plumbing**, not a consumer surface — the editor reads its arrangement, so a change made through `editor.arrangement` (or the engine) is drawn; see "Drive tracks through `editor.arrangement`, not `editor.engine`" below (#848).

### Engine Lifecycle

`<daw-editor>` owns an arrangement from the moment it is created and builds its `PlaylistEngine` on it as soon as it is connected with an `editor.adapter` (#848). Before that, `editor.engine` is `null` and `<daw-track>` elements wait to enter. `await editor.ready()` resolves with the engine (it rejects without an adapter).

```javascript
console.log(editor.engine); // null: no adapter yet
editor.adapter = new NativePlayoutAdapter(new AudioContext());
console.log(editor.engine); // PlaylistEngine
```

### Declarative DOM Mutation

Appending a `<daw-track>` element to a connected `<daw-editor>` is fully supported. The track element fires a `daw-track-connected` event on `connectedCallback` (deferred via `setTimeout(0)`); the editor reads the descriptor and enters the track into its arrangement at its DOM position, where its audio loads.

```javascript
const t = document.createElement('daw-track');
t.setAttribute('src', '/audio/kick.opus');
t.setAttribute('name', 'Kick');
editor.appendChild(t); // → daw-track-ready event fires when loaded
```

Removal works via `element.remove()` — the editor's MutationObserver detects detached `<daw-track>` nodes and cleans up engine state, peaks, and clip buffers. The engine call is incremental (`adapter.removeTrack`) when the adapter supports it; otherwise it falls back to `setTracks()` and stops playback.

**Updating reflected attributes** (`name`, `volume`, `pan`, `muted`, `soloed`, `src`) on a `<daw-track>` after connection fires `daw-track-update`. The event's `changed` lists the properties of that update; the editor sends the engine only the mixer properties it names, as one undo step (#843), and refreshes its descriptor from the element. A mixer change while the track loads is a step too (#848). Changing `src` of the `<daw-track src>` shorthand replaces its clip with a new loading clip, one undo step.

#### Late `<daw-clip>` mutation

`<daw-clip>` dispatches `daw-clip-connected` (deferred via `setTimeout(0)` after construction) and `daw-clip-update` (when reflected attributes change after the initial render). The editor's MutationObserver detects clip removals on the `<daw-track>` subtree.

- Appending a `<daw-clip>` to an already-connected `<daw-track>` triggers an incremental load and appends the clip to the existing track.
- Mutating a `<daw-clip>` attribute (`start`, `offset`, `duration`, `gain`, `name`, `fade-in`, `fade-out`, `fade-type`) after track-connect propagates to the engine via `daw-clip-update`. Re-extracts peaks when `offset`/`duration` change.
- Removing a `<daw-clip>` from the DOM removes it from the engine and cleans up per-clip caches.

Changing `src` on an already-loaded `<daw-clip>` is **not** supported via `daw-clip-update` — remove and re-add the clip instead.

A track's `<daw-clip>` children are read when the track enters the arrangement (#848); their own deferred `daw-clip-connected` events after that are skipped. A `<daw-clip>` appended to a track that has entered goes in as a loading clip, one undo step. A live property set (or attribute change) on a clip is a request to the arrangement; the editor does not act on `daw-clip-update`.

### Imperative Editor API

For consumers who can't or won't go through declarative DOM (Vue/Svelte/Angular templates, MIDI sources without a `src` URL, dynamic clip generation):

```typescript
editor.addTrack(config: TrackConfig, options?: EditorCallOptions): Promise<string>
editor.removeTrack(trackId: string): void
editor.updateTrack(trackId: string, partial: Partial<TrackConfig>): void
editor.addClip(trackId: string, config: ClipConfig, options?: EditorCallOptions): Promise<string> // returns clipId
editor.removeClip(trackId: string, clipId: string): void
editor.updateClip(trackId: string, clipId: string, partial: Partial<ClipConfig>): void

interface TrackConfig {
  name?: string;
  volume?: number;     // 0..1, default 1
  pan?: number;        // -1..1, default 0
  muted?: boolean;
  soloed?: boolean;
  clips?: ClipConfig[];  // omit for empty track
}

interface ClipConfig {
  src?: string;            // URL — fetched + decoded
  peaksSrc?: string;       // URL for .dat/.json peaks
  midiNotes?: MidiNoteData[]; // for MIDI/piano-roll tracks
  start?: number;          // seconds, default 0
  duration?: number;       // seconds, defaults to source length
  offset?: number;         // seconds, default 0
  gain?: number;           // 0..1+, default 1
  name?: string;
  fadeIn?: number;
  fadeOut?: number;
  fadeType?: FadeType;
}
```

Behavior contract — all methods go through the same path as a declared `<daw-track>` (#848): the track enters the editor's arrangement, which loads its audio, so that:

1. `<daw-track-controls>` shows the correct name/volume/pan/mute/solo (read from the arrangement, #848).
2. The waveform renders (peaks generated and cached in `_peaksData` as each clip loads).
3. Drag/trim/split work once a clip has loaded.
4. `daw-track-ready` / `daw-track-error` fire as the audio loads or fails.

`addTrack` adds the track to the arrangement played and creates no element (#848); it resolves with its track id once the track has entered. Change it with the id-keyed editor methods or `editor.arrangement`.

```javascript
// Plain audio
const trackId = await editor.addTrack({
  name: 'Drums',
  clips: [{ src: '/audio/drums.opus', start: 0 }],
});
// resolves once the track has entered, before its audio loads (#848)

// MIDI (no src, parsed notes provided directly)
await editor.addTrack({
  name: 'Synth',
  kind: 'midi',
  clips: [{ midiNotes: parsedNotes, start: 0, duration: 16 }],
});
```

### Drive tracks through `editor.arrangement`, not `editor.engine`

Since #848 the editor draws and lists what its arrangement holds and keeps no copy of it, so an app or an agent changes tracks through `editor.arrangement` (its `addTrack`, `updateTrack`, `moveClip`, mixer setters, `undo`, …) or the editor's methods, which are calls on it. `editor.arrangement.setTracks(...)` (or `editor.engine.setTracks`) replaces every track and clears the undo history; the tracks are drawn with the default render mode and have no element. Handing in a whole arrangement is `editor.arrangement = createArrangement({ tracks })`. Treat `editor.engine` as read-only from consumer code (analyzers, master taps, effect insertions on `editor.adapter.transport.masterOutputNode` are fine; the engine has no `masterOutputNode`).

### Backwards-compat surface

`editor.engine` remains exposed for power users who need to wire effects, taps, or analyzers (the master tap is `editor.adapter.masterOutputNode`, on the adapter, not on the engine). Mutation methods on the engine are out of scope for the documented Web Component API.

---

## File Drop

### Built-in Drop Zone

Enable with the `file-drop` attribute on `<daw-editor>`:

```html
<daw-editor file-drop>
  <daw-track src="/audio/drums.mp3" name="Drums"></daw-track>
</daw-editor>
```

Dropping audio files (`.mp3`, `.wav`, `.ogg`, `.flac`, etc.) creates one new track per file.

**MIDI files in `loadFiles()` is planned, not yet implemented (#492).** Today, drop a `.mid` via the file zone and it will fail at `AudioContext.decodeAudioData()`. Use `editor.loadMidi(file)` directly for MIDI input. See [MIDI Loading](#midi-loading).

### Programmatic File Loading

For custom drop zones, file pickers, or other UIs:

```typescript
editor.loadFiles(files: File[] | FileList, options?: EditorCallOptions): Promise<LoadFilesResult>

interface LoadFilesResult {
  loaded: string[];                                 // Successfully-loaded track IDs (audio only today)
  failed: Array<{ file: File; error: unknown }>;    // Per-file failures
}
```

```javascript
// Custom file picker
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'audio/*';
input.onchange = async () => {
  const { loaded, failed } = await editor.loadFiles(input.files);
  console.log('Loaded:', loaded, 'Failed:', failed);
};
input.click();

// MIDI files require a separate call today
const midiInput = document.createElement('input');
midiInput.type = 'file';
midiInput.accept = '.mid,.midi';
midiInput.onchange = async () => {
  const result = await editor.loadMidi(midiInput.files[0]);
  console.log('Loaded MIDI tracks:', result.trackIds);
};
```

**Planned (#492):** unify the two paths so a single `loadFiles()` call accepts mixed audio + MIDI input and routes by extension. Until that lands, callers branch on extension themselves.

### File Type Detection

`loadFiles()` skips a file whose MIME type is set and is not `audio/*` (reported with `daw-files-load-error`); a file with an empty type (`.opus` on some browsers) is passed to the decoder, and a file that does not decode is reported the same way. The browser's decoder is the most reliable detector of valid audio. For MIDI files, route through `editor.loadMidi()` instead.

```typescript
'daw-files-load-error'; // detail: {file: File, error: string}
```

```javascript
editor.addEventListener('daw-files-load-error', (e) => {
  console.warn('Failed to load', e.detail.file.name, ':', e.detail.error);
});
```

---

## Accessibility

> Tracked in epic #456 — not yet implemented. The 2026-06-11 audit found no ARIA roles, live region, or keyboard track navigation in the shipped elements; this section is the target behavior.

All elements render correct ARIA roles, labels, and states in their Shadow DOM automatically. Consumers can override `aria-label` on host elements.

### ARIA Roles & Semantics

**`<daw-editor>`:**

- `role="region"` — preserves standard screen reader browse-mode navigation
- `aria-label="Audio editor"` (default, overridable)
- `aria-roledescription="audio editor"`

**`<daw-track>`:**

- `role="group"`
- `aria-label` derived from `name` attribute (e.g., "Vocals")
- `aria-roledescription="audio track"`
- `aria-selected` reflects track selection state

**`<daw-clip>`:**

- `aria-hidden="true"` — clips are visual representations within the canvas, not keyboard-navigable in this phase

**Transport buttons** (`<daw-play-button>`, `<daw-stop-button>`, etc.):

- Render a native `<button>` in Shadow DOM
- `aria-label` set automatically ("Play", "Pause", "Stop", etc.)
- Toggle buttons (`<daw-loop-button>`, `<daw-mute-button>`, `<daw-solo-button>`, `<daw-record-button>`) — `aria-pressed` reflects toggle state

**`<daw-volume-slider>`, `<daw-pan-slider>`:**

- Render a native `<input type="range">` in Shadow DOM
- `aria-label` set automatically ("Volume", "Pan", or "Track Vocals volume")
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` reflect current range

**`<daw-time-display>`:**

- `role="status"`
- `aria-label="Playback time"`
- `aria-live="off"` — not announced every frame; screen reader users query on demand

**`<daw-vu-meter>`:**

- `role="meter"` (ARIA 1.2)
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` reflect current level
- `aria-label` set automatically (e.g., "Vocals level", "Master level")

**`<daw-selection-start>`, `<daw-selection-end>`:**

- Render native `<input>` in Shadow DOM
- `aria-label="Selection start time"` / `aria-label="Selection end time"`

**`<daw-tempo>`, `<daw-time-signature>`, `<daw-time-format>`, `<daw-snap-to>`, `<daw-scale-mode>`:**

- Render native `<input>` or `<select>` in Shadow DOM
- `aria-label` set automatically ("Tempo", "Time signature", "Time format", "Snap to", "Scale mode")

**`<daw-ruler>`, `<daw-playhead>`:**

- `aria-hidden="true"` — visual-only elements, screen readers skip them

**`<daw-annotation-track>` / `<daw-annotation>`:**

- Track: `role="list"`, annotations: `role="listitem"`
- `aria-label` from text content and time range (e.g., "First line, 0.0 to 2.5 seconds")
- `aria-selected` reflects active annotation state

### Keyboard Navigation

Arrow keys navigate between tracks when the editor has focus. Standard Tab order applies within track controls and transport.

| Key         | Action                                                           |
| ----------- | ---------------------------------------------------------------- |
| `ArrowUp`   | Focus previous track                                             |
| `ArrowDown` | Focus next track                                                 |
| `Tab`       | Move focus to next focusable element (controls, then next track) |
| `Shift+Tab` | Move focus backwards                                             |
| `Enter`     | Select focused track                                             |

**Note:** `Space` is reserved for play/pause (via `<daw-keyboard-shortcuts playback>`), not track selection. ArrowUp/Down for track navigation only applies when no `<daw-annotation-track keyboard-controls>` has an active selection — annotation shortcuts take priority per the [Keyboard Shortcuts](#keyboard-shortcuts) priority rule.

**Focus order within a track:**

1. Track itself (group)
2. Track controls slot (volume, pan, mute, solo — standard Tab order)
3. Next track

**Transport focus:** `<daw-transport>` children are standard buttons and inputs — native Tab order applies.

**Focus visibility:** All focusable elements render a visible focus indicator via `:focus-visible` in Shadow DOM, customizable via `::part(focus-ring)`:

```css
daw-track::part(focus-ring) {
  outline: 2px solid #63c75f;
  outline-offset: 2px;
}
```

### Live Region Announcements

`<daw-editor>` renders a visually hidden `aria-live="polite"` region in its Shadow DOM. Rapid state changes coalesce into a single announcement.

**Transport state:**

| Event        | Announcement                  |
| ------------ | ----------------------------- |
| Play         | "Playing"                     |
| Pause        | "Paused"                      |
| Stop         | "Stopped"                     |
| Record start | "Recording on Vocals, Guitar" |
| Record stop  | "Recording stopped"           |

**Track/clip operations:**

| Event                   | Announcement                        |
| ----------------------- | ----------------------------------- |
| Track selected          | "Track Vocals selected"             |
| Track added             | "Track Piano added"                 |
| Track removed           | "Track Piano removed"               |
| Track muted / unmuted   | "Vocals muted" / "Vocals unmuted"   |
| Track soloed / unsoloed | "Vocals soloed" / "Vocals unsoloed" |
| Clip split              | "Clip split at 5.2 seconds"         |
| Record armed            | "Vocals armed for recording"        |
| Loop enabled / disabled | "Loop enabled" / "Loop disabled"    |
| Zoom in / out           | "Zoom: 512 samples per pixel"       |

**Not announced** (query on demand):

- Time updates during playback (continuous, would be noisy)
- Selection changes (visual operation)

### Scope & Deferred Work

Clip drag, boundary trim, and waveform scrubbing remain mouse-only. Keyboard alternatives for pixel-level interactions are deferred to a future accessibility phase.

---

## Undo/Redo

### Scope

Edits to the track/clip document model and to the mix are undoable:

| Undoable                       | Not Undoable                              |
| ------------------------------ | ----------------------------------------- |
| Clip move (drop)               | Selection changes                         |
| Clip trim                      | Zoom                                      |
| Clip split                     | Loop region                               |
| Add/remove track               | Playback transport (play/pause/stop/seek) |
| Add/remove clip                | A take's mute on its track                |
| Volume, pan, mute, solo (#843) |                                           |

A mixer move is one step per gesture: one slider drag or key press in `<daw-track-controls>`, one Mute or Solo click, one `<daw-track>` attribute update, one `editor.updateTrack()` call (engine calls with one `{ gesture }` id are one step; `{ undoable: false }` is none). A take mutes the track it records onto without a step and without changing its stored mute (this is not the `record-armed` record-arm described above). Selection and zoom are navigation, not edits.

### Snapshot-Based Stack

Each undo step stores a frozen copy of `tracks[]` and the mix (by track id) before the operation. Undo restores the previous snapshot; redo re-applies the undone snapshot. No per-operation inverse logic — eliminates a class of bugs from incorrect reverse operations.

The stack has a fixed default limit of **100 steps**, set with the `undoLimit` option of `createArrangement()` (read back as `arrangement.undoLimit` or `engine.undoLimit`; `editor.undoLimit` is not implemented, #466). When the limit is reached, the oldest entry is dropped.

Any new structural edit clears the redo stack (standard behavior — you can't redo after making a new change). `clearHistory()` is called automatically when tracks are fully replaced via `setTracks()`, since old snapshots reference a different track set. `<daw-editor>` no longer calls `setTracks()` when a track loads (#848): loading never clears the history; the page's own `<daw-track>` elements that enter while it is empty are not steps.

### Transactions

`beginTransaction()` / `commitTransaction()` groups multiple mutations into a single undo step. One snapshot is captured at `beginTransaction()` and pushed to the stack at `commitTransaction()`.

**Primary use case: drag and drop.** The drag preview calls `moveClip()` on every tick, but only the final drop position should be an undo step:

```javascript
// In the drag handler (e.g., @dnd-kit/dom)
editor.addEventListener('daw-drag-start', () => {
  editor.engine.beginTransaction();
});

editor.addEventListener('daw-drag-end', () => {
  editor.engine.commitTransaction();
  // One undo step captures the net result
});
```

**Multi-step operations:** Transactions also group deliberate multi-step edits:

```javascript
// Split a clip and remove the left half — one undo step
editor.engine.beginTransaction();
editor.engine.splitClip(trackId, clipId, atSample);
editor.engine.removeClip(trackId, leftClipId);
editor.engine.commitTransaction();
```

**Cancellation:** `abortTransaction()` restores the pre-transaction snapshot without pushing to the undo stack. Used for cancelled drags (e.g., Escape key during drag):

```javascript
editor.addEventListener('daw-drag-cancel', () => {
  editor.engine.abortTransaction();
  // State restored, nothing added to undo stack
});
```

### Engine API

```typescript
engine.undo(): void               // Restore previous snapshot
engine.redo(): void               // Re-apply undone snapshot
engine.canUndo: boolean            // Has undo history
engine.canRedo: boolean            // Has redo history
engine.undoLimit: number           // Max stack size (default 100)
engine.clearHistory(): void        // Reset both stacks
engine.beginTransaction(): void    // Start grouping — snapshot captured
engine.commitTransaction(): void   // End grouping — push one step
engine.abortTransaction(): void    // Cancel — restore pre-transaction state
```

### Web Components API

`<daw-editor>` delegates to the engine:

```typescript
// Properties (read-only)
editor.canUndo: boolean
editor.canRedo: boolean

// Properties (read-write)
editor.undoLimit: number // not implemented (#466)

// Methods
editor.undo(): void
editor.redo(): void
editor.clearHistory(): void // not implemented (#466)
```

**Transport elements** (tracked in #466, with `daw-undo-state` and `editor.undoLimit`/`clearHistory()`):

`<daw-undo-button>` and `<daw-redo-button>` auto-wire to the editor via `<daw-transport for="...">`. They reflect disabled state based on `canUndo`/`canRedo`.

```html
<daw-transport for="my-editor">
  <daw-undo-button></daw-undo-button>
  <daw-redo-button></daw-redo-button>
  <daw-play-button></daw-play-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

**Keyboard shortcut preset:**

```html
<daw-editor>
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>
</daw-editor>
```

Default bindings:

- **Cmd/Ctrl+Z** — Undo
- **Cmd/Ctrl+Shift+Z** — Redo

Remappable via the `undoShortcuts` property:

```typescript
interface UndoShortcutMap {
  undo?: KeyBinding;
  redo?: KeyBinding;
}
```

### Events

- **`daw-tracks-change`** is not implemented (#468): today `editor.arrangement.subscribe(listener)` runs after every change, undo and redo included
- **`daw-undo-state`** (not implemented, #466; today read `editor.canUndo` / `editor.canRedo`) is to fire when `canUndo` or `canRedo` changes:

```typescript
'daw-undo-state'; // detail: {canUndo: boolean, canRedo: boolean}
```

```javascript
editor.addEventListener('daw-undo-state', (e) => {
  undoBtn.disabled = !e.detail.canUndo;
  redoBtn.disabled = !e.detail.canRedo;
});
```

Note: `<daw-undo-button>` and `<daw-redo-button>` (also #466) are to handle this automatically — the event is for custom UI.

### Live Region Announcements

| Action | Announcement |
| ------ | ------------ |
| Undo   | "Undo"       |
| Redo   | "Redo"       |

---

## Framework Usage

All frameworks just need `import '@dawcore/components'` to register the custom elements. No wrapper packages needed.

The samples show the design: on `<daw-editor>`, `daw-ready` and `daw-tracks-change` are not implemented yet (#468), nor is the `record-armed` attribute of `<daw-track>` (#469).

### Vanilla JS

```html
<script type="module">
  import '@dawcore/components';

  const editor = document.querySelector('daw-editor');
  editor.addEventListener('daw-ready', () => console.log('loaded'));
  editor.addEventListener('daw-recording-start', (e) => {
    console.log('recording', e.detail.trackId);
  });

  document.querySelector('#play').addEventListener('click', () => {
    editor.play();
  });
</script>

<button id="play">Play</button>
<daw-editor id="my-editor" samples-per-pixel="1024" wave-height="128" timescale>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed></daw-track>
</daw-editor>
```

### React 19+

React 19+ has native Custom Elements interop — properties are set directly (not stringified to attributes) and custom events work via `onEventName` props. No wrapper package needed. React 18 is not supported.

```tsx
import '@dawcore/components';

function App() {
  const editorRef = useRef<DawEditorElement>(null);

  return (
    <>
      <button onClick={() => editorRef.current?.play()}>Play</button>
      <daw-editor
        ref={editorRef}
        samplesPerPixel={1024}
        waveHeight={128}
        timescale
        onDawReady={() => console.log('loaded')}
        onDawTracksChange={(e) => console.log(e.detail.tracks)}
        onDawRecordingStart={(e) => console.log('recording', e.detail.trackId)}
      >
        <daw-track src="/audio/vocals.mp3" name="Vocals" />
        <daw-track src="/audio/guitar.mp3" name="Guitar" recordArmed />
      </daw-editor>
    </>
  );
}
```

**JSX type declarations** (not implemented, #486 in epic #458) are to ship inside `@dawcore/components` so TypeScript knows the valid attributes:

```typescript
// @dawcore/components/jsx.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'daw-editor': DawEditorAttributes & React.HTMLAttributes<DawEditorElement>;
    'daw-track': DawTrackAttributes & React.HTMLAttributes<DawTrackElement>;
    'daw-transport': DawTransportAttributes & React.HTMLAttributes<HTMLElement>;
    // ... all elements
  }
}
```

### Vue 3

```vue
<template>
  <button @click="play">Play</button>
  <daw-editor
    ref="editorRef"
    :samples-per-pixel="1024"
    :wave-height="128"
    timescale
    @daw-ready="onReady"
    @daw-tracks-change="onTracksChange"
    @daw-recording-start="onRecord"
  >
    <daw-track src="/audio/vocals.mp3" name="Vocals" />
    <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed />
  </daw-editor>
</template>

<script setup>
import '@dawcore/components';
import { ref } from 'vue';

const editorRef = ref(null);
function play() {
  editorRef.value?.play();
}
function onReady() {
  console.log('loaded');
}
function onTracksChange(e) {
  console.log(e.detail.tracks);
}
function onRecord(e) {
  console.log('recording', e.detail.trackId);
}
</script>
```

One config line tells the Vue compiler which tags are custom elements:

```typescript
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('daw-') } } });
```

### Svelte

```svelte
<script>
  import '@dawcore/components';

  let editorEl;
</script>

<button on:click={() => editorEl?.play()}>Play</button>
<daw-editor
  bind:this={editorEl}
  samplesPerPixel={1024}
  waveHeight={128}
  timescale
  on:daw-ready={() => console.log('loaded')}
  on:daw-tracks-change={(e) => console.log(e.detail.tracks)}
  on:daw-recording-start={(e) => console.log('recording', e.detail.trackId)}
>
  <daw-track src="/audio/vocals.mp3" name="Vocals" />
  <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed />
</daw-editor>
```

No configuration needed — Svelte treats unknown tags as custom elements automatically.

### Angular

```typescript
// app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

```html
<!-- app.component.html -->
<button (click)="play()">Play</button>
<daw-editor
  #editor
  [attr.samples-per-pixel]="1024"
  [attr.wave-height]="128"
  timescale
  (daw-ready)="onReady()"
  (daw-tracks-change)="onTracksChange($event)"
  (daw-recording-start)="onRecord($event)"
>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed></daw-track>
</daw-editor>
```

### Framework Compatibility

| Framework  | Properties       | Custom Events        | Config Needed            | Extra Types                       |
| ---------- | ---------------- | -------------------- | ------------------------ | --------------------------------- |
| Vanilla JS | `.property =`    | `addEventListener()` | None                     | None                              |
| React 19+  | Native           | `onDawReady`         | None                     | JSX `IntrinsicElements` (shipped) |
| Vue 3      | `:prop` binding  | `@event`             | `isCustomElement`        | Optional Volar types              |
| Svelte     | `prop={value}`   | `on:event`           | None                     | None                              |
| Angular    | `[prop]` binding | `(event)`            | `CUSTOM_ELEMENTS_SCHEMA` | None                              |

---

## Migration Phases

Checklists updated against the 2026-06-11 code audit. Open items link to their tracking issues.

### Phase 1: Foundation

Create `@dawcore/components` package with core elements:

- [x] `<daw-editor>` — engine lifecycle, track management (adapter-pluggable, #378)
- [x] `<daw-track>` — track declaration via attributes
- [x] `<daw-clip>` — clip element with src/peaks-src, positioning (fades captured but not yet applied — #489)
- [x] Resource cache — URL-keyed dedup for AudioBuffer and peaks across clips
- [x] `<daw-waveform>` — chunked canvas waveform rendering with virtual scrolling
- [x] `<daw-playhead>` — animated playhead
- [x] `<daw-ruler>` — time ruler (virtual scrolling pending — #490)
- [x] CSS custom properties theme system
- [x] Playback: play/pause/stop/seek via element methods
- [x] Recording core: start/stop/pause/resume via editor methods, worklet capture, live waveform preview (arming surface — epic #453)
- [x] Custom events for state changes (recording/track/clip/effect events; `daw-timeupdate` — #459; not yet: `daw-ready` and `daw-tracks-change` on the editor — #468, `daw-record-arm` — #469)
- [ ] Accessibility — ARIA roles/labels, keyboard track navigation, live region, focus indicators → **epic #456**
- [x] `<daw-player>` — lightweight single-track HTMLMediaElement player → core done (#473); follow-ups: effects (#475), `<daw-playback-rate>` (#476), transport-compat tests (#474), annotations (#477)
- [ ] `<daw-playback-rate>` — playback speed transport element → #476

### Phase 2: Interactions

- [x] Clip drag — native pointer handlers (decision: no @dnd-kit/dom; see Drag & Drop)
- [x] Clip trimming (boundary drag)
- [x] Clip splitting (keyboard shortcut)
- [x] Selection (click + drag on timeline)
- [x] Track selection
- [x] `<daw-transport>` with play/pause/stop/record buttons (remaining button elements — **epic #452**)
- [x] `<daw-keyboard-shortcuts>` — playback/splitting/undo presets, custom shortcuts, key remapping
- [x] File drop — `file-drop` attribute, `loadFiles()` method (MIDI routing — #492)
- [x] Undo/redo — snapshot stack, transactions, keyboard preset (`<daw-undo-button>` / `<daw-redo-button>` + `daw-undo-state` — #466)

### Phase 3: Track Controls

- [x] Track mixing — shipped as the composite `<daw-track-controls>` strip (individual `<daw-volume-slider>` / `<daw-pan-slider>` / `<daw-mute-button>` / `<daw-solo-button>` + `slot="controls"` — **epic #457**; theming vars — #493)
- [ ] `<daw-vu-meter>` → #472
- [ ] `<daw-rewind-button>` / `<daw-fast-forward-button>` → #460
- [ ] `<daw-loop-button>` + editor loop API → #461
- [ ] `<daw-zoom-in>` / `<daw-zoom-out>` → #462
- [x] `<daw-time-display>` / `<daw-time-format>` → #459
- [ ] `<daw-selection-start>` / `<daw-selection-end>` → #463
- [ ] `<daw-tempo>` / `<daw-time-signature>` → #464
- [ ] `<daw-snap-to>` / `<daw-scale-mode>` → #465
- [ ] Master `<daw-volume-slider>` + `setMasterVolume()` → #467
- [x] Effects — imperative API on `<daw-editor>` (master) and `<daw-track>` (per-track)
- [x] Effect registry — native built-ins + `registerEffect()` + WAM/Faust plugins (decision: replaces the `tonejs-*` plan; epics #412–#414)
- [x] Effect bypass, reorder, real-time parameter updates, state persistence
- [x] `exportAudio()` — offline rendering through all effect chains (incl. WAM)

### Phase 4: Optional Features

- [x] `<daw-annotation-track>`, `<daw-annotation>`, `<daw-annotation-list>` → **epic #455**
- [x] Annotation keyboard controls → #480
- [x] Spectrogram render mode (`split` → #491)
- [x] Spectrogram config — editor global + track override, lazy worker pool
- [x] `editor.loadMidi()` — multi-track MIDI loading with cleanup-on-failure
- [x] Piano-roll rendering — MIDI tracks (`kind="midi"`), `clip.midiNotes`
- [x] Piano-roll theming via CSS custom properties
- [ ] Loop region UI → #461

### Phase 5: React 19+ & JSX Types → **epic #458**

- [ ] JSX `IntrinsicElements` type declarations + `HTMLElementTagNameMap` → #486
- [ ] Custom Elements Manifest generation → #487
- [ ] React 19+ example app verifying native Custom Elements interop → #488
- ~~Storybook stories~~ — dropped (decision 2026-06-11): the examples apps and website demos serve the catalog role

### Phase 6: Documentation & Migration Guide

- [x] Getting-started page (`website/docs/web-components/getting-started.md`) + `examples/dawcore-native`, `examples/dawcore-tone`, `examples/dawcore-wam` apps
- [ ] Full Web Components docs (API reference per element, React ↔ WC guide) — carried by the docs IA-restructure plan (Phase 4, "WC integration")
- [ ] Website at dawcore.com — deferred with the repo transfer (see Open Questions)
- ~~Storybook for component catalog~~ — dropped (see Phase 5)

---

## Build & Tooling

| Concern         | Approach                                                                                |
| --------------- | --------------------------------------------------------------------------------------- |
| **Build**       | tsup (same as current packages)                                                         |
| **Types**       | TypeScript; Custom Elements Manifest planned (#487)                                     |
| **CSS**         | CSS custom properties + `::part()` (part exposure tracked in #494)                      |
| **Testing**     | Vitest + happy-dom                                                                      |
| **Drag & Drop** | Native pointer events (`PointerHandler` / `ClipPointerHandler`) — @dnd-kit/dom not used |
| **Docs**        | Docusaurus (existing website)                                                           |

Storybook was dropped from the plan (decision 2026-06-11).

---

## React ↔ Web Components API Map

The React packages are **not** being replaced — both surfaces coexist (see Package Landscape). This table maps React APIs to their Web Components equivalents for consumers moving between them:

| React (`@waveform-playlist/*`)                     | Web Components (`@dawcore/*`)                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@waveform-playlist/browser` (React)               | `@dawcore/components` (Web Components)                                        |
| `@waveform-playlist/ui-components` (React)         | Merged into `@dawcore/components`                                             |
| `WaveformPlaylistProvider` (React context)         | `<daw-editor>` element                                                        |
| `usePlaybackControls()`, `useEditorControls()`     | `element.play()`, `element.stop()`, etc.                                      |
| `useIsPlaying()`                                   | `element.isPlaying`                                                           |
| `useSelection()`                                   | `element.selection`                                                           |
| `useCurrentTime()`                                 | `element.currentTime`                                                         |
| `usePlaylistTimeline()`                            | `element.tracks`, `element.duration`, etc.                                    |
| `usePlaybackRefs()` (frame callbacks)              | `daw-timeupdate` event                                                        |
| `arrangement.subscribe()` / `useArrangementTracks()` | `editor.arrangement.subscribe()`                                              |
| styled-components theme                            | CSS custom properties                                                         |
| `@dnd-kit/react`                                   | native pointer events (no `@dnd-kit/dom`, see Drag & Drop)                    |
| `useDynamicEffects()` / `useTrackDynamicEffects()` | `editor.addEffect()` / `track.addEffect()` (imperative)                       |
| `SpectrogramProvider` (React context)              | `render-mode="spectrogram"` attribute + `spectrogramConfig` property          |
| `loadMidiTracks()` function                        | `editor.loadMidi()` method                                                    |
| `<KeyboardShortcuts>` (React component)            | `<daw-keyboard-shortcuts>` element                                            |
| `useAnnotationKeyboardControls()` hook             | `<daw-annotation-track keyboard-controls>` attribute                          |
| `arrangement.addTrack(audioTrack({ src: file }))`  | `editor.loadFiles()` method + `file-drop` attribute                           |
| `useUndoRedo()` hook                               | `engine.undo()` / `engine.redo()` + `<daw-undo-button>` / `<daw-redo-button>` (not implemented, #466) |
| `MediaElementPlaylistProvider` (React context)     | `<daw-player>` element                                                        |
| `usePlaybackControls()` under that provider        | `player.play()`, `player.pause()`, etc.                                       |

React 19+ users consume `@dawcore/components` directly in JSX — no wrapper package needed. React 18 is not supported.

---

## Open Questions

1. **Lit or vanilla?** — Decided: **Lit**. Adds ~6KB but provides reactive properties, efficient re-rendering, and `@property` decorators. Reduces boilerplate significantly compared to vanilla `HTMLElement` subclasses. Well-maintained by Google, widely adopted, and has first-class Storybook support.
2. **Custom Elements Manifest** — Decided: **yes**. Generate with `@custom-elements-manifest/analyzer` from Lit source. Provides IDE autocomplete (VS Code suggests attributes in HTML) and machine-readable API docs. No manual maintenance — reads `@property()` decorators and JSDoc automatically. Implementation tracked in #487.
3. **Development strategy** — Superseded: the long-lived `feat/dawcore` branch was never used. Development happens via short-lived feature branches merged to `main` as each lands; `@dawcore/*` packages publish 0.x versions from `main` while the React surface continues uninterrupted.
4. **Repo migration** — Deferred. Develop and publish `@dawcore/*` packages from the existing `naomiaro/waveform-playlist` repo for now. Transfer to `dawcore` org later if desired — GitHub's transfer ownership preserves stars, watchers, forks, issues, PRs, and redirects old URLs.
