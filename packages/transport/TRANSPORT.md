# How the Transport Works

This document explains the architecture and scheduling model of `@dawcore/transport` — a native Web Audio transport that replaces Tone.js for multi-track audio playback.

## Why Replace Tone.js?

Tone.js is excellent for synthesizers and musical applications, but its Transport layer causes issues for multi-track audio editors:

| Problem | Root Cause |
|---------|-----------|
| Can't set sample rate | Tone.js 15.1.22 doesn't pass `sampleRate` to `standardized-audio-context` |
| Firefox AudioParam errors | `standardized-audio-context` wrapping breaks native `AudioParam` identity |
| Ghost tick bugs | Stale `Clock._lastUpdate` fires callbacks at wrong positions after stop/start cycles |
| No metronome | Must be built from scratch outside Tone.js |
| No latency hint control | Can't pass `latencyHint: 0` through Tone.js Context |

This transport uses native Web Audio exclusively, receiving the `AudioContext` from the consumer. No wrapping, no intermediary libraries.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Transport                             │
│                    (top-level orchestrator)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Core Layer                                           │   │
│  │  ┌─────────┐  ┌───────────┐  ┌─────────┐            │   │
│  │  │  Clock   │  │ Scheduler │  │  Timer  │            │   │
│  │  │ elapsed  │  │  sliding  │  │  rAF    │            │   │
│  │  │  time    │  │  window   │  │  loop   │            │   │
│  │  └─────────┘  └───────────┘  └─────────┘            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Timeline Layer                                       │   │
│  │  ┌──────────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │ SampleTimeline│  │ TempoMap │  │ MeterMap │       │   │
│  │  │ samples↔secs  │  │ tick↔sec │  │ time sig │       │   │
│  │  └──────────────┘  └──────────┘  └──────────┘       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Audio Layer                                          │   │
│  │  ┌────────────┐  ┌──────────────────┐  ┌──────────┐ │   │
│  │  │ ClipPlayer │  │ MetronomePlayer  │  │TrackNodes│ │   │
│  │  │ source mgmt│  │ beat-grid clicks │  │signal    │ │   │
│  │  │            │  │                  │  │chains    │ │   │
│  │  └────────────┘  └──────────────────┘  └──────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MasterNode  →  AudioContext.destination              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Each layer is independently testable. The core layer knows nothing about audio. The timeline layer knows nothing about scheduling. The audio layer implements the scheduler's listener contract.

## The Scheduling Model

### The Core Loop

Every animation frame:

```
Timer (rAF) → reads Clock.getTime() → Scheduler.advance(currentTime)
```

The scheduler maintains a **sliding window** that expands forward as time advances. It only generates events for the *new* portion of the window (tracked by `rightEdge`), preventing duplicate work.

### Lookahead Window

The scheduler runs 200ms ahead of real-time audio. This means:

1. At clock time `T`, the scheduler generates events up to `T + 200ms`
2. Events are scheduled on the audio hardware with precise `AudioContext.currentTime` timestamps
3. The 200ms buffer absorbs frame timing jitter from `requestAnimationFrame`

### Listener Contract

Both `ClipPlayer` and `MetronomePlayer` implement the same interface:

```typescript
type Tick = number & { readonly [__tick]: never };   // branded — zero runtime cost
type Sample = number & { readonly [__sample]: never };

interface SchedulerEvent {
  tick: Tick;  // integer tick position on the timeline
}

interface SchedulerListener<T extends SchedulerEvent> {
  generate(fromTick: Tick, toTick: Tick): T[];
  consume(event: T): void;
  onPositionJump(newTick: Tick): void;
  silence(): void;
}
```

`Tick` and `Sample` are branded types that prevent accidentally passing seconds where ticks or samples are expected. They are plain `number` at runtime — the brand exists only at compile time. Conversion functions are the canonical producers: `secondsToTicks()` returns `Tick`, `secondsToSamples()` returns `Sample`. Tests use `as Tick` / `as Sample` casts for literal values.

- **`generate()`** — Produce events for a tick window `[fromTick, toTick)`. Called by the scheduler when the window expands. Each listener converts ticks to its native unit internally (MetronomePlayer stays in ticks, ClipPlayer converts to samples).
- **`consume()`** — Realize an event — create `AudioBufferSourceNode`, connect to audio graph, call `source.start()`. Each listener converts `event.tick` → seconds → audio time internally.
- **`onPositionJump()`** — Position discontinuity (seek, loop wrap, resume from pause). ClipPlayer stops active sources and creates mid-clip sources for clips spanning the new position. MetronomePlayer is a no-op (clicks are short one-shots that finish naturally).
- **`silence()`** — Emergency stop. Kill all active audio immediately.

