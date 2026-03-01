---
sidebar_position: 9
description: "Use the PlaylistEngine directly for Svelte, Vue, vanilla JS, or headless editing without React"
---

# Using the Engine Directly

The `@waveform-playlist/engine` package is **framework-agnostic** — no React, Vue, or Svelte dependencies. It provides:

- A stateful `PlaylistEngine` class with event-driven state management
- A pluggable `PlayoutAdapter` interface for any audio backend
- Pure functions for clip/timeline operations

Use the engine directly when building with Svelte, Vue, vanilla JS, or when you need headless timeline editing (e.g., server-side or testing).

## Installation

```bash
npm install @waveform-playlist/engine @waveform-playlist/core
```

The engine's only peer dependency is `@waveform-playlist/core` (data model types).

## Quick Start

```typescript
import { PlaylistEngine } from '@waveform-playlist/engine';
import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';

// 1. Create an engine
const engine = new PlaylistEngine({
  sampleRate: 44100,
  samplesPerPixel: 1000,
});

// 2. Subscribe to state changes
engine.on('statechange', (state) => {
  console.log('Tracks:', state.tracks.length);
  console.log('Duration:', state.duration, 'seconds');
  console.log('Playing:', state.isPlaying);
});

// 3. Add tracks
const track = createTrack({
  name: 'Vocals',
  clips: [
    createClipFromSeconds({
      audioBuffer: myAudioBuffer,
      startTime: 0,
      name: 'Intro',
    }),
  ],
});

engine.setTracks([track]);

// 4. Control playback (requires a PlayoutAdapter — see below)
await engine.play();
engine.pause();
engine.stop();

// 5. Clean up
engine.dispose();
```

:::tip Headless editing
The `adapter` option is optional. Without an adapter, the engine handles all state management (tracks, selection, zoom, etc.) but playback methods are no-ops. This is useful for headless editing, testing, or building a custom audio layer.
:::

## PlaylistEngine

### Constructor Options

```typescript
const engine = new PlaylistEngine(options?: PlaylistEngineOptions);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `PlayoutAdapter` | `null` | Audio playback backend |
| `sampleRate` | `number` | `44100` | Audio sample rate |
| `samplesPerPixel` | `number` | `1000` | Initial zoom level |
| `zoomLevels` | `number[]` | `[256, 512, 1024, 2048, 4096, 8192]` | Available zoom steps (samples per pixel) |

### State Snapshot

Call `getState()` to get a read-only snapshot of the entire engine state:

```typescript
const state = engine.getState();
```

The returned `EngineState` contains:

**Tracks**

| Field | Type | Description |
|-------|------|-------------|
| `tracks` | `ClipTrack[]` | Defensive copy of all tracks and clips |
| `tracksVersion` | `number` | Monotonic counter — increments on any track mutation |
| `duration` | `number` | Total timeline duration in seconds |

**Playback**

| Field | Type | Description |
|-------|------|-------------|
| `currentTime` | `number` | Current playhead position in seconds |
| `isPlaying` | `boolean` | Whether playback is active |

**Zoom**

| Field | Type | Description |
|-------|------|-------------|
| `samplesPerPixel` | `number` | Current zoom level |
| `sampleRate` | `number` | Audio sample rate |
| `zoomIndex` | `number` | Index into the `zoomLevels` array |
| `canZoomIn` | `boolean` | Whether further zoom in is possible |
| `canZoomOut` | `boolean` | Whether further zoom out is possible |

**Selection & Loop**

| Field | Type | Description |
|-------|------|-------------|
| `selectedTrackId` | `string \| null` | Currently selected track |
| `selectionStart` | `number` | Start of selection range (guaranteed `<= selectionEnd`) |
| `selectionEnd` | `number` | End of selection range |
| `loopStart` | `number` | Start of loop region (guaranteed `<= loopEnd`) |
| `loopEnd` | `number` | End of loop region |
| `isLoopEnabled` | `boolean` | Whether loop playback is active |

**Volume**

| Field | Type | Description |
|-------|------|-------------|
| `masterVolume` | `number` | Master output volume (`0.0`–`1.0`) |

:::info Defensive copies
`getState()` returns a **defensive copy** — modifying the returned object does not affect engine state. Similarly, `setTracks()` copies its input. This prevents accidental mutations.
:::

### Track Management

```typescript
// Replace all tracks
engine.setTracks(tracks: ClipTrack[]): void;

