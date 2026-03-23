# Native Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tone.js Transport with a native Web Audio transport package that handles scheduling, looping, tempo, and metronome — zero Tone.js dependency.

**Architecture:** Layered package: core (clock/scheduler/timer) → timeline (samples/ticks/tempo) → audio (track nodes/clip player/metronome) → transport (orchestrator) → adapter (PlayoutAdapter bridge). Each layer is independently testable.

**Tech Stack:** TypeScript, native Web Audio API, vitest, tsup. Zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-03-23-native-transport-design.md`

---

## Phase 1: Package Scaffold + Core Layer

### Task 1: Package Scaffold

**Files:**
- Create: `packages/transport/package.json`
- Create: `packages/transport/tsconfig.json`
- Create: `packages/transport/tsup.config.ts`
- Create: `packages/transport/src/index.ts`
- Create: `packages/transport/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@waveform-playlist/transport",
  "version": "0.0.1",
  "description": "Native Web Audio transport for waveform-playlist — scheduling, looping, tempo, metronome",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "pnpm typecheck && tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["waveform", "audio", "webaudio", "transport", "scheduler"],
  "author": "Naomi Aro",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/naomiaro/waveform-playlist.git",
    "directory": "packages/transport"
  },
  "files": ["dist", "README.md"],
  "devDependencies": {
    "@waveform-playlist/core": "workspace:*",
    "@waveform-playlist/engine": "workspace:*",
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0"
  },
  "peerDependencies": {
    "@waveform-playlist/core": ">=11.0.0",
    "@waveform-playlist/engine": ">=11.0.0"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 4: Create types.ts with shared interfaces**

```typescript
// packages/transport/src/types.ts

export interface SchedulerEvent {
  /** Audio time when this event should be realized */
  audioTime: number;
}

export interface SchedulerListener<T extends SchedulerEvent> {
  /** Generate events in the time window [fromTime, toTime) */
  generate(fromTime: number, toTime: number): T[];
  /** Realize an event (create audio nodes, start sources) */
  consume(event: T): void;
  /** Position jumped (loop/seek) — stop active sources, re-schedule */
  onPositionJump(newTime: number): void;
  /** Stop all active audio immediately */
  silence(): void;
}

export interface TransportOptions {
  /** Sample rate for SampleTimeline. Default: audioContext.sampleRate */
  sampleRate?: number;
  /** Ticks per quarter note. Default: 960 */
  ppqn?: number;
  /** Initial tempo in BPM. Default: 120 */
  tempo?: number;
  /** Beats per bar. Default: 4 */
  beatsPerBar?: number;
  /** How far ahead to schedule audio, in seconds. Default: 0.2 */
  schedulerLookahead?: number;
}

export interface TempoEntry {
  /** Tick position where this tempo starts */
  tick: number;
  /** Beats per minute */
  bpm: number;
  /** Cached cumulative seconds up to this tick (for O(log n) lookup) */
  secondsAtTick: number;
}

export interface TransportPosition {
  bar: number;
  beat: number;
  tick: number;
}
```

- [ ] **Step 5: Create empty index.ts**

```typescript
// packages/transport/src/index.ts
export type {
  SchedulerEvent,
  SchedulerListener,
  TransportOptions,
  TempoEntry,
  TransportPosition,
} from './types';
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `cd packages/transport && pnpm install && pnpm build`
Expected: Clean build with dist/ output

- [ ] **Step 7: Commit**

```bash
git add packages/transport/
git commit -m "feat(transport): scaffold package with types"
```

---

### Task 2: Clock

**Files:**
- Create: `packages/transport/src/core/clock.ts`
- Create: `packages/transport/src/__tests__/clock.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/clock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Clock } from '../core/clock';

function mockAudioContext(currentTime = 0): AudioContext {
  return { currentTime } as any;
}

