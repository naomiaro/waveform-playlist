# Web Components Migration Spec

Migrate waveform-playlist's UI layer from React to native Web Components, making the library framework-agnostic while providing a thin React wrapper for React users.

**Status:** Draft
**Target:** v11.0.0

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
| `@waveform-playlist/components` | Web Components UI layer — Custom Elements with Shadow DOM |
| `@waveform-playlist/react` | Thin React wrapper — refs, props, event bindings |

### Replaced Packages

| Current | Replaced By |
|---------|------------|
| `ui-components` (React + styled-components) | `components` (Web Components + CSS) |
| `browser` (React providers + hooks) | `components` (elements + events) + `react` (wrapper) |

### Unchanged Packages

core, engine, playout, worklets, webaudio-peaks, loaders, media-element-playout

### Optional Packages (migrated)

recording, annotations, spectrogram, midi — extract framework-agnostic logic, add Web Component wrappers.

---

## Custom Elements

### Core Elements

```html
<!-- Minimal setup -->
<waveform-playlist
  samples-per-pixel="1024"
  wave-height="128"
  timescale
>
  <waveform-track src="/audio/vocals.mp3" name="Vocals"></waveform-track>
  <waveform-track src="/audio/guitar.mp3" name="Guitar"></waveform-track>
</waveform-playlist>

<!-- With transport -->
<waveform-transport for="my-playlist">
  <waveform-play-button></waveform-play-button>
  <waveform-pause-button></waveform-pause-button>
  <waveform-stop-button></waveform-stop-button>
  <waveform-time-display></waveform-time-display>
  <waveform-zoom-controls></waveform-zoom-controls>
</waveform-transport>
```

### Element Registry

| Element | Wraps | Responsibilities |
|---------|-------|-----------------|
| `<waveform-playlist>` | PlaylistEngine + ToneAdapter | Root element. Manages engine, audio context, tracks, state. |
| `<waveform-track>` | Track state | Declares a track. Attributes: `src`, `name`, `volume`, `pan`, `muted`, `soloed`. |
| `<waveform-canvas>` | Canvas rendering | Waveform visualization. Renders peaks to canvas. |
| `<waveform-transport>` | Transport controls container | Groups transport buttons, links to a playlist via `for` attribute. |
| `<waveform-play-button>` | play() | Triggers playback. |
| `<waveform-pause-button>` | pause() | Pauses playback. |
| `<waveform-stop-button>` | stop() | Stops and resets. |
| `<waveform-time-display>` | currentTime | Shows formatted playback time. |
| `<waveform-zoom-controls>` | zoomIn()/zoomOut() | Zoom in/out buttons. |
| `<waveform-volume-slider>` | setTrackVolume() | Per-track or master volume. |
| `<waveform-pan-slider>` | setTrackPan() | Per-track pan control. |
| `<waveform-vu-meter>` | Meter worklet | Level metering (replaces SegmentedVUMeter). |
| `<waveform-timescale>` | Time ruler | Renders time ruler above tracks. |
| `<waveform-cursor>` | Playhead | Animated playhead line. |

### Optional Elements

| Element | Package | Responsibilities |
|---------|---------|-----------------|
| `<waveform-record-button>` | recording | Start/stop recording. |
| `<waveform-annotation>` | annotations | Time-synced text annotation. |
| `<waveform-spectrogram>` | spectrogram | FFT visualization overlay. |
| `<waveform-piano-roll>` | midi | MIDI note visualization. |

---

## Properties, Attributes & Events

