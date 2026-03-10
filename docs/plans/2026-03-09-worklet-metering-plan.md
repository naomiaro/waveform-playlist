# Worklet-Based Metering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move peak/RMS metering into an AudioWorklet for sample-accurate measurement, consolidating all worklets in a new `@waveform-playlist/worklets` package.

**Architecture:** A new `@waveform-playlist/worklets` package holds all AudioWorklet processors (meter + recording). The meter worklet is a pass-through node that accumulates peak/RMS across all 128-sample quantums and posts results at ~60Hz. Both `useMicrophoneLevel` and `useOutputMeter` hooks switch from Tone.js `Analyser` to this worklet.

**Tech Stack:** TypeScript, AudioWorklet API, tsup (dual CJS/ESM build), vitest, React hooks

**Design doc:** `docs/plans/2026-03-09-worklet-metering-design.md`

---

### Task 1: Create the `@waveform-playlist/worklets` package scaffold

**Files:**
- Create: `packages/worklets/package.json`
- Create: `packages/worklets/tsconfig.json`
- Create: `packages/worklets/tsup.config.ts`
- Create: `packages/worklets/src/index.ts`

**Step 1: Create the package directory**

```bash
mkdir -p packages/worklets/src/worklet
```

**Step 2: Create `packages/worklets/package.json`**

```json
{
  "name": "@waveform-playlist/worklets",
  "version": "9.5.2",
  "description": "AudioWorklet processors for waveform-playlist (metering, recording)",
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
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": [
    "waveform",
    "audio",
    "audioworklet",
    "metering",
    "waveform-playlist"
  ],
  "author": "Naomi Aro",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/naomiaro/waveform-playlist.git",
    "directory": "packages/worklets"
  },
  "homepage": "https://naomiaro.github.io/waveform-playlist",
  "bugs": {
    "url": "https://github.com/naomiaro/waveform-playlist/issues"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0"
  }
}
```

**Step 3: Create `packages/worklets/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create `packages/worklets/tsup.config.ts`**

This follows the same dual-entry pattern as the current recording package — one entry for the main index (with DTS), separate entries for each worklet file (no DTS, `clean: false`).

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  // Main package (exports worklet URLs)
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
  },
  // AudioWorklet processors (no DTS, don't clean dist)
  {
    entry: {
      'worklet/meter-processor.worklet': 'src/worklet/meter-processor.worklet.ts',
      'worklet/recording-processor.worklet': 'src/worklet/recording-processor.worklet.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
]);
```

**Step 5: Create `packages/worklets/src/index.ts`** (placeholder)

```typescript
// Worklet URLs resolve relative to this module's location at runtime.
// Consumers call audioContext.audioWorklet.addModule(url) with these.
export const meterProcessorUrl = new URL(
  './worklet/meter-processor.worklet.js',
  import.meta.url
).href;

export const recordingProcessorUrl = new URL(
  './worklet/recording-processor.worklet.js',
  import.meta.url
).href;
```

**Step 6: Install dependencies**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm install
```

**Step 7: Verify the package builds**

```bash
pnpm --filter @waveform-playlist/worklets build
```

Expected: Build succeeds (worklet files don't exist yet so the worklet entry may warn — that's OK for now).

**Step 8: Commit**

```bash
git add packages/worklets/
git commit -m "chore: scaffold @waveform-playlist/worklets package"
```

---

### Task 2: Write the meter processor worklet (TDD)

**Files:**
- Create: `packages/worklets/src/worklet/meter-processor.worklet.ts`
- Create: `packages/worklets/src/__tests__/meter-processor.test.ts`

**Step 1: Write the failing tests**

Create `packages/worklets/src/__tests__/meter-processor.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AudioWorklet globals before importing the processor
const mockPort = {
  postMessage: vi.fn(),
  onmessage: null as ((event: MessageEvent) => void) | null,
};

// Mock the AudioWorkletProcessor base class and registerProcessor
(globalThis as any).AudioWorkletProcessor = class {
  port = mockPort;
};
(globalThis as any).sampleRate = 48000;
(globalThis as any).registerProcessor = vi.fn();

// Import after mocks are set up
await import('../worklet/meter-processor.worklet');

function getProcessorClass(): any {
  return (globalThis as any).registerProcessor.mock.calls[0][1];
}

