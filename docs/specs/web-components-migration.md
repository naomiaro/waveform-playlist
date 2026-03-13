# Web Components Migration Spec

Migrate to native Web Components under the **dawcore** brand, making the library truly framework-agnostic — works with vanilla JS, React 19+, Vue, Svelte, Angular, or any framework that supports Custom Elements.

**Status:** Draft
**Target:** dawcore 1.0.0
**npm:** `@dawcore/*`
**GitHub:** [github.com/dawcore](https://github.com/dawcore)

---

## Motivation

- **Framework-agnostic** — usable in vanilla JS, Lit, Svelte, Vue, Angular, or React without adapters
- **Smaller bundle** — no React/ReactDOM/styled-components runtime dependency
- **Web standard** — Custom Elements, Shadow DOM, and CSS Parts are supported in all modern browsers
- **Ecosystem alignment** — WAM plugins, Storybook, and @dnd-kit/dom all support Web Components natively
- **Simpler API** — HTML elements with attributes, properties, methods, and events

---

## Current Package Landscape

### Zero Changes Needed (already framework-agnostic)

| Package | What It Does |
|---------|-------------|
| `core` | Types, utilities, clip/track creation |
| `engine` | PlaylistEngine, pure operations, PlayoutAdapter interface |
| `playout` | Tone.js adapter, AudioContext management, ToneTrack |
| `worklets` | AudioWorklet processors (metering, recording) |
| `webaudio-peaks` | Peak extraction from AudioBuffer |
| `loaders` | Audio file loaders |
| `media-element-playout` | HTMLMediaElement-based playout |

### Need Web Components Rewrite

| Package | React Surface | Framework-Agnostic Parts |
|---------|--------------|------------------------|
| `ui-components` | 38 React components, styled-components, theme contexts | Theme types, peak rendering utilities |
| `browser` | Providers, hooks, components | Modifiers (SnapToGrid, ClipCollision), data loaders |
| `recording` | 4 hooks (useRecording, useMicrophoneAccess, etc.) | Utility functions (generatePeaks, createAudioBuffer) |
| `annotations` | Components, provider | parseAeneas(), serializeAeneas() |
| `spectrogram` | Components, provider | computeSpectrogram(), worker pool, color maps |
| `midi` | useMidiTracks hook | parseMidiFile(), parseMidiUrl() |

---

## Target Architecture

### New Packages

| Package | Description |
|---------|-------------|
| `@dawcore/components` | Web Components UI layer — Custom Elements with Shadow DOM. Includes JSX type declarations for React 19+. |

### Renamed Packages (framework-agnostic, scope change only)

| Current | New |
|---------|-----|
| `@waveform-playlist/core` | `@dawcore/core` |
| `@waveform-playlist/engine` | `@dawcore/engine` |
| `@waveform-playlist/playout` | `@dawcore/playout` |
| `@waveform-playlist/worklets` | `@dawcore/worklets` |
| `@waveform-playlist/webaudio-peaks` | `@dawcore/webaudio-peaks` |
| `@waveform-playlist/loaders` | `@dawcore/loaders` |
| `@waveform-playlist/media-element-playout` | `@dawcore/media-element-playout` |

### Replaced Packages

| Current | Replaced By |
|---------|------------|
| `@waveform-playlist/ui-components` (React + styled-components) | `@dawcore/components` (Web Components + CSS) |
| `@waveform-playlist/browser` (React providers + hooks) | `@dawcore/components` (elements + events) |

### Optional Packages (migrated)

| Current | New |
|---------|-----|
| `@waveform-playlist/recording` | `@dawcore/recording` |
| `@waveform-playlist/annotations` | `@dawcore/annotations` |
| `@waveform-playlist/spectrogram` | `@dawcore/spectrogram` |
| `@waveform-playlist/midi` | `@dawcore/midi` |

Extract framework-agnostic logic, add Web Component wrappers.

---

## Custom Elements

### Core Elements

```html
<!-- Minimal setup -->
<daw-editor
  id="my-editor"
  samples-per-pixel="1024"
  wave-height="128"
  timescale
>
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

| Element | Wraps | Responsibilities |
|---------|-------|-----------------|
| `<daw-editor>` | PlaylistEngine + ToneAdapter | Root element. Manages engine, audio context, tracks, state. |
| `<daw-track>` | Track state | Declares a track. Contains `<daw-clip>` children. Attributes: `name`, `volume`, `pan`, `muted`, `soloed`, `record-armed`, `input-device`, `render-mode`. `src` is shorthand for a track with a single implicit clip. |
| `<daw-clip>` | AudioClip | Audio or MIDI clip within a track. Attributes: `src`, `peaks-src`, `start`, `duration`, `offset`, `gain`, `name`, `color`, `fade-in`, `fade-out`, `fade-type`. Multiple clips sharing the same `src` share one decoded AudioBuffer. |
| `<daw-waveform>` | Canvas rendering | Waveform visualization. Renders peaks to canvas. |
| `<daw-transport>` | Transport controls container | Groups transport buttons, links to an editor via `for` attribute. |
| `<daw-play-button>` | play() | Triggers playback. If recording is armed, starts overdub recording simultaneously. |
| `<daw-pause-button>` | pause() | Pauses playback and recording. |
| `<daw-stop-button>` | stop() | Stops playback and recording. Finalizes any in-progress recording into a new clip. |
| `<daw-record-button>` | record() | Arms/starts recording on all armed tracks. When clicked during stop, arms the selected track (or first track). When clicked during play, starts overdub on armed tracks. |
| `<daw-rewind-button>` | seekTo(0) | Rewinds playhead to the start of the timeline. |
| `<daw-fast-forward-button>` | seekTo(duration) | Jumps playhead to the end of the timeline. |
| `<daw-loop-button>` | toggleLoop() | Toggles loop playback for the current selection. Reflects `aria-pressed` state. |
| `<daw-time-display>` | currentTime | Shows formatted playback time. |
| `<daw-selection-start>` | setSelection() | Editable input showing selection start time. Updates selection on change. |
| `<daw-selection-end>` | setSelection() | Editable input showing selection end time. Updates selection on change. |
| `<daw-time-format>` | setTimeFormat() | Select for time display format (`hh:mm:ss.sss`, `hh:mm:ss`, `seconds`). Affects time display and selection inputs. |
| `<daw-tempo>` | setBpm() | Editable BPM input. Reflects current tempo. Drives `BeatsAndBarsProvider` bpm, metronome, and musical time formats. |
| `<daw-time-signature>` | setTimeSignature() | Editable time signature (e.g., `4/4`, `3/4`, `6/8`). Drives `BeatsAndBarsProvider` timeSignature, ruler subdivisions, and snap grid. |
| `<daw-snap-to>` | setSnapTo() | Select for snap granularity (`bar`, `beat`, `off`). Controls clip drag/trim snapping. |
| `<daw-scale-mode>` | setScaleMode() | Select for ruler display mode (`beats`, `temporal`). Switches between bar:beat and minutes:seconds ruler. |
| `<daw-zoom-in>` | zoomIn() | Zoom in button. Disabled when at maximum zoom. |
| `<daw-zoom-out>` | zoomOut() | Zoom out button. Disabled when at minimum zoom. |
| `<daw-undo-button>` | undo() | Undo last structural edit. Auto-disables when `canUndo` is false. |
| `<daw-redo-button>` | redo() | Redo last undone edit. Auto-disables when `canRedo` is false. |
| `<daw-playback-rate>` | setPlaybackRate() | Playback speed control. Works with both `<daw-editor>` and `<daw-player>`. |
| `<daw-player>` | HTMLMediaElement | Lightweight single-track player. Uses `<audio>` element internally — no Tone.js, no engine. Supports waveform, transport, annotations, and optional effects. |
| `<daw-mute-button>` | mute toggle | Dispatches `daw-mute` event. Auto-wires to parent `<daw-track>` via `closest()`. Reflects `aria-pressed` state. |
| `<daw-solo-button>` | solo toggle | Dispatches `daw-solo` event. Auto-wires to parent `<daw-track>`. Reflects `aria-pressed` state. |
| `<daw-volume-slider>` | setTrackVolume() / setMasterVolume() | Volume control. When inside a `<daw-track>`, controls that track. When inside `<daw-transport>`, controls master volume. |
| `<daw-pan-slider>` | setTrackPan() | Per-track pan control. |
| `<daw-vu-meter>` | Meter worklet | Level metering (replaces SegmentedVUMeter). |
| `<daw-ruler>` | Time ruler | Renders time ruler above tracks. |
| `<daw-playhead>` | Playhead | Animated playhead line. |
| `<daw-keyboard-shortcuts>` | Keyboard handler | Render-less element inside `<daw-editor>`. Boolean attributes: `playback`, `splitting`, `undo`. Properties: `customShortcuts`, `playbackShortcuts`, `splittingShortcuts`, `undoShortcuts` (key remapping), `shortcuts` (read-only, all active). |

### Multi-Track Record Arming

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
tracks[1].arm();                    // Default mic
tracks[2].arm('specific-device-id'); // Specific mic

// Check armed state
console.log(editor.armedTrackIds);  // ['track-2', 'track-3']
console.log(editor.isRecordArmed);  // true

// Listen for recording events
editor.addEventListener('daw-record', (e) => {
  console.log('Recording on tracks:', e.detail.trackIds);
});

editor.addEventListener('daw-record-stop', (e) => {
  console.log('Recorded clips:', e.detail.clips);
  // Each clip includes the trackId it was recorded on
});

// Disarm all
editor.armedTrackIds.forEach(id => {
  editor.querySelector(`daw-track[id="${id}"]`).disarm();
});
```

### Optional Elements

| Element | Package | Responsibilities |
|---------|---------|-----------------|
| `<daw-annotation-track>` | annotations | Timeline row containing draggable annotation boxes. Children are `<daw-annotation>` elements. Attributes: `editable`, `link-endpoints`, `continuous-play`. |
| `<daw-annotation>` | annotations | Single annotation with `start`, `end` attributes and text content. Renders as a box in the track. |
| `<daw-annotation-list>` | annotations | Scrollable text panel. Links to a `<daw-annotation-track>` via `for` attribute — no duplicate data. |

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

Spectrogram and piano-roll are render modes on `<daw-track>` (via the `render-mode` attribute), not standalone elements. See the [Spectrogram & Piano-Roll](#spectrogram--piano-roll) section.

---

## Properties, Attributes & Events

### `<daw-editor>` API

**Attributes (reflected):**
```
samples-per-pixel    Number    1024     Zoom level
wave-height          Number    128      Track height in px
timescale            Boolean   false    Show time ruler
mono                 Boolean   false    Mono waveform rendering
automatic-scroll     Boolean   false    Follow playhead
indefinite-playback  Boolean   false    Play past end of audio
bar-width            Number    1        Waveform bar width
bar-gap              Number    0        Waveform bar gap
show-clip-headers    Boolean   false    Show clip name headers
file-drop            Boolean   false    Accept dropped audio/MIDI files
```

**Properties (JS only):**
```typescript
editor.tracks: ClipTrack[]           // Current track state
editor.isPlaying: boolean            // Playback state
editor.isRecording: boolean          // Recording state (any track recording)
editor.armedTrackIds: string[]       // Track IDs with record-armed attribute
editor.isRecordArmed: boolean        // Derived: armedTrackIds.length > 0
editor.currentTime: number           // Current playback time
editor.duration: number              // Total duration
editor.selection: {start, end}       // Selection range
editor.selectedTrackId: string|null  // Selected track
editor.theme: DawcoreTheme           // Theme object
editor.effects: EffectState[]        // Read-only. Master effects chain: [{id, type, params, bypassed}, ...]
editor.spectrogramConfig: SpectrogramConfig | null  // Global spectrogram defaults (null = built-in defaults)
editor.canUndo: boolean              // Has undo history
editor.canRedo: boolean              // Has redo history
editor.undoLimit: number             // Max undo steps (default 100)
editor.engine: PlaylistEngine        // Direct engine access
```

**Methods:**
```typescript
editor.play(startTime?, duration?): Promise<void>  // Starts overdub if record is armed
editor.pause(): void                               // Pauses both playback and recording
editor.stop(): void                                // Stops both, finalizes recording to clip
editor.record(): Promise<void>                     // Starts recording on all armed tracks
editor.armTrack(trackId: string, deviceId?: string): Promise<void>  // Arm a track
editor.disarmTrack(trackId: string): void           // Disarm a track
editor.seekTo(time: number): void
editor.setSelection(start: number, end: number): void
editor.setTrackVolume(trackId: string, volume: number): void
editor.setTrackPan(trackId: string, pan: number): void
editor.setTrackMute(trackId: string, muted: boolean): void
editor.setTrackSolo(trackId: string, soloed: boolean): void
editor.zoomIn(): void
editor.zoomOut(): void
editor.setMasterVolume(volume: number): void
editor.addTrack(config: TrackConfig): DawTrackElement   // Add track, returns element
editor.removeTrack(trackId: string): void              // Remove track by ID
editor.setTimeFormat(format: string): void             // 'hh:mm:ss.sss' | 'hh:mm:ss' | 'seconds'
editor.setAutomaticScroll(enabled: boolean): void      // Toggle auto-scroll
editor.setBpm(bpm: number): void                       // Set tempo
editor.setTimeSignature(numerator: number, denominator: number): void
editor.setSnapTo(snap: string): void                   // 'bar' | 'beat' | 'off'
editor.setScaleMode(mode: string): void                // 'beats' | 'temporal'
editor.setLoopEnabled(enabled: boolean): void          // Toggle loop playback
editor.setLoopRegion(start: number, end: number): void // Set loop boundaries
// Effects (master chain)
editor.addEffect(type: string, params?: Record<string, number>): string  // Returns effectId
editor.removeEffect(effectId: string): void
editor.setEffectParams(effectId: string, params: Record<string, number>): void
editor.setEffectBypassed(effectId: string, bypassed: boolean): void
editor.moveEffect(effectId: string, newIndex: number): void
// Offline rendering
editor.exportAudio(options?: ExportOptions): Promise<AudioBuffer>
// MIDI loading
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>
// Undo/redo
editor.undo(): void
editor.redo(): void
editor.clearHistory(): void
// File loading (audio + MIDI auto-detection)
editor.loadFiles(files: File[] | FileList, options?: LoadFilesOptions): Promise<LoadFilesResult>
```

**Events:**
```typescript
'daw-ready'         // All tracks loaded
'daw-play'          // Playback started
'daw-pause'         // Playback paused
'daw-stop'          // Playback stopped
'daw-record'        // Recording started: detail: {trackIds: string[]}
'daw-record-stop'   // Recording stopped: detail: {trackIds: string[], clips: ClipInfo[]}
'daw-record-arm'    // Track armed/disarmed: detail: {trackId, armed, armedTrackIds}
'daw-timeupdate'    // Playback time changed (RAF)
'daw-selection'     // Selection changed: detail: {start, end}
'daw-track-select'  // Track selected: detail: {trackId}
'daw-tracks-change' // Tracks mutated (move/trim/split): detail: {tracks}
'daw-zoom'          // Zoom changed: detail: {samplesPerPixel}
// Effect events (bubble from <daw-track> for per-track, dispatched on <daw-editor> for master)
'daw-effect-add'     // Effect added: detail: {effectId, type, params, index}
'daw-effect-remove'  // Effect removed: detail: {effectId}
'daw-effect-change'  // Params updated: detail: {effectId, params}
'daw-effect-bypass'  // Bypass toggled: detail: {effectId, bypassed}
'daw-effect-reorder' // Effect moved: detail: {effectId, fromIndex, toIndex}
// Spectrogram
'daw-spectrogram-ready' // Visible viewport FFT complete: detail: {trackId}
// Undo/redo
'daw-undo-state'        // canUndo/canRedo changed: detail: {canUndo, canRedo}
// File loading
'daw-files-load-error'  // Decode/parse failed: detail: {file: File, error: string}
```

### `<daw-track>` API

**Attributes (reflected):**
```
src              String    —        Audio source URL
name             String    —        Track display name
volume           Number    1        Track volume (0–1)
pan              Number    0        Stereo pan (-1 to 1)
muted            Boolean   false    Track is muted
soloed           Boolean   false    Track is soloed
record-armed     Boolean   false    Track is armed for recording
input-device     String    —        MediaDeviceInfo.deviceId for mic input
render-mode      String    waveform 'waveform' | 'spectrogram' | 'split' | 'piano-roll'
```

**Properties (JS only):**
```typescript
track.recordArmed: boolean       // Reflects record-armed attribute
track.inputDevice: string|null   // Reflects input-device attribute
track.renderMode: string         // Reflects render-mode attribute
track.isRecording: boolean       // Read-only: currently recording (armed + editor.isRecording)
track.inputStream: MediaStream   // Read-only: active mic stream when recording
track.effects: EffectState[]     // Read-only. Per-track effects chain: [{id, type, params, bypassed}, ...]
track.spectrogramConfig: SpectrogramConfig | null  // Per-track override (null = inherit from editor)
```

**Methods:**
```typescript
track.arm(deviceId?: string): Promise<void>   // Arm for recording, request mic access
track.disarm(): void                          // Disarm, release mic stream
// Effects (per-track chain) — same API as editor master chain
track.addEffect(type: string, params?: Record<string, number>): string  // Returns effectId
track.removeEffect(effectId: string): void
track.setEffectParams(effectId: string, params: Record<string, number>): void
track.setEffectBypassed(effectId: string, bypassed: boolean): void
track.moveEffect(effectId: string, newIndex: number): void
```

When `arm()` is called without a `deviceId`, it uses the default input device. The method requests mic permission via `getUserMedia()` and stores the stream for use when recording starts. Calling `arm()` on an already-armed track with a different `deviceId` switches the input device.

### `<daw-clip>` API

**Attributes (reflected):**
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
clip.audioBuffer: AudioBuffer | null        // Decoded audio (set after load, or programmatically)
clip.waveformData: WaveformDataObject | null // BBC peaks data
clip.midiNotes: MidiNoteData[] | null        // Parsed MIDI notes
```

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
  <daw-clip src="/audio/chorus.mp3" start="0" duration="8"
            fade-in="0.5" fade-out="1.0" fade-type="sCurve">
  </daw-clip>
  <daw-clip src="/audio/chorus.mp3" start="20" duration="8">
  </daw-clip>
  <daw-clip src="/audio/chorus.mp3" start="40" duration="4"
            offset="2.0" fade-in="0.3">
  </daw-clip>
</daw-track>

<!-- Pre-computed peaks for large files (render before decode) -->
<daw-track name="Full Mix">
  <daw-clip src="/audio/full-mix.mp3" peaks-src="/peaks/full-mix.dat">
  </daw-clip>
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
```

`editable`, `link-endpoints`, and `continuous-play` map directly to `AnnotationListOptions` from `@waveform-playlist/core`. `keyboard-controls` enables keyboard shortcuts for annotation navigation and boundary editing (see [Keyboard Shortcuts](#keyboard-shortcuts)).

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

### `<daw-player>` API

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
automatic-scroll Boolean   false    Follow playhead
playback-rate    Number    1        Playback speed (0.25–4.0)
```

**Properties (JS only):**
```typescript
player.isPlaying: boolean            // Read-only: playback state
player.currentTime: number           // Current playback position (seconds)
player.duration: number              // Read-only: total duration (seconds)
player.volume: number                // Volume (0–1)
player.effects: EffectState[]        // Read-only: effects chain
player.audioElement: HTMLAudioElement // Read-only: underlying <audio> element
player.theme: DawcoreTheme           // Theme object
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
player.addEffect(type: string, params?: Record<string, number>): string
player.removeEffect(effectId: string): void
player.setEffectParams(effectId: string, params: Record<string, number>): void
player.setEffectBypassed(effectId: string, bypassed: boolean): void
player.moveEffect(effectId: string, newIndex: number): void
```

**Events:**
```typescript
'daw-ready'       // Audio metadata loaded, waveform rendered
'daw-play'        // Playback started
'daw-pause'       // Playback paused
'daw-stop'        // Playback stopped (reset to 0)
'daw-timeupdate'  // Playback time changed (RAF)
'daw-ended'       // Playback reached end of audio
```

**AudioContext lifecycle:** The player uses `HTMLMediaElement` directly — no AudioContext needed for basic playback. When the first effect is added via `addEffect()`, the player lazily creates an AudioContext, connects the `<audio>` element through a `MediaElementAudioSourceNode`, routes through the effects chain, and connects to the destination. This means zero Web Audio overhead for simple playback use cases.

**Children:** `<daw-player>` accepts `<daw-annotation-track>` and `<daw-annotation>` children for lyric display, chapter markers, or transcription overlays.

```html
<!-- Simple player -->
<daw-player src="/audio/episode-42.mp3" wave-height="80" timescale></daw-player>

<!-- Player with transport controls -->
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

| Element | `<daw-editor>` | `<daw-player>` | Notes |
|---------|:-:|:-:|-------|
| `<daw-play-button>` | Yes | Yes | |
| `<daw-pause-button>` | Yes | Yes | |
| `<daw-stop-button>` | Yes | Yes | |
| `<daw-rewind-button>` | Yes | Yes | |
| `<daw-fast-forward-button>` | Yes | Yes | |
| `<daw-time-display>` | Yes | Yes | |
| `<daw-volume-slider>` | Yes | Yes | Master volume in transport context |
| `<daw-playback-rate>` | Yes | Yes | |
| `<daw-undo-button>` | Yes | No | Player has no undo stack |
| `<daw-redo-button>` | Yes | No | Player has no undo stack |
| `<daw-loop-button>` | Yes | No | Player has no selection-based loop |
| `<daw-record-button>` | Yes | No | Player doesn't support recording |
| `<daw-selection-start>` | Yes | No | |
| `<daw-selection-end>` | Yes | No | |
| `<daw-time-format>` | Yes | Yes | |
| `<daw-tempo>` | Yes | No | |
| `<daw-time-signature>` | Yes | No | |
| `<daw-snap-to>` | Yes | No | |
| `<daw-scale-mode>` | Yes | No | |
| `<daw-zoom-in>` | Yes | No | Player has fixed zoom |
| `<daw-zoom-out>` | Yes | No | |

Transport elements that don't apply to `<daw-player>` render as disabled and log a warning to the console on first interaction.

---

## Styling

### CSS Custom Properties (Theme)

Replace styled-components theme with CSS custom properties:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-progress-color: #63C75F;
  --daw-playhead-color: #d08070;
  --daw-selection-color: rgba(99, 199, 95, 0.3);
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-ruler-color: #c49a6c;
  --daw-ruler-background: #0f0f1a;
  --daw-controls-background: #1a1a2e;
  --daw-controls-text: #e0d4c8;
  --daw-clip-header-background: rgba(0,0,0,0.4);
  --daw-clip-header-text: #e0d4c8;
}
```

### CSS Parts (External Styling)

```css
/* Style internal parts from outside */
daw-editor::part(timescale) { font-family: 'Courier New'; }
daw-editor::part(track) { border-bottom: 1px solid #333; }
daw-editor::part(cursor) { width: 2px; }
daw-track::part(controls) { width: 200px; }
daw-track::part(waveform) { background: #111; }
daw-vu-meter::part(segment) { border-radius: 2px; }
```

### Slots

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
    e.target.dispatchEvent(new CustomEvent('open-fx', {
      bubbles: true,
      composed: true,
    }));
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
    <button onclick="this.dispatchEvent(new CustomEvent('daw-mute', { bubbles: true, composed: true }))">
      My Custom Mute
    </button>
  </div>
</daw-track>
```

The track doesn't care what fired the event — any element that dispatches `daw-mute` triggers the same toggle. This makes every built-in control replaceable with a custom implementation.

**Key pattern:** Instead of pulling state down via hooks (React), navigate up via `closest()` and read properties from elements. Elements are the state containers — the DOM tree is the context.

---

## Drag & Drop

Replace `@dnd-kit/react` with `@dnd-kit/dom` (vanilla):

```typescript
// Inside <daw-editor> connectedCallback
import { DragDropManager, Draggable, Droppable } from '@dnd-kit/dom';

this.dragManager = new DragDropManager({
  sensors: [
    PointerSensor.configure({
      activationConstraints: [
        new PointerActivationConstraints.Distance({ value: 3 }),
      ],
    }),
  ],
});

// Per clip
new Draggable({
  id: clip.clipId,
  element: clipElement,
  modifiers: [SnapToGridModifier.configure({ samplesPerPixel })],
}, this.dragManager);

// Per track (drop target)
new Droppable({
  id: track.id,
  element: trackElement,
  collisionDetector: pointerIntersection,
}, this.dragManager);

// Events
this.dragManager.monitor.addEventListener('dragend', (event) => {
  // Apply clip move/trim via engine operations
});
```

The existing `SnapToGridModifier` and `ClipCollisionModifier` from the browser package are already framework-agnostic — they work with @dnd-kit/dom directly.

---

## Effects

Effects are **imperative only** — no `<daw-effect>` element. Effects are configuration (how audio sounds), not content (what's in the track). The same API surface is available on both `<daw-editor>` (master chain) and `<daw-track>` (per-track chain).

### Effect State

```typescript
interface EffectState {
  id: string;                        // Generated unique ID
  type: string;                      // Registry key (e.g., 'tonejs-reverb')
  params: Record<string, number>;    // Current parameter values
  bypassed: boolean;                 // true = wet set to 0, original stored
}
```

### Built-in Effects (Tone.js)

All built-in effects use a `tonejs-` prefix to clarify their audio engine origin and leave unprefixed names available for custom implementations.

| Category | Effects |
|----------|---------|
| Reverb | `tonejs-reverb`, `tonejs-freeverb`, `tonejs-jc-reverb` |
| Delay | `tonejs-feedback-delay`, `tonejs-ping-pong-delay` |
| Modulation | `tonejs-chorus`, `tonejs-phaser`, `tonejs-tremolo`, `tonejs-vibrato`, `tonejs-auto-filter` |
| Filter | `tonejs-eq3`, `tonejs-auto-wah`, `tonejs-filter` |
| Distortion | `tonejs-distortion`, `tonejs-bit-crusher`, `tonejs-chebyshev` |
| Dynamics | `tonejs-compressor`, `tonejs-limiter`, `tonejs-gate` |
| Spatial | `tonejs-stereo-widener` |

### Effect Registry

Ship the 20 built-in Tone.js effects and allow registering custom effect factories:

```typescript
import { registerEffect, getEffectDefinitions } from '@dawcore/components';

registerEffect('long-verb', {
  label: 'Long Reverb',
  category: 'reverb',
  create: (params) => new Tone.Reverb({ decay: params.decay, wet: params.wet }),
  defaults: { decay: 8, wet: 0.5 },
  params: {
    decay: { min: 0.1, max: 60, step: 0.1, unit: 's' },
    wet:   { min: 0, max: 1, step: 0.01 },
  },
});

// Query available effects (built-in + registered)
const allEffects = getEffectDefinitions();
```

**Registration shape:**

```typescript
interface EffectDefinition {
  label: string;
  category: string;
  create: (params: Record<string, number>) => AudioNode | ToneAudioNode;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
}

interface EffectParamDef {
  min: number;
  max: number;
  step?: number;
  unit?: string;  // 's', 'ms', 'Hz', 'dB', 'st', '%'
}
```

The built-in 20 use this same shape internally — `registerEffect` adds to the same map. Calling `addEffect('unknown-type')` throws with a clear error listing available types.

### Usage

```javascript
// Per-track effects
const track = document.querySelector('daw-track[name="Vocals"]');
const reverbId = track.addEffect('tonejs-reverb', { decay: 2.5, wet: 0.3 });
const delayId = track.addEffect('tonejs-feedback-delay', { delayTime: 0.25, feedback: 0.4 });

// Master effects
const compId = editor.addEffect('tonejs-compressor', { threshold: -24, ratio: 4 });

// Real-time parameter updates (no chain rebuild)
track.setEffectParams(reverbId, { decay: 3.0, wet: 0.5 });

// Bypass: wet/dry effects store original wet and set to 0.
// Effects without wet (compressor, limiter, eq3) are disconnected from chain.
track.setEffectBypassed(reverbId, true);
track.setEffectBypassed(reverbId, false);

// Reorder and remove
track.moveEffect(delayId, 0);      // Move delay before reverb
track.removeEffect(delayId);

// Read current state
console.log(track.effects);  // [{id, type, params, bypassed}, ...]
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
  format?: 'wav';           // Extensible for future formats
  sampleRate?: number;       // Default: audioContext.sampleRate
  startTime?: number;        // Default: 0
  duration?: number;         // Default: editor.duration
  channels?: 1 | 2;         // Default: 2 (stereo)
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
const wav = audioBufferToWav(buffer);  // utility from @dawcore/core
const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
```

---

## Spectrogram & Piano-Roll

Spectrogram and piano-roll are **render modes on `<daw-track>`**, not standalone elements. A track can display as waveform, spectrogram, split (spectrogram + waveform), or piano-roll.

### Render Modes

```html
<!-- Waveform (default) -->
<daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>

<!-- Spectrogram -->
<daw-track src="/audio/vocals.mp3" name="Vocals" render-mode="spectrogram"></daw-track>

<!-- Split: spectrogram on top, waveform on bottom -->
<daw-track src="/audio/vocals.mp3" name="Vocals" render-mode="split"></daw-track>

<!-- Piano-roll (auto-set for tracks created by loadMidi) -->
<daw-track name="Piano" render-mode="piano-roll"></daw-track>
```

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
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192;  // Default: 2048
  hopSize?: number;                                    // Default: fftSize / 4
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb';  // Default: 'mel'
  colorMap?: 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus';
  minFrequency?: number;     // Default: 0
  maxFrequency?: number;     // Default: sampleRate / 2
  gainDb?: number;           // Default: 20
  rangeDb?: number;          // Default: 80
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
'daw-spectrogram-ready'  // Visible viewport FFT complete: detail: {trackId}
```

Useful for E2E tests and screenshot tooling.

### MIDI Loading

MIDI files are loaded imperatively via `editor.loadMidi()` because a `.mid` file can contain multiple tracks — the track count is unknowable at HTML authoring time.

```typescript
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>

interface MidiLoadOptions {
  flatten?: boolean;       // Merge all MIDI tracks into one visual track (default: false)
  name?: string;           // Override track naming
  startTime?: number;      // Timeline position in seconds (default: 0)
}

interface MidiLoadResult {
  trackIds: string[];                   // IDs of created <daw-track> elements
  bpm: number;                          // Tempo from MIDI header (or 120)
  timeSignature: [number, number];      // e.g., [4, 4]
  duration: number;                     // Total duration in seconds
}
```

```javascript
// Load multi-track MIDI — creates N <daw-track> elements automatically
const { trackIds, bpm, timeSignature } = await editor.loadMidi('/midi/song.mid');
console.log('Created tracks:', trackIds);

// Apply tempo from MIDI file
editor.setBpm(bpm);
editor.setTimeSignature(timeSignature[0], timeSignature[1]);

// Flatten into one visual track
await editor.loadMidi('/midi/song.mid', { flatten: true });

// Position on timeline
await editor.loadMidi('/midi/bridge.mid', { startTime: 30.0 });
```

Created tracks get `render-mode="piano-roll"` by default. Each track's clips carry `midiNotes` data for the piano-roll renderer. Track names are derived from the MIDI file (instrument name, channel, or GM program name).

For programmatic MIDI, set `clip.midiNotes` directly:
```javascript
const track = editor.addTrack({ name: 'Synth Lead' });
const clip = track.querySelector('daw-clip');
clip.midiNotes = [
  { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
  { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
];
track.renderMode = 'piano-roll';
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
  key: string;              // 'Space', 's', 'Escape', 'ArrowUp', etc.
  action: () => void;       // Callback
  description?: string;     // Human-readable label
  ctrlKey?: boolean;        // Modifier (optional — if omitted, any state matches)
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean; // Default: true
}

interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}
```

**Built-in playback shortcuts:**

| Action | Default Key | Description |
|--------|------------|-------------|
| `playPause` | `Space` | Play/Pause |
| `stop` | `Escape` | Stop |
| `rewindToStart` | `0` | Rewind to start |

**Built-in splitting shortcuts:**

| Action | Default Key | Description |
|--------|------------|-------------|
| `splitAtPlayhead` | `S` | Split clip at playhead |

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

**Priority rule:** When both `<daw-keyboard-shortcuts>` and `<daw-annotation-track keyboard-controls>` are active, annotation shortcuts run first. If an annotation is selected and the key matches an annotation action, the event is consumed (`stopPropagation`). Otherwise it falls through to editor-level shortcuts. This means `Escape` clears the annotation selection first; pressing `Escape` again (with no selection) stops playback.

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

| Action | Default Key | Description |
|--------|------------|-------------|
| `selectPrevious` | `ArrowUp` / `ArrowLeft` | Select previous (wraps) |
| `selectNext` | `ArrowDown` / `ArrowRight` | Select next (wraps) |
| `selectFirst` | `Home` | Select first |
| `selectLast` | `End` | Select last |
| `clearSelection` | `Escape` | Deselect |
| `moveStartEarlier` | `[` | Start −10ms |
| `moveStartLater` | `]` | Start +10ms |
| `moveEndEarlier` | `{` (Shift+[) | End −10ms |
| `moveEndLater` | `}` (Shift+]) | End +10ms |
| `playActive` | `Enter` | Play selected annotation |

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
- Boundary constraints: minimum 0.1s duration, end cannot exceed timeline duration
- Navigation shortcuts always active; boundary editing requires `editable` attribute

---

## File Drop

### Built-in Drop Zone

Enable with the `file-drop` attribute on `<daw-editor>`:

```html
<daw-editor file-drop>
  <daw-track src="/audio/drums.mp3" name="Drums"></daw-track>
</daw-editor>
```

Dropping audio files (`.mp3`, `.wav`, `.ogg`, `.flac`, etc.) creates one new track per file. Dropping a MIDI file (`.mid`, `.midi`) routes through the `loadMidi()` pipeline, creating N tracks with `render-mode="piano-roll"`.

Mixed drops work — dropping 2 audio files and 1 MIDI file in a single drop creates tracks for all of them.

### Programmatic File Loading

For custom drop zones, file pickers, or other UIs:

```typescript
editor.loadFiles(files: File[] | FileList, options?: LoadFilesOptions): Promise<LoadFilesResult>

interface LoadFilesOptions {
  midiOptions?: MidiLoadOptions;  // Passed through for .mid files (flatten, startTime, etc.)
}

interface LoadFilesResult {
  trackIds: string[];             // All created track IDs (audio + MIDI)
  midi?: MidiLoadResult;          // Present when MIDI files were in the drop (bpm, timeSignature, etc.)
}
```

```javascript
// Custom file picker
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'audio/*,.mid,.midi';
input.onchange = async () => {
  const { trackIds } = await editor.loadFiles(input.files);
  console.log('Created tracks:', trackIds);
};
input.click();

// Custom drop zone with MIDI options
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const { trackIds } = await editor.loadFiles(e.dataTransfer.files, {
    midiOptions: { flatten: true },
  });
});
```

### File Type Detection

`loadFiles()` detects MIDI files by extension (`.mid`, `.midi`) and routes them through `loadMidi()`. All other files are treated as audio and passed to `AudioContext.decodeAudioData()` — no upfront MIME type filtering. Non-audio files (`.pdf`, `.txt`, etc.) will fail at decode and emit a `daw-files-load-error` event. This is intentional: the browser's decoder is the most reliable detector of valid audio.

```typescript
'daw-files-load-error'  // detail: {file: File, error: string}
```

```javascript
editor.addEventListener('daw-files-load-error', (e) => {
  console.warn('Failed to load', e.detail.file.name, ':', e.detail.error);
});
```

---

## Accessibility

All elements render correct ARIA roles, labels, and states in their Shadow DOM automatically. Consumers can override `aria-label` on host elements. Accessibility is built into each element from Phase 1, not bolted on later.

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

| Key | Action |
|-----|--------|
| `ArrowUp` | Focus previous track |
| `ArrowDown` | Focus next track |
| `Tab` | Move focus to next focusable element (controls, then next track) |
| `Shift+Tab` | Move focus backwards |
| `Enter` | Select focused track |

**Note:** `Space` is reserved for play/pause (via `<daw-keyboard-shortcuts playback>`), not track selection. ArrowUp/Down for track navigation only applies when no `<daw-annotation-track keyboard-controls>` has an active selection — annotation shortcuts take priority per the [Keyboard Shortcuts](#keyboard-shortcuts) priority rule.

**Focus order within a track:**
1. Track itself (group)
2. Track controls slot (volume, pan, mute, solo — standard Tab order)
3. Next track

**Transport focus:** `<daw-transport>` children are standard buttons and inputs — native Tab order applies.

**Focus visibility:** All focusable elements render a visible focus indicator via `:focus-visible` in Shadow DOM, customizable via `::part(focus-ring)`:

```css
daw-track::part(focus-ring) {
  outline: 2px solid #63C75F;
  outline-offset: 2px;
}
```

### Live Region Announcements

`<daw-editor>` renders a visually hidden `aria-live="polite"` region in its Shadow DOM. Rapid state changes coalesce into a single announcement.

**Transport state:**

| Event | Announcement |
|-------|-------------|
| Play | "Playing" |
| Pause | "Paused" |
| Stop | "Stopped" |
| Record start | "Recording on Vocals, Guitar" |
| Record stop | "Recording stopped" |

**Track/clip operations:**

| Event | Announcement |
|-------|-------------|
| Track selected | "Track Vocals selected" |
| Track added | "Track Piano added" |
| Track removed | "Track Piano removed" |
| Track muted / unmuted | "Vocals muted" / "Vocals unmuted" |
| Track soloed / unsoloed | "Vocals soloed" / "Vocals unsoloed" |
| Clip split | "Clip split at 5.2 seconds" |
| Record armed | "Vocals armed for recording" |
| Loop enabled / disabled | "Loop enabled" / "Loop disabled" |
| Zoom in / out | "Zoom: 512 samples per pixel" |

**Not announced** (query on demand):
- Time updates during playback (continuous, would be noisy)
- Selection changes (visual operation)

### Scope & Deferred Work

Clip drag, boundary trim, and waveform scrubbing remain mouse-only. Keyboard alternatives for pixel-level interactions are deferred to a future accessibility phase.

---

## Undo/Redo

### Scope

Only structural edits are undoable — operations that change the track/clip document model:

| Undoable | Not Undoable |
|----------|-------------|
| Clip move (drop) | Volume, pan, mute, solo |
| Clip trim | Selection changes |
| Clip split | Zoom |
| Add/remove track | Loop region |
| Add/remove clip | Playback transport (play/pause/stop/seek) |

Volume, pan, mute, and solo are live mixing adjustments — non-destructive and instantly reversible by the user. Selection and zoom are navigation, not edits.

### Snapshot-Based Stack

Each undo step stores a frozen copy of `tracks[]` before the operation. Undo restores the previous snapshot; redo re-applies the undone snapshot. No per-operation inverse logic — eliminates a class of bugs from incorrect reverse operations.

The stack has a fixed default limit of **100 steps**, configurable via `engine.undoLimit` or `editor.undoLimit`. When the limit is reached, the oldest entry is dropped.

Any new structural edit clears the redo stack (standard behavior — you can't redo after making a new change). `clearHistory()` is called automatically when tracks are fully replaced via `setTracks()`, since old snapshots reference a different track set.

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
editor.undoLimit: number

// Methods
editor.undo(): void
editor.redo(): void
editor.clearHistory(): void
```

**Transport elements:**

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

- **`daw-tracks-change`** fires as usual when undo/redo changes tracks (existing event, no special handling needed)
- **`daw-undo-state`** fires when `canUndo` or `canRedo` changes:

```typescript
'daw-undo-state'  // detail: {canUndo: boolean, canRedo: boolean}
```

```javascript
editor.addEventListener('daw-undo-state', (e) => {
  undoBtn.disabled = !e.detail.canUndo;
  redoBtn.disabled = !e.detail.canRedo;
});
```

Note: `<daw-undo-button>` and `<daw-redo-button>` handle this automatically — the event is for custom UI.

### Live Region Announcements

| Action | Announcement |
|--------|-------------|
| Undo | "Undo" |
| Redo | "Redo" |

---

## Framework Usage

All frameworks just need `import '@dawcore/components'` to register the custom elements. No wrapper packages needed.

### Vanilla JS

```html
<script type="module">
  import '@dawcore/components';

  const editor = document.querySelector('daw-editor');
  editor.addEventListener('daw-ready', () => console.log('loaded'));
  editor.addEventListener('daw-record', (e) => {
    console.log('recording', e.detail.trackIds);
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
        onDawRecord={(e) => console.log('recording', e.detail.trackIds)}
      >
        <daw-track src="/audio/vocals.mp3" name="Vocals" />
        <daw-track src="/audio/guitar.mp3" name="Guitar" recordArmed />
      </daw-editor>
    </>
  );
}
```

**JSX type declarations** ship inside `@dawcore/components` so TypeScript knows the valid attributes:

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
    @daw-record="onRecord"
  >
    <daw-track src="/audio/vocals.mp3" name="Vocals" />
    <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed />
  </daw-editor>
</template>

<script setup>
import '@dawcore/components';
import { ref } from 'vue';

const editorRef = ref(null);
function play() { editorRef.value?.play(); }
function onReady() { console.log('loaded'); }
function onTracksChange(e) { console.log(e.detail.tracks); }
function onRecord(e) { console.log('recording', e.detail.trackIds); }
</script>
```

One config line tells the Vue compiler which tags are custom elements:

```typescript
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('daw-') } } })
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
  on:daw-record={(e) => console.log('recording', e.detail.trackIds)}
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
  (daw-record)="onRecord($event)"
