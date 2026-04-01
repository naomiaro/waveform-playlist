# Single Clock Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Transport the single time authority for audio scheduling, eliminating the two-clock problem that blocks variable-tempo playback.

**Architecture:** Engine becomes a state manager + thin transport controller. Clips gain `startTick` (authoritative timeline position); `startSample` becomes a derived cache. The `PlayoutAdapter` interface gains tempo/conversion methods so the adapter can schedule clips at tick positions. ClipPlayer matches clips in tick space directly.

**Tech Stack:** TypeScript, vitest, tsup, pnpm monorepo

**Spec:** `docs/specs/2026-03-31-single-clock-engine-design.md`

---

## File Map

| Package | File | Action | Responsibility |
|---------|------|--------|----------------|
| core | `src/types/clip.ts` | Modify | Add `startTick` to `AudioClip`, `CreateClipOptions`, `CreateClipOptionsSeconds`. Add `CreateClipOptionsTicks` + `createClipFromTicks()` |
| core | `src/__tests__/clip.test.ts` | Modify | Tests for `startTick` passthrough and `createClipFromTicks()` |
| engine | `src/types.ts` | Modify | Add `setTempo`, `setMeter?`, `ticksToSeconds`, `secondsToTicks` to `PlayoutAdapter`. Add `bpm`/`ppqn` to `PlaylistEngineOptions` and `EngineState` |
| engine | `src/PlaylistEngine.ts` | Modify | Add `_bpm`, `_ppqn`, `setTempo()`, `_ticksToSeconds()`, `_secondsToTicks()`, `_recomputeStartSamples()`, `_enrichClipsWithStartTick()`. Simplify `getCurrentTime()` |
| engine | `src/__tests__/PlaylistEngine.test.ts` | Modify | Tests for tempo, startTick enrichment, getCurrentTime simplification |
| transport | `src/audio/clip-player.ts` | Modify | `generate()` and `onPositionJump()` use `clip.startTick` for tick-space matching |
| transport | `src/__tests__/clip-player.test.ts` | Modify | Tests for tick-based clip matching |
| transport | `src/adapter.ts` | Modify | Implement `setTempo()`, `setMeter()`, `ticksToSeconds()`, `secondsToTicks()` |
| transport | `src/__tests__/adapter.test.ts` | Modify | Tests for new adapter methods |

---

### Task 1: Add `startTick` to AudioClip and create `createClipFromTicks`

**Files:**
- Modify: `packages/core/src/types/clip.ts`
- Modify: `packages/core/src/__tests__/clip.test.ts`

- [ ] **Step 1: Write failing tests for `startTick` on AudioClip**

In `packages/core/src/__tests__/clip.test.ts`, add to the existing `createClip` describe block:

```typescript
it('passes through startTick when provided', () => {
  const clip = createClip({
    startSample: 48000,
    sampleRate: 48000,
    sourceDurationSamples: 96000,
    startTick: 960,
  });
  expect(clip.startTick).toBe(960);
});

it('leaves startTick undefined when not provided', () => {
  const clip = createClip({
    startSample: 48000,
    sampleRate: 48000,
    sourceDurationSamples: 96000,
  });
  expect(clip.startTick).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/__tests__/clip.test.ts`
Expected: FAIL — `startTick` not in `CreateClipOptions` or `AudioClip`

- [ ] **Step 3: Add `startTick` to `AudioClip`, `CreateClipOptions`, and `CreateClipOptionsSeconds`**

In `packages/core/src/types/clip.ts`:

Add to `AudioClip` interface (after `startSample`):

```typescript
  /**
   * Position on timeline in ticks (authoritative when present).
   * When set, startSample is a derived cache recomputed from startTick via TempoMap.
   * Optional for backwards compatibility — engine enriches clips without startTick on ingestion.
   */
  startTick?: number;
```

Add to `CreateClipOptions` (after `startSample`):

```typescript
  startTick?: number; // Timeline position in ticks (optional)
```

Add to `CreateClipOptionsSeconds` (after `startTime`):

```typescript
  startTick?: number; // Timeline position in ticks (optional)
```

In the `createClip()` function, destructure `startTick` from options and include it in the return object:

```typescript
export function createClip(options: CreateClipOptions): AudioClip {
  const {
    audioBuffer,
    startSample,
    offsetSamples = 0,
    gain = 1.0,
    name,
    color,
    fadeIn,
    fadeOut,
    waveformData,
    midiNotes,
    midiChannel,
    midiProgram,
    startTick,
  } = options;
```

Add `startTick` to the return object:

```typescript
  return {
    id: generateId(),
    audioBuffer,
    startSample,
    startTick,
    durationSamples,
    // ... rest unchanged
  };
```

In `createClipFromSeconds()`, pass `startTick` through to `createClip()`:

```typescript
  return createClip({
    // ... existing fields
    startTick: options.startTick,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/clip.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for `createClipFromTicks`**

Add a new describe block in `packages/core/src/__tests__/clip.test.ts`:

```typescript
import {
  createClip,
  createClipFromSeconds,
  createClipFromTicks,
  // ... other existing imports
} from '../types/clip';

// --- createClipFromTicks ---

describe('createClipFromTicks', () => {
  it('creates a clip with startTick and derives startSample', () => {
    const clip = createClipFromTicks({
      startTick: 960,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      bpm: 120,
      ppqn: 960,
    });
    expect(clip.startTick).toBe(960);
    // 960 ticks at 120 BPM, 960 PPQN = 1 beat = 0.5 seconds = 24000 samples
    expect(clip.startSample).toBe(24000);
  });

  it('defaults durationSamples to full source duration', () => {
    const clip = createClipFromTicks({
      startTick: 0,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      bpm: 120,
      ppqn: 960,
    });
    expect(clip.durationSamples).toBe(96000);
  });

  it('uses ticksToSeconds callback when provided', () => {
    const ticksToSeconds = (tick: number) => tick / 480; // custom conversion
    const clip = createClipFromTicks({
      startTick: 480,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      ticksToSeconds,
    });
    expect(clip.startTick).toBe(480);
    // 480 / 480 = 1 second = 48000 samples
    expect(clip.startSample).toBe(48000);
  });

  it('prefers ticksToSeconds over bpm/ppqn', () => {
    const ticksToSeconds = (tick: number) => tick / 100;
    const clip = createClipFromTicks({
      startTick: 100,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      ticksToSeconds,
      bpm: 120, // should be ignored
      ppqn: 960, // should be ignored
    });
    // ticksToSeconds(100) = 1.0 seconds = 48000 samples
    expect(clip.startSample).toBe(48000);
  });

  it('throws when neither ticksToSeconds nor bpm+ppqn provided', () => {
    expect(() =>
      createClipFromTicks({
        startTick: 960,
        sampleRate: 48000,
        sourceDurationSamples: 96000,
      })
    ).toThrow('createClipFromTicks');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/__tests__/clip.test.ts`
Expected: FAIL — `createClipFromTicks` is not exported

- [ ] **Step 7: Implement `createClipFromTicks`**

Add interfaces and function to `packages/core/src/types/clip.ts` (after `createClipFromSeconds`):

```typescript
/**
 * Options for creating a new audio clip from tick position.
 * startTick is authoritative; startSample is derived.
 *
 * Provide either:
 * - ticksToSeconds callback (for variable-tempo / multi-tempo), or
 * - bpm + ppqn (for single-tempo convenience)
 */
export interface CreateClipOptionsTicks {
  startTick: number;
  /** Callback to convert ticks to seconds. Takes precedence over bpm/ppqn. */
  ticksToSeconds?: (tick: number) => number;
  /** BPM for single-tempo conversion (used when ticksToSeconds not provided) */
  bpm?: number;
  /** Pulses per quarter note (used when ticksToSeconds not provided) */
  ppqn?: number;
  /** Audio buffer - optional for peaks-first rendering */
  audioBuffer?: AudioBuffer;
  durationSamples?: number;
  offsetSamples?: number;
  gain?: number;
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  waveformData?: WaveformDataObject;
  sampleRate?: number;
  sourceDurationSamples?: number;
  midiNotes?: MidiNoteData[];
  midiChannel?: number;
  midiProgram?: number;
}

/**
 * Creates a new AudioClip from a tick position (tick-first creation).
 * Derives startSample from startTick using the provided conversion.
 */
export function createClipFromTicks(options: CreateClipOptionsTicks): AudioClip {
  const { startTick, ticksToSeconds, bpm, ppqn } = options;

  let toSeconds: (tick: number) => number;
  if (ticksToSeconds) {
    toSeconds = ticksToSeconds;
  } else if (bpm !== undefined && ppqn !== undefined) {
    toSeconds = (tick: number) => (tick * 60) / (ppqn * bpm);
  } else {
    throw new Error(
      'createClipFromTicks: either ticksToSeconds callback or both bpm and ppqn are required'
    );
  }

  const sampleRate =
    options.audioBuffer?.sampleRate ?? options.sampleRate ?? options.waveformData?.sample_rate;
  if (sampleRate === undefined) {
    throw new Error(
      'createClipFromTicks: sampleRate is required when audioBuffer is not provided'
    );
  }

  const startSample = Math.round(toSeconds(startTick) * sampleRate);

  return createClip({
    audioBuffer: options.audioBuffer,
    startSample,
    startTick,
    durationSamples: options.durationSamples,
    offsetSamples: options.offsetSamples,
    gain: options.gain,
    name: options.name,
    color: options.color,
    fadeIn: options.fadeIn,
    fadeOut: options.fadeOut,
    waveformData: options.waveformData,
    sampleRate: options.sampleRate,
    sourceDurationSamples: options.sourceDurationSamples,
    midiNotes: options.midiNotes,
    midiChannel: options.midiChannel,
    midiProgram: options.midiProgram,
  });
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/clip.test.ts`
Expected: PASS

- [ ] **Step 9: Run full core test suite and typecheck**

Run: `cd packages/core && npx vitest run && pnpm typecheck`
Expected: All tests pass, no type errors

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/types/clip.ts packages/core/src/__tests__/clip.test.ts
git commit -m "feat(core): add startTick to AudioClip and createClipFromTicks helper

AudioClip gains optional startTick field as the authoritative timeline
position in ticks. startSample becomes a derived cache. createClipFromTicks
accepts either a ticksToSeconds callback (multi-tempo) or bpm+ppqn
(single-tempo) to derive startSample."
```

---

### Task 2: Add tempo and conversion methods to PlayoutAdapter interface

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/__tests__/PlaylistEngine.test.ts`

- [ ] **Step 1: Add new methods to PlayoutAdapter interface**

In `packages/engine/src/types.ts`, add to `PlayoutAdapter` (after `setLoop`):

```typescript
  /** Set tempo at a tick position. First call (or atTick=0) sets the base tempo. */
  setTempo?(bpm: number, atTick?: number): void;
  /** Set time signature at a tick position. */
  setMeter?(numerator: number, denominator: number, atTick?: number): void;
  /** Convert ticks to seconds using the adapter's tempo map. */
  ticksToSeconds?(tick: number): number;
  /** Convert seconds to ticks using the adapter's tempo map. */
  secondsToTicks?(seconds: number): number;
```

All four are optional (`?`) for backwards compatibility with TonePlayoutAdapter and any consumer adapters.

- [ ] **Step 2: Add `bpm` and `ppqn` to `PlaylistEngineOptions` and `EngineState`**

In `packages/engine/src/types.ts`, add to `PlaylistEngineOptions`:

```typescript
  /** Initial tempo in BPM (default 120). */
  bpm?: number;
  /** Pulses per quarter note (default 960). */
  ppqn?: number;
```

Add to `EngineState`:

```typescript
  /** Current base tempo in BPM. */
  bpm: number;
  /** Pulses per quarter note. */
  ppqn: number;
```

- [ ] **Step 3: Update mock adapter in engine tests**

In `packages/engine/src/__tests__/PlaylistEngine.test.ts`, update `createMockAdapter()` to include the new optional methods:

```typescript
function createMockAdapter(): PlayoutAdapter {
  return {
    // ... existing mocks unchanged ...
    setTempo: vi.fn(),
    ticksToSeconds: vi.fn((tick: number) => (tick * 60) / (960 * 120)),
    secondsToTicks: vi.fn((seconds: number) => Math.round((seconds * 960 * 120) / 60)),
  };
}
```

- [ ] **Step 4: Run typecheck to verify interface changes compile**

Run: `cd packages/engine && pnpm typecheck`
Expected: PASS (all new methods are optional, existing code compiles)

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/__tests__/PlaylistEngine.test.ts
git commit -m "feat(engine): add tempo and conversion methods to PlayoutAdapter

PlayoutAdapter gains optional setTempo, setMeter, ticksToSeconds, and
secondsToTicks methods. PlaylistEngineOptions gains bpm and ppqn.
EngineState gains bpm and ppqn fields."
```

---

### Task 3: Add tempo management and startTick enrichment to PlaylistEngine

**Files:**
- Modify: `packages/engine/src/PlaylistEngine.ts`
- Modify: `packages/engine/src/__tests__/PlaylistEngine.test.ts`

- [ ] **Step 1: Write failing tests for setTempo**

In `packages/engine/src/__tests__/PlaylistEngine.test.ts`, add a new describe block:

```typescript
describe('tempo management', () => {
  it('has default bpm of 120 and ppqn of 960', () => {
    const engine = new PlaylistEngine();
    const state = engine.getState();
    expect(state.bpm).toBe(120);
    expect(state.ppqn).toBe(960);
  });

  it('accepts bpm and ppqn in constructor', () => {
    const engine = new PlaylistEngine({ bpm: 140, ppqn: 480 });
    const state = engine.getState();
    expect(state.bpm).toBe(140);
    expect(state.ppqn).toBe(480);
  });

  it('setTempo updates bpm and forwards to adapter', () => {
    const adapter = createMockAdapter();
    const engine = new PlaylistEngine({ adapter });
    engine.setTempo(140);
    expect(engine.getState().bpm).toBe(140);
    expect(adapter.setTempo).toHaveBeenCalledWith(140, undefined);
  });

  it('setTempo with atTick forwards to adapter', () => {
    const adapter = createMockAdapter();
    const engine = new PlaylistEngine({ adapter });
    engine.setTempo(140, 960);
    expect(adapter.setTempo).toHaveBeenCalledWith(140, 960);
  });

  it('setTempo emits statechange', () => {
    const engine = new PlaylistEngine();
    const listener = vi.fn();
    engine.on('statechange', listener);
    engine.setTempo(140);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && npx vitest run src/__tests__/PlaylistEngine.test.ts`
Expected: FAIL — `setTempo` not on engine, `bpm`/`ppqn` not in state

- [ ] **Step 3: Implement bpm/ppqn fields and setTempo**

In `packages/engine/src/PlaylistEngine.ts`:

Add fields (after `_loopEnd`):

```typescript
  private _bpm: number;
  private _ppqn: number;
```

In constructor, add:

```typescript
  this._bpm = options.bpm ?? 120;
  this._ppqn = options.ppqn ?? 960;
```

Add `bpm` and `ppqn` to `getState()` return:

```typescript
  bpm: this._bpm,
  ppqn: this._ppqn,
```

Add `setTempo` method (after `setMasterVolume`):

```typescript
  setTempo(bpm: number, atTick?: number): void {
    this._bpm = bpm;
    this._adapter?.setTempo?.(bpm, atTick);
    this._recomputeStartSamples();
    this._emitStateChange();
  }
```

Add private `_ticksToSeconds` and `_secondsToTicks` (before `_recomputeStartSamples`):

```typescript
  private _ticksToSeconds(tick: number): number {
    if (this._adapter?.ticksToSeconds) {
      return this._adapter.ticksToSeconds(tick);
    }
    return (tick * 60) / (this._ppqn * this._bpm);
  }

  private _secondsToTicks(seconds: number): number {
    if (this._adapter?.secondsToTicks) {
      return this._adapter.secondsToTicks(seconds);
    }
    return Math.round((seconds * this._ppqn * this._bpm) / 60);
  }
```

Add `_recomputeStartSamples`:

```typescript
  private _recomputeStartSamples(): void {
    this._tracks = this._tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.startTick === undefined) return clip;
        return {
          ...clip,
          startSample: Math.round(
            this._ticksToSeconds(clip.startTick) * this._sampleRate
          ),
        };
      }),
    }));
    this._tracksVersion++;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && npx vitest run src/__tests__/PlaylistEngine.test.ts`
Expected: tempo tests PASS

- [ ] **Step 5: Write failing tests for startTick enrichment in setTracks**

```typescript
describe('startTick enrichment', () => {
  it('setTracks enriches clips without startTick', () => {
    const adapter = createMockAdapter();
    const engine = new PlaylistEngine({ adapter, bpm: 120, ppqn: 960 });
    engine.setTracks([
      {
        id: 'track-1',
        name: 'Track 1',
        clips: [
          {
            id: 'clip-1',
            startSample: 24000,
            durationSamples: 48000,
            offsetSamples: 0,
            sampleRate: 48000,
            sourceDurationSamples: 48000,
            gain: 1,
          },
        ],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
    ]);
    const clip = engine.getState().tracks[0].clips[0];
    // 24000 samples at 48000 Hz = 0.5 seconds
    // 0.5 seconds at 120 BPM, 960 PPQN = 960 ticks
    expect(clip.startTick).toBe(960);
  });

  it('setTracks preserves existing startTick', () => {
    const engine = new PlaylistEngine({ bpm: 120, ppqn: 960 });
    engine.setTracks([
      {
        id: 'track-1',
        name: 'Track 1',
        clips: [
          {
            id: 'clip-1',
            startSample: 24000,
            startTick: 500, // explicit, should not be overwritten
            durationSamples: 48000,
            offsetSamples: 0,
            sampleRate: 48000,
            sourceDurationSamples: 48000,
            gain: 1,
          },
        ],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
    ]);
    expect(engine.getState().tracks[0].clips[0].startTick).toBe(500);
  });

  it('setTempo recomputes startSample from startTick', () => {
    const engine = new PlaylistEngine({ bpm: 120, ppqn: 960 });
    engine.setTracks([
      {
        id: 'track-1',
        name: 'Track 1',
        clips: [
          {
            id: 'clip-1',
            startSample: 24000,
            startTick: 960,
            durationSamples: 48000,
            offsetSamples: 0,
            sampleRate: 48000,
            sourceDurationSamples: 48000,
            gain: 1,
          },
        ],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
    ]);
    // At 120 BPM: 960 ticks = 0.5s = 24000 samples
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(24000);

    engine.setTempo(60);
    // At 60 BPM: 960 ticks = 1.0s = 48000 samples
    expect(engine.getState().tracks[0].clips[0].startSample).toBe(48000);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/engine && npx vitest run src/__tests__/PlaylistEngine.test.ts`
Expected: FAIL — `setTracks` doesn't enrich, `setTempo` doesn't recompute

- [ ] **Step 7: Implement startTick enrichment in setTracks**

In `packages/engine/src/PlaylistEngine.ts`, modify `setTracks`:

```typescript
  setTracks(tracks: ClipTrack[]): void {
    this.clearHistory();
    this._tracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        startTick:
          clip.startTick ?? this._secondsToTicks(clip.startSample / this._sampleRate),
      })),
    }));
    this._tracksVersion++;
    this._adapter?.setTracks(this._tracks);
    this._emitStateChange();
  }
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/engine && npx vitest run src/__tests__/PlaylistEngine.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing test for getCurrentTime simplification**

```typescript
describe('getCurrentTime', () => {
  it('reads from adapter even when not playing', () => {
    const adapter = createMockAdapter();
    (adapter.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(2.5);
    const engine = new PlaylistEngine({ adapter });
    // Not playing — old behavior would return _currentTime (0)
    // New behavior: always reads from adapter when adapter exists
    expect(engine.getCurrentTime()).toBe(2.5);
  });

  it('returns cached time when no adapter', () => {
    const engine = new PlaylistEngine();
    expect(engine.getCurrentTime()).toBe(0);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/PlaylistEngine.test.ts`
Expected: FAIL — `getCurrentTime()` returns 0 because `_isPlaying` is false

- [ ] **Step 11: Simplify getCurrentTime**

In `packages/engine/src/PlaylistEngine.ts`:

```typescript
  getCurrentTime(): number {
    if (this._adapter) {
      return this._adapter.getCurrentTime();
    }
    return this._currentTime;
  }
```

- [ ] **Step 12: Run full engine test suite and typecheck**

Run: `cd packages/engine && npx vitest run && pnpm typecheck`
Expected: All tests PASS, no type errors

- [ ] **Step 13: Commit**

```bash
git add packages/engine/src/PlaylistEngine.ts packages/engine/src/__tests__/PlaylistEngine.test.ts
git commit -m "feat(engine): add tempo management and startTick enrichment

Engine gains setTempo(), _ticksToSeconds(), _secondsToTicks(), and
_recomputeStartSamples(). setTracks() enriches clips missing startTick.
getCurrentTime() always reads from adapter when present."
```

---

### Task 4: Update ClipPlayer to use startTick for scheduling

**Files:**
- Modify: `packages/transport/src/audio/clip-player.ts`
- Modify: `packages/transport/src/__tests__/clip-player.test.ts`

- [ ] **Step 1: Write failing tests for tick-based generate()**

In `packages/transport/src/__tests__/clip-player.test.ts`, add tests that use `startTick`:

```typescript
describe('tick-based scheduling', () => {
  it('generate() matches clips by startTick when present', () => {
    // Create a clip at tick 960 (1 beat at 120 BPM, 960 PPQN)
    const clip = {
      id: 'clip-1',
      startSample: 24000,
      startTick: 960,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 48000,
      gain: 1,
      audioBuffer: createMockAudioBuffer(),
    };

    const tracks = [createTestTrack([clip])];
    clipPlayer.setTracks(tracks, trackNodes);

    // Window [0, 480) — clip at tick 960 should NOT be included
    const events1 = clipPlayer.generate(0 as Tick, 480 as Tick);
    expect(events1).toHaveLength(0);

    // Window [480, 1440) — clip at tick 960 SHOULD be included
    const events2 = clipPlayer.generate(480 as Tick, 1440 as Tick);
    expect(events2).toHaveLength(1);
    expect(events2[0].clipId).toBe('clip-1');
    expect(events2[0].tick).toBe(960);
  });

  it('generate() uses startTick directly for event.tick', () => {
    const clip = {
      id: 'clip-1',
      startSample: 24000,
      startTick: 960,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 48000,
      gain: 1,
      audioBuffer: createMockAudioBuffer(),
    };

    const tracks = [createTestTrack([clip])];
    clipPlayer.setTracks(tracks, trackNodes);

    const events = clipPlayer.generate(0 as Tick, 1920 as Tick);
    // event.tick should come from clip.startTick, not derived from samples
    expect(events[0].tick).toBe(960);
  });

  it('onPositionJump() detects mid-clip using startTick', () => {
    const clip = {
      id: 'clip-1',
      startSample: 0,
      startTick: 0,
      durationSamples: 96000,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 96000,
      gain: 1,
      audioBuffer: createMockAudioBuffer(),
    };

    const tracks = [createTestTrack([clip])];
    clipPlayer.setTracks(tracks, trackNodes);

    // Jump to tick 480 — clip starts at tick 0, should create mid-clip source
    clipPlayer.onPositionJump(480 as Tick);

    // Verify consume was called (source.start was invoked)
    const sources = getMockSources();
    expect(sources.length).toBeGreaterThan(0);
  });
});
```

Note: Use existing test helper patterns from the file (`createMockAudioBuffer`, `createTestTrack`, `trackNodes`, `getMockSources`). The exact helper names may differ — adapt to match existing patterns in `clip-player.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/clip-player.test.ts`
Expected: FAIL — ClipPlayer still uses sample-based matching

- [ ] **Step 3: Update generate() to use startTick**

In `packages/transport/src/audio/clip-player.ts`, modify `generate()`:

Replace the sample-based window comparison with tick-based:

```typescript
  generate(fromTick: Tick, toTick: Tick): ClipEvent[] {
    const events: ClipEvent[] = [];

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        // Use startTick when available, fall back to sample-derived tick
        const clipTick: number =
          clip.startTick !== undefined
            ? clip.startTick
            : (this._sampleTimeline.samplesToTicks(clip.startSample as Sample) as number);

        // Clip start must fall within the scheduling window [fromTick, toTick)
        if (clipTick < (fromTick as number)) continue;
        if (clipTick >= (toTick as number)) continue;

        let durationSamples = clip.durationSamples;

        // Loop clamping in samples (duration is audio-file-relative)
        if (this._loopEnabled) {
          const clipEndSample = clip.startSample + durationSamples;
          if (clipEndSample > (this._loopEndSamples as number)) {
            durationSamples = (this._loopEndSamples as number) - clip.startSample;
          }
          if (durationSamples <= 0) continue;
        }

        const fadeInDurationSamples = clip.fadeIn
          ? Math.round(clip.fadeIn.duration * clip.sampleRate)
          : 0;
        const fadeOutDurationSamples = clip.fadeOut
          ? Math.round(clip.fadeOut.duration * clip.sampleRate)
          : 0;

        events.push({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          tick: clipTick as Tick,
          startSample: clip.startSample as Sample,
          offsetSamples: clip.offsetSamples as Sample,
          durationSamples: durationSamples as Sample,
          gain: clip.gain,
          fadeInDurationSamples: fadeInDurationSamples as Sample,
          fadeOutDurationSamples: fadeOutDurationSamples as Sample,
        });
      }
    }

    return events;
  }
```

- [ ] **Step 4: Update onPositionJump() to use startTick**

In `packages/transport/src/audio/clip-player.ts`, modify `onPositionJump()`:

```typescript
  onPositionJump(newTick: Tick): void {
    this.silence();
    const newSample = this._sampleTimeline.ticksToSamples(newTick);

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        // Start comparison in ticks (strict < to avoid double-scheduling)
        const clipTick: number =
          clip.startTick !== undefined
            ? clip.startTick
            : (this._sampleTimeline.samplesToTicks(clip.startSample as Sample) as number);

        if (clipTick >= (newTick as number)) continue; // hasn't started yet

        // End comparison in samples (duration is audio-file-relative)
        const clipEndSample = clip.startSample + clip.durationSamples;
        if (clipEndSample <= (newSample as number)) continue; // already finished

        // Mid-clip: compute offset
        const offsetIntoClipSamples = (newSample as number) - clip.startSample;
        const offsetSamples = clip.offsetSamples + offsetIntoClipSamples;
        let durationSamples = clipEndSample - (newSample as number);

        // Loop clamping
        if (
          this._loopEnabled &&
          (newSample as number) + durationSamples > (this._loopEndSamples as number)
        ) {
          durationSamples = (this._loopEndSamples as number) - (newSample as number);
        }
        if (durationSamples <= 0) continue;

        const fadeOutDurationSamples = clip.fadeOut
          ? Math.round(clip.fadeOut.duration * clip.sampleRate)
          : 0;

        this.consume({
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          tick: newTick,
          startSample: newSample,
          offsetSamples: offsetSamples as Sample,
          durationSamples: durationSamples as Sample,
          gain: clip.gain,
          fadeInDurationSamples: 0 as Sample,
          fadeOutDurationSamples: fadeOutDurationSamples as Sample,
        });
      }
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/clip-player.test.ts`
Expected: PASS

- [ ] **Step 6: Run full transport test suite**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS (existing tests still work via sample fallback)

- [ ] **Step 7: Commit**

```bash
git add packages/transport/src/audio/clip-player.ts packages/transport/src/__tests__/clip-player.test.ts
git commit -m "feat(transport): ClipPlayer uses startTick for tick-space matching

generate() and onPositionJump() compare clip.startTick directly against
the tick window when present, falling back to sample-derived ticks for
backwards compatibility. Loop clamping stays in sample space since
duration is audio-file-relative."
```

---

### Task 5: Update NativePlayoutAdapter with tempo and conversion methods

**Files:**
- Modify: `packages/transport/src/adapter.ts`
- Modify: `packages/transport/src/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing tests**

In `packages/transport/src/__tests__/adapter.test.ts`, add:

```typescript
describe('tempo methods', () => {
  it('setTempo delegates to transport', () => {
    const adapter = new NativePlayoutAdapter(mockAudioContext);
    const setTempoSpy = vi.spyOn(adapter.transport, 'setTempo');
    adapter.setTempo(140);
    expect(setTempoSpy).toHaveBeenCalledWith(140, undefined);
  });

  it('setTempo with atTick delegates to transport', () => {
    const adapter = new NativePlayoutAdapter(mockAudioContext);
    const setTempoSpy = vi.spyOn(adapter.transport, 'setTempo');
    adapter.setTempo(140, 960);
    expect(setTempoSpy).toHaveBeenCalledWith(140, 960);
  });

  it('ticksToSeconds delegates to transport', () => {
    const adapter = new NativePlayoutAdapter(mockAudioContext);
    // Default: 120 BPM, 960 PPQN. 960 ticks = 0.5 seconds
    const seconds = adapter.ticksToSeconds(960);
    expect(seconds).toBeCloseTo(0.5);
  });

  it('secondsToTicks delegates to transport', () => {
    const adapter = new NativePlayoutAdapter(mockAudioContext);
    const ticks = adapter.secondsToTicks(0.5);
    expect(ticks).toBe(960);
  });

  it('setMeter delegates to transport', () => {
    const adapter = new NativePlayoutAdapter(mockAudioContext);
    const setMeterSpy = vi.spyOn(adapter.transport, 'setMeter');
    adapter.setMeter(3, 4);
    expect(setMeterSpy).toHaveBeenCalledWith(3, 4, undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/adapter.test.ts`
Expected: FAIL — `setTempo`, `ticksToSeconds`, etc. not on adapter

- [ ] **Step 3: Implement new methods on NativePlayoutAdapter**

In `packages/transport/src/adapter.ts`, add methods (before `dispose()`):

```typescript
  setTempo(bpm: number, atTick?: number): void {
    this._transport.setTempo(bpm, atTick !== undefined ? (atTick as Tick) : undefined);
  }

  setMeter(numerator: number, denominator: number, atTick?: number): void {
    this._transport.setMeter(numerator, denominator, atTick !== undefined ? (atTick as Tick) : undefined);
  }

  ticksToSeconds(tick: number): number {
    return this._transport.tickToTime(tick as Tick);
  }

  secondsToTicks(seconds: number): number {
    return this._transport.timeToTick(seconds) as number;
  }
```

Add the `Tick` import at the top if not already present:

```typescript
import type { Tick } from './types';
```

Note: `Transport.tickToTime()` and `Transport.timeToTick()` are the public API names. Verify these match the actual Transport method names — they may be `ticksToSeconds()`/`secondsToTicks()` instead. Use whichever names exist on the Transport class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/adapter.test.ts`
Expected: PASS

- [ ] **Step 5: Run full transport test suite and typecheck**

Run: `cd packages/transport && npx vitest run && pnpm typecheck`
Expected: All tests PASS, no type errors

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/adapter.ts packages/transport/src/__tests__/adapter.test.ts
git commit -m "feat(transport): NativePlayoutAdapter implements tempo and conversion methods

setTempo, setMeter, ticksToSeconds, and secondsToTicks delegate to the
underlying Transport. Enables the engine to forward tempo changes and
use the adapter's TempoMap for startSample cache recomputation."
```

---

### Task 6: Cross-package typecheck and integration verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: All 13 packages build successfully

- [ ] **Step 2: Run all tests across affected packages**

Run three commands in sequence:

```bash
cd packages/core && npx vitest run && cd ../engine && npx vitest run && cd ../transport && npx vitest run
```

Expected: All tests PASS in core, engine, and transport

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS (no lint errors)

- [ ] **Step 4: Kill any leftover vitest processes**

Run: `pkill -f vitest 2>/dev/null; echo "cleaned up"`
Expected: No orphaned processes

- [ ] **Step 5: Commit any formatting fixes from lint**

If `pnpm lint` reported formatting issues:

```bash
pnpm format
git add -u
git commit -m "chore: fix formatting"
```

---

## Post-Implementation Notes

**What this unblocks:**
- `feat/variable-tempo-grid` branch can merge rendering/grid work and wire playback through this single-clock architecture
- Dawcore's `<daw-editor>` can use `NativePlayoutAdapter.setTempo()` instead of manual offset arithmetic
- Beat-map demo can schedule clips at tick positions directly

**Next steps (separate PRs):**
1. Wire `TonePlayoutAdapter` to implement `setTempo()` via `Tone.Transport.schedule()`
2. Update dawcore `<daw-editor>` to use engine `setTempo()` and remove `audioStartOffset` workarounds
3. Merge `feat/variable-tempo-grid` with single-clock playback
