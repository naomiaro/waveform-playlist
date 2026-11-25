# @waveform-playlist/engine

Framework-agnostic multitrack timeline engine for waveform-playlist — pure clip/track operations, an arrangement that owns the tracks, the mix and the undo history, and a stateful `PlaylistEngine` that plays an arrangement and manages selection, loop and zoom, decoupled from any audio backend via a pluggable `PlayoutAdapter`.

Used by `@waveform-playlist/browser` (the React provider) and `@dawcore/components` (the Lit web-components layer). Pair it with a `PlayoutAdapter` implementation such as `@waveform-playlist/playout` (Tone.js) or `@dawcore/transport` (native Web Audio) to actually produce sound — the engine itself never touches the audio graph directly.

## Features

- **Clip-based timeline model** — tracks hold multiple clips; move, trim, and split with automatic collision constraints
- **Sample + tick timeline math** — integer samples for precision, ticks for tempo-independent positioning
- **The arrangement** — one object owns the tracks, the mix (volume, mute, solo and pan by track id) and the undo history; it needs no engine and outlives the engine that plays it
- **Loading audio** — a clip may name its audio (`src`: a URL, `Blob` or `File`) instead of carrying it; the arrangement fetches and decodes each source once, reports where each one is (`arrangement.sources`) and replaces the clip with a loaded one when the audio arrives
- **Undo/redo** — one history for the tracks, the clips and the mix: a fader move is an undo step, a whole drag is one step (`createMixerGesture()`), and transactions group a clip drag
- **Selection, loop, and zoom state** — engine owns selection range, loop region, zoom level, and master volume
- **`statechange` events** — subscribe once and mirror a single `EngineState` snapshot into any UI framework
- **Adapter-pluggable playback** — bring your own `PlayoutAdapter` (Tone.js, native Web Audio, or a custom backend); the engine runs headless without one

## Installation

```bash
npm install @waveform-playlist/engine @waveform-playlist/core
```

`@waveform-playlist/core` is a required peer dependency (version 13 or later) — it provides the `ClipTrack`/`AudioClip` types and clip-construction helpers used below.

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
arrangement.getTracks(); // readonly ArrangementTrack[]; the same array until the tracks change
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

An arrangement plays through one engine at a time: building a second engine on it while the first has not been disposed logs a warning. Two engines alive on one arrangement is unsupported, in particular with different `ppqn`: the second engine's time base replaces the first's, so ticks the first engine gives later are computed with the second engine's. The engine's own `undoLimit` option is ignored, with a warning, when an arrangement is passed; set it on `createArrangement({ undoLimit })`. The `arrangement` option accepts only an arrangement made by `createArrangement()`. The engine recognises one by a versioned `Symbol.for` key and not by `instanceof`, so an arrangement made by another installed copy of this package (an app and a library that pin different versions) is accepted as long as both copies use the same key version. The key version changed with the mixer undo steps (`/v2`): an engine and an arrangement from copies on either side of that change refuse each other.

The engine's track, clip, mixer, arm and history methods call the arrangement's, so a change made through either reaches the adapter and emits `statechange`. The arrangement's `removeTrack` also takes `{ undoable: false }` (no undo step, and the track is taken out of every undo and redo state, so no undo brings it back: for a dropped file that could not be decoded), and its `updateTrack` takes a function of the current track: `arrangement.updateTrack(id, (track) => ({ ...track, name: 'Bass' }))`.

### Mixer moves are undo steps

`setTrackVolume`, `setTrackMute`, `setTrackSolo` and `setTrackPan` (on the arrangement and on the engine) are undo steps: an undo puts the fader back. Their last argument, `options?: MixerChangeOptions`, says how a change goes into the history:

- nothing: each call is a step of its own;
- `{ gesture: id }`: calls with the same id, one after another, are one step (a fader drag from press to release);
- `{ undoable: false }`: no step. The value is written into every saved state as well, so no undo or redo brings back an older one (automation, a value that is not the user's edit). It wins over `gesture`.

A call that changes nothing (the value the track already has, or a track that is not in the current tracks) makes no step and no `statechange`. Inside an open transaction an undoable mixer change is part of it, and an abort takes it back; an `{ undoable: false }` change is written into the transaction's base too, so an abort keeps it. Undo, redo and an abort bring back the mix of the state they return to.

`createMixerGesture()` makes the ids for one control. Use one per slider:

```typescript
import { createMixerGesture } from '@waveform-playlist/engine';

const gesture = createMixerGesture();
const detach = gesture.attach(slider); // ends the gesture on the slider's own events
slider.addEventListener('input', () => {
  engine.setTrackVolume('track-1', slider.valueAsNumber, { gesture: gesture.id });
});
// gesture.end() ends it by hand; detach() removes the listeners
```

`attach` ends the gesture on the input's `change` (the end of a pointer drag), except while an arrow, Page Up/Down, Home or End key is held: then on that key's `keyup`, so a held key is one step. A `blur` ends it too. Mute and solo buttons need no helper: each click is a step.

**The recording arm.** `setTrackArmed(trackId, armed)` (arrangement and engine) arms a track for recording, and `arrangement.armedTrackIds` is the set of armed ids. An armed track plays muted: `engine.getState().tracks` and the adapter have it muted, while its mute in `getMixer()` stays as it is and comes back when the track is disarmed. Arming is not an undo step, and undo, redo, an abort, `setTracks` and `clearHistory` do not change which tracks are armed.

### Loading audio

A track of an arrangement is an `ArrangementTrack` (from `@waveform-playlist/core`): its clips are loaded clips (`AudioClip`) or clips whose audio is not loaded yet (`LoadingClip`: a `src` and times in seconds). `isLoadingClip(clip)` tells them apart; narrow with it before reading `startSample`, `durationSamples` or any other sample field of a clip from `arrangement.getTracks()`. `createArrangement({ tracks })`, `getTracks`, `setTracks`, `addTrack` and `updateTrack` of the arrangement use that type. The engine's own `setTracks`, `addTrack` and `updateTrack` still take `ClipTrack` (loaded clips only).

```typescript
import { createArrangement, PlaylistEngine } from '@waveform-playlist/engine';
import { audioTrack, isLoadingClip } from '@waveform-playlist/core';

const arrangement = createArrangement({
  tracks: [
    audioTrack({ id: 'guitar', src: '/audio/guitar.opus' }), // one LoadingClip
    audioTrack({ id: 'vocals', src: '/audio/vocals.opus', start: 4 }), // seconds
  ],
});

// Nothing is fetched yet: the arrangement has no audio context to decode with.
arrangement.sources.getSnapshot(); // { sources: Map(2), pendingCount: 2, failedCount: 0, isLoading: true }

// An engine with an adapter attaches adapter.audioContext, and the loads start.
const engine = new PlaylistEngine({ adapter: createToneAdapter(), arrangement });
await engine.init();

arrangement.sources.subscribe(({ sources, isLoading, failedCount }) => {
  for (const [src, state] of sources) {
    if (state.status === 'failed') {
      console.error(state.error); // an Error
      arrangement.retry(src); // or leave it: nothing starts a failed source again by itself
    }
  }
});

arrangement.subscribe(() => {
  for (const track of arrangement.getTracks()) {
    for (const clip of track.clips) {
      if (isLoadingClip(clip)) continue; // clip.start, clip.duration, clip.offset: seconds, all optional
      clip.startSample; // an AudioClip
    }
  }
});
```

What happens to a loading clip:

- **It is held like any clip.** It is copied on its way in, is the same object through every operation on its track, keeps its place among the track's clips and is part of the undo steps. It has no `startTick`.
- **It cannot be edited.** `moveClip`, `trimClip` and `splitClip` on it log a warning (`… is still loading and cannot be edited until its audio has loaded`) and change nothing; `getClipBounds` returns `null` and `constrainTrimDelta` returns 0. Loaded clips do not collide with it.
- **It is audio.** A loading clip on a `kind: 'midi'` track is refused: `createArrangement({ tracks })`, `setTracks`, `addTrack` and `updateTrack` throw the error for a track whose clips do not match its kind, and nothing changes.
- **An engine does not play or report it.** The tracks an adapter is sent and `engine.getState().tracks` are each track without its loading clips, and `getState().duration` counts loaded clips only. A change that leaves a track's loaded clips (the same objects in the same order) and its own fields as they were makes no adapter call for that track; the `statechange` is still emitted. `engine.updateTrack(id)` always sends.

Which sources are loaded: every source a loading clip names in the current tracks, in an undo or redo state or in the base of an open transaction. So an undo never fetches a source again, and a source is dropped (its load aborted, its audio let go) when no state names it any more; named again later, it is fetched again. A loaded clip that carries both `src` and `audioBuffer` counts too: its buffer is used for that source and nothing is fetched. A loaded clip with `src` and no `audioBuffer` is not fetched and is not in `sources`: it never gets audio from the arrangement.

When a source is loaded, every loading clip that names it becomes an `AudioClip`: seconds become integer samples at the sample rate of the decoded buffer, the clip keeps its `id`, `name`, `color`, `gain`, fades, `waveformData` and `src`, a `duration` that runs past the end of the audio is cut to it (one console warning), and it gets a `startTick` when an engine is attached. This happens in the current tracks and in every undo and redo state, it is not an undo step, and subscribers are told once (`tracksVersion` goes up by one) when the current tracks changed. A clip added later that names a source that is already loaded is a loaded clip by the time the call that added it returns. A clip that comes in carrying `src` and `audioBuffer` for a source other loading clips are waiting for loads those clips inside the same call, with the one notification of that call.

If the adapter throws while an engine applies audio that arrived, there is no caller to fail: the engine logs `[waveform-playlist] The playout adapter failed while loaded audio was applied:` with the error, still emits the `statechange`, and sends the adapter every track at the next track change.

`arrangement.sources` is a `ValueSource` (`getSnapshot()` and `subscribe(listener)`, the shape `useSyncExternalStore` takes). Its value is `{ sources, pendingCount, failedCount, isLoading }`, where `sources` is a `ReadonlyMap` from each source to `{ status: 'pending' | 'loaded' | 'failed', error? }`. It is the same object until a source is added or dropped or a status changes, and it is published after the subscribers of `arrangement.subscribe` have been told, so a listener of `sources` that sees `loaded` finds the loaded clip in `getTracks()`. The other way round, a listener of `arrangement.subscribe` that finds the loaded clip still reads its source as `pending` in `sources`. The order of the entries of `sources` means nothing.

A source is `failed` in two cases:

- **Its load failed** (the fetch, the decode, or getting the audio context). No track changes. `arrangement.retry(src)` starts it again; nothing else does.
- **A clip in the current tracks could not be made from its audio**: an `offset` at or past the end of the audio, or a `start`, `offset` or `duration` that is not a usable number. That clip stays a loading clip, the error's message is `clip "<id>": <reason>`, and other clips of the same source are still loaded. `retry` does nothing here. Only a clip in the current tracks counts: replacing or removing the clip clears the failure at once, also while an undo step still holds it, and an undo that brings the clip back brings the failure back.

`createArrangement({ loadSource })` replaces how a source becomes an `AudioBuffer`. The default is the exported `defaultLoadSource`: `fetch` for a string, `arrayBuffer()` for a `Blob` or `File`, then `audioContext.decodeAudioData`, with the abort signal checked after each step.

```typescript
import { createArrangement, defaultLoadSource, type LoadSource } from '@waveform-playlist/engine';

const loadSource: LoadSource = async (src, { signal, audioContext }) => {
  if (typeof src !== 'string') return defaultLoadSource(src, { signal, audioContext });
  const response = await fetch(src, { signal, credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  return audioContext.decodeAudioData(await response.arrayBuffer());
};

const arrangement = createArrangement({ loadSource });
```

The messages of `defaultLoadSource`'s own errors (`Failed to fetch <source>: <status> <statusText>`, `Failed to fetch <source>` when `fetch` threw a `TypeError`, `Decoded audio is empty: <source>`) name a URL without its query string, its fragment and a user name or password before the host (a URL the browser's parser finds credentials in is named in its parsed, absolute form; a malformed one the parser refuses loses only its query string and fragment), never echo a `data:` or `blob:` URL, and call a `File` by its name and any other `Blob` "Blob". The browser's `TypeError` is kept in `cause` only when the name in the message is the source unchanged. When anything was left out of the name (a user name or password, a query string, a fragment, a `data:` or `blob:` URL) the error has no `cause`, because the browser's own message can quote the whole URL. An `Error` the browser's decoder rejects with is passed on as it is, so its message is the browser's and does not name the source.

