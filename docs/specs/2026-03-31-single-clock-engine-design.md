# Single Clock Engine Design

**Date:** 2026-03-31
**Branch:** `feat/single-clock-engine`
**Status:** Design approved, ready for implementation planning

## Problem

The Engine and Transport maintain independent clocks during playback. The Engine calls `adapter.play(startTime)` and tracks `_currentTime` independently, while the Transport runs its own Clock for audio scheduling. In single-tempo mode both clocks agree (time is linear), but in variable-tempo mode they diverge because tempo changes affect transport time nonlinearly while audio file time is linear.

The `feat/variable-tempo-grid` branch has all rendering, grid, and interaction work complete but playback sync is broken due to this two-clock problem. Manual `audioStartOffset` workarounds in the demo are a symptom, not a solution.

## Solution

Make the Transport the single time authority for audio scheduling. The Engine becomes a state manager and thin transport controller. Clips are scheduled on the Transport at their tick positions; the Transport handles all tick-to-seconds-to-AudioContext-time conversion internally.

## Clip Model Changes

`AudioClip` gains `startTick` as the authoritative timeline position:

```typescript
interface AudioClip {
  startTick: Tick;           // Authoritative timeline position
  startSample: Sample;       // Derived cache (from startTick via TempoMap)
  offsetSamples: Sample;     // Position within audio file (unchanged)
  durationSamples: Sample;   // Clip length in audio samples (unchanged)
  // ... rest unchanged (id, gain, fadeIn, fadeOut, audioBuffer, etc.)
}
```

**Derivation rule:** `startSample = Math.round(tempoMap.ticksToSeconds(startTick) * sampleRate)`

**No `durationTicks`** -- `durationSamples` stays as the only duration field. Tick-space duration is computable on the fly when needed (loop clamping, visual width).

### Clip Creation Helpers

- `createClipFromSeconds(startTime, ...)` -- gains optional TempoMap/bpm+ppqn parameter to compute `startTick`. When absent, uses default single-tempo math.
- `createClip(startSample, ...)` -- same, needs conversion context to derive `startTick`.
- `createClipFromTicks(startTick, ...)` -- new helper, derives `startSample` from TempoMap.

## PlayoutAdapter Interface Changes

The adapter becomes a transport controller + clip data sink:

```typescript
interface PlayoutAdapter {
  // Lifecycle (unchanged)
  init(): Promise<void>;
  dispose(): void;

  // Track/clip data (unchanged)
  setTracks(tracks: ClipTrack[]): void;
  addTrack?(track: ClipTrack): void;
  removeTrack?(trackId: string): void;
  updateTrack?(trackId: string, track: ClipTrack): void;

  // Transport control (unchanged)
  play(startTime: number, endTime?: number): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  isPlaying(): boolean;

  // Track controls (unchanged)
  setMasterVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;
  setLoop(enabled: boolean, start: number, end: number): void;

  // NEW: Tempo/meter control
  setTempo(bpm: number, atTick?: Tick): void;
  setMeter?(numerator: number, denominator: number, atTick?: Tick): void;
}
```

**Key additions:** `setTempo()` and `setMeter()` allow the Engine to forward tempo/meter changes to the adapter. The adapter configures its Transport (native) or `Tone.Transport` (Tone.js) accordingly.

**Removed from earlier discussion:** `getTempoMap()` -- Engine owns its own TempoMap instead.

## Engine Changes

### TempoMap Ownership

Engine maintains its own TempoMap for `startSample` cache recomputation and UI coordinate conversions. Transport maintains a separate TempoMap instance with the same data for audio scheduling. All mutations go through the Engine, which forwards to both:

```typescript
setTempo(bpm: number, atTick?: Tick): void {
  this._tempoMap.setTempo(bpm, atTick);       // own copy for cache
  this._adapter?.setTempo(bpm, atTick);        // transport's copy for scheduling
  this._recomputeStartSamples();
  this._emitStateChange();
}
```

Same pattern as solo/mute -- Engine is source of truth, forwards to adapter. Two copies of data, one owner.

### getCurrentTime() Simplification