>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar" record-armed></daw-track>
</daw-editor>
```

### Framework Compatibility

| Framework | Properties | Custom Events | Config Needed | Extra Types |
|-----------|-----------|---------------|---------------|-------------|
| Vanilla JS | `.property =` | `addEventListener()` | None | None |
| React 19+ | Native | `onDawReady` | None | JSX `IntrinsicElements` (shipped) |
| Vue 3 | `:prop` binding | `@event` | `isCustomElement` | Optional Volar types |
| Svelte | `prop={value}` | `on:event` | None | None |
| Angular | `[prop]` binding | `(event)` | `CUSTOM_ELEMENTS_SCHEMA` | None |

---

## Migration Phases

### Phase 1: Foundation

Create `@dawcore/components` package with core elements:

- [ ] `<daw-editor>` — engine + audio context lifecycle, track management
- [ ] `<daw-track>` — track declaration via attributes
- [ ] `<daw-clip>` — clip element with src/peaks-src, positioning, fades
- [ ] Resource cache — URL-keyed dedup for AudioBuffer and peaks across clips
- [ ] `<daw-waveform>` — canvas waveform rendering (port existing canvas code)
- [ ] `<daw-playhead>` — animated playhead
- [ ] `<daw-ruler>` — time ruler
- [ ] CSS custom properties theme system
- [ ] Playback: play/pause/stop/seek via element methods
- [ ] Recording: record/arm via element methods, mic access, live waveform preview
- [ ] Custom events for state changes (including `daw-record`, `daw-record-stop`, `daw-record-arm`)
- [ ] Accessibility — built-in ARIA roles/labels, keyboard track navigation, live region announcements, focus indicators
- [ ] `<daw-player>` — lightweight single-track player using HTMLMediaElement, waveform visualization, optional effects (lazy AudioContext)
- [ ] `<daw-playback-rate>` — playback speed transport element (works with both editor and player)

**Deliverable:** Multi-track waveform editor with playback and recording, plus standalone single-track player.

### Phase 2: Interactions

- [ ] @dnd-kit/dom integration for clip drag
- [ ] Clip trimming (boundary drag)
- [ ] Clip splitting (keyboard shortcut)
- [ ] Selection (click + drag on timeline)
- [ ] Track selection
- [ ] `<daw-transport>` with button elements
- [ ] `<daw-keyboard-shortcuts>` — playback and splitting presets, custom shortcuts, key remapping
- [ ] File drop — `file-drop` attribute on editor, `loadFiles()` method, audio + MIDI auto-detection
- [ ] Undo/redo — snapshot-based stack in engine, transactions for drag grouping, `<daw-undo-button>` / `<daw-redo-button>`, keyboard shortcut preset

**Deliverable:** Interactive editor with drag/trim/split and undo/redo.

### Phase 3: Track Controls

- [ ] `<daw-volume-slider>` — per-track and master
- [ ] `<daw-pan-slider>`
- [ ] `<daw-mute-button>` / `<daw-solo-button>`
- [ ] `<daw-vu-meter>` — port SegmentedVUMeter to Custom Element
- [ ] `<daw-rewind-button>` / `<daw-fast-forward-button>`
- [ ] `<daw-loop-button>`
- [ ] `<daw-zoom-in>` / `<daw-zoom-out>`
- [ ] `<daw-time-display>`
- [ ] `<daw-selection-start>` / `<daw-selection-end>`
- [ ] `<daw-time-format>`
- [ ] `<daw-tempo>` / `<daw-time-signature>`
- [ ] `<daw-snap-to>` / `<daw-scale-mode>`
- [ ] Effects — imperative API on `<daw-editor>` (master) and `<daw-track>` (per-track)
- [ ] Effect registry — 20 built-in `tonejs-*` effects + `registerEffect()` for custom
- [ ] Effect bypass, reorder, real-time parameter updates
- [ ] `exportAudio()` — offline rendering through all effect chains

**Deliverable:** Full mixing controls and effects processing.

### Phase 4: Optional Features

- [ ] `<daw-annotation-track>`, `<daw-annotation>`, `<daw-annotation-list>` — single source of truth, dual view
- [ ] Annotation keyboard controls — `keyboard-controls` attribute, key remapping, programmatic methods
- [ ] Spectrogram render mode — `render-mode="spectrogram"` and `render-mode="split"` on `<daw-track>`
- [ ] Spectrogram config — `SpectrogramConfig` on editor (global) and track (override), lazy worker pool
- [ ] `editor.loadMidi()` — multi-track MIDI loading, returns `{trackIds, bpm, timeSignature, duration}`
- [ ] Piano-roll render mode — `render-mode="piano-roll"`, `clip.midiNotes` property
- [ ] Piano-roll theming via CSS custom properties
- [ ] Loop region UI

**Deliverable:** Feature parity with current React version.

### Phase 5: React 19+ & JSX Types

- [ ] JSX `IntrinsicElements` type declarations for all `<daw-*>` elements
- [ ] Ship types inside `@dawcore/components` (no separate React package)
- [ ] React 19+ example app verifying native Custom Elements interop
- [ ] Storybook stories (shared between vanilla and React)

**Deliverable:** React 19+ users consume Web Components directly in JSX with full type safety.

### Phase 6: Documentation & Migration Guide

- [ ] Website at dawcore.com
- [ ] React migration guide (waveform-playlist v10 → dawcore 1.0)
- [ ] Vanilla JS getting started guide
- [ ] API reference for all elements
- [ ] Storybook for component catalog

---

## Build & Tooling

| Concern | Approach |
|---------|---------|
| **Build** | tsup (same as current packages) |
| **Types** | TypeScript with Custom Elements Manifest for tooling |
| **CSS** | CSS custom properties + `::part()` + adopted stylesheets |
| **Testing** | Vitest + @open-wc/testing or vanilla DOM assertions |
| **Storybook** | @storybook/web-components with lit-html |
| **Drag & Drop** | @dnd-kit/dom (vanilla) |
| **Docs** | Docusaurus or Starlight |

---

## Breaking Changes (waveform-playlist v10 → dawcore 1.0)

| waveform-playlist v10 | dawcore 1.0 |
|-----------------------|-------------|
| `@waveform-playlist/browser` (React) | `@dawcore/components` (Web Components) |
| `@waveform-playlist/ui-components` (React) | Merged into `@dawcore/components` |
| `WaveformPlaylistProvider` (React context) | `<daw-editor>` element |
| `usePlaylistControls()` | `element.play()`, `element.stop()`, etc. |
| `usePlaylistState()` | `element.isPlaying`, `element.selection`, etc. |
| `usePlaylistData()` | `element.tracks`, `element.duration`, etc. |
| `usePlaybackAnimation()` | `daw-timeupdate` event |
| `onTracksChange` prop | `daw-tracks-change` event |
| styled-components theme | CSS custom properties |
| `@dnd-kit/react` | `@dnd-kit/dom` |
| `useDynamicEffects()` / `useTrackDynamicEffects()` | `editor.addEffect()` / `track.addEffect()` (imperative) |
| `SpectrogramProvider` (React context) | `render-mode="spectrogram"` attribute + `spectrogramConfig` property |
| `useMidiTracks()` hook | `editor.loadMidi()` method |
| `<KeyboardShortcuts>` (React component) | `<daw-keyboard-shortcuts>` element |
| `useAnnotationKeyboardControls()` hook | `<daw-annotation-track keyboard-controls>` attribute |
| `useDynamicTracks()` hook (file/blob loading) | `editor.loadFiles()` method + `file-drop` attribute |
| `useUndoRedo()` hook (planned) | `engine.undo()` / `engine.redo()` + `<daw-undo-button>` / `<daw-redo-button>` |
| `MediaElementPlaylistProvider` (React context) | `<daw-player>` element |
| `useMediaElementControls()` | `player.play()`, `player.pause()`, etc. |

React 19+ users consume `@dawcore/components` directly in JSX — no wrapper package needed. React 18 is not supported.

---

## Open Questions

1. **Lit or vanilla?** — Decided: **Lit**. Adds ~6KB but provides reactive properties, efficient re-rendering, and `@property` decorators. Reduces boilerplate significantly compared to vanilla `HTMLElement` subclasses. Well-maintained by Google, widely adopted, and has first-class Storybook support.
2. **Custom Elements Manifest** — Decided: **yes**. Generate with `@custom-elements-manifest/analyzer` from Lit source. Provides IDE autocomplete (VS Code suggests attributes in HTML), Storybook auto-generated controls, and machine-readable API docs. No manual maintenance — reads `@property()` decorators and JSDoc automatically.
3. **Development strategy** — Decided: develop on a long-lived feature branch (e.g., `feat/dawcore`). Each migration phase gets its own branch off the feature branch, merged back when complete. Merge to `main` only when fully ready for release. Existing v10 users stay on `main` until then.
4. **Repo migration** — Deferred. Develop and publish `@dawcore/*` packages from the existing `naomiaro/waveform-playlist` repo for now. Transfer to `dawcore` org later if desired — GitHub's transfer ownership preserves stars, watchers, forks, issues, PRs, and redirects old URLs.
