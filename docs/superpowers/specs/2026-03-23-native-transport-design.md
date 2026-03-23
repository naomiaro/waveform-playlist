# Native Transport Package Design

**Date:** 2026-03-23
**Status:** Approved
**Branch:** `experimental/native-transport`

## Problem

Tone.js is blocking multiple features and causing cross-browser bugs:

1. **Sample rate control** — Tone.js 15.1.22 doesn't pass `sampleRate` to `standardized-audio-context`. Upstream fix exists but is unreleased.
2. **Firefox AudioListener** — Passing native/standardized `AudioContext` to Tone.js `Context` causes `"param must be an AudioParam"` errors.
3. **Ghost ticks** — Stale `Clock._lastUpdate` in Tone.js Transport fires callbacks at wrong positions after stop/start cycles. Required `_scheduleGuardOffset` workaround.
4. **No metronome** — Tone.js has no built-in metronome. Must be built from scratch.
5. **Latency hint** — Cannot pass `latencyHint: 0` through Tone.js Context.

## Solution

A new `@waveform-playlist/transport` package that replaces Tone.js Transport/scheduling with native Web Audio. Tone.js remains available only for effects (optional, consumer-side).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package scope | Standalone core + adapter | Reusable core, waveform-playlist adapter layer |
| Tempo system | Tick-first (PPQN internal) | Retrofitting ticks into seconds-based core is expensive |
| Tick resolution | Dual timeline | Audio clips are sample-absolute, music events are beat-relative |
| Audio graph | Fully native Web Audio | Zero dependency on Tone.js for playback signal path |
| Loop handling | Hybrid | Scheduler detects global loop boundary, players handle source cleanup |
| AudioContext | Received from consumer | Sidesteps all Tone.js/Firefox context creation issues |
| Dependencies | Zero | `@waveform-playlist/core` and `engine` as peer deps for types only |
| Effects | Plugin hook per track | `connectTrackOutput(trackId, node)` accepts any AudioNode chain |

## Package Structure

```
packages/transport/
  src/
    core/
      clock.ts              # elapsed time tracking, audio <-> clock sync
      scheduler.ts          # sliding window event generation/consumption
      timer.ts              # drives scheduler (rAF or setInterval)
    timeline/
      sample-timeline.ts    # absolute sample positions (audio clips)
      tick-timeline.ts      # PPQN positions (metronome, MIDI)
      tempo-map.ts          # tempo changes, tick <-> seconds conversion
    audio/
      track-node.ts         # per-track native signal chain
      master-node.ts        # master volume -> destination/effects hook
      clip-player.ts        # schedules AudioBufferSourceNodes
      metronome-player.ts   # generates click AudioBufferSourceNodes
    transport.ts            # top-level orchestrator, public API
    adapter.ts              # NativePlayoutAdapter (implements PlayoutAdapter)
    types.ts                # shared interfaces
    index.ts                # public exports
  __tests__/
  CLAUDE.md
  package.json
  tsconfig.json
  tsup.config.ts
```

## Core Layer

### Clock

Tracks elapsed time relative to `AudioContext.currentTime`.

```typescript
class Clock {
  private _audioContext: AudioContext;
  private _running: boolean;
  private _audioTimeAtStart: number;   // context.currentTime when started
  private _clockTimeAtStart: number;   // accumulated time from previous runs

  start(): void        // capture audioTimeAtStart
  stop(): void         // accumulate elapsed into clockTimeAtStart
  reset(): void        // zero everything
  getTime(): number    // current elapsed seconds (live when running)
  seekTo(time: number): void  // jump clock to arbitrary position
}
```

No ticks, no tempo. Single source of truth for timeline position in seconds.

### Scheduler

Sliding window that generates and consumes events. Runs 100-200ms ahead of real audio time.

```typescript
class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;   // how far ahead to schedule (default 0.2s)
  private _leftEdge: number;    // last consumed time
  private _rightEdge: number;   // last generated time
  private _loopEnabled: boolean;
  private _loopStart: number;
  private _loopEnd: number;

  advance(currentTime: number): void
  addListener(listener: SchedulerListener<T>): void
  removeListener(listener: SchedulerListener<T>): void
  setLoop(enabled: boolean, start: number, end: number): void
}

interface SchedulerListener<T> {
  generate(fromTime: number, toTime: number): T[];
  consume(event: T): void;
  onPositionJump(newTime: number): void;  // loop/seek discontinuity
  silence(): void;                         // stop all active audio
}
```