### Generate-Once Scheduling

A clip is only scheduled when its `startSample` falls within the scheduling window `[fromTick, toTick)` (converted to samples internally). Once an `AudioBufferSourceNode` is created, it plays for its full duration — the scheduler doesn't re-generate for it.

Clips that started in a previous window are already playing. Mid-clip playback (seek, loop, resume) is handled by `onPositionJump()`, which creates new sources at the correct buffer offset.

This prevents the stacking bug where duplicate sources accumulate and volume ramps uncontrollably.

## Two Clock Spaces

The transport operates in two time coordinate systems:

| Space | Example | Used For |
|-------|---------|----------|
| **Transport time** | 0.0, 0.5, 1.0... | Timeline position (seconds from start) |
| **AudioContext time** | 100.5, 101.0... | Hardware scheduling (`source.start(when)`) |

`Clock.toAudioTime(transportTime)` converts between them:

```
audioContextTime = audioContext.currentTime + (transportTime - clock.getTime())
```

This conversion happens inside `consume()` — events carry transport time, and the player converts to AudioContext time right before scheduling the `AudioBufferSourceNode`.

## Dual Timeline

Audio clips and music events live in different coordinate spaces:

- **SampleTimeline** — Audio clips use absolute sample positions (`startSample`, `durationSamples`), typed as `Sample`. Position does NOT change when tempo changes. Also converts between ticks and samples via TempoMap (`ticksToSamples()` / `samplesToTicks()`).
- **TempoMap** — Converts between ticks and seconds. `secondsToTicks()` returns branded `Tick`; `ticksToSeconds()` accepts `Tick`. Supports tempo changes at arbitrary tick positions with cached cumulative seconds for O(log n) lookups.
- **MeterMap** — Time signature entries at tick positions. Determines beat unit (from denominator) and bar length (from numerator). See Meter Map section below.

The scheduler works in integer ticks — `advance()` converts Clock seconds → ticks via TempoMap at entry. MetronomePlayer receives ticks directly; ClipPlayer converts ticks to samples via SampleTimeline.

## Tempo Automation

TempoMap entries carry an `interpolation` field describing how to arrive at this entry from the previous:

- **`'step'`** (default) — Instant jump. Constant BPM within the segment. Simple formula: `seconds = ticks * 60 / (bpm * ppqn)`.
- **`'linear'`** — Linear ramp from previous BPM to this BPM. Uses exact trapezoidal formula: `seconds = ticks * 60/ppqn * (1/bpm0 + 1/bpmAtTick) / 2`. The inverse (`secondsToTicks`) solves a closed-form quadratic — no iterative stepping needed.
- **`{ type: 'curve', slope }`** — Reserved for future Möbius-Ease curves (not yet implemented).

`getTempo(atTick)` returns the interpolated BPM at any position within a ramp. The `secondsAtTick` cache on each entry accounts for the interpolation type of that segment, so O(log n) lookup still works.

The first entry is always `'step'` — there is no previous entry to ramp from.

## Meter Map

The transport maintains two independent musical maps:

- **TempoMap** — maps ticks to seconds. Answers "how many seconds is beat N?"
- **MeterMap** — maps ticks to bar/beat structure. Answers "what bar is tick N in, and how many beats per bar?"

These are intentionally separate. A tempo change does not affect bar numbering; a meter change does not affect the tick→second conversion. Each concern owns its own sorted entry list with O(log n) lookup.

### MeterMap Entry

```typescript
{ tick: number; numerator: number; denominator: number; barAtTick: number }
```

`barAtTick` is cached at insertion time by accumulating bar counts from all preceding entries. This makes `barToTick(n)` and `tickToBar(t)` both O(entries) with no per-query accumulation.

### Beat Unit

The denominator controls how many ticks constitute one beat:

```
ticksPerBeat = ppqn * (4 / denominator)
```

A denominator of `4` gives a quarter-note beat (standard). A denominator of `8` gives an eighth-note beat — useful for compound meters where the pulse is felt in eighth notes.

### Bar Boundary Constraint

`setMeter(numerator, denominator, atTick)` snaps `atTick` to the nearest preceding bar boundary under the current meter. This prevents fractional bars, which would make bar numbers inconsistent for all later entries.

