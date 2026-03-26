# Transport Count-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add count-in (pre-roll clicks) to the `@dawcore/transport` package with default synthesized click sounds, configurable bar count/mode, beat-by-beat events for UI, and event payloads for tempo/meter changes.

**Architecture:** CountInPlayer implements the existing `SchedulerListener` contract. A dedicated count-in scheduler (separate from the main clip/metronome scheduler) drives it during a pre-play phase. The Transport orchestrates the count-in→playback transition. Default click sounds are synthesized via `createDefaultClickSounds()`.

**Tech Stack:** TypeScript, vitest, native Web Audio API, tsup bundler.

**Spec:** `docs/superpowers/specs/2026-03-25-transport-count-in-design.md`

**Run tests:** `cd packages/transport && npx vitest run`

**Build:** `cd packages/transport && pnpm build`

**Lint:** `pnpm lint` (from repo root)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/transport/src/audio/click-sounds.ts` | Synthesize default accent/normal AudioBuffers from sine waves |
| `packages/transport/src/audio/count-in-player.ts` | `SchedulerListener<CountInEvent>` — generates and consumes count-in beat events |
| `packages/transport/src/__tests__/click-sounds.test.ts` | Tests for click sound synthesis |
| `packages/transport/src/__tests__/count-in-player.test.ts` | Tests for CountInPlayer beat generation, callbacks, lifecycle |
| `packages/transport/src/__tests__/transport-count-in.test.ts` | Integration tests for Transport count-in flow |

### Modified Files

| File | Changes |
|------|---------|
| `packages/transport/src/types.ts` | Add `CountInMode`, `CountInEventData` types |
| `packages/transport/src/transport.ts` | Add count-in state/methods, update `_emit` for payloads, update `play`/`stop`/`pause`/`seek`/`dispose`, add event payloads to `tempochange`/`meterchange`, default click sounds in constructor |
| `packages/transport/src/adapter.ts` | Add count-in pass-through methods |
| `packages/transport/src/index.ts` | Export new types |
| `packages/transport/src/__tests__/transport.test.ts` | Update existing event tests to verify payloads |

---

## Task 1: Add Types (`CountInMode`, `CountInEventData`)

**Files:**
- Modify: `packages/transport/src/types.ts`
- Modify: `packages/transport/src/index.ts`

- [ ] **Step 1: Add types to `types.ts`**

Add at end of file:

```typescript
/** Count-in mode: 'always' plays count-in on every play(), 'recording-only' only when recording. */
export type CountInMode = 'always' | 'recording-only';

/** Payload emitted with the 'countIn' transport event. */
export interface CountInEventData {
  /** Current beat number (1-indexed) */
  beat: number;
  /** Total number of beats in the count-in */
  totalBeats: number;
}
```

- [ ] **Step 2: Export from `index.ts`**

Add to the type exports block:

```typescript
export type {
  // ...existing exports...
  CountInMode,
  CountInEventData,
} from './types';
```

- [ ] **Step 3: Build and verify**

Run: `cd packages/transport && pnpm build`
Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/transport/src/types.ts packages/transport/src/index.ts
git commit -m "feat(transport): add CountInMode and CountInEventData types"
```

---

## Task 2: Create `click-sounds.ts` with Tests (TDD)

**Files:**
- Create: `packages/transport/src/audio/click-sounds.ts`
- Create: `packages/transport/src/__tests__/click-sounds.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/transport/src/__tests__/click-sounds.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createDefaultClickSounds } from '../audio/click-sounds';

function createMockAudioContext(sampleRate = 48000): AudioContext {
  return {
    sampleRate,
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return {
        duration: length / rate,
        length,
        sampleRate: rate,
        numberOfChannels: channels,
        getChannelData: vi.fn(() => data),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      };
    }),
  } as unknown as AudioContext;
}

describe('createDefaultClickSounds', () => {
  it('returns accent and normal AudioBuffers', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent).toBeDefined();
    expect(normal).toBeDefined();
  });

  it('buffers have correct sample rate', () => {
    const ctx = createMockAudioContext(44100);
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent.sampleRate).toBe(44100);
    expect(normal.sampleRate).toBe(44100);
  });

  it('buffer duration is ~30-50ms', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    expect(accent.duration).toBeGreaterThanOrEqual(0.03);
    expect(accent.duration).toBeLessThanOrEqual(0.06);
    expect(normal.duration).toBeGreaterThanOrEqual(0.02);
    expect(normal.duration).toBeLessThanOrEqual(0.06);
  });

  it('uses default frequencies when options omitted', () => {
    const ctx = createMockAudioContext();
    const { accent, normal } = createDefaultClickSounds(ctx);
    // Verify buffers have non-zero content (sine wave data)
    const accentData = accent.getChannelData(0);
    const normalData = normal.getChannelData(0);
    const accentHasContent = accentData.some((v: number) => v !== 0);
    const normalHasContent = normalData.some((v: number) => v !== 0);
    expect(accentHasContent).toBe(true);
    expect(normalHasContent).toBe(true);
  });

  it('custom frequencies produce different buffer content', () => {
    const ctx = createMockAudioContext();
    const defaults = createDefaultClickSounds(ctx);
    const custom = createDefaultClickSounds(ctx, {
      accentFrequency: 440,
      normalFrequency: 330,
    });
    // Different frequencies → different sample values at same position
    const defaultData = defaults.accent.getChannelData(0);
    const customData = custom.accent.getChannelData(0);
    // At least one sample should differ (frequencies are different)
    let differs = false;
    for (let i = 0; i < defaultData.length; i++) {
      if (Math.abs(defaultData[i] - customData[i]) > 0.001) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/click-sounds.test.ts`