```typescript
// Before: dual logic with independent _currentTime
getCurrentTime(): number {
  if (this._isPlaying && this._adapter) {
    return this._adapter.getCurrentTime();
  }
  return this._currentTime;
}

// After: adapter is always authoritative when present
getCurrentTime(): number {
  if (this._adapter) {
    return this._adapter.getCurrentTime();
  }
  return this._currentTime;  // fallback when no adapter
}
```

Engine still caches `_currentTime` on `pause()` / `stop()` for the no-adapter fallback.

### startSample Recomputation

```typescript
private _recomputeStartSamples(): void {
  this._tracks = this._tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      startSample: Math.round(
        this._tempoMap.ticksToSeconds(clip.startTick) * this._sampleRate
      ) as Sample,
    })),
  }));
}
```

Called after `setTempo()` and any clip mutation that changes `startTick`. Produces new track/clip objects (immutable pattern) so React subscribers detect the change.

### setTracks() Migration

During migration, consumers may pass clips without `startTick`. Engine computes it on ingestion, producing new clip objects (immutable pattern):

```typescript
setTracks(tracks: ClipTrack[]): void {
  const enrichedTracks = tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => ({
      ...clip,
      startTick: clip.startTick ?? this._tempoMap.secondsToTicks(
        clip.startSample / this._sampleRate
      ),
    })),
  }));
  // ... rest of setTracks uses enrichedTracks
}
```

## ClipPlayer Changes

ClipPlayer works in tick space directly for clip matching:

### generate()

```typescript
// Before: convert window to samples, compare clip.startSample
generate(fromTick: Tick, toTick: Tick): ClipEvent[] {
  const fromSample = this._sampleTimeline.ticksToSamples(fromTick);
  const toSample = this._sampleTimeline.ticksToSamples(toTick);
  // ... if (clipStartSample < fromSample) continue;
}

// After: compare ticks directly
generate(fromTick: Tick, toTick: Tick): ClipEvent[] {
  for (const clip of state.clips) {
    if (clip.startTick < fromTick) continue;   // already playing
    if (clip.startTick >= toTick) continue;     // not yet
    // ... create event with clip.startTick as the scheduling tick
  }
}
```

### Loop clamping

Moves to ticks. Compute clamped duration from tick difference when clip extends past `loopEndTick`.

### onPositionJump()

Compares `clip.startTick` directly against `newTick` instead of converting to samples first.

### consume()

No major change. Already does `tick -> seconds -> audioTime` for `source.start(when, ...)`. `offsetSamples` and `durationSamples` stay as samples since that's what the Web Audio API expects.

## Tone.js Adapter Compatibility

Tone.js supports variable tempo via scheduled callbacks:

```typescript
setTempo(bpm: number, atTick?: Tick): void {
  if (atTick === undefined || atTick === 0) {
    Tone.Transport.bpm.value = bpm;
  } else {
    const time = ticksToTransportTime(atTick);
    Tone.Transport.schedule(() => {
      Tone.Transport.bpm.value = bpm;
    }, time);
  }
}
```

Both adapters are variable-tempo capable. The Tone adapter builds scheduling from the same `setTempo()` calls the Engine forwards.

## Scope

### In scope
- `AudioClip` gains `startTick`, `startSample` becomes derived cache
- `PlayoutAdapter` interface gains `setTempo()`, `setMeter()`
- Engine owns a TempoMap, forwards tempo to adapter
- Engine's `getCurrentTime()` always reads from adapter
- ClipPlayer works in tick space for clip matching
- `NativePlayoutAdapter` implements new interface
- `createClipFromTicks()` helper

### Out of scope (future work)
- `durationTicks` -- not needed, computable on the fly
- Dropping `startSample` from the type entirely
- `TonePlayoutAdapter` variable-tempo implementation (interface is ready)
- React/browser layer changes (reads from Engine, no changes needed)
- Clip dual timebase (`timeBase: 'ticks' | 'samples'` per clip)
- `feat/variable-tempo-grid` merge (this PR unblocks it)

## Testing

- Unit tests for ClipPlayer tick-based `generate()` / `onPositionJump()`
- Unit tests for Engine TempoMap ownership and `startSample` recomputation
- Unit tests for `createClipFromTicks()` helper
- Integration test: play clips at various tick positions with multi-tempo TempoMap