function createProcessor(options?: { numberOfChannels?: number; updateRate?: number }): any {
  const Processor = getProcessorClass();
  return new Processor({
    processorOptions: {
      numberOfChannels: options?.numberOfChannels ?? 2,
      updateRate: options?.updateRate ?? 60,
    },
  });
}

function makeInput(channels: Float32Array[]): Float32Array[][] {
  return [channels];
}

function makeOutput(channelCount: number): Float32Array[][] {
  return [Array.from({ length: channelCount }, () => new Float32Array(128))];
}

describe('MeterProcessor', () => {
  beforeEach(() => {
    mockPort.postMessage.mockClear();
  });

  it('registers as "meter-processor"', () => {
    expect((globalThis as any).registerProcessor).toHaveBeenCalledWith(
      'meter-processor',
      expect.any(Function)
    );
  });

  it('is a pass-through: copies input to output', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const input = new Float32Array(128).fill(0.5);
    const output = new Float32Array(128);

    processor.process([[input]], [[output]], {});

    expect(output[0]).toBe(0.5);
    expect(output[63]).toBe(0.5);
    expect(output[127]).toBe(0.5);
  });

  it('computes correct peak for known samples', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });
    // updateRate = sampleRate means post every quantum (1 block)

    const input = new Float32Array(128).fill(0);
    input[42] = 0.75;
    input[100] = -0.9; // Negative peak, abs = 0.9

    processor.process(makeInput([input]), makeOutput(1), {});

    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
    const msg = mockPort.postMessage.mock.calls[0][0];
    expect(msg.peak[0]).toBe(0.9); // max(0.75, 0.9)
  });

  it('computes correct RMS for known samples', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });

    // All samples = 0.5 → RMS = 0.5
    const input = new Float32Array(128).fill(0.5);

    processor.process(makeInput([input]), makeOutput(1), {});

    const msg = mockPort.postMessage.mock.calls[0][0];
    expect(msg.rms[0]).toBeCloseTo(0.5, 5);
  });

  it('accumulates peak across multiple quantums before posting', () => {
    // At 48kHz with updateRate=60: blocksPerUpdate = floor(48000 / (128 * 60)) = 6
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 60 });

    const silence = new Float32Array(128).fill(0);
    const loud = new Float32Array(128).fill(0);
    loud[0] = 0.8;

    // Process 5 blocks — should not post yet
    processor.process(makeInput([loud]), makeOutput(1), {});
    for (let i = 1; i < 5; i++) {
      processor.process(makeInput([silence]), makeOutput(1), {});
    }
    expect(mockPort.postMessage).not.toHaveBeenCalled();

    // 6th block triggers post
    processor.process(makeInput([silence]), makeOutput(1), {});
    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);

    const msg = mockPort.postMessage.mock.calls[0][0];
    // Peak from first block (0.8) accumulated across all 6 blocks
    expect(msg.peak[0]).toBe(0.8);
  });

  it('handles multi-channel independently', () => {
    const processor = createProcessor({ numberOfChannels: 2, updateRate: 48000 });

    const ch0 = new Float32Array(128).fill(0);
    ch0[0] = 0.3;
    const ch1 = new Float32Array(128).fill(0);
    ch1[0] = 0.7;

    processor.process(makeInput([ch0, ch1]), makeOutput(2), {});

    const msg = mockPort.postMessage.mock.calls[0][0];
    expect(msg.peak[0]).toBe(0.3);
    expect(msg.peak[1]).toBe(0.7);
  });

  it('resets accumulators after posting', () => {
    const processor = createProcessor({ numberOfChannels: 1, updateRate: 48000 });

    const loud = new Float32Array(128).fill(0);
    loud[0] = 0.9;
    processor.process(makeInput([loud]), makeOutput(1), {});

    const silence = new Float32Array(128).fill(0);
    processor.process(makeInput([silence]), makeOutput(1), {});

    const msg2 = mockPort.postMessage.mock.calls[1][0];
    expect(msg2.peak[0]).toBe(0); // Reset after first post
  });

  it('returns true to keep processor alive', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const result = processor.process(
      makeInput([new Float32Array(128)]),
      makeOutput(1),
      {}
    );
    expect(result).toBe(true);
  });

  it('handles missing input gracefully', () => {
    const processor = createProcessor({ numberOfChannels: 1 });
    const result = processor.process([[]], makeOutput(1), {});
    expect(result).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/worklets && npx vitest run
```

Expected: FAIL — `meter-processor.worklet.ts` doesn't exist yet.

**Step 3: Write the meter processor implementation**

Create `packages/worklets/src/worklet/meter-processor.worklet.ts`:

```typescript
/**
 * MeterProcessor — AudioWorklet processor for sample-accurate peak/RMS metering
 *
 * Pass-through node: audio flows through unchanged while levels are computed.
 * Accumulates peak (max absolute sample) and RMS (root mean square) across all
 * 128-sample quantums, posting results at ~updateRate Hz via postMessage.
 *
 * This guarantees every sample is measured — unlike AnalyserNode snapshots which
 * can miss transients between animation frames.
 *
 * Message format posted to main thread:
 * {
 *   peak: number[],  // Per-channel max absolute sample since last post
 *   rms: number[]    // Per-channel RMS over the interval since last post
 * }
 *
 * RMS Strategy: Simple interval average (not sliding window).
 * Trade-off: A sliding window (like openDAW's 100ms circular buffer) provides
 * smoother, more perceptually accurate loudness display. Our interval-based
 * approach may appear jumpier since each update only reflects ~16ms of audio.
 * However, for visual metering at 60fps the difference is subtle. A circular
 * buffer can be added later without changing the message format or hook API.
 */

// Type declarations for AudioWorklet context
declare const sampleRate: number;

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: 'a-rate' | 'k-rate';
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}
declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): void;