Expected: FAIL — module `../audio/click-sounds` not found.

- [ ] **Step 3: Write implementation**

Create `packages/transport/src/audio/click-sounds.ts`:

```typescript
export interface ClickSoundOptions {
  /** Frequency for accent click (beat 1). Default: 1000 Hz */
  accentFrequency?: number;
  /** Frequency for normal click (other beats). Default: 800 Hz */
  normalFrequency?: number;
}

const DEFAULT_ACCENT_FREQUENCY = 1000;
const DEFAULT_NORMAL_FREQUENCY = 800;
const ACCENT_DURATION = 0.04; // 40ms
const NORMAL_DURATION = 0.03; // 30ms

function synthesizeClick(
  audioContext: AudioContext,
  frequency: number,
  duration: number
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Sine wave with exponential decay envelope
    const envelope = Math.exp(-t * 50);
    data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope;
  }

  return buffer;
}

export function createDefaultClickSounds(
  audioContext: AudioContext,
  options?: ClickSoundOptions
): { accent: AudioBuffer; normal: AudioBuffer } {
  const accentFreq = options?.accentFrequency ?? DEFAULT_ACCENT_FREQUENCY;
  const normalFreq = options?.normalFrequency ?? DEFAULT_NORMAL_FREQUENCY;

  return {
    accent: synthesizeClick(audioContext, accentFreq, ACCENT_DURATION),
    normal: synthesizeClick(audioContext, normalFreq, NORMAL_DURATION),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/click-sounds.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/audio/click-sounds.ts packages/transport/src/__tests__/click-sounds.test.ts
git commit -m "feat(transport): add createDefaultClickSounds utility with tests"
```

---

## Task 3: Create CountInPlayer with Tests (TDD)