### MetronomePlayer Integration

`MetronomePlayer.generate(fromTick, toTick)` receives ticks directly from the Scheduler and walks the beat grid. For each beat tick, it queries `MeterMap.getMeter(tick)` to determine:

1. The beat unit duration (ticks per beat → seconds via TempoMap)
2. Whether this beat is beat 1 of a bar (→ accent click) or an inner beat (→ normal click)

This means the metronome correctly accents bar 1 regardless of meter changes mid-session.

## Audio Signal Chain

Each track has an independent signal chain:

```
clip AudioBufferSourceNode
          ↓
    GainNode (per-clip gain + fades)
          ↓
    GainNode (track volume)
          ↓
    StereoPannerNode (pan, channelCount: 2)
          ↓
    GainNode (mute: 0 or 1)
          ↓
    [effects hook] ← connectTrackOutput(trackId, node)
          ↓
    MasterNode (master volume)
          ↓
    AudioContext.destination
```

Key design choices:
- **Separate mute GainNode** — Volume and mute are independent. Unmuting restores the original volume.
- **`channelCount: 2` on panner** — Prevents stereo→mono downmix (Web Audio `StereoPannerNode` defaults to `channelCount: 1`).
- **Effects hook** — `connectEffects(node)` reroutes the signal through any `AudioNode` chain without the transport knowing what's in it.

## Playback Lifecycle

### Play

1. Seek clock to `startTime` (if provided)
2. Reset scheduler to current position
3. Start clock (captures `AudioContext.currentTime` reference)
4. Call `clipPlayer.onPositionJump()` to create mid-clip sources
5. Start rAF timer loop

### Pause

1. Stop timer
2. Stop clock (accumulates elapsed time)
3. Silence all listeners (stop active sources)
4. Position is preserved — next `play()` resumes from here

### Stop

1. Stop timer
2. Reset clock (elapsed time → 0)
3. Reset scheduler
4. Silence all listeners

### Seek During Playback

1. Stop timer
2. Silence all listeners
3. Seek clock to new position
4. Reset scheduler to new position
5. Start clock
6. Call `clipPlayer.onPositionJump()` for mid-clip sources
7. Restart timer

### Loop

The scheduler detects when the lookahead window (in ticks) crosses `loopEnd`:

1. Generate events up to `loopEnd` (clip durations clamped at boundary in samples)
2. Call `onPositionJump(loopStart)` on all listeners — ClipPlayer stops sources and creates mid-clip sources; MetronomePlayer is a no-op (clicks finish naturally)
3. Seek clock to `loopStart - timeToBoundary` where `timeToBoundary = loopEnd - clockTime` in seconds. This offset ensures post-wrap events schedule at the boundary's audio time, not at "now" (the advance runs ahead of real time by the lookahead)
4. Continue generating from `loopStart` to fill remaining lookahead — events use the adjusted clock so `toAudioTime()` maps correctly
5. Handles multiple wraps per advance for loop regions shorter than the lookahead
6. `getCurrentTime()` clamps to `loopStart` during the brief window after wrap when the clock is behind (the lookahead offset)

## Solo Logic

When any track is soloed, all non-soloed tracks are muted via `TrackNode.setMute(true)`. A track that is both explicitly muted AND soloed stays muted — explicit mute takes precedence.

## NativePlayoutAdapter

A thin bridge that implements the `PlayoutAdapter` interface from `@waveform-playlist/engine`. All methods delegate to the internal `Transport` instance.

```typescript
const adapter = new NativePlayoutAdapter(audioContext);

// All PlayoutAdapter methods work
adapter.setTracks(tracks);
adapter.play(0);
adapter.seek(5);

// Access Transport for features beyond PlayoutAdapter
adapter.transport.setTempo(140);
adapter.transport.setMetronomeEnabled(true);
adapter.transport.connectTrackOutput('vocals', reverbNode);
```

The `transport` getter exposes the full Transport API for tempo, metronome, and effects — features that don't exist in the `PlayoutAdapter` interface.

## Testing

All layers are tested with mocked `AudioContext` — no real audio hardware needed:

- **Core** — Mock `audioContext.currentTime`, verify clock/scheduler/timer behavior
- **Timeline** — Pure math, no mocks needed
- **Audio** — Mock `createBufferSource()`, verify `start()` call arguments
- **Transport** — Integration tests combining all layers
- **Adapter** — Verify `PlayoutAdapter` contract compliance

```bash
cd packages/transport && npx vitest run
```