interface MeterProcessorOptions {
  numberOfChannels: number;
  updateRate: number;
}

class MeterProcessor extends AudioWorkletProcessor {
  private numberOfChannels: number;
  private blocksPerUpdate: number;
  private blocksProcessed: number;
  private maxPeak: number[];
  private sumSquares: number[];
  private sampleCount: number[];

  constructor(options: { processorOptions: MeterProcessorOptions } & AudioWorkletNodeOptions) {
    super();

    const { numberOfChannels, updateRate } = options.processorOptions;
    this.numberOfChannels = numberOfChannels;
    this.blocksPerUpdate = Math.max(1, Math.floor(sampleRate / (128 * updateRate)));
    this.blocksProcessed = 0;
    this.maxPeak = new Array(numberOfChannels).fill(0);
    this.sumSquares = new Array(numberOfChannels).fill(0);
    this.sampleCount = new Array(numberOfChannels).fill(0);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) {
      return true;
    }

    // Pass-through: copy input to output
    for (let ch = 0; ch < output.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];
      if (inputChannel && outputChannel) {
        outputChannel.set(inputChannel);
      }
    }

    // Accumulate peak and RMS per channel
    for (let ch = 0; ch < this.numberOfChannels; ch++) {
      const inputChannel = input[ch];
      if (!inputChannel) continue;

      let peak = this.maxPeak[ch];
      let sum = this.sumSquares[ch];

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        sum += sample * sample;
      }

      this.maxPeak[ch] = peak;
      this.sumSquares[ch] = sum;
      this.sampleCount[ch] += inputChannel.length;
    }

    this.blocksProcessed++;

    // Post at target update rate
    if (this.blocksProcessed >= this.blocksPerUpdate) {
      const peak: number[] = [];
      const rms: number[] = [];

      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        peak.push(this.maxPeak[ch]);
        const count = this.sampleCount[ch];
        rms.push(count > 0 ? Math.sqrt(this.sumSquares[ch] / count) : 0);
      }

      this.port.postMessage({ peak, rms });

      // Reset accumulators
      this.maxPeak.fill(0);
      this.sumSquares.fill(0);
      this.sampleCount.fill(0);
      this.blocksProcessed = 0;
    }

    return true;
  }
}