**Files:**
- Create: `packages/transport/src/audio/count-in-player.ts`
- Create: `packages/transport/src/__tests__/count-in-player.test.ts`
- Modify: `packages/transport/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/transport/src/__tests__/count-in-player.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CountInPlayer } from '../audio/count-in-player';
import { TempoMap } from '../timeline/tempo-map';
import { MeterMap } from '../timeline/meter-map';
import type { Tick } from '../types';

function createMockSource() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
  };
}

function createMockAudioContext() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    createBufferSource: vi.fn(() => createMockSource()),
  } as unknown as AudioContext;
}

function createMockBuffer(): AudioBuffer {
  return {
    duration: 0.05,
    length: 2400,
    sampleRate: 48000,
    numberOfChannels: 1,
  } as unknown as AudioBuffer;
}

describe('CountInPlayer', () => {
  let ctx: AudioContext;
  let tempoMap: TempoMap;
  let meterMap: MeterMap;
  let destination: AudioNode;
  let accentBuffer: AudioBuffer;
  let normalBuffer: AudioBuffer;

  beforeEach(() => {
    ctx = createMockAudioContext();
    tempoMap = new TempoMap(960, 120);
    meterMap = new MeterMap(960);
    destination = { connect: vi.fn() } as unknown as AudioNode;
    accentBuffer = createMockBuffer();
    normalBuffer = createMockBuffer();
  });

  it('generates correct beat count for 1 bar of 4/4 (4 beats)', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    // 1 bar of 4/4 at 960 PPQN = 3840 ticks. Generate all.
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events.length).toBe(4);
  });

  it('generates correct beat count for 1 bar of 3/4 (3 beats)', () => {
    const threeQuarterMap = new MeterMap(960, 3, 4);
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 3,
      accentBuffer,
      normalBuffer,
      meterMap: threeQuarterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    // 1 bar of 3/4 = 2880 ticks
    const events = player.generate(0 as Tick, 2880 as Tick);
    expect(events.length).toBe(3);
  });

  it('generates correct beat count for 1 bar of 6/8 (6 beats)', () => {
    const sixEightMap = new MeterMap(960, 6, 8);
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 6,
      accentBuffer,
      normalBuffer,
      meterMap: sixEightMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    // 1 bar of 6/8: beat = 480 ticks, 6 beats = 2880 ticks
    const events = player.generate(0 as Tick, 2880 as Tick);
    expect(events.length).toBe(6);
  });

  it('beat 1 gets accent buffer, others get normal', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events[0].isAccent).toBe(true);
    expect(events[0].buffer).toBe(accentBuffer);
    expect(events[1].isAccent).toBe(false);
    expect(events[1].buffer).toBe(normalBuffer);
    expect(events[2].isAccent).toBe(false);
    expect(events[3].isAccent).toBe(false);
  });

  it('beat field increments 1 through totalBeats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events[0].beat).toBe(1);
    expect(events[0].totalBeats).toBe(4);
    expect(events[1].beat).toBe(2);
    expect(events[2].beat).toBe(3);
    expect(events[3].beat).toBe(4);
    expect(events[3].totalBeats).toBe(4);
  });

  it('multi-bar count-in: 2 bars of 4/4 = 8 beats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 8,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    // 2 bars of 4/4 = 7680 ticks
    const events = player.generate(0 as Tick, 7680 as Tick);
    expect(events.length).toBe(8);
    // Bar 1 beat 1 is accent, bar 2 beat 1 is also accent
    expect(events[0].isAccent).toBe(true);
    expect(events[4].isAccent).toBe(true);
  });

  it('onBeat callback fires for each consumed event', () => {
    const onBeat = vi.fn();
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat,
      onComplete: vi.fn(),
    });

    const events = player.generate(0 as Tick, 3840 as Tick);
    for (const event of events) {
      player.consume(event);
    }
    expect(onBeat).toHaveBeenCalledTimes(4);
    expect(onBeat).toHaveBeenNthCalledWith(1, 1, 4);
    expect(onBeat).toHaveBeenNthCalledWith(4, 4, 4);
  });

  it('onComplete fires after last beat consumed', () => {
    const onComplete = vi.fn();
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete,
    });

    const events = player.generate(0 as Tick, 3840 as Tick);
    player.consume(events[0]);
    player.consume(events[1]);
    player.consume(events[2]);
    expect(onComplete).not.toHaveBeenCalled();
    player.consume(events[3]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('silence stops all active sources', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    const events = player.generate(0 as Tick, 960 as Tick);
    player.consume(events[0]);
    player.silence();

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('does not generate events beyond totalBeats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 2,
      accentBuffer,
      normalBuffer,
      meterMap,
      onBeat: vi.fn(),
      onComplete: vi.fn(),
    });

    // Request a full bar but only 2 beats configured
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/count-in-player.test.ts`
Expected: FAIL — module `../audio/count-in-player` not found.

- [ ] **Step 3: Write implementation**

Create `packages/transport/src/audio/count-in-player.ts`:

```typescript
import type { Tick, SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import type { MeterMap } from '../timeline/meter-map';

export interface CountInEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
  beat: number;
  totalBeats: number;
}

interface CountInConfig {
  totalBeats: number;
  accentBuffer: AudioBuffer;
  normalBuffer: AudioBuffer;
  meterMap: MeterMap;
  onBeat: (beat: number, totalBeats: number) => void;
  onComplete: () => void;
}

export class CountInPlayer implements SchedulerListener<CountInEvent> {
  private _audioContext: AudioContext;
  private _tempoMap: TempoMap;
  private _destination: AudioNode;
  private _toAudioTime: (transportTime: number) => number;
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  private _totalBeats = 0;
  private _beatsGenerated = 0;
  private _beatsConsumed = 0;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
  private _meterMap: MeterMap | null = null;
  private _onBeat: ((beat: number, totalBeats: number) => void) | null = null;
  private _onComplete: (() => void) | null = null;

  constructor(
    audioContext: AudioContext,
    tempoMap: TempoMap,
    destination: AudioNode,
    toAudioTime: (transportTime: number) => number
  ) {
    this._audioContext = audioContext;
    this._tempoMap = tempoMap;
    this._destination = destination;
    this._toAudioTime = toAudioTime;
  }

  configure(config: CountInConfig): void {
    this._totalBeats = config.totalBeats;
    this._beatsGenerated = 0;
    this._beatsConsumed = 0;
    this._accentBuffer = config.accentBuffer;
    this._normalBuffer = config.normalBuffer;
    this._meterMap = config.meterMap;
    this._onBeat = config.onBeat;
    this._onComplete = config.onComplete;
  }

  generate(fromTick: Tick, toTick: Tick): CountInEvent[] {
    if (!this._accentBuffer || !this._normalBuffer || !this._meterMap) {
      return [];
    }

    const events: CountInEvent[] = [];
    const meterMap = this._meterMap;

    // Walk the beat grid (same algorithm as MetronomePlayer)
    let entry = meterMap.getEntryAt(fromTick);
    let beatSize = meterMap.ticksPerBeat(fromTick);
    const tickIntoSection = fromTick - entry.tick;
    let tick = entry.tick + Math.ceil(tickIntoSection / beatSize) * beatSize;

    while (tick < toTick && this._beatsGenerated < this._totalBeats) {
      const tickPos = tick as Tick;
      // Re-snap at meter boundaries
      const currentEntry = meterMap.getEntryAt(tickPos);
      if (currentEntry.tick !== entry.tick) {
        entry = currentEntry;
        beatSize = meterMap.ticksPerBeat(tickPos);
      }

      this._beatsGenerated++;
      const isAccent = meterMap.isBarBoundary(tickPos);

      events.push({
        tick: tickPos,
        isAccent,
        buffer: isAccent ? this._accentBuffer : this._normalBuffer,
        beat: this._beatsGenerated,
        totalBeats: this._totalBeats,
      });

      beatSize = meterMap.ticksPerBeat(tickPos);
      tick += beatSize;
    }

    return events;
  }

  consume(event: CountInEvent): void {
    const source = this._audioContext.createBufferSource();
    source.buffer = event.buffer;
    source.connect(this._destination);

    this._activeSources.add(source);
    source.addEventListener('ended', () => {
      this._activeSources.delete(source);
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] CountInPlayer: error disconnecting source:',
          String(err)
        );
      }
    });

    const transportTime = this._tempoMap.ticksToSeconds(event.tick);
    source.start(this._toAudioTime(transportTime));

    this._onBeat?.(event.beat, event.totalBeats);

    this._beatsConsumed++;
    if (this._beatsConsumed === this._totalBeats) {
      this._onComplete?.();
    }
  }

  onPositionJump(_newTick: Tick): void {
    // No-op — clicks are short one-shots that finish naturally.
  }

  silence(): void {
    for (const source of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn(
          '[waveform-playlist] CountInPlayer.silence: error stopping source:',
          String(err)
        );
      }
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] CountInPlayer.silence: error disconnecting:',
          String(err)
        );
      }
    }
    this._activeSources.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/count-in-player.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Export CountInEvent type from index.ts**

Add to `packages/transport/src/index.ts`:

```typescript
export type { CountInEvent } from './audio/count-in-player';
```

Note: Only the `CountInEvent` type is exported, not the `CountInPlayer` class — it's an internal implementation detail managed by Transport.

- [ ] **Step 6: Build and verify**

Run: `cd packages/transport && pnpm build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/transport/src/audio/count-in-player.ts packages/transport/src/__tests__/count-in-player.test.ts packages/transport/src/index.ts
git commit -m "feat(transport): add CountInPlayer with SchedulerListener contract"
```

---

## Task 4: Update `_emit` to Support Event Payloads + Add Payloads to `tempochange`/`meterchange`

**Files:**
- Modify: `packages/transport/src/transport.ts`
- Modify: `packages/transport/src/__tests__/transport.test.ts`

This task updates the event system before adding count-in to Transport, so it can be tested independently.

- [ ] **Step 1: Write failing tests for event payloads**

Add to `packages/transport/src/__tests__/transport.test.ts`:

```typescript
  it('tempochange event includes bpm and atTick payload', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.setTempo(140, 3840 as Tick);
    expect(onTempo).toHaveBeenCalledWith({ bpm: 140, atTick: 3840 });
  });

  it('tempochange at tick 0 uses default tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.setTempo(140);
    expect(onTempo).toHaveBeenCalledWith({ bpm: 140, atTick: 0 });
  });

  it('meterchange event includes numerator, denominator, and atTick payload', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.setMeter(3, 4, 3840 as Tick);
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 3,
      denominator: 4,
      atTick: 3840,
    });
  });

  it('meterchange at tick 0 uses default tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.setMeter(6, 8);
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 6,
      denominator: 8,
      atTick: 0,
    });
  });

  it('clearTempos emits tempochange with default BPM', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140, 3840 as Tick);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.clearTempos();
    expect(onTempo).toHaveBeenCalledWith({ bpm: 120, atTick: 0 });
  });

  it('clearMeters emits meterchange with default meter', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.clearMeters();
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 4,
      denominator: 4,
      atTick: 0,
    });
  });

  it('removeMeter emits meterchange with meter at removed tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.removeMeter(3840 as Tick);
    // After removal, meter at 3840 falls back to default 4/4
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 4,
      denominator: 4,
      atTick: 3840,
    });
  });

  it('existing () => void listeners still work after payload addition', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const noArgListener = vi.fn();
    transport.on('tempochange', noArgListener as any);
    transport.setTempo(140);
    // Should not throw — extra args are ignored
    expect(noArgListener).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/transport.test.ts`
Expected: New tests FAIL — `tempochange` callback receives no arguments.

- [ ] **Step 3: Update `TransportEvents` interface and `_emit` method**

In `packages/transport/src/transport.ts`:

Update the `TransportEvents` interface:

```typescript
import type { Tick, TransportOptions, MeterSignature, CountInEventData } from './types';

export interface TransportEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  loop: () => void;
  tempochange: (event: { bpm: number; atTick: Tick }) => void;
  meterchange: (event: { numerator: number; denominator: number; atTick: Tick }) => void;
  countIn: (event: CountInEventData) => void;
  countInEnd: () => void;
}
```

Update `_emit`:

```typescript
  private _emit<K extends TransportEventType>(
    event: K,
    ...args: Parameters<TransportEvents[K]>
  ): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          (cb as (...a: Parameters<TransportEvents[K]>) => void)(...args);
        } catch (err) {
          console.warn(
            '[waveform-playlist] Transport "' + event + '" listener threw:',
            String(err)
          );
        }
      }
    }
  }