**Loop handling in `advance()`:**

1. Window expands to `[leftEdge, currentTime + lookahead]`
2. If `loopEnabled` and window crosses `loopEnd`:
   - Generate events from `leftEdge` to `loopEnd`
   - Call `onPositionJump(loopStart)` on all listeners
   - Clock seeks to `loopStart`
   - Continue generating from `loopStart` to fill remaining window
3. All in one tick — seamless audio, no gap

### Timer

Drives the scheduler at a fixed interval.

```typescript
class Timer {
  private _interval: number;  // default 20ms
  start(): void   // begin ticking
  stop(): void    // stop ticking
}
```

Each tick: `scheduler.advance(clock.getTime())`.

## Timeline Layer

### Dual Coordinate System

Audio clips and music events live in different coordinate spaces:

- **SampleTimeline** — absolute positions in samples. `samplesToSeconds(samples)` / `secondsToSamples(seconds)`. Audio clips use this. Position does NOT change when tempo changes.
- **TickTimeline** — relative positions in PPQN ticks (default 960 PPQN). `toPosition(ticks, beatsPerBar)` returns `{ bar, beat, tick }`. Metronome and MIDI use this.
- **TempoMap** — converts between ticks and seconds. Supports multiple tempo entries (sorted by tick position) with cached cumulative seconds for O(log n) lookups.

Both coordinate systems convert to seconds at the scheduler boundary. The scheduler only works in seconds.

### TempoMap

```typescript
class TempoMap {
  private _entries: TempoEntry[];  // sorted by tick

  ticksToSeconds(ticks: number): number
  secondsToTicks(seconds: number): number
  setTempo(bpm: number, atTick?: number): void  // default: tick 0
  getTempo(atTick?: number): number
}

interface TempoEntry {
  tick: number;
  bpm: number;
  secondsAtTick: number;  // cached cumulative
}
```

For v1, most users have a single tempo entry. The structure supports tempo automation for future use.

## Audio Layer

### TrackNode

Per-track native Web Audio signal chain:

```
clip source -> GainNode (volume) -> StereoPannerNode -> GainNode (mute) -> [effects hook] -> output
```

```typescript
class TrackNode {
  readonly id: string;
  get input(): AudioNode     // where clip sources connect
  get output(): AudioNode    // connect to master or effects

  setVolume(value: number): void
  setPan(value: number): void
  setMute(muted: boolean): void
  connectEffects(effectsInput: AudioNode): void
  disconnectEffects(): void
  dispose(): void
}
```

Effects hook: `connectEffects(node)` inserts any `AudioNode` chain between mute and output. Supports Tone.js effects, WAM plugins, or native nodes.

### MasterNode

```typescript
class MasterNode {
  get input(): AudioNode
  get output(): AudioNode
  setVolume(value: number): void
  dispose(): void
}
```

### ClipPlayer

Implements `SchedulerListener`. Replaces `ToneTrack`'s `Transport.schedule()` approach.

```typescript
class ClipPlayer implements SchedulerListener<ClipEvent> {
  private _tracks: Map<string, TrackClipState>;
  private _activeSources: Set<AudioBufferSourceNode>;

  setTracks(tracks: ClipTrack[]): void

  generate(fromTime: number, toTime: number): ClipEvent[]
  consume(event: ClipEvent): void      // create source, connect, start
  onPositionJump(newTime: number): void // stop sources, re-schedule mid-clip
  silence(): void                       // stop all sources
}
```

`generate()` finds clips overlapping the time window. `consume()` creates native `AudioBufferSourceNode`, connects to `TrackNode.input`, applies fade envelope, calls `source.start(when, offset, duration)`.

Mid-clip starts (play from middle of a clip, or loop wrap) handled in `onPositionJump()` — same concept as current `ToneTrack.startMidClipSources()`.

### MetronomePlayer

Implements `SchedulerListener`. Generates click sounds on the beat grid.

```typescript
class MetronomePlayer implements SchedulerListener<MetronomeEvent> {
  private _tempoMap: TempoMap;
  private _tickTimeline: TickTimeline;

  generate(fromTime: number, toTime: number): MetronomeEvent[]
  consume(event: MetronomeEvent): void  // play click buffer

  setEnabled(enabled: boolean): void
  setBeatsPerBar(beats: number): void
  setClickSounds(accent: AudioBuffer, normal: AudioBuffer): void
}
```

