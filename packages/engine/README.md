# @waveform-playlist/engine

Framework-agnostic multitrack timeline engine for waveform-playlist — pure clip/track operations, an arrangement that owns the tracks, the mix and the undo history, and a stateful `PlaylistEngine` that plays an arrangement and manages selection, loop and zoom, decoupled from any audio backend via a pluggable `PlayoutAdapter`.

Used by `@waveform-playlist/browser` (the React provider) and `@dawcore/components` (the Lit web-components layer). Pair it with a `PlayoutAdapter` implementation such as `@waveform-playlist/playout` (Tone.js) or `@dawcore/transport` (native Web Audio) to actually produce sound — the engine itself never touches the audio graph directly.

## Features

- **Clip-based timeline model** — tracks hold multiple clips; move, trim, and split with automatic collision constraints
- **Sample + tick timeline math** — integer samples for precision, ticks for tempo-independent positioning
- **The arrangement** — one object owns the tracks, the mix (volume, mute, solo and pan by track id) and the undo history; it needs no engine and outlives the engine that plays it
- **Undo/redo** — history for the structural changes (tracks and clips), with transaction grouping for drag gestures; an undo never changes the mix
- **Selection, loop, and zoom state** — engine owns selection range, loop region, zoom level, and master volume
- **`statechange` events** — subscribe once and mirror a single `EngineState` snapshot into any UI framework
- **Adapter-pluggable playback** — bring your own `PlayoutAdapter` (Tone.js, native Web Audio, or a custom backend); the engine runs headless without one

## Installation

```bash
npm install @waveform-playlist/engine @waveform-playlist/core
```

`@waveform-playlist/core` is a required peer dependency (`>=7.0.0`) — it provides the `ClipTrack`/`AudioClip` types and clip-construction helpers used below.

## Quick Start

```typescript
import { PlaylistEngine } from '@waveform-playlist/engine';
import { createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import { createToneAdapter } from '@waveform-playlist/playout'; // any PlayoutAdapter implementation

const adapter = createToneAdapter();
const engine = new PlaylistEngine({ adapter, sampleRate: 48000 });
await engine.init();

const track: ClipTrack = {
  id: 'track-1',
  kind: 'audio', // or 'midi': a track holds one kind of clip, and setTracks throws otherwise
  name: 'Guitar',
  clips: [
    createClipFromSeconds({
      audioBuffer, // decoded AudioBuffer
      startTime: 0,
    }),
  ],
  // The mix the track enters with. Afterwards change it with engine.setTrackVolume() etc.
  muted: false,
  soloed: false,
  volume: 1.0,
  pan: 0,
};

engine.setTracks([track]); // the engine keeps a copy; `track` stays yours

// Subscribe once; mirror EngineState into your framework's state
engine.on('statechange', (state) => {
  console.log('duration:', state.duration, 'currentTime:', state.currentTime);
});

// Transport
engine.play(); // resumes from current position
engine.seek(5); // seek to 5 seconds
engine.pause();
engine.stop(); // returns to the position playback started from

// Clip editing (all undoable, all emit statechange)
engine.moveClip('track-1', track.clips[0].id, 48000); // shift 1s right (in samples)
engine.trimClip('track-1', track.clips[0].id, 'left', 24000);
engine.splitClip('track-1', track.clips[0].id, 96000);

engine.undo();
engine.redo();
```

## The arrangement

An arrangement is the owner of three things: the tracks with their clips, the mix (volume, mute, solo and pan by track id) and the undo history with its transactions. Everything else reads it and changes it by calling its methods. A `PlaylistEngine` plays an arrangement: it follows it by subscription, and for each change it makes the adapter call and emits `statechange`.

An engine built without an `arrangement` option makes one of its own, so `new PlaylistEngine({ adapter })` works as in the Quick Start. Make the arrangement yourself when it has to exist before the engine does, or outlive it:

```typescript
import { createArrangement, PlaylistEngine } from '@waveform-playlist/engine';

const arrangement = createArrangement({ tracks: [track], undoLimit: 50 });

// No engine is needed to edit
arrangement.moveClip('track-1', track.clips[0].id, 48000);
arrangement.setTrackVolume('track-1', 0.5);

// Read: nothing returned is a copy
arrangement.getTracks(); // readonly ClipTrack[]; the same array until the tracks change
arrangement.getMixer().get('track-1'); // { volume: 0.5, muted: false, soloed: false, pan: 0 }
const unsubscribe = arrangement.subscribe(() => {
  // once per change (tracks, mix or history), after the engine has made its adapter call for it
});

// Play it
const engine = new PlaylistEngine({ adapter: createToneAdapter(), arrangement });
await engine.init();

// The arrangement outlives the engine
engine.dispose();
const next = new PlaylistEngine({ adapter: createToneAdapter(), arrangement });
// next has the same tracks, the same mix and the same undo history
```