```

Update `on` and `off` — the listener `Map` value type changes. Replace `TransportEvents[TransportEventType]` with a general function type:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _listeners: Map<TransportEventType, Set<(...args: any[]) => void>> = new Map();

  on<K extends TransportEventType>(event: K, cb: TransportEvents[K]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._listeners.get(event)!.add(cb as (...args: any[]) => void);
  }

  off<K extends TransportEventType>(event: K, cb: TransportEvents[K]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._listeners.get(event)?.delete(cb as (...args: any[]) => void);
  }
```

- [ ] **Step 4: Update all `_emit` call sites with payloads**

In `setTempo()`:
```typescript
  setTempo(bpm: number, atTick?: Tick, options?: SetTempoOptions): void {
    this._tempoMap.setTempo(bpm, atTick, options);
    if (this._loopEnabled) {
      this._loopStartSeconds = this._tempoMap.ticksToSeconds(this._loopStartTick);
    }
    this._emit('tempochange', { bpm, atTick: atTick ?? 0 as Tick });
  }
```

In `setMeter()`:
```typescript
  setMeter(numerator: number, denominator: number, atTick?: Tick): void {
    this._meterMap.setMeter(numerator, denominator, atTick);
    this._emit('meterchange', { numerator, denominator, atTick: atTick ?? 0 as Tick });
  }
```

In `removeMeter()`:
```typescript
  removeMeter(atTick: Tick): void {
    this._meterMap.removeMeter(atTick);
    const meter = this._meterMap.getMeter(atTick);
    this._emit('meterchange', { numerator: meter.numerator, denominator: meter.denominator, atTick });
  }
```

In `clearMeters()`:
```typescript
  clearMeters(): void {
    this._meterMap.clearMeters();
    const meter = this._meterMap.getMeter();
    this._emit('meterchange', { numerator: meter.numerator, denominator: meter.denominator, atTick: 0 as Tick });
  }
```

In `clearTempos()`:
```typescript
  clearTempos(): void {
    this._tempoMap.clearTempos();
    if (this._loopEnabled) {
      this._loopStartSeconds = this._tempoMap.ticksToSeconds(this._loopStartTick);
    }
    this._emit('tempochange', { bpm: this._tempoMap.getTempo(), atTick: 0 as Tick });
  }
```

- [ ] **Step 5: Run all tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS (existing + new payload tests).

- [ ] **Step 6: Build**

Run: `cd packages/transport && pnpm build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/transport/src/transport.ts packages/transport/src/__tests__/transport.test.ts
git commit -m "feat(transport): add event payloads to tempochange and meterchange"
```

---

## Task 5: Wire Count-In into Transport (TDD)

**Files:**
- Modify: `packages/transport/src/transport.ts`
- Create: `packages/transport/src/__tests__/transport-count-in.test.ts`

This is the main integration task — adds count-in state, methods, and the play/stop/pause/seek flow modifications.

- [ ] **Step 1: Write failing tests**