Converts the scheduler's seconds window to ticks via `TempoMap`, finds beat positions, generates click events. Accent on beat 1.

## Transport (Top-Level API)

```typescript
class Transport {
  constructor(audioContext: AudioContext, options?: TransportOptions)

  // Playback
  play(startTime?: number, endTime?: number): void
  pause(): void
  stop(): void
  seek(time: number): void
  getCurrentTime(): number
  isPlaying(): boolean

  // Tracks
  setTracks(tracks: ClipTrack[]): void
  addTrack(track: ClipTrack): void
  removeTrack(trackId: string): void
  updateTrack(trackId: string, track: ClipTrack): void

  // Track controls
  setTrackVolume(trackId: string, volume: number): void
  setTrackPan(trackId: string, pan: number): void
  setTrackMute(trackId: string, muted: boolean): void
  setTrackSolo(trackId: string, soloed: boolean): void

  // Master
  setMasterVolume(volume: number): void

  // Loop
  setLoop(enabled: boolean, start: number, end: number): void

  // Tempo
  setTempo(bpm: number): void
  getTempo(): number
  setBeatsPerBar(beats: number): void

  // Metronome
  setMetronomeEnabled(enabled: boolean): void
  setMetronomeClickSounds(accent: AudioBuffer, normal: AudioBuffer): void

  // Effects hook
  connectTrackOutput(trackId: string, node: AudioNode): void
  disconnectTrackOutput(trackId: string): void

  // Events
  on(event: 'play' | 'pause' | 'stop' | 'loop' | 'tempochange', cb): void
  off(event, cb): void

  dispose(): void
}

interface TransportOptions {
  sampleRate?: number;         // default: audioContext.sampleRate
  ppqn?: number;               // default: 960
  tempo?: number;              // default: 120 BPM
  beatsPerBar?: number;        // default: 4
  schedulerLookahead?: number; // seconds, default: 0.2
  schedulerInterval?: number;  // ms, default: 20
}
```

**Solo logic** lives in Transport — when any track is soloed, mutes all non-soloed tracks via `TrackNode.setMute()`.

## NativePlayoutAdapter

Thin bridge to `PlaylistEngine`:

```typescript
class NativePlayoutAdapter implements PlayoutAdapter {
  private _transport: Transport;

  constructor(audioContext: AudioContext, options?: TransportOptions)

  // All PlayoutAdapter methods delegate to this._transport
  // ...

  // Expose transport for direct access (tempo, metronome, effects)
  get transport(): Transport
}
```

`PlaylistEngine` doesn't change. React and dawcore swap `createToneAdapter()` for `new NativePlayoutAdapter(audioContext)`.

The `transport` getter exposes features beyond `PlayoutAdapter` (tempo, metronome, effects hooks).

## What This Solves

| Problem | Solution |
|---------|----------|
| Sample rate control | Native `AudioContext({ sampleRate })` — no wrapper |
| Firefox AudioListener | No `standardized-audio-context` needed |
| Ghost tick bugs | Our own scheduler, no Tone.js Clock |
| Metronome | Built-in as `MetronomePlayer` |
| Latency hint | Native `AudioContext({ latencyHint: 0 })` |
| Effects lock-in | Plugin hook accepts any AudioNode chain |

## Reference Projects

- **webaudio-transport** (`/Users/naomiaro/Code/webaudio-transport`) — sliding window scheduler, generator/consumer pattern, metronome as player, tempo map
- **openDAW** (`/Users/naomiaro/Code/openDAWOriginal`) — block-based processing, global loop + per-clip loop, PPQN timeline, discontinuous position jumps

## Testing Strategy

- **Core (clock, scheduler, timer)** — unit tests with mocked `AudioContext.currentTime`, no real audio
- **Timeline (sample, tick, tempo)** — pure math, extensive unit tests for conversion accuracy
- **Audio (clip player, metronome)** — unit tests with mocked `AudioBufferSourceNode.start()` calls, verify timing
- **Transport** — integration tests combining core + timeline + audio layers
- **Adapter** — verify PlayoutAdapter contract compliance

## Migration Path

1. Build transport package on experimental branch
2. Wire `NativePlayoutAdapter` into one example (multiclip) for testing
3. Compare audio output with `TonePlayoutAdapter` side-by-side
4. Gradually migrate other examples
5. Make Tone.js adapter the legacy path, native the default
