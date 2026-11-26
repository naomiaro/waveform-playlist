---
sidebar_position: 9
description: "Use the PlaylistEngine directly for Svelte, Vue, vanilla JS, or headless editing without React"
---

# Using the Engine Directly

The `@waveform-playlist/engine` package is **framework-agnostic** — no React, Vue, or Svelte dependencies. It provides:

- A stateful `PlaylistEngine` class with event-driven state management
- An arrangement (`createArrangement()`): the owner of the tracks, the mix and the undo history, which an engine plays
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

// 1. Create an engine (use AudioContext.sampleRate for the hardware rate)
const engine = new PlaylistEngine({
  sampleRate: 48000, // Match your AudioContext.sampleRate
  samplesPerPixel: 1024, // must be one of the zoom levels
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
engine.play();
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
| `arrangement` | `Arrangement` | a new, empty one | The arrangement to play, from `createArrangement()`. See [The Arrangement](#the-arrangement) |
| `sampleRate` | `number` | `48000` | Audio sample rate (use `AudioContext.sampleRate` for hardware rate) |
| `samplesPerPixel` | `number` | `1024` | Initial zoom level. Must be one of `zoomLevels`, or the constructor throws |
| `zoomLevels` | `number[]` | `[256, 512, 1024, 2048, 4096, 8192]` | Available zoom steps (samples per pixel) |
| `undoLimit` | `number` | `100` | Maximum number of undo steps. Only when the engine makes its own arrangement; with `arrangement` it is ignored, with a console warning |
| `attachDecodeContext` | `boolean` | `true` | With an adapter, the engine gives its arrangement `adapter.audioContext` to decode audio with and takes it away in `dispose()`. `false`: the host attaches a context itself. See [Loading Audio](#loading-audio) |
| `bpm` | `number` | `120` | Initial tempo |
| `ppqn` | `number` | `960` | Pulses per quarter note without an adapter. With an adapter, `adapter.ppqn` is used |

### State Snapshot

Call `getState()` to get the engine state as one object:

```typescript
const state = engine.getState();
```

The returned `EngineState` contains:

**Tracks**

| Field | Type | Description |
|-------|------|-------------|
| `tracks` | `readonly ClipTrack[]` | The tracks and their clips, each track with its current volume, mute, solo and pan. Not a copy: read it, never write to it |
| `tracksVersion` | `number` | Monotonic counter — increments on structural track changes only |
| `mixerVersion` | `number` | Monotonic counter — increments on every change of the current mix: a per-track mixer edit (volume/mute/solo/pan), an undo, a redo or an aborted transaction that brings back other values, and the start or end of a take's mute on a track that is in the current tracks |
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

**Tempo & History**

| Field | Type | Description |
|-------|------|-------------|
| `bpm` | `number` | Current base tempo |
| `ppqn` | `number` | Pulses per quarter note |
| `canUndo` | `boolean` | Whether there is a step to undo |
| `canRedo` | `boolean` | Whether there is a step to redo |

:::warning `tracks` is shared, not copied
`getState()` returns a new object on every call, but `state.tracks` is the engine's own array, shared with the undo history. It is the same array until the tracks or the mix change. Never write to the array, to a track or to a clip in it: make a copy and hand the copy to `updateTrack()`. Outside production builds the array, each track, its `clips` array and each clip are frozen, so a write throws. See [Shared, Read-Only Tracks](#shared-read-only-tracks).

`setTracks()`, `addTrack()` and `updateTrack()` copy the tracks they are given, so the objects you pass in stay yours.
:::

### Track Management

```typescript
// Replace all tracks (clears the undo history and ends an open transaction)
engine.setTracks(tracks: readonly ClipTrack[]): void;

// Append a track
engine.addTrack(track: ClipTrack): void;

// Remove by ID (no-op if not found)
engine.removeTrack(trackId: string): void;

// With a track: replace the track that has this ID (no-op if no track has it).
// Without one: send the current track to the adapter again.
engine.updateTrack(trackId: string, track?: ClipTrack): void;

// Move a track to another place in the order (not audible; the adapter is not called)
engine.reorderTrack(trackId: string, toIndex: number): void;

// Select a track (no-op if already selected)
engine.selectTrack(trackId: string | null): void;
```

`setTracks()`, `addTrack()` and `updateTrack(id, track)` check the tracks before they change anything, and throw an `Error` for:

- a track whose clips do not match its `kind`;
- a track ID that another track has;
- two clips with the same ID on one track (the same clip ID on two different tracks is accepted).

A track's `volume`, `muted`, `soloed` and `pan` fields are the mix it enters with. They are read when its ID has no mixer entry yet. `setTracks()` keeps the mix of an ID that is in the tracks it replaces; `updateTrack(id, track)` keeps the track's mix, also when the new track has another ID. In those cases the fields are not read. `addTrack()` reads them, also for the ID of a track removed earlier. Use the [volume methods](#volume) to change the mix.

The mix holds an entry for each current track; each undo and redo step keeps the mix it had, so a removed track's entry is in the step from before the removal and comes back with it.

`updateTrack(id, track)` calls the adapter only when the track plays differently from before. A track whose loaded clips are the same objects in the same order and whose own fields are unchanged is not sent; the undo step and the `statechange` are the same either way. Clips are compared by identity: a clip object this track already holds (one taken from this track in `getState().tracks` or `arrangement.getTracks()`) is kept as it is, and any other clip object, also one held by another track, is copied and counts as changed.

`updateTrack(id, track)` may give the track an ID no other track has. The track keeps its mix, and the adapter receives every track through `setTracks`.

`selectedTrackId` becomes `null` when its track goes away: by `removeTrack()`, by an undo, a redo or an aborted transaction that takes the track away, or when `updateTrack()` gives the track a new ID. `setTracks()` leaves it alone, also when the new tracks do not include it: a host may empty the tracks and add them again.

### Clip Editing

All clip operations use **sample-based** positions (integers, not seconds):

```typescript
// Move a clip by deltaSamples (constrained to prevent overlaps).
// Returns the delta actually applied (0 when the clip cannot move).
engine.moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter?: boolean): number;

// Trim a clip boundary
engine.trimClip(
  trackId: string,
  clipId: string,
  boundary: 'left' | 'right',
  deltaSamples: number,
  skipAdapter?: boolean
): void;

// Split a clip at a sample position
engine.splitClip(trackId: string, clipId: string, atSample: number): void;
```

All three methods:
- Validate track and clip IDs (warn to console if not found)
- Apply collision constraints automatically (no overlaps)
- Enforce minimum clip duration (0.1 seconds)
- Increment `tracksVersion` and emit `statechange`
- Are undo steps

With `skipAdapter` set to `true`, `moveClip()` and `trimClip()` change the state and emit `statechange` without calling the adapter. A drag uses this for each pointer move and sends the track once on drop with `engine.updateTrack(trackId)`.

### Playback

```typescript
// Start playback (optionally from a time position)
engine.play(startTime?: number, endTime?: number): void;

// Pause at current position
engine.pause(): void;

// Stop and return to the position playback started from
engine.stop(): void;

// Seek to a time position (any non-negative value — plays silence beyond audio)
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

// Per-track mix: each call is an undo step (see Undo & Redo)
engine.setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
engine.setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
engine.setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
engine.setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;

interface MixerChangeOptions {
  /** Changes with the same id, one after another, are one undo step. */
  gesture?: string;
  /** Not an undo step: the value is written into every saved state as well. */
  undoable?: false;
}

// The take's mute: the track a take records onto plays muted; not an undo step
engine.setTrackRecording(trackId: string, recording: boolean): void;
```

Each per-track method stores the value in the arrangement's mix, calls the adapter, increments `mixerVersion` and emits `statechange`; the next `state.tracks` carries the value in that track's field. Each call is an undo step, unless its options say otherwise ([Mixer moves](#mixer-moves)). They act on a track that is in the current tracks, and on a value that changes. For any other track ID (one the engine has never seen, or a removed track) and for the value the track already has, no state changes, no undo step is made and no `statechange` is emitted, but the adapter method is still called.

`setTrackRecording()` marks the track a take is recording onto, and clears it when the take ends. That track plays muted for the take: `state.tracks` and the adapter have it muted, while its mute in `arrangement.getMixer()` stays as it is and comes back when the take ends (`arrangement.recordingTrackIds` holds the IDs). A mute set during the take is stored and heard after it. It is not an undo step, and undo, redo, an aborted transaction, `setTracks()` and `clearHistory()` do not change which tracks are recording. An ID that is not a current track can be set and mutes nothing until a track of that ID enters. It is not a record-arm: `<daw-editor>` sets it for the length of a take.

### Undo & Redo

```typescript
engine.undo(): void;
engine.redo(): void;
engine.canUndo; // boolean, also in EngineState
engine.canRedo;
engine.clearHistory(): void;

// Group several changes into one undo step (a drag)
engine.beginTransaction(): void;
engine.commitTransaction(): void;
engine.abortTransaction(): void; // put the tracks and the mix back as they were at beginTransaction()
```

- Undo steps are made by `addTrack()`, `removeTrack()`, `updateTrack(id, track)`, `reorderTrack()`, `moveClip()`, `trimClip()`, `splitClip()`, `setTrackVolume()`, `setTrackMute()`, `setTrackSolo()` and `setTrackPan()`. `setTracks()` clears the history. `setTrackRecording()`, `setTempo()`, the master volume, selection, loop and zoom are not undo steps.
- Undo, redo and an aborted transaction restore the tracks, the clips and the mix of the state they return to. Undoing a `removeTrack()` brings the track back with the mix it had; undoing an `updateTrack()` that gave a track a new ID brings back the old ID with the mix it had then. An undoable mixer change made inside a transaction is part of it, and an abort takes it back; one made with `{ undoable: false }` is written into the transaction's base as well, so an abort keeps it. An undo that changes only the mix increments `mixerVersion`, not `tracksVersion`.
- `undo()` and `redo()` called while a transaction is open abort the transaction first.
- `commitTransaction()` adds one undo step and emits `statechange` when the transaction changed something. When the tracks and the mix are back where the transaction began (the same track objects in the same order and the same mixer values; for example a track added during the transaction and then taken out with the arrangement's `removeTrack(id, { undoable: false })`. A clip moved away and back is not that: the clip is a new object), it adds no step and emits nothing. `clearHistory()` emits `statechange` when there was history. So `canUndo` and `canRedo` in the state are current.
- After an undo, a redo or an aborted transaction the adapter receives only the tracks that differ when the same track IDs are there before and after: its `updateTrack` for each, or, when the adapter has no `updateTrack`, one `setTracks` per differing track. When the set of IDs differs it receives one `setTracks`. An undo of a reorder calls no adapter method. A mixer value that differs reaches the adapter through its setter (`setTrackVolume` and so on), because a track call does not carry the mix to every adapter; an undo that changes only the mix calls the setters and no track method.

#### Mixer moves

By default each mixer call is an undo step of its own. A fader drag makes many calls, so pass the same `gesture` ID for all of them: calls with one ID, one after another, are one step. Another undo step, an undo, a redo, `clearHistory()`, `setTracks()` or a transaction in between ends that step, and the next call with the ID makes a new one; a take's mute (`setTrackRecording()`), a call that changes nothing and an `{ undoable: false }` call do not (unless the `undoable: false` call makes the gesture's step equal to the current state, which drops the step; one that makes the step below equal to the gesture's step leaves the gesture going). When a gesture ends where its step began, the step is dropped and the history it found comes back: the redo states its first call cleared, and a step the undo limit evicted for it. `{ undoable: false }` makes no step: the value is written into every undo and redo state as well, so no undo or redo brings back an older one; it is for values that are not the user's edit, such as automation, and it wins over `gesture`.

`createMixerGesture()`, from `@waveform-playlist/core`, makes the IDs for one control. Use one per slider:

```typescript
import { createMixerGesture } from '@waveform-playlist/core';

const gesture = createMixerGesture();
const detach = gesture.attach(slider); // ends the gesture on the slider's own events
slider.addEventListener('input', () => {
  engine.setTrackVolume(trackId, slider.valueAsNumber, { gesture: gesture.id });
});

gesture.end(); // ends the gesture by hand: the next call starts a new step
detach();      // removes the listeners attach added
```

`attach(input)` ends the gesture on the input's `change` event (the end of a pointer drag), except while an arrow, Page Up, Page Down, Home or End key is held down: then on that key's `keyup`, so a held key that repeats is one step. A `blur` ends it too. Mute and solo buttons need no helper: each click is one step. The IDs are unique per helper, also across two installed copies of the package.

### Events

```typescript
engine.on(event, listener): void;
engine.off(event, listener): void;
```

| Event | Listener Signature | When |
|-------|--------------------|------|
| `statechange` | `(state: EngineState) => void` | Any state change |
| `play` | `() => void` | Playback starts |
| `pause` | `() => void` | Playback pauses |
| `stop` | `() => void` | Playback stops |

The `statechange` event fires on every change (tracks, mix, undo history, selection, zoom, volume, playback state), after the engine has made its adapter call for that change. A change made from inside a `statechange` listener is delivered after the one being handled has reached every listener, so all listeners see the changes in the order they were made. One track edit made from inside a listener is still the current state when it is delivered, and the adapter gets the call for that edit (`updateTrack`, `addTrack` or `removeTrack`). Two or more track edits made in one listener run are different: the first is delivered after the tracks have changed again, so the engine sends the adapter every track once (`setTracks`, a full rebuild that can interrupt playback), and the edits still waiting make no adapter call. A reorder and a move made with `skipAdapter` count as track edits here, although neither needs an adapter call of its own. When a rebuild matters, make several track edits from an event handler, not from inside a `statechange` or `subscribe` listener (a transaction does not change this: it groups undo steps, not adapter calls). After an adapter call for a track change has thrown, the next track change also sends every track. If the adapter throws while a track change is applied, that change emits no `statechange` and the error reaches the caller of the engine method; for a change made from inside a listener, that is the caller of the outer method, the one whose `statechange` the listener was handling. Use the `tracksVersion` field to distinguish structural track changes, and `mixerVersion` to distinguish per-track mixer edits (volume/mute/solo/pan), from other state updates.

### Cleanup

```typescript
engine.dispose(): void;
```

Disposes the adapter, clears all event listeners, stops following the arrangement and takes back the audio context it gave the arrangement to decode with (loads in flight are aborted and stay pending). Safe to call multiple times. An arrangement you passed in is not cleared: see [The Arrangement](#the-arrangement).

## The Arrangement

An arrangement is the owner of three things: the tracks with their clips, the mix (volume, mute, solo and pan by track ID), and the undo history with its transactions. Everything else reads it and changes it by calling its methods. A `PlaylistEngine` plays an arrangement: it follows it by subscription, and for each change it makes the adapter call and emits `statechange`. The engine owns the rest: transport, selection, loop, zoom, the selected track and the master volume.

An engine built without the `arrangement` option makes an arrangement of its own, and every example above works that way. Make the arrangement yourself when it has to exist before the engine does, or outlive it:

```typescript
import { createArrangement, PlaylistEngine } from '@waveform-playlist/engine';

const arrangement = createArrangement({
  tracks: [track], // the first tracks; not an undo step
  undoLimit: 50,   // default 100
});

const engine = new PlaylistEngine({ adapter, arrangement });
```

### Reading

```typescript
// The tracks and their clips. The same array until they change.
arrangement.getTracks(); // readonly ArrangementTrack[]: clips are AudioClip | LoadingClip

// The current mix by track ID. The same Map until a value changes, an entry is added or entries are dropped.
arrangement.getMixer(); // ReadonlyMap<string, TrackMixerValues>
arrangement.getMixer().get(trackId); // { volume, muted, soloed, pan } | undefined

// Told once per change (tracks, mix or history), in the order the changes were made.
const unsubscribe = arrangement.subscribe(() => {
  render(arrangement.getTracks(), arrangement.getMixer());
});

arrangement.tracksVersion; // counts changes to the tracks
arrangement.mixerVersion;  // counts the changes of the current mix (the setters, an undo of the mix, a take's mute)
arrangement.canUndo;
arrangement.canRedo;
```

`getTracks()` holds each track as it entered: its `volume`, `muted`, `soloed` and `pan` fields are not updated by the mixer setters. The current values are in `getMixer()`. (`engine.getState().tracks` is the same tracks with the current mix written into those fields and without the clips that are [still loading](#loading-audio).)

A subscriber is called after the engine has made its adapter call for that change. Two changes reach subscribers without the adapter being in step: one made with `skipAdapter`, and the `startTick` assignment when an engine attaches, which subscribers hear before that engine sends its first tracks to its adapter. `getMixer()` is also replaced, without a change of `mixerVersion`, when a track with a new ID enters or entries are dropped, and an undo, a redo or an abort replaces it with the mix of the state it returns to. A subscriber that throws is reported with `console.warn` and does not fail the change. `getTracks()` and `getMixer()` return the same object until it changes, so a subscriber can tell what changed by comparing with what it read last time.

Make track changes from an event handler (or a listener of `arrangement.sources`), not from inside a `subscribe()` or `statechange` listener: two or more track edits made inside one listener run make an engine send its adapter every track at once (`setTracks`), which can interrupt playback (see [Events](#events)). The same rule holds under the React provider: see [Loading Audio](/docs/react/guides/loading-audio#adding-tracks-at-runtime).

### Changing

The arrangement has the engine's track, clip, mixer, recording and history methods: `setTracks`, `addTrack`, `removeTrack`, `updateTrack`, `reorderTrack`, `moveClip`, `trimClip`, `splitClip`, `getClipBounds`, `constrainTrimDelta`, `setTrackVolume`, `setTrackMute`, `setTrackSolo`, `setTrackPan` (each with the same `options`), `setTrackRecording`, `undo`, `redo`, `clearHistory`, `beginTransaction`, `commitTransaction` and `abortTransaction`. The engine's methods call them, so a change made through either reaches the adapter and emits `statechange`.

Besides [loading audio](#loading-audio), two things are on the arrangement only:

```typescript
// Remove a track for good: no undo step, and no undo or redo brings it back
arrangement.removeTrack(trackId, { undoable: false });

// Replace a track with a function of the current one (not called for an unknown ID)
arrangement.updateTrack(trackId, (track) => ({ ...track, name: 'Bass' }));
```

`updateTrack()`, given a track or a function, keeps each clip object the track already holds and copies every other clip. The clips you did not replace are therefore the same objects afterwards.

`removeTrack(trackId, { undoable: false })` is for a track that should never have been there, such as a dropped file that could not be decoded. The track is taken out of the current tracks and out of every undo and redo state, and an undo step that no longer changes anything is dropped. Its mixer values go with it.

The arrangement's `moveClip()` and `trimClip()` have no `skipAdapter` argument; that one is the engine's.

### Loading Audio

A clip of an arrangement may name its audio instead of carrying it. The arrangement fetches and decodes each source once, reports where each one is, and replaces the clip with a loaded one when the audio arrives.

An arrangement's tracks are `ArrangementTrack` (from `@waveform-playlist/core`): each clip is an `AudioClip` (loaded) or a `LoadingClip` (a `src` and times in seconds; the audio is not loaded yet). `isLoadingClip(clip)` tells them apart. `createArrangement({ tracks })`, `getTracks()`, `setTracks()`, `addTrack()` and `updateTrack()` of the arrangement use that type. The engine's own `setTracks()`, `addTrack()` and `updateTrack()` still take `ClipTrack`, whose clips are all loaded.

`audioTrack()` from core builds a track with one clip. With `src` and no `audioBuffer` that clip is a `LoadingClip`:

```typescript
import { createArrangement, PlaylistEngine } from '@waveform-playlist/engine';
import { audioTrack, isLoadingClip } from '@waveform-playlist/core';

const arrangement = createArrangement({
  tracks: [
    audioTrack({ id: 'guitar', src: '/audio/guitar.opus' }),
    audioTrack({ id: 'vocals', src: '/audio/vocals.opus', start: 4 }), // seconds
  ],
});

// Nothing is fetched yet: there is no audio context to decode with.
arrangement.sources.getSnapshot().pendingCount; // 2

// An engine with an adapter attaches adapter.audioContext, and the loads start.
const engine = new PlaylistEngine({ adapter, arrangement });

// Where each source is
const stop = arrangement.sources.subscribe(({ sources, isLoading }) => {
  showSpinner(isLoading);
  for (const [src, state] of sources) {
    if (state.status === 'failed') showRetryButton(src, state.error); // state.error is an Error
  }
});

// The tracks: narrow a clip before reading its sample fields
arrangement.subscribe(() => {
  for (const track of arrangement.getTracks()) {
    for (const clip of track.clips) {
      if (isLoadingClip(clip)) {
        drawPlaceholder(clip.start ?? 0, clip.duration); // seconds; duration may be undefined
      } else {
        drawClip(clip.startSample, clip.durationSamples);
      }
    }
  }
});

// A source whose load failed is started again only by this
arrangement.retry('/audio/guitar.opus');
```

A `src` is a URL string, a `Blob` or a `File`. A string is one source however many clips name it; a `Blob` or `File` is a source by identity.

#### What a loading clip is, and is not

- It is copied on its way in, stays the same object through every operation on its track, keeps its place among the track's clips and is part of the undo steps. It has no `startTick`.
- It cannot be edited. `moveClip()`, `trimClip()` and `splitClip()` on it log a console warning (`… is still loading and cannot be edited until its audio has loaded`) and change nothing; `getClipBounds()` returns `null` and `constrainTrimDelta()` returns `0`. A loaded clip that is moved or trimmed does not collide with it.
- It is an audio clip, whatever else it carries. `createArrangement({ tracks })`, `setTracks()`, `addTrack()` and `updateTrack()` throw for a `kind: 'midi'` track that holds one, with the same error as for a MIDI track that holds a loaded audio clip, and change nothing.
- An engine neither plays nor reports it. The tracks an adapter is sent and `getState().tracks` are each track without its loading clips, and `getState().duration` counts loaded clips only. Read `arrangement.getTracks()` to draw the clips that are still loading.
- A change that leaves a track's loaded clips (the same objects in the same order) and its own fields as they were makes no adapter call for that track: adding, replacing or removing a loading clip, and an undo or a redo of that. The `statechange` is still emitted. `engine.updateTrack(id)` with no track always sends.

#### Which sources are loaded

Every source a loading clip names in the current tracks, in an undo or redo state, or in the base of an open transaction. An undo therefore never fetches a source again. When no state names a source any more (the track was removed and the history cleared, or `setTracks()` replaced everything), its load is aborted and its audio is let go; a clip that names it later starts a new fetch.

A loaded clip that carries both `src` and `audioBuffer` (what `audioTrack({ src, audioBuffer })` builds) counts as well: its buffer is used for that source, nothing is fetched, and a loading clip of the same `src` is loaded from it. A loaded clip with `src` and no `audioBuffer` is not fetched and does not appear in `sources`: it never gets audio from the arrangement.

#### When the audio arrives

Every loading clip that names the source becomes an `AudioClip`:

- `start`, `offset` and `duration` in seconds become integer samples at the sample rate of the decoded buffer. Without a `duration` the clip runs from `offset` to the end of the audio.
- The clip keeps its `id`, and its `name`, `color`, `gain`, `fadeIn`, `fadeOut`, `waveformData` and `src`.
- A `duration` that runs past the end of the audio is cut to it, with one console warning.
- It gets a `startTick` when an engine is attached; without one, when the next engine attaches.

This happens in the current tracks and in every undo and redo state, so an undo brings back a loaded clip. It is not an undo step. When the current tracks changed, subscribers are told once and `tracksVersion` goes up by one; an engine sends each track that gained a clip to its adapter (`updateTrack`, or `setTracks` for an adapter without it) and emits one `statechange`. When only undo or redo states changed, nobody is told except the subscribers of `sources`.

A clip added later that names a source that is already loaded is a loaded clip when the call that added it returns. A clip that comes in carrying `src` and `audioBuffer` for a source other loading clips are waiting for loads those clips inside the same call: one notification and one `statechange`, and the adapter is also sent each other track that gained a clip.

If the adapter throws while an engine applies audio that arrived, there is no caller to fail. The engine logs `[waveform-playlist] The playout adapter failed while loaded audio was applied:` with the error, still emits the `statechange`, and sends the adapter every track at the next track change. For every other change an adapter that throws fails the call that made the change, and no `statechange` is emitted for it.

#### `arrangement.sources` and `retry()`

`sources` is a `ValueSource`: `getSnapshot()` returns the current value and `subscribe(listener)` calls the listener with each new one (the shape React's `useSyncExternalStore` takes). The value:

```typescript
interface ArrangementSourcesValue {
  sources: ReadonlyMap<ClipSource, ArrangementSourceState>;
  pendingCount: number;
  failedCount: number;
  isLoading: boolean; // true while a source is pending
}

interface ArrangementSourceState {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error; // when failed
}
```

It is the same object until a source is added or dropped, a status changes, or a failed source gets another error. A new value is published after the subscribers of `arrangement.subscribe()` have been told about the change it belongs to, so a listener of `sources` that sees `loaded` finds the loaded clip in `getTracks()`. The other way round, a listener of `arrangement.subscribe()` that finds the loaded clip still reads its source as `pending` in `sources`. The order of the entries of `sources` means nothing.

A source is `failed` in two cases:

| Case | What the tracks show | `error` | How it ends |
| --- | --- | --- | --- |
| The load failed: the fetch, the decode, or getting the audio context | No track changes; the clips stay loading clips | What the loader rejected with | `arrangement.retry(src)` starts the load again. Nothing else does |
| A clip in the current tracks cannot be made from the audio: its `offset` is at or past the end, or its `start`, `offset` or `duration` is not a usable number | That clip stays a loading clip; other clips of the same source are loaded | An `Error` with the message `clip "<id>": <reason>` | When that clip is no longer in the current tracks. `retry()` does nothing |

For the second case, replace or remove the clip with `updateTrack()`: the failure is cleared at once. Only clips in the current tracks count, so an undo step that still holds the clip does not keep the failure, and an undo that brings the clip back brings the failure back.

`retry(src)` does nothing for a source that is pending or loaded, and for one no clip names.

#### How a source is loaded

`createArrangement({ loadSource })` replaces how a source becomes an `AudioBuffer`. The default, exported as `defaultLoadSource`, fetches a string (or reads a `Blob` or `File` with `arrayBuffer()`) and decodes it with `audioContext.decodeAudioData()`. It checks the abort signal before it starts and after each step, so a cancelled load neither decodes nor resolves.

```typescript
import { createArrangement, defaultLoadSource } from '@waveform-playlist/engine';
import type { LoadSource } from '@waveform-playlist/engine';

const loadSource: LoadSource = async (src, { signal, audioContext }) => {
  if (typeof src !== 'string') return defaultLoadSource(src, { signal, audioContext });
  const response = await fetch(src, { signal, credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  return audioContext.decodeAudioData(await response.arrayBuffer());
};

const arrangement = createArrangement({ loadSource });
```

A `loadSource` of your own should pass `signal` to what it awaits: the arrangement aborts a load when its source is no longer named and when the audio context is taken away.

The error messages `defaultLoadSource` writes itself:

| Message | When |
| --- | --- |
| `Failed to fetch <source>: <status> <statusText>` | The response is not ok |
| `Failed to fetch <source>` | `fetch` threw a `TypeError` (a network failure, a refused cross-origin request). The `TypeError` is in the error's `cause` when the source is named unchanged (see below) |
| `Decoded audio is empty: <source>` | The decoded buffer has no samples |
| `Failed to decode audio: <source>` | The decoder rejected with something that is not an `Error` |

In these, `<source>` is the URL without its query string, its fragment and a user name or password before the host (each can hold a secret). A URL in which the browser's URL parser finds a user name or password (also in forms such as one slash after the scheme, backslashes, or white space in front) is named in its parsed, absolute form without them. A malformed URL that the parser refuses loses only its query string and fragment. The browser's `TypeError` is kept in `cause` only when the name in the message is the source unchanged. When anything was left out of the name (a user name or password, a query string, a fragment, a `data:` or `blob:` URL) the error has no `cause`, because the browser's own message can quote the whole URL (Chromium's does for a URL with a user name or password). A `data:` or `blob:` URL is never echoed (`data: URL`, `blob: URL`), a `File` is called by its name and any other `Blob` is `Blob`. An `Error` the browser's decoder rejects with is passed on unchanged: its message is the browser's and does not name the source. An abort is passed on as the `AbortError` it is.

#### The audio context to decode with

Nothing is fetched until the arrangement has an audio context to decode with. Until then its sources are `pending`.

- `new PlaylistEngine({ adapter, arrangement })` attaches `adapter.audioContext` in its constructor and takes it away in `dispose()`.
- An engine without an adapter attaches nothing.
- With `attachDecodeContext: false` the engine leaves it to you.

To attach one yourself:

```typescript
import { attachDecodeContext } from '@waveform-playlist/engine';

// getContext is called for each load, so it may create or resume the context when the first one is needed
const detach = attachDecodeContext(arrangement, async () => audioContext);

detach();
```

`detach()` aborts the loads in flight. Their sources stay `pending`, loaded sources stay loaded, and the next attach starts the aborted ones again. That is what happens between one engine's `dispose()` and the next engine. One context at a time: a second attach while one is attached logs a console warning and replaces the first, and the first one's `detach` then does nothing. A `getContext` that rejects fails the source with that error; `retry()` asks again.

### Without an Engine

An arrangement needs no engine. Every method above works on one that has none, with two differences:

- Clips are given no `startTick`, because there is no tempo to convert with. A clip that came with one keeps it until it is moved, trimmed on the left or split; after that it has none. When an engine attaches, every clip without a `startTick` gets one from its `startSample`, in the current tracks and in every undo and redo state.
- The shortest a clip may be (0.1 seconds) is counted at the clip's own sample rate instead of the engine's.

### Swapping the Engine

An arrangement outlives its engine. Dispose the engine, build another on the same arrangement, and the tracks, the mix and the undo history are all still there:

```typescript
const arrangement = createArrangement();
let engine = new PlaylistEngine({ adapter: adapterA, arrangement });
engine.setTracks(tracks);
engine.setTrackVolume(trackId, 0.5);
engine.moveClip(trackId, clipId, 48000);

engine.dispose();

engine = new PlaylistEngine({ adapter: adapterB, arrangement });
engine.getState().tracks.length; // as before
engine.canUndo;                  // true
```

A clip's `startTick` is counted in an engine's `ppqn`. When an engine attaches, every clip without a `startTick` gets one from its `startSample`, and when the engine has another `ppqn` than the one before (the Tone.js adapter at 192 after the native transport at 960, or the reverse) every stored tick is converted to the new unit, rounded to the nearest tick. Both happen in the current tracks, in every undo and redo state and in the base of an open transaction. `startSample` is not touched and it is not an undo step. When the current tracks changed, subscribers are told once (`tracksVersion` goes up by one); with the same `ppqn` and a tick on every clip, nothing happens. It is all or nothing: if the engine's tempo map throws while the ticks are worked out, the constructor throws, nothing in the arrangement has changed and it is not attached.

A `setTempo` places every clip that has a tick on the tick grid of the engine it is called on, swap or no swap. Going to a coarser `ppqn` rounds: 7 ticks at 960 become 1 at 192, and 5 when an engine at 960 takes over again. After such a swap the next tempo change can therefore place a clip up to half a tick of the coarser engine away from where it was: 0.5 × 60 × sampleRate / (ppqn × bpm) samples, about 62 samples (1.3 ms) at 192 ppqn, 120 bpm and 48 kHz.

A different tempo is not converted. A tick is the musical position, so an engine built at another tempo than the one the ticks were made under has clips whose `startSample` and `startTick` disagree until the next `setTempo`, which moves `startSample` to follow the tick. Clips added under the new engine get their ticks at its tempo and keep their place at that `setTempo`, while the older ones move.

The new engine sends the tracks it finds to its adapter once, in its constructor, with their mix. If that call throws, the constructor throws and the engine is no longer attached to the arrangement. After `dispose()`, the engine's track, clip, mixer, recording and history methods still change the arrangement, but call no adapter and emit no `statechange`, and `setTempo()` does nothing. Selection, loop, zoom, the playback position and the master volume belong to the engine and start from their defaults in the new one.

An arrangement plays through one engine at a time. Building a second engine on an arrangement whose first engine has not been disposed logs a console warning. Two engines alive on one arrangement is unsupported, in particular with different `ppqn`: the second engine's time base replaces the first's, so ticks the first engine gives later are computed with the second engine's. The `arrangement` option accepts only an object made by `createArrangement()`; anything else throws. The engine recognises an arrangement by a versioned `Symbol.for` key, not by `instanceof`, so one made by another installed copy of `@waveform-playlist/engine` (an app and a library that pin different versions) is accepted when both copies use the same key version. The keys are `@waveform-playlist/engine/arrangement/time-base/v2` and `@waveform-playlist/engine/arrangement/attach-decode/v2` (v1 until the mixer became undoable): an engine and an arrangement from copies on either side of that change refuse each other.

## Implementing a PlayoutAdapter

The `PlayoutAdapter` interface connects the engine to any audio backend. The engine calls these methods; your adapter translates them into audio API calls.

```typescript
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { ClipTrack } from '@waveform-playlist/core';

class MyAudioAdapter implements PlayoutAdapter {
  readonly audioContext = new AudioContext();
  readonly ppqn = 960;

  async init(): Promise<void> {
    // Resume the audio context, load worklets, etc.
  }

  setTracks(tracks: readonly ClipTrack[]): void {
    // Rebuild audio graph from tracks.
    // The tracks are the engine's own objects: read them, never write to them.
  }

  play(startTime: number, endTime?: number): void {
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

  setLoop(enabled: boolean, start: number, end: number): void {
    // Configure loop region
  }

  dispose(): void {
    // Clean up audio resources
  }
}

// Use it:
const engine = new PlaylistEngine({
  adapter: new MyAudioAdapter(),
});
```

`addTrack(track)`, `removeTrack(trackId)` and `updateTrack(trackId, track)` are optional. When the adapter has them, the engine calls them for a change to one track; otherwise it calls `setTracks` with every track. The tracks an adapter receives carry the current mix in their `volume`, `muted`, `soloed` and `pan` fields.

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

// Clamp a seek position to the range 0..duration
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
- Selection, loop region or master volume values haven't changed
- `updateTrack(id, track)` names a track the engine does not have (the track object is still checked, and an invalid one throws)
- `moveClip`, `trimClip` or `splitClip` names a clip that is still loading
- A transaction that changed nothing is committed or aborted

This prevents wasted re-renders in your UI framework.

### Shared, Read-Only Tracks

The tracks are immutable. A change replaces the tracks array and only the track and clip objects that changed; every other track is the same object as before, so comparing by identity (`prev.tracks[i] !== next.tracks[i]`) finds what changed. The exception is `setTracks()`: it copies every track it is given, so after it no track is the object it was. An undo step is a reference to an earlier array.

- `setTracks()`, `addTrack()` and `updateTrack()` copy each track and clip they are given — your objects are not retained
- `updateTrack()` keeps a clip object the track already holds, so a clip you did not replace is the same object afterwards
- `getState().tracks`, `arrangement.getTracks()` and the tracks an adapter receives are **not** copies. They are typed `readonly ClipTrack[]` (`readonly ArrangementTrack[]` for `getTracks()`, which also holds the clips that are still loading)
- Outside production builds (`process.env.NODE_ENV` is not `'production'`; a page that loads the module with no bundler, and so has no `process`, counts as production) the tracks array, each track, its `clips` array and each clip are frozen, so a write throws in a module. What a clip refers to (its `AudioBuffer`, peaks, fades, notes) is not frozen

To change a track, build a new one from it:

```typescript
const track = engine.getState().tracks.find((t) => t.id === trackId);
if (track) {
  engine.updateTrack(trackId, { ...track, name: 'Bass' });
}
```

### Invariant Normalization

The engine normalizes ordering automatically:

- `setSelection(10, 5)` → `selectionStart = 5, selectionEnd = 10`
- `setLoopRegion(20, 10)` → `loopStart = 10, loopEnd = 20`

Consumers can trust that `EngineState.selectionStart <= selectionEnd` and `loopStart <= loopEnd`.

### tracksVersion Counter

The `tracksVersion` field in `EngineState` is a monotonic counter that increments **only** on structural track changes: `setTracks`, `addTrack`, `removeTrack`, `reorderTrack`, `updateTrack(id, track)`, `moveClip`, `trimClip`, `splitClip`, `undo`, `redo`, an aborted transaction that had changed something, a `setTempo` that the adapter did not refuse (`setTempo` with the tempo the engine already has and no `atTick` returns before that), and an engine being built on an arrangement that has clips without a `startTick`, or whose ticks are in another `ppqn` (they are converted), and the audio of a loading clip in the current tracks arriving (see [Loading Audio](#loading-audio)). It does **not** increment on selection, zoom, master volume, or loop changes, on a change of the undo history alone (`commitTransaction`, `clearHistory`), nor on per-track mixer edits. Use it to skip expensive operations (like audio graph rebuilds or peak regeneration) when only non-structural state changed.

Per-track mixer edits (`setTrackVolume`, `setTrackMute`, `setTrackSolo`, `setTrackPan`) instead bump a separate `mixerVersion` counter (and emit `statechange`). This lets a consumer refresh what it shows of the mix without re-running the structural work gated on `tracksVersion`. The split matters because mixer setters fire continuously during a volume/pan slider drag.

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

  const engine = new PlaylistEngine({ sampleRate: 48000 });

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

  const engine = new PlaylistEngine({ sampleRate: 48000 });

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
  Arrangement,
  CreateArrangementOptions,
  RemoveTrackOptions,
  MixerChangeOptions,
  ClipBounds,
  TrackMixerValues,
  ArrangementSourcesValue,
  ArrangementSourceState,
  LoadSource,
} from '@waveform-playlist/engine';
```

Data model types come from `@waveform-playlist/core`:

```typescript
import type {
  AudioClip,
  ClipTrack,
  ArrangementTrack,
  LoadingClip,
  ClipSource,
  ValueSource,
  MixerGesture, // what createMixerGesture() returns
} from '@waveform-playlist/core';
```

### EngineState

```typescript
interface EngineState {
  tracks: readonly ClipTrack[]; // shared, not a copy; frozen outside production builds; loaded clips only
  tracksVersion: number;
  mixerVersion: number;
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
  bpm: number;
  ppqn: number;
  canUndo: boolean;
  canRedo: boolean;
}
```

### PlaylistEngineOptions

```typescript
interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  arrangement?: Arrangement;
  sampleRate?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[];
  undoLimit?: number;
  attachDecodeContext?: boolean; // default true
  bpm?: number;
  ppqn?: number;
}
```

### Arrangement

```typescript
function createArrangement(options?: CreateArrangementOptions): Arrangement;

interface CreateArrangementOptions {
  tracks?: readonly ArrangementTrack[]; // the first tracks; not an undo step
  undoLimit?: number;                   // default 100
  loadSource?: LoadSource;              // default: defaultLoadSource
}

type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;

const defaultLoadSource: LoadSource;

// Returns the function that detaches
function attachDecodeContext(
  arrangement: Arrangement,
  getContext: () => Promise<BaseAudioContext>
): () => void;

interface ArrangementSourceState {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error;
}

interface ArrangementSourcesValue {
  sources: ReadonlyMap<ClipSource, ArrangementSourceState>;
  pendingCount: number;
  failedCount: number;
  isLoading: boolean;
}

interface RemoveTrackOptions {
  undoable?: boolean; // false: no undo step, and the track leaves every undo and redo state
}

interface MixerChangeOptions {
  gesture?: string;   // changes with the same id, one after another, are one undo step
  undoable?: false;   // not an undo step: the value is written into every saved state as well
}

// From @waveform-playlist/core
function createMixerGesture(): MixerGesture;

interface MixerGesture {
  readonly id: string;                           // the id to pass while a gesture is going on
  end(): void;                                   // the next change starts a new step
  attach(input: HTMLInputElement): () => void;   // ends the gesture on the input's own events; returns the detach function
}

interface TrackMixerValues {
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
}

interface ClipBounds {
  offsetSamples: number;
  durationSamples: number;
  startSample: number;
  sourceDurationSamples: number;
}

interface Arrangement {
  // read
  getTracks(): readonly ArrangementTrack[];
  getMixer(): ReadonlyMap<string, TrackMixerValues>;
  subscribe(listener: () => void): () => void;
  readonly tracksVersion: number;
  readonly mixerVersion: number;

  // whole set
  setTracks(tracks: readonly ArrangementTrack[]): void;

  // tracks
  addTrack(track: ArrangementTrack): void;
  removeTrack(trackId: string, options?: RemoveTrackOptions): void;
  updateTrack(
    trackId: string,
    next: ArrangementTrack | ((track: ArrangementTrack) => ArrangementTrack)
  ): void;
  reorderTrack(trackId: string, toIndex: number): void;

  // clips (a clip that is still loading cannot be edited)
  moveClip(trackId: string, clipId: string, deltaSamples: number): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
  splitClip(trackId: string, clipId: string, atSample: number): void;
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number;

  // mixer (each call is an undo step; see MixerChangeOptions)
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;

  // the take's mute: the tracks a take is recording onto (outside the history)
  readonly recordingTrackIds: ReadonlySet<string>;
  setTrackRecording(trackId: string, recording: boolean): void;

  // history
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;
  redo(): void;
  clearHistory(): void;
  beginTransaction(): void;
  commitTransaction(): void;
  abortTransaction(): void;

  // loading
  readonly sources: ValueSource<ArrangementSourcesValue>;
  retry(src: ClipSource): void;
}
```

### PlayoutAdapter

```typescript
interface PlayoutAdapter {
  readonly audioContext: AudioContext;
  readonly ppqn: number;
  init(): Promise<void>;
  setTracks(tracks: readonly ClipTrack[]): void;
  addTrack?(track: ClipTrack): void;
  removeTrack?(trackId: string): void;
  updateTrack?(trackId: string, track: ClipTrack): void;
  play(startTime: number, endTime?: number): void;
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
  setLoop(enabled: boolean, start: number, end: number): void;
  dispose(): void;
}
```

The interface has further optional members (tempo and tick conversion, `onPlaybackEnded`, worklet helpers, `masterOutputNode`, `lookAhead`); see `packages/engine/src/types.ts`.

### EngineEvents

```typescript
interface EngineEvents {
  statechange: (state: EngineState) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}
```

## See Also

- [Hooks Reference](/docs/react/api/hooks) — React hooks that wrap the engine
- [Loading Audio](/docs/react/guides/loading-audio) — `WaveformPlaylistProvider` on an arrangement: `useCreateArrangement`, `audioTrack()`, loading state and ready
- [Track Management](/docs/react/guides/track-management) — Adding and removing tracks