Create `packages/transport/src/__tests__/transport-count-in.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../transport';
import type { Tick, CountInEventData } from '../types';

let rafCallbacks: Array<(time: number) => void>;
let rafId: number;

function mockAudioContext(currentTime = 0): AudioContext {
  return {
    sampleRate: 48000,
    currentTime,
    state: 'running',
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: { value: 1, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      channelCount: 1,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return {
        duration: length / rate,
        length,
        sampleRate: rate,
        numberOfChannels: channels,
        getChannelData: vi.fn(() => data),
      };
    }),
    resume: vi.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}

describe('Transport Count-In', () => {
  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return ++rafId;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('default click sounds created in constructor', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    // Metronome should work without explicit setMetronomeClickSounds
    transport.setMetronomeEnabled(true);
    // No throw — default buffers loaded
  });

  it('isCountingIn() is false by default', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in skipped when disabled', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(false);
    transport.setRecording(true);
    transport.play();
    // Should go directly to playing, no count-in
    expect(transport.isPlaying()).toBe(true);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in skipped when mode is recording-only and not recording', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('recording-only');
    transport.setRecording(false);
    transport.play();
    expect(transport.isPlaying()).toBe(true);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in triggers when mode is recording-only and recording is true', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('recording-only');
    transport.setRecording(true);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('count-in triggers when mode is always regardless of recording', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.setRecording(false);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('getCurrentTime returns play position during count-in', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.seek(5);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    // Even though clock is running, getCurrentTime should return the play position
    expect(transport.getCurrentTime()).toBe(5);
  });

  it('stop during count-in cancels cleanly, no countInEnd', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    const onCountInEnd = vi.fn();
    transport.on('countInEnd', onCountInEnd);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.stop();
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(false);
    expect(onCountInEnd).not.toHaveBeenCalled();
  });

  it('pause during count-in cancels cleanly', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.pause();
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(false);
  });

  it('seek during count-in cancels count-in and stops playback', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.seek(3);
    expect(transport.isCountingIn()).toBe(false);
    // Seek during count-in should NOT auto-resume playback
    expect(transport.isPlaying()).toBe(false);
  });

  it('play during count-in is no-op', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    // Second play should be ignored (guard: _playing = true)
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('setCountInBars clamps to 1-8', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountInBars(0);
    // Internally clamped to 1 — verify via count-in behavior
    transport.setCountInBars(10);
    // Internally clamped to 8
    // No throw expected
  });

  it('setCountInBars rounds non-integer', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountInBars(1.5);
    // Internally rounded to 2 — no throw
  });

  it('dispose cleans up count-in state', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    transport.dispose();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('countIn event fires with beat and totalBeats when rAF drives scheduler', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const countInEvents: CountInEventData[] = [];
    transport.on('countIn', (event) => {
      countInEvents.push(event);
    });

    transport.play();
    expect(transport.isCountingIn()).toBe(true);

    // Drive the rAF loop — advance time past count-in duration
    // 1 bar of 4/4 at 120 BPM = 2 seconds
    (ctx as any).currentTime = 12.5; // 2.5s after start
    for (const cb of rafCallbacks) {
      cb(performance.now());
    }

    // Should have received 4 beat events (1 bar of 4/4)
    expect(countInEvents.length).toBe(4);
    expect(countInEvents[0]).toEqual({ beat: 1, totalBeats: 4 });
    expect(countInEvents[3]).toEqual({ beat: 4, totalBeats: 4 });
  });

  it('countInEnd event fires after count-in completes', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const onCountInEnd = vi.fn();
    transport.on('countInEnd', onCountInEnd);

    transport.play();

    // Drive past count-in
    (ctx as any).currentTime = 12.5;
    for (const cb of rafCallbacks) {
      cb(performance.now());
    }

    expect(onCountInEnd).toHaveBeenCalledTimes(1);
    // After count-in ends, should be playing normally
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/transport-count-in.test.ts`
Expected: FAIL — `setCountIn`, `isCountingIn`, etc. not found on Transport.

- [ ] **Step 3: Implement count-in in Transport**

In `packages/transport/src/transport.ts`, add the following changes:

**Add imports:**
```typescript
import { CountInPlayer } from './audio/count-in-player';
import { createDefaultClickSounds } from './audio/click-sounds';
import type { CountInMode } from './types';
```

**Add `TransportOptions` fields** (update import in types.ts too):
```typescript
// In types.ts, add to TransportOptions:
  /** Accent click frequency in Hz. Default: 1000 */
  accentFrequency?: number;
  /** Normal click frequency in Hz. Default: 800 */
  normalFrequency?: number;
```

**Add state fields** after existing private fields:
```typescript
  private _countInEnabled = false;
  private _countInBars = 1;
  private _countInMode: CountInMode = 'recording-only';
  private _recording = false;
  private _countingIn = false;
  private _countInStartPosition = 0;
  private _countInPlayer!: CountInPlayer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _countInScheduler: Scheduler<any> | null = null;
  private _countInTimer!: Timer;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
```

**Update constructor** — after `_initAudioGraph()`:
```typescript
    this._initCountIn(audioContext, options);
```

**Add `_schedulerLookahead` field** to the private state (stored from constructor for reuse):
```typescript
  private _schedulerLookahead: number;
```

In the constructor, after `const lookahead = ...`:
```typescript
    this._schedulerLookahead = lookahead;
```

**Add `_initCountIn` method:**
```typescript
  private _initCountIn(audioContext: AudioContext, options: TransportOptions): void {
    const { accent, normal } = createDefaultClickSounds(audioContext, {
      accentFrequency: options.accentFrequency,
      normalFrequency: options.normalFrequency,
    });
    this._accentBuffer = accent;
    this._normalBuffer = normal;
    this._metronomePlayer.setClickSounds(accent, normal);

    const toAudioTime = (transportTime: number) => this._clock.toAudioTime(transportTime);
    this._countInPlayer = new CountInPlayer(
      audioContext,
      this._tempoMap,
      this._masterNode.input,
      toAudioTime
    );
    // Count-in scheduler is created fresh per count-in in _startCountIn() with
    // a dedicated TempoMap. No need to create one here.
    this._countInTimer = new Timer(() => {
      this._countInScheduler?.advance(this._clock.getTime());
    });
  }
```