// Append a track
engine.addTrack(track: ClipTrack): void;

// Remove by ID (no-op if not found)
engine.removeTrack(trackId: string): void;

// Select a track (no-op if already selected)
engine.selectTrack(trackId: string | null): void;
```

### Clip Editing

All clip operations use **sample-based** positions (integers, not seconds):

```typescript
// Move a clip by deltaSamples (constrained to prevent overlaps)
engine.moveClip(trackId: string, clipId: string, deltaSamples: number): void;

// Trim a clip boundary
engine.trimClip(
  trackId: string,
  clipId: string,
  boundary: 'left' | 'right',
  deltaSamples: number
): void;

// Split a clip at a sample position
engine.splitClip(trackId: string, clipId: string, atSample: number): void;
```

All three methods:
- Validate track and clip IDs (warn to console if not found)
- Apply collision constraints automatically (no overlaps)
- Enforce minimum clip duration (0.1 seconds)
- Increment `tracksVersion` and emit `statechange`

### Playback

```typescript
// Start playback (optionally from a time position)
await engine.play(startTime?: number, endTime?: number): Promise<void>;

// Pause at current position
engine.pause(): void;

// Stop and reset to beginning
engine.stop(): void;

// Seek to a time position (clamped to duration)
engine.seek(time: number): void;
```

:::note Adapter required
Playback methods delegate to the `PlayoutAdapter`. Without an adapter, `play()` still updates `isPlaying` state and emits events, but no audio plays.
:::

### Selection & Loop

```typescript
// Set selection range (automatically normalizes start <= end)
engine.setSelection(start: number, end: number): void;

// Set loop region (automatically normalizes start <= end)
engine.setLoopRegion(start: number, end: number): void;

// Toggle loop mode
engine.setLoopEnabled(enabled: boolean): void;
```

### Zoom

```typescript
// Step zoom in (lower samplesPerPixel = more detail)
engine.zoomIn(): void;

// Step zoom out
engine.zoomOut(): void;

// Jump to a specific zoom level (snaps to closest available level)
engine.setZoomLevel(samplesPerPixel: number): void;
```

### Volume

```typescript
// Master output volume (0.0–1.0)
engine.setMasterVolume(volume: number): void;

// Per-track controls (delegate directly to adapter)
engine.setTrackVolume(trackId: string, volume: number): void;
engine.setTrackMute(trackId: string, muted: boolean): void;
engine.setTrackSolo(trackId: string, soloed: boolean): void;
engine.setTrackPan(trackId: string, pan: number): void;
```

### Events

```typescript
engine.on(event, listener): void;
engine.off(event, listener): void;
```

| Event | Listener Signature | When |
|-------|--------------------|------|
| `statechange` | `(state: EngineState) => void` | Any state mutation |
| `timeupdate` | `(time: number) => void` | Every animation frame during playback |
| `play` | `() => void` | Playback starts |
| `pause` | `() => void` | Playback pauses |
| `stop` | `() => void` | Playback stops |

The `statechange` event fires on every mutation (tracks, selection, zoom, volume, playback state). Use the `tracksVersion` field to distinguish track-specific changes from other state updates.

### Cleanup

```typescript
engine.dispose(): void;
```

Stops playback, disposes the adapter, and clears all event listeners. Safe to call multiple times.

## Implementing a PlayoutAdapter

The `PlayoutAdapter` interface connects the engine to any audio backend. The engine calls these methods; your adapter translates them into audio API calls.

```typescript
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { ClipTrack } from '@waveform-playlist/core';

class MyAudioAdapter implements PlayoutAdapter {
  async init(): Promise<void> {
    // Initialize your audio context
  }

  setTracks(tracks: ClipTrack[]): void {
    // Rebuild audio graph from tracks
  }

  async play(startTime: number, endTime?: number): Promise<void> {
    // Start audio playback from startTime
  }

  pause(): void {
    // Pause audio playback
  }

  stop(): void {
    // Stop audio and reset
  }

  seek(time: number): void {
    // Move playhead to time position
  }

  getCurrentTime(): number {
    // Return current playback position in seconds
    return 0;
  }

  isPlaying(): boolean {
    // Return whether audio is currently playing
    return false;
  }