registerProcessor('meter-processor', MeterProcessor);
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/worklets && npx vitest run
```

Expected: All tests PASS.

**Step 5: Build the package to verify worklet compiles**

```bash
pnpm --filter @waveform-playlist/worklets build
```

Expected: Build succeeds with both `dist/index.{js,mjs}` and `dist/worklet/meter-processor.worklet.{js,mjs}`.

**Step 6: Commit**

```bash
git add packages/worklets/src/
git commit -m "feat: add meter-processor worklet with sample-accurate peak/RMS"
```

---

### Task 3: Move the recording worklet to the worklets package

**Files:**
- Move: `packages/recording/src/worklet/recording-processor.worklet.ts` → `packages/worklets/src/worklet/recording-processor.worklet.ts`
- Move: `packages/recording/src/__tests__/recordingProcessor.test.ts` → `packages/worklets/src/__tests__/recordingProcessor.test.ts`
- Modify: `packages/recording/src/hooks/useRecording.ts` (change worklet URL import)
- Modify: `packages/recording/tsup.config.ts` (remove worklet entry)
- Modify: `packages/recording/package.json` (add worklets dependency)

**Step 1: Move the recording worklet file**

```bash
cp packages/recording/src/worklet/recording-processor.worklet.ts packages/worklets/src/worklet/recording-processor.worklet.ts
```

**Step 2: Move the recording worklet test**

```bash
cp packages/recording/src/__tests__/recordingProcessor.test.ts packages/worklets/src/__tests__/recordingProcessor.test.ts
```

Update the import path in the test file. Change:

```typescript
await import('../worklet/recording-processor.worklet');
```

This should stay the same since the relative path is the same in the new location.

**Step 3: Verify tests pass in worklets package**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/worklets && npx vitest run
```

Expected: Both meter and recording processor tests pass.

**Step 4: Build worklets package**

```bash
pnpm --filter @waveform-playlist/worklets build
```

Expected: All three entries build — `index`, `meter-processor.worklet`, `recording-processor.worklet`.

**Step 5: Add worklets as dependency to recording**

In `packages/recording/package.json`, add to `dependencies`:

```json
"@waveform-playlist/worklets": "workspace:*"
```

Run `pnpm install` to link the workspace dependency.

**Step 6: Update `useRecording.ts` to import worklet URL**

In `packages/recording/src/hooks/useRecording.ts`, change the worklet URL from a relative path to the exported URL:

Old (line ~58):
```typescript
const workletUrl = new URL('./worklet/recording-processor.worklet.js', import.meta.url).href;
```

New:
```typescript
import { recordingProcessorUrl } from '@waveform-playlist/worklets';
// ... then in loadWorklet:
await context.addAudioWorkletModule(recordingProcessorUrl);
```

Move the import to the top of the file. Remove the `new URL(...)` line inside `loadWorklet`.

**Step 7: Simplify recording tsup config**

In `packages/recording/tsup.config.ts`, remove the second entry (worklet build). The config becomes:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['tone', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'styled-components'],
});
```

**Step 8: Remove old worklet files from recording**

```bash
rm packages/recording/src/worklet/recording-processor.worklet.ts
rm packages/recording/src/__tests__/recordingProcessor.test.ts
rmdir packages/recording/src/worklet
```

**Step 9: Build recording package and verify**

```bash
pnpm --filter @waveform-playlist/recording build
```

Expected: Build succeeds. `dist/worklet/` directory no longer exists in recording.

**Step 10: Run recording tests**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/recording && npx vitest run
```

Expected: All tests pass (recording worklet test now lives in worklets package).

**Step 11: Commit**

```bash
git add packages/worklets/ packages/recording/
git commit -m "refactor: move recording worklet to @waveform-playlist/worklets package"
```

---

### Task 4: Update `useMicrophoneLevel` to use the meter worklet

**Files:**
- Modify: `packages/recording/src/hooks/useMicrophoneLevel.ts`
- Modify: `packages/recording/package.json` (worklets dependency already added in Task 3)

**Step 1: Rewrite `useMicrophoneLevel` to use the meter worklet**

Replace the Tone.js `Analyser` + `requestAnimationFrame` approach with an `AudioWorkletNode` using the meter processor.

Key changes:
- Import `meterProcessorUrl` from `@waveform-playlist/worklets`
- Import `dBToNormalized` from `@waveform-playlist/core` (already imported)
- Remove `Analyser` import from `tone` — only need `getContext` for AudioContext access
- Remove `computePeak`, `computeRms` helper functions (now in worklet)
- Keep `gainToNormalized` for converting raw gain values from worklet to normalized 0–1
- Remove `requestAnimationFrame` loop — listen on `port.onmessage` instead
- Keep peak decay, mono mirroring, and `resetPeak` logic
- Keep the return type and shape unchanged