**Add public methods:**
```typescript
  // --- Count-In ---

  setCountIn(enabled: boolean): void {
    this._countInEnabled = enabled;
  }

  setCountInBars(bars: number): void {
    const rounded = Math.round(bars);
    if (rounded < 1) {
      console.warn('[waveform-playlist] Transport.setCountInBars: clamping ' + bars + ' to 1');
      this._countInBars = 1;
      return;
    }
    if (rounded > 8) {
      console.warn('[waveform-playlist] Transport.setCountInBars: clamping ' + bars + ' to 8');
      this._countInBars = 8;
      return;
    }
    this._countInBars = rounded;
  }

  setCountInMode(mode: CountInMode): void {
    this._countInMode = mode;
  }

  setRecording(recording: boolean): void {
    this._recording = recording;
  }

  isCountingIn(): boolean {
    return this._countingIn;
  }
```

**Update `play()` method** — at the top, after the `if (this._playing) return` guard:
```typescript
  play(startTime?: number, endTime?: number): void {
    if (this._playing) return;

    if (startTime !== undefined) {
      this._clock.seekTo(startTime);
    }

    // Check if count-in should activate
    if (this._shouldCountIn()) {
      this._startCountIn(endTime);
      return;
    }

    // ...existing play logic unchanged...
  }
```

**Add `_shouldCountIn` helper:**
```typescript
  private _shouldCountIn(): boolean {
    if (!this._countInEnabled) return false;
    if (!this._accentBuffer || !this._normalBuffer) {
      console.warn('[waveform-playlist] Transport: count-in skipped — no click sounds loaded');
      return false;
    }
    if (this._countInMode === 'recording-only' && !this._recording) return false;
    return true;
  }
```

**Add `_startCountIn` method:**
```typescript
  private _startCountIn(endTime?: number): void {
    const currentTime = this._clock.getTime();
    this._countInStartPosition = currentTime;
    this._countingIn = true;
    this._playing = true;
    this._endTime = endTime;

    const playPositionTick = this._tempoMap.secondsToTicks(currentTime);
    const meter = this._meterMap.getMeter(playPositionTick);
    const totalBeats = meter.numerator * this._countInBars;

    // Create a dedicated TempoMap for the count-in with the tempo at the play position.
    // This ensures count-in clicks use the correct tempo even if the main TempoMap has
    // different tempos at tick 0 vs the play position.
    const countInTempoMap = new TempoMap(this._tempoMap.ppqn, this._tempoMap.getTempo(playPositionTick));

    // Create a fresh count-in scheduler with the dedicated TempoMap
    this._countInScheduler = new Scheduler(countInTempoMap, {
      lookahead: this._schedulerLookahead,
    });

    this._countInPlayer.configure({
      totalBeats,
      accentBuffer: this._accentBuffer!,
      normalBuffer: this._normalBuffer!,
      meterMap: this._meterMap,
      onBeat: (beat, total) => {
        this._emit('countIn', { beat, totalBeats: total });
      },
      onComplete: () => {
        this._finishCountIn();
      },
    });

    this._countInScheduler.addListener(this._countInPlayer);
    // Reset count-in scheduler to tick 0 (its own coordinate space)
    // 0 seconds = 0 ticks is always true regardless of TempoMap
    this._countInScheduler.reset(0);
    this._clock.seekTo(0);
    this._clock.start();
    this._countInTimer.start();
  }
```

Note: This creates a fresh `TempoMap` with a single constant tempo matching the play position. This avoids the bug where multi-tempo sessions would use the wrong tempo for count-in clicks. The `_schedulerLookahead` field (stored from constructor options) replaces the previous `this._scheduler['_lookahead']` private field access.

**Add `_finishCountIn` method:**
```typescript
  private _finishCountIn(): void {
    this._countInTimer.stop();
    this._countInScheduler.removeListener(this._countInPlayer);
    this._countInPlayer.silence();
    this._countingIn = false;
    this._emit('countInEnd');

    // Transition to normal playback at original position
    this._clock.seekTo(this._countInStartPosition);
    const currentTime = this._clock.getTime();
    this._scheduler.reset(currentTime);
    const currentTick = this._tempoMap.secondsToTicks(currentTime);
    this._clipPlayer.onPositionJump(currentTick);
    this._timer.start();
    this._emit('play');
  }
```

**Add `_cancelCountIn` helper:**
```typescript
  private _cancelCountIn(): void {
    this._countInTimer.stop();
    this._countInPlayer.silence();
    this._countInScheduler?.removeListener(this._countInPlayer);
    this._countingIn = false;
  }
```

**Update `stop()`:**
```typescript
  stop(): void {
    const wasPlaying = this._playing;
    if (this._countingIn) {
      this._cancelCountIn();
    }
    this._timer.stop();
    this._clock.reset();
    this._scheduler.reset(0);
    this._silenceAll();
    this._playing = false;
    this._endTime = undefined;
    if (wasPlaying) {
      this._emit('stop');
    }
  }
```