A clip's `startTick` is counted in an engine's `ppqn`. When an engine attaches, every clip without a `startTick` gets one from its `startSample`, and when the engine has another `ppqn` than the one before (the Tone.js adapter at 192 after the native transport at 960, or the reverse) every stored tick is converted to the new unit, rounded to the nearest tick. Both happen in the current tracks, in every undo and redo state and in the base of an open transaction. `startSample` is not touched and it is not an undo step. When the current tracks changed, subscribers are told once (`tracksVersion` goes up by one); with the same `ppqn` and a tick on every clip, nothing happens. It is all or nothing: if the engine's tempo map throws while the ticks are worked out, the constructor throws, nothing in the arrangement has changed and it is not attached.

A `setTempo` places every clip that has a tick on the tick grid of the engine it is called on, swap or no swap. Going to a coarser `ppqn` rounds: 7 ticks at 960 become 1 at 192, and 5 when an engine at 960 takes over again. After such a swap the next tempo change can therefore place a clip up to half a tick of the coarser engine away from where it was: 0.5 × 60 × sampleRate / (ppqn × bpm) samples, about 62 samples (1.3 ms) at 192 ppqn, 120 bpm and 48 kHz.

A different tempo is not converted. A tick is the musical position, so an engine built at another tempo than the one the ticks were made under has clips whose `startSample` and `startTick` disagree until the next `setTempo`, which moves `startSample` to follow the tick. Clips added under the new engine get their ticks at its tempo and keep their place at that `setTempo`, while the older ones move.

An arrangement plays through one engine at a time: building a second engine on it while the first has not been disposed logs a warning. Two engines alive on one arrangement is unsupported, in particular with different `ppqn`: the second engine's time base replaces the first's, so ticks the first engine gives later are computed with the second engine's. The engine's own `undoLimit` option is ignored, with a warning, when an arrangement is passed; set it on `createArrangement({ undoLimit })`.

The engine's track, clip, mixer and history methods call the arrangement's, so a change made through either reaches the adapter and emits `statechange`. The arrangement's `removeTrack` also takes `{ undoable: false }` (no undo step, and the track is taken out of every undo and redo state, so no undo brings it back: for a dropped file that could not be decoded), and its `updateTrack` takes a function of the current track: `arrangement.updateTrack(id, (track) => ({ ...track, name: 'Bass' }))`.

Rules that hold for the engine and the arrangement alike:

- **Nothing handed out is a copy.** `arrangement.getTracks()`, `engine.getState().tracks` and the tracks an adapter receives are shared with the undo history. Never write to the array, a track or a clip: copy first (`{ ...track, clips: [...] }`) and pass the copy to `updateTrack`. Outside production builds (`process.env.NODE_ENV` is not `'production'`; a page that loads the module with no bundler, and so has no `process`, counts as production) the tracks array, each track, its `clips` array and each clip are frozen, so a write throws in strict code (every module is strict). What a clip refers to (its `AudioBuffer`, peaks, fades, notes) is not frozen. Tracks are copied on their way in, so the objects you pass stay yours.
- **A change replaces only what changed.** The tracks array and the changed track and clip objects are new; every other track is the same object as before, so a comparison by identity finds what changed. The exception is `setTracks`, which copies every track it is given: after it no track is the object it was.
- **The mix is separate from the tracks.** A track's own `volume`, `muted`, `soloed` and `pan` fields are the values it enters with. They seed its mixer entry when its id has none. `setTracks` keeps the mix of an id that is in the tracks it replaces, `updateTrack` keeps the track's mix (also when it gives the track a new id, and then also over an entry the new id still has from a removed track), and `addTrack` of a track whose removal can still be undone finds the mix it had; in those cases the fields are not read. An entry is dropped as soon as no state holds its track any more: not the current tracks, not an undo or redo step, not the base of an open transaction (with `undoLimit: 0` a removed track's entry goes at once). Change the mix with `setTrackVolume`, `setTrackMute`, `setTrackSolo` and `setTrackPan`, which act on a track that is in the current tracks. `engine.getState().tracks` and the tracks an adapter receives carry the current mix in those fields; `arrangement.getTracks()` does not (read `getMixer()`).
- **Undo, redo and an aborted transaction restore tracks and clips, never the mix.** Undoing a `removeTrack` brings the track back with the mix it had. One exception: undoing or redoing an `updateTrack` that gave a track a new id switches between the old id's mix and the new id's, so a fader moved after the rename is not what the old id has after the undo. A second one: when a track is given the id of a removed track whose removal can still be undone, the renamed track's mix replaces the removed track's, so undoing back past the removal brings that track back with the renamed track's mix.
- **Ids are unique.** `setTracks`, `addTrack` and `updateTrack` throw an `Error` for a duplicate track id, for two clips with one id on the same track, and for a track whose clips do not match its `kind`, before anything changes.
- **Without an engine** clips are given no `startTick`, and a clip that came with one loses it when it is moved, trimmed on the left or split. Every clip without a tick, in the current tracks and in every undo and redo state, gets one from its `startSample` when an engine attaches. The shortest a clip may be is 0.1 s at the clip's own sample rate.

## API

### PlaylistEngine

Key methods (see `src/types.ts` for the full `EngineState` shape). `PlaylistEngineOptions` takes `adapter`, `arrangement`, `sampleRate`, `samplesPerPixel`, `zoomLevels`, `undoLimit`, `bpm` and `ppqn`, all optional:

```typescript
class PlaylistEngine {
  constructor(options?: PlaylistEngineOptions);

  // Tracks
  setTracks(tracks: readonly ClipTrack[]): void; // replaces every track, clears the undo history
  addTrack(track: ClipTrack): void;
  removeTrack(trackId: string): void;
  updateTrack(trackId: string, track?: ClipTrack): void; // with a track: replace it; without: send the current one to the adapter again
  reorderTrack(trackId: string, toIndex: number): void;
  selectTrack(trackId: string | null): void;

  // Clip editing (undoable)
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter?: boolean): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number, skipAdapter?: boolean): void;
  splitClip(trackId: string, clipId: string, atSample: number): void;
  constrainTrimDelta(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): number;
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;

  // Playback (no-ops without an adapter)
  init(): Promise<void>;
  play(startTime?: number, endTime?: number): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  getAudibleTime(): number; // latency-compensated position for playheads/UI

  // Selection, loop, zoom, volume
  setSelection(start: number, end: number): void;
  setLoopRegion(start: number, end: number): void;
  setLoopEnabled(enabled: boolean): void;
  setMasterVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;
  zoomIn(): void;
  zoomOut(): void;
  setZoomLevel(samplesPerPixel: number): void;
  setTempo(bpm: number, atTick?: number): void;

  // Undo/redo (tracks and clips; never the mix)
  undo(): void; // with a transaction open: aborts it first
  redo(): void; // with a transaction open: aborts it first
  clearHistory(): void;
  beginTransaction(): void;
  commitTransaction(): void;
  abortTransaction(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  // State & events
  getState(): EngineState;
  on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): void;
  off<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): void; // 'statechange' | 'play' | 'pause' | 'stop'

  dispose(): void;
}
```

### PlayoutAdapter

The interface an audio backend implements to plug into the engine:

```typescript
interface PlayoutAdapter {
  readonly audioContext: AudioContext;
  readonly ppqn: number;
  setPpqn?(ppqn: number): void;

  init(): Promise<void>;
  setTracks(tracks: readonly ClipTrack[]): void; // the engine's own objects: read them, never write to them
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

  setTempo?(bpm: number, atTick?: number): boolean | void;
  setMeter?(numerator: number, denominator: number, atTick?: number): void;
  ticksToSeconds?(tick: number): number;
  secondsToTicks?(seconds: number): number;

  dispose(): void;
}
```

Implement this against your own audio backend to use the engine outside Tone.js or native Web Audio — everything else (undo/redo, clip constraints, timeline state) works the same headless or adapted.

### Pure operations

`src/operations` exports framework-free helper functions the engine itself is built on — `constrainClipDrag`, `constrainBoundaryTrim`, `splitClip`, `canSplitAt`, `calculateDuration`, `findClosestZoomIndex`, `calculateViewportBounds`, `getVisibleChunkIndices`, and more — useful if you need the raw math without the stateful class.

## Examples & Documentation

- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