The new implementation:

```typescript
import { useEffect, useState, useRef } from 'react';
import { getContext } from 'tone';
import { dBToNormalized } from '@waveform-playlist/core';
import { meterProcessorUrl } from '@waveform-playlist/worklets';

const PEAK_DECAY = 0.98;

// Keep existing interfaces: UseMicrophoneLevelOptions, UseMicrophoneLevelReturn

function gainToNormalized(gain: number): number {
  if (gain <= 0) return 0;
  const db = 20 * Math.log10(gain);
  return dBToNormalized(db);
}

export function useMicrophoneLevel(
  stream: MediaStream | null,
  options: UseMicrophoneLevelOptions = {}
): UseMicrophoneLevelReturn {
  const { updateRate = 60, channelCount = 1 } = options;
  // Note: smoothingTimeConstant is no longer used (worklet handles timing)

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

  const resetPeak = () => setPeakLevels(new Array(channelCount).fill(0));

  useEffect(() => {
    if (!stream) {
      setLevels(new Array(channelCount).fill(0));
      setPeakLevels(new Array(channelCount).fill(0));
      setRmsLevels(new Array(channelCount).fill(0));
      smoothedPeakRef.current = new Array(channelCount).fill(0);
      return;
    }

    let isMounted = true;

    const setupMonitoring = async () => {
      if (!isMounted) return;

      const context = getContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      if (!isMounted) return;

      const rawContext = context.rawContext as AudioContext;

      // Auto-detect actual mic channel count from stream
      const trackSettings = stream.getAudioTracks()[0]?.getSettings();
      const actualChannels = trackSettings?.channelCount ?? channelCount;

      // Load the meter worklet module
      await rawContext.audioWorklet.addModule(meterProcessorUrl);
      if (!isMounted) return;

      // Create the meter worklet node
      const workletNode = new AudioWorkletNode(rawContext, 'meter-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: actualChannels,
        channelCountMode: 'explicit',
        processorOptions: {
          numberOfChannels: actualChannels,
          updateRate,
        },
      });
      workletNodeRef.current = workletNode;

      // Create source and connect: source → meter (pass-through, output not connected)
      const source = rawContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(workletNode);
      // Don't connect output to destination — mic monitoring would cause feedback

      smoothedPeakRef.current = new Array(actualChannels).fill(0);

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const { peak, rms } = event.data as { peak: number[]; rms: number[] };
        const smoothed = smoothedPeakRef.current;

        const peakValues: number[] = [];
        const rmsValues: number[] = [];

        for (let ch = 0; ch < peak.length; ch++) {
          // Smoothed peak: jump up instantly, decay slowly
          smoothed[ch] = Math.max(peak[ch], (smoothed[ch] ?? 0) * PEAK_DECAY);
          peakValues.push(gainToNormalized(smoothed[ch]));
          rmsValues.push(gainToNormalized(rms[ch]));
        }

        // Mirror mono to fill requested channelCount
        const mirroredPeaks =
          peak.length < channelCount
            ? new Array(channelCount).fill(peakValues[0])
            : peakValues;
        const mirroredRms =
          peak.length < channelCount
            ? new Array(channelCount).fill(rmsValues[0])
            : rmsValues;

        setLevels(mirroredPeaks);
        setRmsLevels(mirroredRms);
        setPeakLevels((prev) => mirroredPeaks.map((val, i) => Math.max(prev[i] ?? 0, val)));
      };
    };

    setupMonitoring();

    return () => {
      isMounted = false;

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // Ignore disconnect errors
        }
        sourceRef.current = null;
      }

      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.close();
        } catch {
          // Ignore disconnect errors
        }
        workletNodeRef.current = null;
      }
    };
  }, [stream, updateRate, channelCount]);

  const level = channelCount === 1 ? (levels[0] ?? 0) : Math.max(...levels);
  const peakLevel = channelCount === 1 ? (peakLevels[0] ?? 0) : Math.max(...peakLevels);

  return {
    level,
    peakLevel,
    resetPeak,
    levels,
    peakLevels,
    rmsLevels,
  };
}
```

**Step 2: Build recording package**

```bash
pnpm --filter @waveform-playlist/worklets build && pnpm --filter @waveform-playlist/recording build
```

Expected: Both build successfully.