  setMasterVolume(volume: number): void {
    // Set master output level
  }

  setTrackVolume(trackId: string, volume: number): void { /* ... */ }
  setTrackMute(trackId: string, muted: boolean): void { /* ... */ }
  setTrackSolo(trackId: string, soloed: boolean): void { /* ... */ }
  setTrackPan(trackId: string, pan: number): void { /* ... */ }

  dispose(): void {
    // Clean up audio resources
  }
}

// Use it:
const engine = new PlaylistEngine({
  adapter: new MyAudioAdapter(),
});
```

:::tip Built-in adapter
The `@waveform-playlist/playout` package provides `createToneAdapter()` — a production `PlayoutAdapter` built on Tone.js. The React provider uses this internally.
:::

## Pure Operations

The engine also exports pure functions used internally. These are useful for custom UIs or headless processing:

### Clip Operations

```typescript
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  splitClip,
  canSplitAt,
  calculateSplitPoint,
} from '@waveform-playlist/engine';

// Constrain a drag delta to prevent overlaps
const safeDelta = constrainClipDrag(clip, deltaSamples, sortedClips, clipIndex);

// Constrain a boundary trim
const safeTrim = constrainBoundaryTrim(clip, delta, 'left', sortedClips, index, minDuration);

// Check if a split is valid, then split
if (canSplitAt(clip, samplePosition, minDuration)) {
  const { left, right } = splitClip(clip, samplePosition);
}

// Snap split point to pixel boundary
const snapped = calculateSplitPoint(samplePosition, samplesPerPixel);
```

### Timeline Operations

```typescript
import {
  calculateDuration,
  findClosestZoomIndex,
  calculateZoomScrollPosition,
  clampSeekPosition,
} from '@waveform-playlist/engine';

// Total duration across all tracks
const duration = calculateDuration(tracks);

// Find nearest zoom level
const index = findClosestZoomIndex(targetSpp, zoomLevels);

// Keep viewport centered during zoom
const newScrollLeft = calculateZoomScrollPosition(
  oldSpp, newSpp, scrollLeft, containerWidth, sampleRate
);

// Clamp seek position
const time = clampSeekPosition(requestedTime, duration);
```

### Viewport Operations

```typescript
import {
  calculateViewportBounds,
  getVisibleChunkIndices,
  shouldUpdateViewport,
} from '@waveform-playlist/engine';

// Calculate visible region with overscan buffer
const { visibleStart, visibleEnd } = calculateViewportBounds(scrollLeft, containerWidth);

// Which canvas chunks are visible?
const chunks = getVisibleChunkIndices(totalWidth, chunkWidth, visibleStart, visibleEnd);

// Should we recalculate? (debounce small scroll movements)
if (shouldUpdateViewport(oldScroll, newScroll, threshold)) {
  // re-render
}
```

## Key Concepts

### Sample-Based Architecture

All timing is stored as **integer sample counts**, not floating-point seconds. This eliminates precision errors that cause pixel gaps between clips.

```typescript
// Positions are in samples
clip.startSample;        // 44100  (= 1 second at 44.1kHz)
clip.durationSamples;    // 88200  (= 2 seconds)
clip.offsetSamples;      // 0      (start of source audio)

// Convert to seconds when needed
const seconds = clip.startSample / clip.sampleRate;
```

Use `createClipFromSeconds()` for convenience — it handles the conversion internally.

### No-Op Emission Guards

The engine avoids unnecessary listener calls. Mutating methods bail early when:

- A constrained drag/trim delta resolves to zero
- A track/clip ID is not found
- A zoom level is already at the requested value
- Selection or volume values haven't changed

This prevents wasted re-renders in your UI framework.

### Defensive Copying

- `setTracks()` copies the input array — your original array is not retained
- `getState()` returns copies of tracks — modifying the snapshot doesn't affect engine state

### Invariant Normalization

The engine normalizes ordering automatically:

- `setSelection(10, 5)` → `selectionStart = 5, selectionEnd = 10`
- `setLoopRegion(20, 10)` → `loopStart = 10, loopEnd = 20`

Consumers can trust that `EngineState.selectionStart <= selectionEnd` and `loopStart <= loopEnd`.

### tracksVersion Counter

The `tracksVersion` field in `EngineState` is a monotonic counter that increments **only** on track mutations (`setTracks`, `addTrack`, `removeTrack`, `moveClip`, `trimClip`, `splitClip`). It does **not** increment on selection, zoom, volume, or loop changes. Use it to skip expensive operations (like audio graph rebuilds) when only non-track state changed.

## Example: Vanilla JavaScript

A plain DOM UI that reacts to engine state — no framework required:

```html
<div id="app">
  <p id="status">Stopped</p>
  <p id="info">Duration: 0s | Tracks: 0</p>
  <button id="play">Play</button>
  <button id="pause">Pause</button>
  <button id="stop">Stop</button>
  <button id="zoom-in">Zoom In</button>
  <button id="zoom-out">Zoom Out</button>
