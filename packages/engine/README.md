# @waveform-playlist/engine

Framework-agnostic multitrack timeline engine for waveform-playlist — pure clip/track operations plus a stateful `PlaylistEngine` that manages tracks, selection, loop, zoom, and undo/redo, decoupled from any audio backend via a pluggable `PlayoutAdapter`.

Used by `@waveform-playlist/browser` (the React provider) and `@dawcore/components` (the Lit web-components layer). Pair it with a `PlayoutAdapter` implementation such as `@waveform-playlist/playout` (Tone.js) or `@dawcore/transport` (native Web Audio) to actually produce sound — the engine itself never touches the audio graph directly.

## Features

- **Clip-based timeline model** — tracks hold multiple clips; move, trim, and split with automatic collision constraints
- **Sample + tick timeline math** — integer samples for precision, ticks for tempo-independent positioning
- **Undo/redo** — snapshot-based history for all structural mutations, with transaction grouping for drag gestures
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
import { TonePlayout } from '@waveform-playlist/playout'; // any PlayoutAdapter implementation

const adapter = new TonePlayout();
const engine = new PlaylistEngine({ adapter, sampleRate: 48000 });
await engine.init();

const track: ClipTrack = {
  id: 'track-1',
  name: 'Guitar',
  clips: [
    createClipFromSeconds({
      audioBuffer, // decoded AudioBuffer
      startTime: 0,
    }),
  ],
  muted: false,
  soloed: false,
  volume: 1.0,
  pan: 0,
};

engine.setTracks([track]);

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

## API

### PlaylistEngine

Key methods (see `src/types.ts` for the full `EngineState` shape):

```typescript
class PlaylistEngine {
  constructor(options?: PlaylistEngineOptions);

  // Tracks
  setTracks(tracks: ClipTrack[]): void;
  addTrack(track: ClipTrack): void;
  removeTrack(trackId: string): void;
  updateTrack(trackId: string, track?: ClipTrack): void;
  selectTrack(trackId: string | null): void;

  // Clip editing (undoable)
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter?: boolean): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number, skipAdapter?: boolean): void;
  splitClip(trackId: string, clipId: string, atSample: number): void;
  constrainTrimDelta(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): number;

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

  // Undo/redo
  undo(): void;
  redo(): void;
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
  setTracks(tracks: ClipTrack[]): void;
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