**Step 3: Run recording tests**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/recording && npx vitest run
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/recording/src/hooks/useMicrophoneLevel.ts
git commit -m "feat: switch useMicrophoneLevel to meter worklet for sample-accurate peaks"
```

---

### Task 5: Update `useOutputMeter` to use the meter worklet

**Files:**
- Modify: `packages/browser/src/hooks/useOutputMeter.ts`
- Modify: `packages/browser/package.json` (add worklets dependency)

**Step 1: Add worklets as dependency to browser**

In `packages/browser/package.json`, add to `dependencies`:

```json
"@waveform-playlist/worklets": "workspace:*"
```

Run `pnpm install`.

**Step 2: Rewrite `useOutputMeter` to use the meter worklet**

Same pattern as Task 4 but for output. Key differences:
- Uses `getGlobalContext()` from `@waveform-playlist/playout` (not `getContext()` from tone)
- Inserts worklet as pass-through in destination chain
- No mono mirroring needed

```typescript
import { useEffect, useState, useRef, useCallback } from 'react';
import { getGlobalContext } from '@waveform-playlist/playout';
import { dBToNormalized } from '@waveform-playlist/core';
import { meterProcessorUrl } from '@waveform-playlist/worklets';

const PEAK_DECAY = 0.98;

// Keep existing interfaces: UseOutputMeterOptions, UseOutputMeterReturn

function gainToNormalized(gain: number): number {
  if (gain <= 0) return 0;
  const db = 20 * Math.log10(gain);
  return dBToNormalized(db);
}

