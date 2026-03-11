# Web Components Migration Spec

Migrate to native Web Components under the **dawcore** brand, making the library framework-agnostic while providing a thin React wrapper for React users.

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
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar"></daw-track>
</daw-editor>

<!-- With transport (recording-aware by default) -->
<daw-transport for="my-editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-record-button></daw-record-button>
  <daw-time-display></daw-time-display>
  <daw-zoom-controls></daw-zoom-controls>
</daw-transport>
```

### Element Registry

| Element | Wraps | Responsibilities |
|---------|-------|-----------------|
| `<daw-editor>` | PlaylistEngine + ToneAdapter | Root element. Manages engine, audio context, tracks, state. |
| `<daw-track>` | Track state | Declares a track. Attributes: `src`, `name`, `volume`, `pan`, `muted`, `soloed`, `record-armed`, `input-device`. |
| `<daw-canvas>` | Canvas rendering | Waveform visualization. Renders peaks to canvas. |
| `<daw-transport>` | Transport controls container | Groups transport buttons, links to an editor via `for` attribute. |
| `<daw-play-button>` | play() | Triggers playback. If recording is armed, starts overdub recording simultaneously. |
| `<daw-pause-button>` | pause() | Pauses playback and recording. |
| `<daw-stop-button>` | stop() | Stops playback and recording. Finalizes any in-progress recording into a new clip. |
| `<daw-record-button>` | record() | Arms/starts recording on all armed tracks. When clicked during stop, arms the selected track (or first track). When clicked during play, starts overdub on armed tracks. |
| `<daw-time-display>` | currentTime | Shows formatted playback time. |
| `<daw-zoom-controls>` | zoomIn()/zoomOut() | Zoom in/out buttons. |
| `<daw-volume-slider>` | setTrackVolume() | Per-track or master volume. |
| `<daw-pan-slider>` | setTrackPan() | Per-track pan control. |
| `<daw-vu-meter>` | Meter worklet | Level metering (replaces SegmentedVUMeter). |
| `<daw-timescale>` | Time ruler | Renders time ruler above tracks. |
| `<daw-cursor>` | Playhead | Animated playhead line. |

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
| `<daw-annotation>` | annotations | Time-synced text annotation. |
| `<daw-spectrogram>` | spectrogram | FFT visualization overlay. |
| `<daw-piano-roll>` | midi | MIDI note visualization. |

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
```

**Properties (JS only):**
```typescript
track.recordArmed: boolean       // Reflects record-armed attribute
track.inputDevice: string|null   // Reflects input-device attribute
track.isRecording: boolean       // Read-only: currently recording (armed + editor.isRecording)
track.inputStream: MediaStream   // Read-only: active mic stream when recording
```

**Methods:**
```typescript
track.arm(deviceId?: string): Promise<void>   // Arm for recording, request mic access
track.disarm(): void                          // Disarm, release mic stream
```

When `arm()` is called without a `deviceId`, it uses the default input device. The method requests mic permission via `getUserMedia()` and stores the stream for use when recording starts. Calling `arm()` on an already-armed track with a different `deviceId` switches the input device.

---

## Styling

### CSS Custom Properties (Theme)

Replace styled-components theme with CSS custom properties:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-progress-color: #63C75F;
  --daw-cursor-color: #d08070;
  --daw-selection-color: rgba(99, 199, 95, 0.3);
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-timescale-color: #c49a6c;
  --daw-timescale-background: #0f0f1a;
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
      <button slot="controls">FX</button>
    </div>
  </daw-track>
</daw-editor>
```

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
- [ ] `<daw-track>` — track declaration via attributes, audio loading
- [ ] `<daw-canvas>` — canvas waveform rendering (port existing canvas code)
- [ ] `<daw-cursor>` — animated playhead
- [ ] `<daw-timescale>` — time ruler
- [ ] CSS custom properties theme system
- [ ] Playback: play/pause/stop/seek via element methods
- [ ] Recording: record/arm via element methods, mic access, live waveform preview
- [ ] Custom events for state changes (including `daw-record`, `daw-record-stop`, `daw-record-arm`)

**Deliverable:** Multi-track waveform player with playback and recording.

### Phase 2: Interactions

- [ ] @dnd-kit/dom integration for clip drag
- [ ] Clip trimming (boundary drag)
- [ ] Clip splitting (keyboard shortcut)
- [ ] Selection (click + drag on timeline)
- [ ] Track selection
- [ ] `<daw-transport>` with button elements

**Deliverable:** Interactive editor with drag/trim/split.

### Phase 3: Track Controls

- [ ] `<daw-volume-slider>` — per-track and master
- [ ] `<daw-pan-slider>`
- [ ] Mute/solo buttons
- [ ] `<daw-vu-meter>` — port SegmentedVUMeter to Custom Element
- [ ] `<daw-zoom-controls>`
- [ ] `<daw-time-display>`

**Deliverable:** Full mixing controls.

### Phase 4: Optional Features

- [ ] `<daw-annotation>` + annotation rendering
- [ ] `<daw-spectrogram>` + FFT visualization
- [ ] `<daw-piano-roll>` + MIDI rendering
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

React 19+ users consume `@dawcore/components` directly in JSX — no wrapper package needed. React 18 is not supported.

---

## Open Questions

1. **Lit or vanilla?** — Decided: **Lit**. Adds ~6KB but provides reactive properties, efficient re-rendering, and `@property` decorators. Reduces boilerplate significantly compared to vanilla `HTMLElement` subclasses. Well-maintained by Google, widely adopted, and has first-class Storybook support.
2. **Custom Elements Manifest** — Decided: **yes**. Generate with `@custom-elements-manifest/analyzer` from Lit source. Provides IDE autocomplete (VS Code suggests attributes in HTML), Storybook auto-generated controls, and machine-readable API docs. No manual maintenance — reads `@property()` decorators and JSDoc automatically.
3. **Development strategy** — Decided: develop on a long-lived feature branch (e.g., `feat/dawcore`). Each migration phase gets its own branch off the feature branch, merged back when complete. Merge to `main` only when fully ready for release. Existing v10 users stay on `main` until then.
4. **Repo migration** — Deferred. Develop and publish `@dawcore/*` packages from the existing `naomiaro/waveform-playlist` repo for now. Transfer to `dawcore` org later if desired — GitHub's transfer ownership preserves stars, watchers, forks, issues, PRs, and redirects old URLs.