### `<waveform-playlist>` API

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
playlist.tracks: ClipTrack[]           // Current track state
playlist.isPlaying: boolean            // Playback state
playlist.currentTime: number           // Current playback time
playlist.duration: number              // Total duration
playlist.selection: {start, end}       // Selection range
playlist.selectedTrackId: string|null  // Selected track
playlist.theme: WaveformPlaylistTheme  // Theme object
playlist.engine: PlaylistEngine        // Direct engine access
```

**Methods:**
```typescript
playlist.play(startTime?, duration?): Promise<void>
playlist.pause(): void
playlist.stop(): void
playlist.seekTo(time: number): void
playlist.setSelection(start: number, end: number): void
playlist.setTrackVolume(trackId: string, volume: number): void
playlist.setTrackPan(trackId: string, pan: number): void
playlist.setTrackMute(trackId: string, muted: boolean): void
playlist.setTrackSolo(trackId: string, soloed: boolean): void
playlist.zoomIn(): void
playlist.zoomOut(): void
playlist.setMasterVolume(volume: number): void
```

**Events:**
```typescript
'waveform-ready'         // All tracks loaded
'waveform-play'          // Playback started
'waveform-pause'         // Playback paused
'waveform-stop'          // Playback stopped
'waveform-timeupdate'    // Playback time changed (RAF)
'waveform-selection'     // Selection changed: detail: {start, end}
'waveform-track-select'  // Track selected: detail: {trackId}
'waveform-tracks-change' // Tracks mutated (move/trim/split): detail: {tracks}
'waveform-zoom'          // Zoom changed: detail: {samplesPerPixel}
```

---

## Styling

### CSS Custom Properties (Theme)

Replace styled-components theme with CSS custom properties:

```css
waveform-playlist {
  --waveform-wave-color: #c49a6c;
  --waveform-progress-color: #63C75F;
  --waveform-cursor-color: #d08070;
  --waveform-selection-color: rgba(99, 199, 95, 0.3);
  --waveform-background: #1a1a2e;
  --waveform-track-background: #16213e;
  --waveform-timescale-color: #c49a6c;
  --waveform-timescale-background: #0f0f1a;
  --waveform-controls-background: #1a1a2e;
  --waveform-controls-text: #e0d4c8;
  --waveform-clip-header-background: rgba(0,0,0,0.4);
  --waveform-clip-header-text: #e0d4c8;
}
```

### CSS Parts (External Styling)

```css
/* Style internal parts from outside */
waveform-playlist::part(timescale) { font-family: 'Courier New'; }
waveform-playlist::part(track) { border-bottom: 1px solid #333; }
waveform-playlist::part(cursor) { width: 2px; }
waveform-track::part(controls) { width: 200px; }
waveform-track::part(waveform) { background: #111; }
waveform-vu-meter::part(segment) { border-radius: 2px; }
```

### Slots

```html
<waveform-playlist>
  <!-- Default slot: tracks -->
  <waveform-track src="vocals.mp3" name="Vocals">
    <!-- Named slot: custom track controls -->
    <div slot="controls">
      <waveform-volume-slider></waveform-volume-slider>
      <waveform-pan-slider></waveform-pan-slider>
      <button slot="controls">FX</button>
    </div>
  </waveform-track>
</waveform-playlist>
```

---

## Drag & Drop

Replace `@dnd-kit/react` with `@dnd-kit/dom` (vanilla):

```typescript
// Inside <waveform-playlist> connectedCallback
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

## React Wrapper (`@waveform-playlist/react`)

Thin wrapper that makes Web Components feel native in React:

```tsx
// @waveform-playlist/react
import { useRef, useEffect, useState, useCallback } from 'react';

export function WaveformPlaylist({
  tracks, samplesPerPixel, waveHeight, timescale,
  onReady, onTracksChange, onSelectionChange,
  theme, children, ...props
}: WaveformPlaylistProps) {
  const ref = useRef<WaveformPlaylistElement>(null);

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
      ['waveform-ready', onReady],
      ['waveform-tracks-change', (e) => onTracksChange?.(e.detail.tracks)],
      ['waveform-selection', (e) => onSelectionChange?.(e.detail)],
    ].filter(([, fn]) => fn);

    handlers.forEach(([evt, fn]) => el.addEventListener(evt, fn));
    return () => handlers.forEach(([evt, fn]) => el.removeEventListener(evt, fn));
  }, [onReady, onTracksChange, onSelectionChange]);

  return (
    <waveform-playlist
      ref={ref}
      samples-per-pixel={samplesPerPixel}
      wave-height={waveHeight}
      timescale={timescale || undefined}
      {...props}
    >
      {children}
    </waveform-playlist>
  );
}

// Convenience hook for imperative access
export function usePlaylistRef() {
  const ref = useRef<WaveformPlaylistElement>(null);
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
import { WaveformPlaylist, usePlaylistRef } from '@waveform-playlist/react';

function App() {
  const playlist = usePlaylistRef();

  return (
    <>
      <button onClick={() => playlist.play()}>Play</button>
      <WaveformPlaylist
        ref={playlist.ref}
        samples-per-pixel={1024}
        wave-height={128}
        timescale
        onReady={() => console.log('loaded')}
      >
        <waveform-track src="/audio/vocals.mp3" name="Vocals" />
        <waveform-track src="/audio/guitar.mp3" name="Guitar" />
      </WaveformPlaylist>
    </>
  );
}
```

---

## Migration Phases

### Phase 1: Foundation

Create `@waveform-playlist/components` package with core elements:

- [ ] `<waveform-playlist>` — engine + audio context lifecycle, track management
- [ ] `<waveform-track>` — track declaration via attributes, audio loading
- [ ] `<waveform-canvas>` — canvas waveform rendering (port existing canvas code)
- [ ] `<waveform-cursor>` — animated playhead
- [ ] `<waveform-timescale>` — time ruler
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
- [ ] `<waveform-transport>` with button elements

**Deliverable:** Interactive editor with drag/trim/split.

### Phase 3: Track Controls

- [ ] `<waveform-volume-slider>` — per-track and master
- [ ] `<waveform-pan-slider>`
- [ ] Mute/solo buttons
- [ ] `<waveform-vu-meter>` — port SegmentedVUMeter to Custom Element
- [ ] `<waveform-zoom-controls>`
- [ ] `<waveform-time-display>`

**Deliverable:** Full mixing controls.

### Phase 4: Optional Features

- [ ] `<waveform-record-button>` + recording integration
- [ ] `<waveform-annotation>` + annotation rendering
- [ ] `<waveform-spectrogram>` + FFT visualization
- [ ] `<waveform-piano-roll>` + MIDI rendering
- [ ] Loop region UI

**Deliverable:** Feature parity with current React version.

### Phase 5: React Wrapper

- [ ] `@waveform-playlist/react` package
- [ ] Props → attributes/properties sync
- [ ] Custom events → React callbacks
- [ ] `usePlaylistRef()` hook for imperative access
- [ ] TypeScript declarations for JSX (`IntrinsicElements`)
- [ ] Storybook stories (shared between vanilla and React)

**Deliverable:** Drop-in React package consuming Web Components.

### Phase 6: Documentation & Migration Guide

- [ ] Update website examples to use Web Components
- [ ] React migration guide (v10 → v11)
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
| **Docs** | Docusaurus (unchanged) |

---

## Breaking Changes (v10 → v11)

| v10 | v11 |
|-----|-----|
| `@waveform-playlist/browser` (React) | `@waveform-playlist/components` (Web Components) |
| `@waveform-playlist/ui-components` (React) | Merged into `components` |
| `WaveformPlaylistProvider` (React context) | `<waveform-playlist>` element |
| `usePlaylistControls()` | `element.play()`, `element.stop()`, etc. |
| `usePlaylistState()` | `element.isPlaying`, `element.selection`, etc. |
| `usePlaylistData()` | `element.tracks`, `element.duration`, etc. |
| `usePlaybackAnimation()` | `waveform-timeupdate` event |
| `onTracksChange` prop | `waveform-tracks-change` event |
| styled-components theme | CSS custom properties |
| `@dnd-kit/react` | `@dnd-kit/dom` |

React users install `@waveform-playlist/react` for a familiar props + callbacks API that wraps the Web Components internally.

---

## Open Questions

1. **Lit or vanilla?** — Lit adds ~6KB but provides reactive properties, efficient re-rendering, and `@property` decorators. Vanilla `HTMLElement` subclasses are lighter but more boilerplate. Recommend Lit for productivity.
2. **Canvas rendering strategy** — Keep current multi-canvas chunk approach, or consolidate? Current approach works well for virtual scrolling.
3. **Custom Elements Manifest** — Generate with `@custom-elements-manifest/analyzer` for IDE autocomplete and Storybook integration?
4. **SSR** — Declarative Shadow DOM support needed? Audio editors are inherently client-side, but some frameworks expect SSR compatibility.
5. **Backwards compatibility period** — Maintain v10 React packages alongside v11 Web Components for a transition period?