export function useOutputMeter(options: UseOutputMeterOptions = {}): UseOutputMeterReturn {
  const { channelCount = 2, updateRate = 60 } = options;
  // smoothingTimeConstant no longer used

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      const context = getGlobalContext();
      const rawContext = context.rawContext as AudioContext;

      await rawContext.audioWorklet.addModule(meterProcessorUrl);
      if (!isMounted) return;

      const workletNode = new AudioWorkletNode(rawContext, 'meter-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount,
        channelCountMode: 'explicit',
        processorOptions: {
          numberOfChannels: channelCount,
          updateRate,
        },
      });
      workletNodeRef.current = workletNode;

      // Insert as pass-through in destination chain:
      // Destination's Volume → MeterWorklet → rawContext.destination
      const destination = context.destination;
      destination.chain(workletNode);

      smoothedPeakRef.current = new Array(channelCount).fill(0);

      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const { peak, rms } = event.data as { peak: number[]; rms: number[] };
        const smoothed = smoothedPeakRef.current;

        const peakValues: number[] = [];
        const rmsValues: number[] = [];

        for (let ch = 0; ch < peak.length; ch++) {
          smoothed[ch] = Math.max(peak[ch], (smoothed[ch] ?? 0) * PEAK_DECAY);
          peakValues.push(gainToNormalized(smoothed[ch]));
          rmsValues.push(gainToNormalized(rms[ch]));
        }

        setLevels(peakValues);
        setRmsLevels(rmsValues);
        setPeakLevels((prev) => peakValues.map((val, i) => Math.max(prev[i] ?? 0, val)));
      };
    };

    setup();

    return () => {
      isMounted = false;

      if (workletNodeRef.current) {
        const context = getGlobalContext();
        try {
          context.destination.chain(); // Restore default chain
        } catch {
          console.warn('[waveform-playlist] Failed to restore destination chain');
        }
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.close();
        } catch {
          // Ignore disconnect errors
        }
        workletNodeRef.current = null;
      }
    };
  }, [channelCount, updateRate]);

  return { levels, peakLevels, rmsLevels, resetPeak };
}
```

**Step 3: Build and verify**

```bash
pnpm --filter @waveform-playlist/worklets build && pnpm build
```

Expected: All packages build successfully.

**Step 4: Run browser tests**

```bash
cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run
```

Expected: All tests pass.

**Step 5: Run typecheck across all packages**

```bash
pnpm typecheck
```

Expected: No type errors.

**Step 6: Commit**

```bash
git add packages/browser/
git commit -m "feat: switch useOutputMeter to meter worklet for sample-accurate peaks"
```

---

### Task 6: Update Docusaurus aliases and verify website

**Files:**
- Modify: `website/docusaurus.config.ts` (add worklets alias, optionally alias recording to source)
- Modify: `packages/worklets/package.json` (if version bump needed)

**Step 1: Add worklets alias to Docusaurus webpack config**

In `website/docusaurus.config.ts`, find the webpack aliases section. Add the worklets package alias. Since worklets contains built worklet JS files that use `import.meta.url`, it should resolve via `node_modules` (same pattern as the current recording package):

Add a comment:
```typescript
// worklets uses import.meta.url for worklet JS files — resolve via node_modules
```

No code change needed if it already resolves via node_modules (which it will as a workspace dependency).

**Step 2: Test if recording can now be aliased to source**

In `website/docusaurus.config.ts`, try adding:
```typescript
'@waveform-playlist/recording': path.resolve(__dirname, '../packages/recording/src'),
```

Since recording no longer has worklet files in its build, this should work.

**Step 3: Build the website**

```bash
pnpm --filter website build
```

Expected: Build succeeds without errors. CSS calc warnings are pre-existing and harmless.

**Step 4: If recording alias fails, revert it**

If the website build fails with the recording source alias, remove it and keep recording resolving via node_modules.

**Step 5: Run lint**

```bash
pnpm lint
```

Expected: All files pass formatting and linting.

**Step 6: Commit**

```bash
git add website/
git commit -m "chore: update Docusaurus aliases for worklets package"
```

---

### Task 7: Update documentation and CLAUDE.md

**Files:**
- Modify: `website/docs/guides/vu-meters.md` (update architecture description)
- Modify: `packages/recording/CLAUDE.md` (update worklet references)
- Modify: `packages/browser/CLAUDE.md` (update output metering section)
- Modify: `CLAUDE.md` (add worklets package reference)

**Step 1: Update `website/docs/guides/vu-meters.md`**

In the "Input Metering" and "Output Metering" sections, the API hasn't changed — hooks still return the same `levels`, `peakLevels`, `rmsLevels`. But update the introductory text to mention sample-accurate metering.

Add near the top of the "Peak vs RMS Metering" section:

```markdown
Both hooks use an AudioWorklet processor that measures every audio sample — no transient is missed, even between animation frames. This guarantees accurate clipping detection for recording.
```

Remove `smoothingTimeConstant` from the `useMicrophoneLevel` and `useOutputMeter` options tables (no longer used).

**Step 2: Update `packages/recording/CLAUDE.md`**

Update the "VU Meter Level Normalization" section to reference the worklet approach instead of Tone.js Meter. Remove references to `Analyser`. Update the worklet section to note worklets now live in `@waveform-playlist/worklets`.

**Step 3: Update `packages/browser/CLAUDE.md`**

Update the "Output Metering (useOutputMeter)" section to reference the meter worklet instead of `Analyser`. Note that `destination.chain(workletNode)` replaces `destination.chain(analyser)`.

**Step 4: Update root `CLAUDE.md`**

Add `packages/worklets/CLAUDE.md` to the per-package documentation list if a CLAUDE.md is created, or just add a note about the new package.

**Step 5: Build website to verify docs render**

```bash
pnpm --filter website build
```

Expected: Build succeeds.

**Step 6: Run lint**

```bash
pnpm lint
```

Expected: All files pass.

**Step 7: Commit**

```bash
git add website/docs/ packages/recording/CLAUDE.md packages/browser/CLAUDE.md CLAUDE.md
git commit -m "docs: update metering docs for worklet-based architecture"
```

---

### Task 8: Version bump and final verification

**Step 1: Bump version in all package.json files**

```bash
sed -i '' 's/"version": "9.5.2"/"version": "9.6.0"/g' package.json packages/*/package.json
```

Note: This is a minor version bump since we're adding a new package and changing internal implementation without breaking the public API.

**Step 2: Full build**

```bash
pnpm build
```

Expected: All packages build successfully.

**Step 3: Full lint**

```bash
pnpm lint
```

Expected: All files pass.

**Step 4: Run all tests**

```bash
cd packages/worklets && npx vitest run && cd ../core && npx vitest run && cd ../recording && npx vitest run && cd ../browser && npx vitest run && cd ../ui-components && npx vitest run
```

Expected: All tests pass across all packages.

**Step 5: Build website**

```bash
pnpm --filter website build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: bump version to 9.6.0"
```

**Step 7: Push**

```bash
git push
```