Nothing is fetched until the arrangement has an audio context to decode with; until then its sources are `pending`. A `PlaylistEngine` built with an adapter attaches `adapter.audioContext` in its constructor and detaches it in `dispose()`. Without an engine, or with `new PlaylistEngine({ adapter, arrangement, attachDecodeContext: false })`, attach one yourself:

```typescript
import { attachDecodeContext } from '@waveform-playlist/engine';

const detach = attachDecodeContext(arrangement, async () => audioContext); // called for each load
// later
detach(); // loads in flight are aborted and stay pending; what is loaded stays; the next attach starts them again
```

One context at a time: attaching a second while one is attached logs a warning and replaces the first. An engine without an adapter attaches nothing.

### Rules

Rules that hold for the engine and the arrangement alike:

- **Nothing handed out is a copy.** `arrangement.getTracks()`, `engine.getState().tracks` and the tracks an adapter receives are shared with the undo history. Never write to the array, a track or a clip: copy first (`{ ...track, clips: [...] }`) and pass the copy to `updateTrack`. `arrangement.updateTrack`, given a track object or a function, keeps each clip object the track already holds and copies every other clip, so the clips you did not replace are the same objects afterwards. Outside production builds (`process.env.NODE_ENV` is not `'production'`; a page that loads the module with no bundler, and so has no `process`, counts as production) the tracks array, each track, its `clips` array and each clip are frozen, so a write throws in strict code (every module is strict). What a clip refers to (its `AudioBuffer`, peaks, fades, notes) is not frozen. Tracks are copied on their way in, so the objects you pass stay yours.
- **A change replaces only what changed.** The tracks array and the changed track and clip objects are new; every other track is the same object as before, so a comparison by identity finds what changed. The exception is `setTracks`, which copies every track it is given: after it no track is the object it was.
- **The mix is separate from the tracks.** A track's own `volume`, `muted`, `soloed` and `pan` fields are the values it enters with. They seed its mixer entry when its id has none. `setTracks` keeps the mix of an id that is in the tracks it replaces, and `updateTrack` keeps the track's mix (also when it gives the track a new id); in those cases the fields are not read. `addTrack` seeds the entry from the new track's fields, also for the id of a track removed earlier. `getMixer()` holds the entries of the current tracks; each undo and redo state keeps its own. Change the mix with `setTrackVolume`, `setTrackMute`, `setTrackSolo` and `setTrackPan`, which act on a track that is in the current tracks. `engine.getState().tracks` and the tracks an adapter receives carry the current mix in those fields; `arrangement.getTracks()` does not (read `getMixer()`).
- **Undo, redo and an aborted transaction restore the tracks, the clips and the mix** of the state they return to. Undoing a `removeTrack` brings the track back with the mix it had, and undoing an `updateTrack` that gave a track a new id brings back the old id with the mix it had then.
- **Ids are unique.** `setTracks`, `addTrack` and `updateTrack` throw an `Error` for a duplicate track id, for two clips with one id on the same track, and for a track whose clips do not match its `kind` (a loading clip is an audio clip), before anything changes.
- **Without an engine** clips are given no `startTick`, and a clip that came with one loses it when it is moved, trimmed on the left or split. Every clip without a tick, in the current tracks and in every undo and redo state, gets one from its `startSample` when an engine attaches. The shortest a clip may be is 0.1 s at the clip's own sample rate.