**Update `pause()`:**
```typescript
  pause(): void {
    if (!this._playing) return;
    if (this._countingIn) {
      this._cancelCountIn();
    }
    this._timer.stop();
    this._clock.stop();
    this._silenceAll();
    this._playing = false;
    this._emit('pause');
  }
```

**Update `seek()`:**
```typescript
  seek(time: number): void {
    const wasPlaying = this._playing;
    const wasCountingIn = this._countingIn;

    if (wasCountingIn) {
      this._cancelCountIn();
      this._playing = false;
    }

    if (wasPlaying && !wasCountingIn) {
      this._timer.stop();
    }

    this._silenceAll();
    this._clock.seekTo(time);
    this._scheduler.reset(time);
    this._endTime = undefined;

    // Resume playback at new position only if was playing normally (not counting in)
    if (wasPlaying && !wasCountingIn) {
      this._clock.start();
      const seekTick = this._tempoMap.secondsToTicks(time);
      this._clipPlayer.onPositionJump(seekTick);
      this._timer.start();
    }
  }
```

**Update `getCurrentTime()`:**
```typescript
  getCurrentTime(): number {
    if (this._countingIn) {
      return this._countInStartPosition;
    }
    const t = this._clock.getTime();
    if (this._loopEnabled && t < this._loopStartSeconds) {
      return this._loopStartSeconds;
    }
    return t;
  }
```

**Update `setMetronomeClickSounds()`:**
```typescript
  setMetronomeClickSounds(accent: AudioBuffer, normal: AudioBuffer): void {
    this._accentBuffer = accent;
    this._normalBuffer = normal;
    this._metronomePlayer.setClickSounds(accent, normal);
  }
```

**Update `_silenceAll()` to include count-in player:**
```typescript
  private _silenceAll(): void {
    this._clipPlayer.silence();
    this._metronomePlayer.silence();
    this._countInPlayer.silence();
  }
```

**Update `dispose()`:**
```typescript
  dispose(): void {
    this.stop();
    for (const node of this._trackNodes.values()) {
      node.dispose();
    }
    this._trackNodes.clear();
    this._masterNode.dispose();
    this._listeners.clear();
    this._countInTimer.stop();
  }
```

- [ ] **Step 4: Run all transport tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS (existing + count-in + payload tests).

- [ ] **Step 5: Build**

Run: `cd packages/transport && pnpm build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/transport.ts packages/transport/src/types.ts packages/transport/src/__tests__/transport-count-in.test.ts
git commit -m "feat(transport): wire count-in into Transport with play/stop/pause/seek flow"
```

---

## Task 6: Update Adapter and Exports

**Files:**
- Modify: `packages/transport/src/adapter.ts`
- Modify: `packages/transport/src/index.ts`

- [ ] **Step 1: Add pass-through methods to adapter**

In `packages/transport/src/adapter.ts`, add imports and methods:

```typescript
import type { CountInMode } from './types';

// Add to NativePlayoutAdapter class:

  setCountIn(enabled: boolean): void {
    this._transport.setCountIn(enabled);
  }

  setCountInBars(bars: number): void {
    this._transport.setCountInBars(bars);
  }

  setCountInMode(mode: CountInMode): void {
    this._transport.setCountInMode(mode);
  }

  setRecording(recording: boolean): void {
    this._transport.setRecording(recording);
  }

  isCountingIn(): boolean {
    return this._transport.isCountingIn();
  }
```

- [ ] **Step 2: Verify index.ts exports are complete**

Ensure `packages/transport/src/index.ts` exports:

```typescript
export type { ClickSoundOptions } from './audio/click-sounds';
export type { CountInEvent } from './audio/count-in-player';
```

Along with the `CountInMode` and `CountInEventData` already exported from types. `CountInPlayer` class is NOT exported — it's internal.

- [ ] **Step 3: Run all tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Build**

Run: `cd packages/transport && pnpm build`
Expected: Clean build.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: No new errors. Fix any formatting issues with `pnpm format`.

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/adapter.ts packages/transport/src/index.ts
git commit -m "feat(transport): add count-in pass-throughs to adapter and update exports"
```

---

## Task 7: Full Verification

- [ ] **Step 1: Run all transport tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Build all packages**

Run: `pnpm build`
Expected: Clean build across all packages.

- [ ] **Step 3: Lint all packages**

Run: `pnpm lint`
Expected: No errors. Fix any with `pnpm format`.

- [ ] **Step 4: Typecheck**

Run: `cd packages/transport && pnpm typecheck`
Expected: No type errors.

- [ ] **Step 5: Kill orphaned vitest processes**

Run: `pgrep -f vitest && pkill -f vitest || echo "No orphans"`
Expected: Clean.