describe('Clock', () => {
  it('getTime returns 0 when not started', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    expect(clock.getTime()).toBe(0);
  });

  it('getTime returns elapsed time when running', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(2);
  });

  it('stop accumulates elapsed time', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 13;
    clock.stop();
    // After stop, time is frozen at 3
    (ctx as any).currentTime = 20;
    expect(clock.getTime()).toBe(3);
  });

  it('start after stop resumes from accumulated time', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 13;
    clock.stop(); // accumulated: 3
    (ctx as any).currentTime = 20;
    clock.start(); // resume from 3
    (ctx as any).currentTime = 22;
    expect(clock.getTime()).toBe(5); // 3 accumulated + 2 new
  });

  it('reset zeros everything', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 15;
    clock.reset();
    expect(clock.getTime()).toBe(0);
    expect(clock.isRunning()).toBe(false);
  });

  it('seekTo jumps to arbitrary position', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    clock.seekTo(5);
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(7); // 5 + 2 elapsed since seek
  });

  it('seekTo while stopped sets position for next start', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.seekTo(5);
    expect(clock.getTime()).toBe(5);
    clock.start();
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(7);
  });

  it('isRunning reflects state', () => {
    const ctx = mockAudioContext(0);
    const clock = new Clock(ctx);
    expect(clock.isRunning()).toBe(false);
    clock.start();
    expect(clock.isRunning()).toBe(true);
    clock.stop();
    expect(clock.isRunning()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run`
Expected: FAIL — `Clock` not found

- [ ] **Step 3: Implement Clock**

```typescript
// packages/transport/src/core/clock.ts

export class Clock {
  private _audioContext: AudioContext;
  private _running = false;
  private _audioTimeAtStart = 0;
  private _clockTimeAtStart = 0;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
  }

  start(): void {
    if (this._running) return;
    this._audioTimeAtStart = this._audioContext.currentTime;
    this._running = true;
  }

  stop(): void {
    if (!this._running) return;
    this._clockTimeAtStart = this.getTime();
    this._running = false;
  }

  reset(): void {
    this._running = false;
    this._clockTimeAtStart = 0;
    this._audioTimeAtStart = 0;
  }

  getTime(): number {
    if (this._running) {
      return (
        this._clockTimeAtStart +
        (this._audioContext.currentTime - this._audioTimeAtStart)
      );
    }
    return this._clockTimeAtStart;
  }

  seekTo(time: number): void {
    if (this._running) {
      this._clockTimeAtStart = time;
      this._audioTimeAtStart = this._audioContext.currentTime;
    } else {
      this._clockTimeAtStart = time;
    }
  }

  isRunning(): boolean {
    return this._running;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run`
Expected: All PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Clock } from './core/clock';
```

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/core/clock.ts packages/transport/src/__tests__/clock.test.ts packages/transport/src/index.ts
git commit -m "feat(transport): add Clock — elapsed time tracking"
```

---

### Task 3: Scheduler

**Files:**
- Create: `packages/transport/src/core/scheduler.ts`
- Create: `packages/transport/src/__tests__/scheduler.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/scheduler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Scheduler } from '../core/scheduler';
import type { SchedulerEvent, SchedulerListener } from '../types';

interface TestEvent extends SchedulerEvent {
  id: string;
}

function createMockListener(): SchedulerListener<TestEvent> & {
  generated: TestEvent[];
  consumed: TestEvent[];
  jumpedTo: number[];
  silenced: number;
} {
  const state = { generated: [] as TestEvent[], consumed: [] as TestEvent[], jumpedTo: [] as number[], silenced: 0 };
  return {
    ...state,
    generate(from, to) {
      const events: TestEvent[] = [];
      // Generate an event every 0.1s in the window
      for (let t = Math.ceil(from * 10) / 10; t < to; t += 0.1) {
        const event = { audioTime: t, id: 'e-' + t.toFixed(1) };
        events.push(event);
        state.generated.push(event);
      }
      return events;
    },
    consume(event) { state.consumed.push(event); },
    onPositionJump(time) { state.jumpedTo.push(time); },
    silence() { state.silenced++; },
  };
}

describe('Scheduler', () => {
  it('advance generates and consumes events in lookahead window', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(0);
    // Should generate events in [0, 0.2): 0.0, 0.1
    expect(listener.consumed.length).toBe(2);
    expect(listener.consumed[0].audioTime).toBeCloseTo(0.0);
    expect(listener.consumed[1].audioTime).toBeCloseTo(0.1);
  });

  it('advance does not re-generate consumed window', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(0);
    const count1 = listener.consumed.length;
    scheduler.advance(0.05); // still within first window
    // Should generate [0.2, 0.25) — one partial window
    expect(listener.consumed.length).toBeGreaterThanOrEqual(count1);
  });

  it('loop: wraps at loopEnd and generates from loopStart', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.3 });
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoop(true, 0, 0.5);

    // Advance to near loop end
    scheduler.advance(0.35);
    // Should have generated events up to 0.5 (loopEnd), then from 0.0 (loopStart)
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0);
  });

  it('removeListener stops generating for that listener', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.removeListener(listener);

    scheduler.advance(0);
    expect(listener.consumed.length).toBe(0);
  });

  it('reset clears edges', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(1.0);
    const count1 = listener.consumed.length;
    scheduler.reset(0);
    scheduler.advance(0);
    // Should re-generate from 0
    expect(listener.consumed.length).toBeGreaterThan(count1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run`
Expected: FAIL — `Scheduler` not found

- [ ] **Step 3: Implement Scheduler**

```typescript
// packages/transport/src/core/scheduler.ts
import type { SchedulerEvent, SchedulerListener } from '../types';

export interface SchedulerOptions {
  lookahead?: number;
}

export class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;
  private _rightEdge = 0;
  private _listeners: Set<SchedulerListener<T>> = new Set();
  private _loopEnabled = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  constructor(options: SchedulerOptions = {}) {
    this._lookahead = options.lookahead ?? 0.2;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  setLoop(enabled: boolean, start: number, end: number): void {
    this._loopEnabled = enabled;
    this._loopStart = start;
    this._loopEnd = end;
  }

  reset(time: number): void {
    this._rightEdge = time;
  }

  advance(currentTime: number): void {
    const targetEdge = currentTime + this._lookahead;

    if (this._loopEnabled && this._loopEnd > this._loopStart) {
      // Check if window crosses loop boundary
      if (this._rightEdge < this._loopEnd && targetEdge >= this._loopEnd) {
        // Generate up to loopEnd
        this._generateAndConsume(this._rightEdge, this._loopEnd);
        // Notify listeners of position jump
        for (const listener of this._listeners) {
          listener.onPositionJump(this._loopStart);
        }
        // Continue from loopStart
        this._rightEdge = this._loopStart;
        const remaining = targetEdge - this._loopEnd;
        this._generateAndConsume(this._loopStart, this._loopStart + remaining);
        this._rightEdge = this._loopStart + remaining;
        return;
      }
    }

    if (targetEdge > this._rightEdge) {
      this._generateAndConsume(this._rightEdge, targetEdge);
      this._rightEdge = targetEdge;
    }
  }

  private _generateAndConsume(from: number, to: number): void {
    for (const listener of this._listeners) {
      const events = listener.generate(from, to);
      for (const event of events) {
        listener.consume(event);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run`
Expected: All PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { Scheduler, type SchedulerOptions } from './core/scheduler';
```

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/core/scheduler.ts packages/transport/src/__tests__/scheduler.test.ts packages/transport/src/index.ts
git commit -m "feat(transport): add Scheduler — sliding window event pipeline"
```

---

### Task 4: Timer

**Files:**
- Create: `packages/transport/src/core/timer.ts`
- Create: `packages/transport/src/__tests__/timer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/timer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timer } from '../core/timer';

describe('Timer', () => {
  let rafCallbacks: Array<(time: number) => void>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return ++rafId;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls onTick on each animation frame', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();

    expect(rafCallbacks.length).toBe(1);
    rafCallbacks[0](16);
    expect(onTick).toHaveBeenCalledTimes(1);
    // rAF should be re-requested
    expect(rafCallbacks.length).toBe(2);
  });

  it('stop cancels animation frame', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('does not tick after stop', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.stop();
    // Simulate late rAF callback
    if (rafCallbacks.length > 0) rafCallbacks[0](16);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('start is idempotent', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.start();
    expect(rafCallbacks.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run`
Expected: FAIL — `Timer` not found

- [ ] **Step 3: Implement Timer**

```typescript
// packages/transport/src/core/timer.ts

export class Timer {
  private _onTick: () => void;
  private _rafId: number | null = null;
  private _running = false;

  constructor(onTick: () => void) {
    this._onTick = onTick;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._scheduleFrame();
  }

  stop(): void {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _scheduleFrame(): void {
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return;
      this._onTick();
      this._scheduleFrame();
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run`
Expected: All PASS

- [ ] **Step 5: Export and commit**

Add to `src/index.ts`:
```typescript
export { Timer } from './core/timer';
```

```bash
git add packages/transport/src/core/timer.ts packages/transport/src/__tests__/timer.test.ts packages/transport/src/index.ts
git commit -m "feat(transport): add Timer — rAF-driven tick loop"
```

---

## Phase 2: Timeline Layer

### Task 5: SampleTimeline

**Files:**
- Create: `packages/transport/src/timeline/sample-timeline.ts`
- Create: `packages/transport/src/__tests__/sample-timeline.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/sample-timeline.test.ts
import { describe, it, expect } from 'vitest';
import { SampleTimeline } from '../timeline/sample-timeline';

describe('SampleTimeline', () => {
  it('samplesToSeconds converts at given rate', () => {
    const st = new SampleTimeline(48000);
    expect(st.samplesToSeconds(48000)).toBe(1);
    expect(st.samplesToSeconds(24000)).toBe(0.5);
    expect(st.samplesToSeconds(0)).toBe(0);
  });

  it('secondsToSamples converts at given rate', () => {
    const st = new SampleTimeline(48000);
    expect(st.secondsToSamples(1)).toBe(48000);
    expect(st.secondsToSamples(0.5)).toBe(24000);
    expect(st.secondsToSamples(0)).toBe(0);
  });

  it('round-trips accurately', () => {
    const st = new SampleTimeline(44100);
    const samples = 123456;
    expect(st.secondsToSamples(st.samplesToSeconds(samples))).toBe(samples);
  });

  it('sampleRate getter returns rate', () => {
    const st = new SampleTimeline(44100);
    expect(st.sampleRate).toBe(44100);
  });
});
```

- [ ] **Step 2: Run, verify fail, implement, verify pass**

```typescript
// packages/transport/src/timeline/sample-timeline.ts
export class SampleTimeline {
  private _sampleRate: number;

  constructor(sampleRate: number) {
    this._sampleRate = sampleRate;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  samplesToSeconds(samples: number): number {
    return samples / this._sampleRate;
  }

  secondsToSamples(seconds: number): number {
    return Math.round(seconds * this._sampleRate);
  }
}
```

- [ ] **Step 3: Export and commit**

```bash
git commit -m "feat(transport): add SampleTimeline — sample/seconds conversion"
```

---

### Task 6: TickTimeline

**Files:**
- Create: `packages/transport/src/timeline/tick-timeline.ts`
- Create: `packages/transport/src/__tests__/tick-timeline.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/tick-timeline.test.ts
import { describe, it, expect } from 'vitest';
import { TickTimeline } from '../timeline/tick-timeline';

describe('TickTimeline', () => {
  const tt = new TickTimeline(960);

  it('ticksPerBeat returns ppqn', () => {
    expect(tt.ticksPerBeat()).toBe(960);
  });

  it('ticksPerBar returns ppqn * beatsPerBar', () => {
    expect(tt.ticksPerBar(4)).toBe(3840);
    expect(tt.ticksPerBar(3)).toBe(2880);
  });

  it('toPosition converts ticks to bar/beat/tick', () => {
    // Bar 1, beat 1, tick 0
    expect(tt.toPosition(0, 4)).toEqual({ bar: 1, beat: 1, tick: 0 });
    // Bar 1, beat 2, tick 0
    expect(tt.toPosition(960, 4)).toEqual({ bar: 1, beat: 2, tick: 0 });
    // Bar 2, beat 1, tick 0
    expect(tt.toPosition(3840, 4)).toEqual({ bar: 2, beat: 1, tick: 0 });
    // Bar 1, beat 1, tick 480 (half beat)
    expect(tt.toPosition(480, 4)).toEqual({ bar: 1, beat: 1, tick: 480 });
  });

  it('fromPosition converts bar/beat/tick to ticks', () => {
    expect(tt.fromPosition(1, 1, 0, 4)).toBe(0);
    expect(tt.fromPosition(1, 2, 0, 4)).toBe(960);
    expect(tt.fromPosition(2, 1, 0, 4)).toBe(3840);
    expect(tt.fromPosition(1, 1, 480, 4)).toBe(480);
  });

  it('round-trips position conversion', () => {
    const ticks = 5280; // some arbitrary position
    const pos = tt.toPosition(ticks, 4);
    expect(tt.fromPosition(pos.bar, pos.beat, pos.tick, 4)).toBe(ticks);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// packages/transport/src/timeline/tick-timeline.ts
import type { TransportPosition } from '../types';

export class TickTimeline {
  private _ppqn: number;

  constructor(ppqn: number = 960) {
    this._ppqn = ppqn;
  }

  get ppqn(): number {
    return this._ppqn;
  }

  ticksPerBeat(): number {
    return this._ppqn;
  }

  ticksPerBar(beatsPerBar: number): number {
    return this._ppqn * beatsPerBar;
  }

  toPosition(ticks: number, beatsPerBar: number): TransportPosition {
    const ticksPerBar = this.ticksPerBar(beatsPerBar);
    const bar = Math.floor(ticks / ticksPerBar) + 1;
    const remaining = ticks % ticksPerBar;
    const beat = Math.floor(remaining / this._ppqn) + 1;
    const tick = remaining % this._ppqn;
    return { bar, beat, tick };
  }

  fromPosition(bar: number, beat: number, tick: number, beatsPerBar: number): number {
    const ticksPerBar = this.ticksPerBar(beatsPerBar);
    return (bar - 1) * ticksPerBar + (beat - 1) * this._ppqn + tick;
  }
}
```

- [ ] **Step 3: Export and commit**

```bash
git commit -m "feat(transport): add TickTimeline — PPQN position conversion"
```

---

### Task 7: TempoMap

**Files:**
- Create: `packages/transport/src/timeline/tempo-map.ts`
- Create: `packages/transport/src/__tests__/tempo-map.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/transport/src/__tests__/tempo-map.test.ts
import { describe, it, expect } from 'vitest';
import { TempoMap } from '../timeline/tempo-map';

describe('TempoMap', () => {
  it('single tempo: ticksToSeconds at 120 BPM, 960 PPQN', () => {
    const tm = new TempoMap(960, 120);
    // 1 beat = 960 ticks = 0.5s at 120 BPM
    expect(tm.ticksToSeconds(960)).toBeCloseTo(0.5);
    expect(tm.ticksToSeconds(1920)).toBeCloseTo(1.0);
    expect(tm.ticksToSeconds(0)).toBe(0);
  });

  it('single tempo: secondsToTicks', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.secondsToTicks(0.5)).toBeCloseTo(960);
    expect(tm.secondsToTicks(1.0)).toBeCloseTo(1920);
  });

  it('round-trips ticks through seconds', () => {
    const tm = new TempoMap(960, 140);
    const ticks = 4800;
    expect(tm.secondsToTicks(tm.ticksToSeconds(ticks))).toBeCloseTo(ticks);
  });

  it('getTempo returns BPM', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.getTempo()).toBe(120);
  });

  it('setTempo changes conversion', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60);
    // 1 beat = 960 ticks = 1.0s at 60 BPM
    expect(tm.ticksToSeconds(960)).toBeCloseTo(1.0);
  });

  it('multiple tempos: second region uses new tempo', () => {
    const tm = new TempoMap(960, 120);
    // At tick 1920 (1s at 120BPM), switch to 60 BPM
    tm.setTempo(60, 1920);
    // First 1920 ticks at 120 BPM = 1.0s
    expect(tm.ticksToSeconds(1920)).toBeCloseTo(1.0);
    // Next 960 ticks at 60 BPM = 1.0s (total: 2.0s)
    expect(tm.ticksToSeconds(2880)).toBeCloseTo(2.0);
  });

  it('secondsToTicks with multiple tempos', () => {
    const tm = new TempoMap(960, 120);
    tm.setTempo(60, 1920);
    expect(tm.secondsToTicks(1.0)).toBeCloseTo(1920);
    expect(tm.secondsToTicks(2.0)).toBeCloseTo(2880);
  });

  it('beatsToSeconds convenience', () => {
    const tm = new TempoMap(960, 120);
    expect(tm.beatsToSeconds(1)).toBeCloseTo(0.5);
    expect(tm.beatsToSeconds(4)).toBeCloseTo(2.0);
  });
});
```

- [ ] **Step 2: Implement TempoMap**

```typescript
// packages/transport/src/timeline/tempo-map.ts
import type { TempoEntry } from '../types';

export class TempoMap {
  private _ppqn: number;
  private _entries: TempoEntry[];

  constructor(ppqn: number = 960, initialBpm: number = 120) {
    this._ppqn = ppqn;
    this._entries = [{ tick: 0, bpm: initialBpm, secondsAtTick: 0 }];
  }

  getTempo(atTick: number = 0): number {
    const entry = this._entryAt(atTick);
    return entry.bpm;
  }

  setTempo(bpm: number, atTick: number = 0): void {
    if (atTick === 0) {
      this._entries[0].bpm = bpm;
      this._recomputeCache(0);
      return;
    }
    // Find insertion point
    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > atTick) i--;

    if (this._entries[i].tick === atTick) {
      this._entries[i].bpm = bpm;
    } else {
      const secondsAtTick = this._ticksToSecondsInternal(atTick);
      this._entries.splice(i + 1, 0, { tick: atTick, bpm, secondsAtTick });
      i = i + 1;
    }
    this._recomputeCache(i);
  }

  ticksToSeconds(ticks: number): number {
    return this._ticksToSecondsInternal(ticks);
  }

  secondsToTicks(seconds: number): number {
    // Binary search for the entry whose secondsAtTick is <= seconds
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].secondsAtTick <= seconds) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const entry = this._entries[lo];
    const secondsIntoSegment = seconds - entry.secondsAtTick;
    const ticksPerSecond = (entry.bpm / 60) * this._ppqn;
    return entry.tick + secondsIntoSegment * ticksPerSecond;
  }

  beatsToSeconds(beats: number): number {
    return this.ticksToSeconds(beats * this._ppqn);
  }

  secondsToBeats(seconds: number): number {
    return this.secondsToTicks(seconds) / this._ppqn;
  }

  private _ticksToSecondsInternal(ticks: number): number {
    const entry = this._entryAt(ticks);
    const ticksIntoSegment = ticks - entry.tick;
    const secondsPerTick = 60 / (entry.bpm * this._ppqn);
    return entry.secondsAtTick + ticksIntoSegment * secondsPerTick;
  }

  private _entryAt(tick: number): TempoEntry {
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].tick <= tick) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return this._entries[lo];
  }

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const curr = this._entries[i];
      const tickDelta = curr.tick - prev.tick;
      const secondsPerTick = 60 / (prev.bpm * this._ppqn);
      curr.secondsAtTick = prev.secondsAtTick + tickDelta * secondsPerTick;
    }
  }
}
```

- [ ] **Step 3: Run tests, export, commit**

```bash
git commit -m "feat(transport): add TempoMap — tick/seconds conversion with tempo changes"
```

---

## Phase 3: Audio Layer

### Task 8: MasterNode + TrackNode

**Files:**
- Create: `packages/transport/src/audio/master-node.ts`
- Create: `packages/transport/src/audio/track-node.ts`
- Create: `packages/transport/src/__tests__/track-node.test.ts`

- [ ] **Step 1: Write failing tests for TrackNode**

Test volume/pan/mute setters, effects hook connect/disconnect, dispose. Use mocked `AudioContext` with `createGain()` and `createStereoPanner()` returning mock nodes.

- [ ] **Step 2: Implement MasterNode**

```typescript
// packages/transport/src/audio/master-node.ts
export class MasterNode {
  private _gainNode: GainNode;

  constructor(audioContext: AudioContext) {
    this._gainNode = audioContext.createGain();
  }

  get input(): AudioNode { return this._gainNode; }
  get output(): AudioNode { return this._gainNode; }

  setVolume(value: number): void {
    this._gainNode.gain.value = value;
  }

  dispose(): void {
    this._gainNode.disconnect();
  }
}
```

- [ ] **Step 3: Implement TrackNode**

Signal chain: `input (gainNode) → panNode → muteNode → [effects hook] → output`

With `connectEffects(node)`: disconnect muteNode from output, connect muteNode → effects input, effects output connects to original output destination.

- [ ] **Step 4: Run tests, export, commit**

```bash
git commit -m "feat(transport): add MasterNode + TrackNode — native signal chain"
```

---

### Task 9: ClipPlayer

**Files:**
- Create: `packages/transport/src/audio/clip-player.ts`
- Create: `packages/transport/src/__tests__/clip-player.test.ts`

This is the largest and most critical component. Implements `SchedulerListener<ClipEvent>`.

- [ ] **Step 1: Write failing tests**

Required test cases (derive from spec edge cases):
1. `generate()` returns events for clips overlapping `[fromTime, toTime)` — verify `audioTime`, `offset`, `duration`
2. `generate()` skips clips with `durationSamples === 0`
3. `generate()` skips clips with `audioBuffer === undefined` (peaks-first)
4. `generate()` returns `[]` for empty tracks
5. `generate()` clamps duration at `loopEnd` when clip spans boundary: `duration = loopEnd - clipStartTime`
6. `consume()` calls `source.start(when, offset, duration)` with correct values
7. `onPositionJump()` calls `.stop()` on all active sources, creates mid-clip sources for clips spanning new position with `offset = newTime - clipStartTime`
8. `silence()` calls `.stop()` on all active sources, clears set
9. `updateTrack()` silences only that track's sources, not others

- [ ] **Step 2: Implement ClipPlayer**

Key methods:
- `generate(from, to)`: iterate tracks/clips, find overlaps, emit `ClipEvent`s. Clamp duration at `loopEnd` when applicable.
- `consume(event)`: create `AudioBufferSourceNode`, connect to `TrackNode.input`, apply fades via `GainNode`, call `source.start(when, offset, duration)`.
- `onPositionJump(time)`: call `silence()`, then for each clip spanning the new time, create mid-clip sources.
- `silence()`: `.stop()` on all active sources, clear set.

- [ ] **Step 3: Run tests, export, commit**

```bash
git commit -m "feat(transport): add ClipPlayer — audio clip scheduling"
```

---

### Task 10: MetronomePlayer

**Files:**
- Create: `packages/transport/src/audio/metronome-player.ts`
- Create: `packages/transport/src/__tests__/metronome-player.test.ts`

- [ ] **Step 1: Write failing tests**

Test `generate()` produces beat events at correct times for a tempo. Test accent on beat 1. Test `setEnabled(false)` produces no events. Test `silence()` and `onPositionJump()`.

- [ ] **Step 2: Implement MetronomePlayer**

Converts seconds window to tick range via TempoMap, walks beat positions, generates events. `consume()` creates `AudioBufferSourceNode` with click buffer.

- [ ] **Step 3: Run tests, export, commit**

```bash
git commit -m "feat(transport): add MetronomePlayer — beat-grid click scheduling"
```

---

## Phase 4: Transport + Adapter

### Task 11: Transport

**Files:**
- Create: `packages/transport/src/transport.ts`
- Create: `packages/transport/src/__tests__/transport.test.ts`

- [ ] **Step 1: Write failing tests**

Test play/pause/stop lifecycle. Test seek during playback (flush). Test loop behavior. Test track volume/pan/mute/solo. Test getCurrentTime accuracy. Test events (on/off). Test dispose cleanup.

- [ ] **Step 2: Implement Transport**

Orchestrates Clock + Scheduler + Timer + SampleTimeline + TickTimeline + TempoMap + ClipPlayer + MetronomePlayer + MasterNode + TrackNodes.

Key flows:
- `play()`: `clock.seekTo(startTime)` if provided, `clock.start()`, `timer.start()`
- `pause()`: `clock.stop()`, `timer.stop()`, `silence()` all listeners
- `stop()`: `clock.reset()`, `timer.stop()`, `silence()` all listeners
- `seek()`: `timer.stop()`, `silence()`, `clock.seekTo()`, `scheduler.reset()`, `timer.start()` if was playing
- `setTracks()`: build TrackNodes, pass to ClipPlayer

- [ ] **Step 3: Run tests, export, commit**

```bash
git commit -m "feat(transport): add Transport — top-level orchestrator"
```

---

### Task 12: NativePlayoutAdapter

**Files:**
- Create: `packages/transport/src/adapter.ts`
- Create: `packages/transport/src/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing tests**

Test all `PlayoutAdapter` methods delegate correctly, including optional methods `addTrack?`, `removeTrack?`, and `updateTrack?`. Test `init()` resumes AudioContext. Test `transport` getter exposes the Transport instance.

- [ ] **Step 2: Implement NativePlayoutAdapter**

Thin delegation to Transport. Import `PlayoutAdapter` type from `@waveform-playlist/engine`. Must implement all required methods (`init`, `setTracks`, `play`, `pause`, `stop`, `seek`, `getCurrentTime`, `isPlaying`, `setMasterVolume`, `setTrackVolume`, `setTrackMute`, `setTrackSolo`, `setTrackPan`, `setLoop`, `dispose`) plus optional methods (`addTrack`, `removeTrack`, `updateTrack`).

- [ ] **Step 3: Run tests, verify full build, commit**

```bash
cd packages/transport && pnpm build && pnpm test
git commit -m "feat(transport): add NativePlayoutAdapter — PlayoutAdapter bridge"
```

---

## Phase 5: Integration

### Task 13: Wire into Dawcore Dev Page

**Files:**
- Modify: `packages/dawcore/dev/multiclip.html`
- Modify: `packages/dawcore/dev/vite.config.ts` (add resolve alias for transport)

- [ ] **Step 1: Add transport alias to dev vite config**
- [ ] **Step 2: Update multiclip.html to use NativePlayoutAdapter**
- [ ] **Step 3: Human verification checkpoint**

Stop and ask user to test manually in browser. Verify: play, pause, stop, seek, zoom, loop, solo/mute, split clip during playback. Report any audio glitches or visual mismatches.
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dawcore): wire NativePlayoutAdapter into multiclip dev page"
```

---

### Task 14: CLAUDE.md + Package Documentation

**Files:**
- Create: `packages/transport/CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md with architecture, patterns, and gotchas discovered during implementation**
- [ ] **Step 2: Commit**

```bash
git commit -m "docs(transport): add CLAUDE.md"
```
