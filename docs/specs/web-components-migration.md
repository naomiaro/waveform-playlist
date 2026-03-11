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
| `@dawcore/components` | Web Components UI layer — Custom Elements with Shadow DOM |
| `@dawcore/react` | Thin React wrapper — refs, props, event bindings |

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
| `@waveform-playlist/browser` (React providers + hooks) | `@dawcore/components` (elements + events) + `@dawcore/react` (wrapper) |

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
  samples-per-pixel="1024"
  wave-height="128"
  timescale
>
  <daw-track src="/audio/vocals.mp3" name="Vocals"></daw-track>
  <daw-track src="/audio/guitar.mp3" name="Guitar"></daw-track>
</daw-editor>

<!-- With transport -->
<daw-transport for="my-editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-time-display></daw-time-display>
  <daw-zoom-controls></daw-zoom-controls>
</daw-transport>
```

### Element Registry

| Element | Wraps | Responsibilities |
|---------|-------|-----------------|
| `<daw-editor>` | PlaylistEngine + ToneAdapter | Root element. Manages engine, audio context, tracks, state. |
| `<daw-track>` | Track state | Declares a track. Attributes: `src`, `name`, `volume`, `pan`, `muted`, `soloed`. |
| `<daw-canvas>` | Canvas rendering | Waveform visualization. Renders peaks to canvas. |
| `<daw-transport>` | Transport controls container | Groups transport buttons, links to an editor via `for` attribute. |
| `<daw-play-button>` | play() | Triggers playback. |
| `<daw-pause-button>` | pause() | Pauses playback. |
| `<daw-stop-button>` | stop() | Stops and resets. |
| `<daw-time-display>` | currentTime | Shows formatted playback time. |
| `<daw-zoom-controls>` | zoomIn()/zoomOut() | Zoom in/out buttons. |
| `<daw-volume-slider>` | setTrackVolume() | Per-track or master volume. |
| `<daw-pan-slider>` | setTrackPan() | Per-track pan control. |
| `<daw-vu-meter>` | Meter worklet | Level metering (replaces SegmentedVUMeter). |
| `<daw-timescale>` | Time ruler | Renders time ruler above tracks. |
| `<daw-cursor>` | Playhead | Animated playhead line. |

### Optional Elements

| Element | Package | Responsibilities |
|---------|---------|-----------------|
| `<daw-record-button>` | recording | Start/stop recording. |
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
editor.currentTime: number           // Current playback time
editor.duration: number              // Total duration
editor.selection: {start, end}       // Selection range
editor.selectedTrackId: string|null  // Selected track
editor.theme: DawcoreTheme           // Theme object
editor.engine: PlaylistEngine        // Direct engine access
```

**Methods:**
```typescript
editor.play(startTime?, duration?): Promise<void>
editor.pause(): void
editor.stop(): void
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
'daw-timeupdate'    // Playback time changed (RAF)
'daw-selection'     // Selection changed: detail: {start, end}
'daw-track-select'  // Track selected: detail: {trackId}
'daw-tracks-change' // Tracks mutated (move/trim/split): detail: {tracks}
'daw-zoom'          // Zoom changed: detail: {samplesPerPixel}
```

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

## React Wrapper (`@dawcore/react`)

Thin wrapper that makes Web Components feel native in React:

```tsx
// @dawcore/react
import { useRef, useEffect, useState, useCallback } from 'react';

export function DawEditor({
  tracks, samplesPerPixel, waveHeight, timescale,
  onReady, onTracksChange, onSelectionChange,
  theme, children, ...props
}: DawEditorProps) {
  const ref = useRef<DawEditorElement>(null);

  // Sync props to element properties
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (tracks) el.tracks = tracks;
    if (theme) el.theme = theme;
  }, [tracks, theme]);

  // Forward custom events to React callbacks
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handlers: [string, Function][] = [
      ['daw-ready', onReady],
      ['daw-tracks-change', (e) => onTracksChange?.(e.detail.tracks)],
      ['daw-selection', (e) => onSelectionChange?.(e.detail)],
    ].filter(([, fn]) => fn);

    handlers.forEach(([evt, fn]) => el.addEventListener(evt, fn));
    return () => handlers.forEach(([evt, fn]) => el.removeEventListener(evt, fn));
  }, [onReady, onTracksChange, onSelectionChange]);

  return (
    <daw-editor
      ref={ref}
      samples-per-pixel={samplesPerPixel}
      wave-height={waveHeight}
      timescale={timescale || undefined}
      {...props}
    >
      {children}
    </daw-editor>
  );
}

// Convenience hook for imperative access
export function useDawEditor() {
  const ref = useRef<DawEditorElement>(null);
  return {
    ref,
    play: (...args) => ref.current?.play(...args),
    pause: () => ref.current?.pause(),
    stop: () => ref.current?.stop(),
    get isPlaying() { return ref.current?.isPlaying ?? false },
    get currentTime() { return ref.current?.currentTime ?? 0 },
  };
}
```

**React usage:**

```tsx
import { DawEditor, useDawEditor } from '@dawcore/react';

function App() {
  const editor = useDawEditor();

  return (
    <>
      <button onClick={() => editor.play()}>Play</button>
      <DawEditor
        ref={editor.ref}
        samples-per-pixel={1024}
        wave-height={128}
        timescale
        onReady={() => console.log('loaded')}
      >
        <daw-track src="/audio/vocals.mp3" name="Vocals" />
        <daw-track src="/audio/guitar.mp3" name="Guitar" />
      </DawEditor>
    </>
  );
}
```

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
- [ ] Custom events for state changes

**Deliverable:** Read-only multi-track waveform player with playback.

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

- [ ] `<daw-record-button>` + recording integration
- [ ] `<daw-annotation>` + annotation rendering
- [ ] `<daw-spectrogram>` + FFT visualization
- [ ] `<daw-piano-roll>` + MIDI rendering
- [ ] Loop region UI

**Deliverable:** Feature parity with current React version.

### Phase 5: React Wrapper

- [ ] `@dawcore/react` package
- [ ] Props → attributes/properties sync
- [ ] Custom events → React callbacks
- [ ] `useDawEditor()` hook for imperative access
- [ ] TypeScript declarations for JSX (`IntrinsicElements`)
- [ ] Storybook stories (shared between vanilla and React)

**Deliverable:** Drop-in React package consuming Web Components.

### Phase 6: Documentation & Migration Guide

- [ ] Website at dawcore.dev or similar
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

React users install `@dawcore/react` for a familiar props + callbacks API that wraps the Web Components internally.

---

## Open Questions

1. **Lit or vanilla?** — Lit adds ~6KB but provides reactive properties, efficient re-rendering, and `@property` decorators. Vanilla `HTMLElement` subclasses are lighter but more boilerplate. Recommend Lit for productivity.
2. **Canvas rendering strategy** — Keep current multi-canvas chunk approach, or consolidate? Current approach works well for virtual scrolling.
3. **Custom Elements Manifest** — Generate with `@custom-elements-manifest/analyzer` for IDE autocomplete and Storybook integration?
4. **SSR** — Declarative Shadow DOM support needed? Audio editors are inherently client-side, but some frameworks expect SSR compatibility.
5. **Backwards compatibility period** — Maintain waveform-playlist v10 alongside dawcore 1.0 for a transition period?
6. **Monorepo or new repo?** — Start fresh at github.com/dawcore, or develop in the existing waveform-playlist repo and publish under the new scope?