</div>

<script type="module">
  import { PlaylistEngine } from '@waveform-playlist/engine';
  import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';

  const engine = new PlaylistEngine({ sampleRate: 44100 });

  // Update DOM on every state change
  engine.on('statechange', (state) => {
    document.getElementById('status').textContent =
      state.isPlaying ? 'Playing' : 'Stopped';
    document.getElementById('info').textContent =
      `Duration: ${state.duration.toFixed(2)}s | Tracks: ${state.tracks.length}`;
    document.getElementById('zoom-in').disabled = !state.canZoomIn;
    document.getElementById('zoom-out').disabled = !state.canZoomOut;
  });

  // Wire up buttons
  document.getElementById('play').onclick = () => engine.play();
  document.getElementById('pause').onclick = () => engine.pause();
  document.getElementById('stop').onclick = () => engine.stop();
  document.getElementById('zoom-in').onclick = () => engine.zoomIn();
  document.getElementById('zoom-out').onclick = () => engine.zoomOut();
</script>
```

## Example: Svelte Integration

A minimal Svelte store that subscribes to engine state:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { PlaylistEngine } from '@waveform-playlist/engine';

  const engine = new PlaylistEngine({ sampleRate: 44100 });

  const state = writable(engine.getState());

  function handleStateChange(newState) {
    state.set(newState);
  }

  onMount(() => {
    engine.on('statechange', handleStateChange);
  });

  onDestroy(() => {
    engine.dispose();
  });
</script>

<div>
  <p>Duration: {$state.duration.toFixed(2)}s</p>
  <p>Playing: {$state.isPlaying}</p>
  <p>Tracks: {$state.tracks.length}</p>

  <button on:click={() => engine.play()}>Play</button>
  <button on:click={() => engine.pause()}>Pause</button>
  <button on:click={() => engine.stop()}>Stop</button>

  <button on:click={() => engine.zoomIn()} disabled={!$state.canZoomIn}>Zoom In</button>
  <button on:click={() => engine.zoomOut()} disabled={!$state.canZoomOut}>Zoom Out</button>
</div>
```

## TypeScript

All types are exported from `@waveform-playlist/engine`:

```typescript
import type {
  EngineState,
  EngineEvents,
  PlaylistEngineOptions,
  PlayoutAdapter,
} from '@waveform-playlist/engine';
```

Data model types come from `@waveform-playlist/core`:

```typescript
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
```

### EngineState

```typescript
interface EngineState {
  tracks: ClipTrack[];
  tracksVersion: number;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  samplesPerPixel: number;
  sampleRate: number;
  selectedTrackId: string | null;
  zoomIndex: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  selectionStart: number;
  selectionEnd: number;
  masterVolume: number;
  loopStart: number;
  loopEnd: number;
  isLoopEnabled: boolean;
}
```

### PlaylistEngineOptions

```typescript
interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  sampleRate?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[];
}
```

### PlayoutAdapter

```typescript
interface PlayoutAdapter {
  init(): Promise<void>;
  setTracks(tracks: ClipTrack[]): void;
  play(startTime: number, endTime?: number): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  isPlaying(): boolean;
  setMasterVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;
  dispose(): void;
}
```

### EngineEvents

```typescript
interface EngineEvents {
  statechange: (state: EngineState) => void;
  timeupdate: (time: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}
```

## See Also

- [Hooks Reference](/docs/api/hooks) — React hooks that wrap the engine
- [Loading Audio](/docs/guides/loading-audio) — Creating tracks with `useAudioTracks`
- [Track Management](/docs/guides/track-management) — Adding and removing tracks