## API

### PlaylistEngine

Key methods (see `src/types.ts` for the full `EngineState` shape). `PlaylistEngineOptions` takes `adapter`, `arrangement`, `sampleRate`, `samplesPerPixel`, `zoomLevels`, `undoLimit`, `attachDecodeContext`, `bpm` and `ppqn`, all optional:

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
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void; // an undo step
  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;
  setTrackArmed(trackId: string, armed: boolean): void; // plays muted while armed; not an undo step
  zoomIn(): void;
  zoomOut(): void;
  setZoomLevel(samplesPerPixel: number): void;
  setTempo(bpm: number, atTick?: number): void;

  // Undo/redo (tracks, clips and the mix)
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

### Arrangement

```typescript
function createArrangement(options?: CreateArrangementOptions): Arrangement;

interface CreateArrangementOptions {
  tracks?: readonly ArrangementTrack[]; // the first tracks; not an undo step
  undoLimit?: number; // default 100
  loadSource?: LoadSource; // default: defaultLoadSource
}

interface Arrangement {
  // read
  getTracks(): readonly ArrangementTrack[];
  getMixer(): ReadonlyMap<string, TrackMixerValues>;
  subscribe(listener: () => void): () => void;
  readonly tracksVersion: number;
  readonly mixerVersion: number;

  // tracks
  setTracks(tracks: readonly ArrangementTrack[]): void;
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
  constrainTrimDelta(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): number;

  // mixer (each call is an undo step; see MixerChangeOptions)
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;

  // recording arm (outside the history)
  readonly armedTrackIds: ReadonlySet<string>;
  setTrackArmed(trackId: string, armed: boolean): void;

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
  retry(src: ClipSource): void; // start a source whose load failed again
}

interface MixerChangeOptions {
  /** Changes with the same id, one after another, are one undo step. */
  gesture?: string;
  /** Not an undo step: the value is written into every saved state as well. */
  undoable?: false;
}

function createMixerGesture(): MixerGesture;

interface MixerGesture {
  /** The id to pass while a gesture is going on. */
  readonly id: string;
  /** The gesture is over: the next change starts a new one. */
  end(): void;
  /** Ends the gesture on the input's own events; returns the detach function. */
  attach(input: HTMLInputElement): () => void;
}

interface ArrangementSourceState {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error; // when failed
}

interface ArrangementSourcesValue {
  sources: ReadonlyMap<ClipSource, ArrangementSourceState>;
  pendingCount: number;
  failedCount: number;
  isLoading: boolean; // true while a source is pending
}

type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;

const defaultLoadSource: LoadSource;

function attachDecodeContext(
  arrangement: Arrangement,
  getContext: () => Promise<BaseAudioContext>
): () => void; // returns the function that detaches
```

`ArrangementTrack`, `LoadingClip`, `ClipSource` (`string | Blob`), `ValueSource` and `isLoadingClip` come from `@waveform-playlist/core`.

### PlayoutAdapter

The interface an audio backend implements to plug into the engine:

```typescript
interface PlayoutAdapter {
  readonly audioContext: AudioContext;
  readonly ppqn: number;
  setPpqn?(ppqn: number): void;

  init(): Promise<void>;
  setTracks(tracks: readonly ClipTrack[]): void; // the engine's own objects: read them, never write to them. Loaded clips only
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
