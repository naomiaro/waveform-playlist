# Tone.js Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a `PlayoutAdapter` wrapping `TonePlayout` for the engine package, add shared clip time helpers to core, and fix the `track-${index}` bug in the browser package.

**Architecture:** Thin adapter in the existing `playout` package wrapping `TonePlayout`/`ToneTrack`. Rebuild-on-`setTracks()`. Clip time helpers in `core` DRY up sample-to-seconds conversions across the codebase.

**Tech Stack:** TypeScript, Tone.js 15, vitest, tsup

---

### Task 1: Add vitest to core package

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/tsconfig.json` (if test exclusion needed)

**Step 1: Add vitest devDependency to core**

```bash
cd packages/core && pnpm add -D vitest
```

**Step 2: Add test scripts to package.json**

In `packages/core/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify vitest runs (no tests yet)**

Run: `cd packages/core && npx vitest run`
Expected: 0 tests found, no errors

**Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add vitest for unit testing"
```

---

### Task 2: Clip time helpers — tests

**Files:**
- Create: `packages/core/src/__tests__/clipTimeHelpers.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect } from 'vitest';
import { clipStartTime, clipEndTime, clipOffsetTime, clipDurationTime } from '../clipTimeHelpers';
import type { AudioClip } from '../types';

function makeClip(overrides: Partial<AudioClip> & {
  id: string;
  startSample: number;
  durationSamples: number;
}): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    ...overrides,
  };
}

describe('clipStartTime', () => {
  it('converts startSample to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipStartTime(clip)).toBe(1);
  });

  it('returns 0 for clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipStartTime(clip)).toBe(0);
  });

  it('uses clip sampleRate', () => {
    const clip = makeClip({ id: 'c1', startSample: 48000, durationSamples: 48000, sampleRate: 48000 });
    expect(clipStartTime(clip)).toBe(1);
  });
});

describe('clipEndTime', () => {
  it('computes start + duration in seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipEndTime(clip)).toBe(1.5);
  });

  it('handles clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipEndTime(clip)).toBe(1);
  });
});

describe('clipOffsetTime', () => {
  it('converts offsetSamples to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100, offsetSamples: 22050 });
    expect(clipOffsetTime(clip)).toBe(0.5);
  });

  it('returns 0 when offset is 0', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipOffsetTime(clip)).toBe(0);
  });
});

describe('clipDurationTime', () => {
  it('converts durationSamples to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 22050 });
    expect(clipDurationTime(clip)).toBe(0.5);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run`
Expected: FAIL — `clipStartTime` not found / cannot resolve `../clipTimeHelpers`

---

### Task 3: Clip time helpers — implementation

**Files:**
- Create: `packages/core/src/clipTimeHelpers.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Create clipTimeHelpers.ts**

```typescript
import type { AudioClip } from './types';

/** Clip start position in seconds */
export function clipStartTime(clip: AudioClip): number {
  return clip.startSample / clip.sampleRate;
}

/** Clip end position in seconds (start + duration) */
export function clipEndTime(clip: AudioClip): number {
  return (clip.startSample + clip.durationSamples) / clip.sampleRate;
}

/** Clip offset into source audio in seconds */
export function clipOffsetTime(clip: AudioClip): number {
  return clip.offsetSamples / clip.sampleRate;
}

/** Clip duration in seconds */
export function clipDurationTime(clip: AudioClip): number {
  return clip.durationSamples / clip.sampleRate;
}
```

**Step 2: Export from index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export * from './clipTimeHelpers';
```

**Step 3: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run`
Expected: All 7 tests PASS

**Step 4: Run typecheck and build**

Run: `cd packages/core && pnpm typecheck && pnpm build`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/core/src/clipTimeHelpers.ts packages/core/src/__tests__/clipTimeHelpers.test.ts packages/core/src/index.ts
git commit -m "feat(core): add clip time helper functions for sample-to-seconds conversion"
```

---

### Task 4: Add vitest to playout package

**Files:**
- Modify: `packages/playout/package.json`

**Step 1: Add vitest devDependency**

```bash
cd packages/playout && pnpm add -D vitest
```

**Step 2: Add test scripts to package.json**

In `packages/playout/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Add engine as peer + dev dependency**

The adapter imports `PlayoutAdapter` from `@waveform-playlist/engine`. Per CLAUDE.md's pnpm build ordering rule, it must be in both `peerDependencies` and `devDependencies`.

```bash
cd packages/playout && pnpm add -D @waveform-playlist/engine
```

Then manually add to `peerDependencies` in `package.json`:

```json
"peerDependencies": {
  "tone": "^15.0.0",
  "@waveform-playlist/engine": ">=7.0.0"
}
```

**Step 4: Verify vitest runs (no tests yet)**

Run: `cd packages/playout && npx vitest run`
Expected: 0 tests found, no errors

**Step 5: Commit**

```bash
git add packages/playout/package.json pnpm-lock.yaml
git commit -m "chore(playout): add vitest and engine dependency for adapter"
```

---

### Task 5: Tone.js adapter — tests

**Files:**
- Create: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts`

**Step 1: Write the tests**

Mock `TonePlayout` to avoid requiring a real AudioContext. Test the adapter's conversion logic, delegation, and state tracking.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TonePlayout before importing adapter
vi.mock('../TonePlayout', () => {
  return {
    TonePlayout: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      addTrack: vi.fn(),
      applyInitialSoloState: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0),
      setMasterGain: vi.fn(),
      setMute: vi.fn(),
      setSolo: vi.fn(),
      getTrack: vi.fn().mockReturnValue({
        setVolume: vi.fn(),
        setPan: vi.fn(),
      }),
      dispose: vi.fn(),
      setOnPlaybackComplete: vi.fn(),
    })),
  };
});

// Mock Tone.js now() function
vi.mock('tone', () => ({
  now: vi.fn().mockReturnValue(0.1),
}));

import { createToneAdapter } from '../TonePlayoutAdapter';
import { TonePlayout } from '../TonePlayout';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';

function makeClip(overrides: Partial<AudioClip> & {
  id: string;
  startSample: number;
  durationSamples: number;
}): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    audioBuffer: {} as AudioBuffer, // Fake buffer so clip is "playable"
    ...overrides,
  };
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: `Track ${id}`, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

describe('createToneAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('calls playout.init()', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      await adapter.init();
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.init).toHaveBeenCalled();
    });
  });

  describe('setTracks', () => {
    it('creates TonePlayout and adds tracks with real IDs', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('my-track', [clip])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.addTrack).toHaveBeenCalledTimes(1);

      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      expect(addTrackArg.track.id).toBe('my-track');
    });

    it('converts clips from samples to seconds', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({
        id: 'c1',
        startSample: 44100,
        durationSamples: 22050,
        offsetSamples: 11025,
      });
      adapter.setTracks([makeTrack('t1', [clip])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      const clipInfo = addTrackArg.clips[0];

      // clipInfo.startTime is relative to track startTime (1.0)
      // clip starts at 1.0s, track starts at 1.0s, so relative = 0
      expect(clipInfo.startTime).toBe(0);
      expect(clipInfo.duration).toBeCloseTo(0.5);
      expect(clipInfo.offset).toBeCloseTo(0.25);
    });

    it('skips clips without audioBuffer', () => {
      const adapter = createToneAdapter();
      const playable = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      const peaksOnly = makeClip({ id: 'c2', startSample: 44100, durationSamples: 44100 });
      delete (peaksOnly as Partial<AudioClip>).audioBuffer;

      adapter.setTracks([makeTrack('t1', [playable, peaksOnly])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      expect(addTrackArg.clips).toHaveLength(1);
    });

    it('skips tracks with no playable clips', () => {
      const adapter = createToneAdapter();
      const peaksOnly = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      delete (peaksOnly as Partial<AudioClip>).audioBuffer;

      adapter.setTracks([makeTrack('t1', [peaksOnly])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.addTrack).not.toHaveBeenCalled();
    });

    it('calls applyInitialSoloState after adding tracks', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.applyInitialSoloState).toHaveBeenCalled();
    });

    it('disposes old playout on subsequent setTracks calls', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip])]);

      const firstInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

      adapter.setTracks([makeTrack('t2', [clip])]);
      expect(firstInstance.dispose).toHaveBeenCalled();
    });
  });

  describe('play', () => {
    it('calls init then playout.play with converted args', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })])]);
      await adapter.play(1.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.init).toHaveBeenCalled();
      // play(when, offset, duration) — when=now(), offset=startTime, duration=undefined
      expect(mockInstance.play).toHaveBeenCalledWith(expect.any(Number), 1.5, undefined);
    });

    it('computes duration from endTime - startTime', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })])]);
      await adapter.play(1.0, 3.0);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.play).toHaveBeenCalledWith(expect.any(Number), 1.0, 2.0);
    });

    it('sets isPlaying to true', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      await adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);
    });
  });

  describe('pause', () => {
    it('delegates to playout.pause and sets isPlaying false', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      await adapter.play(0);
      adapter.pause();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.pause).toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(false);
    });
  });

  describe('stop', () => {
    it('delegates to playout.stop and sets isPlaying false', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      await adapter.play(0);
      adapter.stop();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.stop).toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(false);
    });
  });

  describe('seek', () => {
    it('delegates to playout.seekTo', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.seek(2.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.seekTo).toHaveBeenCalledWith(2.5);
    });
  });

  describe('getCurrentTime', () => {
    it('delegates to playout.getCurrentTime', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      (mockInstance.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(3.5);

      expect(adapter.getCurrentTime()).toBe(3.5);
    });
  });

  describe('track controls', () => {
    it('delegates setMasterVolume to playout.setMasterGain', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.setMasterVolume(0.75);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.setMasterGain).toHaveBeenCalledWith(0.75);
    });

    it('delegates setTrackMute', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.setTrackMute('t1', true);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.setMute).toHaveBeenCalledWith('t1', true);
    });

    it('delegates setTrackSolo', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.setTrackSolo('t1', true);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.setSolo).toHaveBeenCalledWith('t1', true);
    });

    it('delegates setTrackVolume to track.setVolume', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.setTrackVolume('t1', 0.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.getTrack).toHaveBeenCalledWith('t1');
      const mockTrack = mockInstance.getTrack.mock.results[0].value;
      expect(mockTrack.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('delegates setTrackPan to track.setPan', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.setTrackPan('t1', -0.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.getTrack).toHaveBeenCalledWith('t1');
      const mockTrack = mockInstance.getTrack.mock.results[0].value;
      expect(mockTrack.setPan).toHaveBeenCalledWith(-0.5);
    });
  });

  describe('dispose', () => {
    it('disposes playout', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })])]);
      adapter.dispose();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockInstance.dispose).toHaveBeenCalled();
    });

    it('is safe to call without setTracks', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.dispose()).not.toThrow();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/playout && npx vitest run`
Expected: FAIL — cannot resolve `../TonePlayoutAdapter`

---

### Task 6: Tone.js adapter — implementation

**Files:**
- Create: `packages/playout/src/TonePlayoutAdapter.ts`
- Modify: `packages/playout/src/index.ts`

**Step 1: Create TonePlayoutAdapter.ts**

```typescript
import type { ClipTrack } from '@waveform-playlist/core';
import {
  clipStartTime,
  clipEndTime,
  clipOffsetTime,
  clipDurationTime,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { Track } from '@waveform-playlist/core';
import { TonePlayout } from './TonePlayout';
import type { EffectsFunction } from './TonePlayout';
import type { ClipInfo } from './ToneTrack';
import { now } from 'tone';

export interface ToneAdapterOptions {
  effects?: EffectsFunction;
}

export function createToneAdapter(options?: ToneAdapterOptions): PlayoutAdapter {
  let playout: TonePlayout | null = null;
  let _isPlaying = false;

  function buildPlayout(tracks: ClipTrack[]): void {
    if (playout) {
      playout.dispose();
    }

    playout = new TonePlayout({
      effects: options?.effects,
    });

    for (const track of tracks) {
      const playableClips = track.clips.filter((c) => c.audioBuffer);
      if (playableClips.length === 0) continue;

      const startTime = Math.min(...playableClips.map(clipStartTime));
      const endTime = Math.max(...playableClips.map(clipEndTime));

      const trackObj: Track = {
        id: track.id,
        name: track.name,
        gain: track.volume,
        muted: track.muted,
        soloed: track.soloed,
        stereoPan: track.pan,
        startTime,
        endTime,
      };

      const clipInfos: ClipInfo[] = playableClips.map((clip) => ({
        buffer: clip.audioBuffer!,
        startTime: clipStartTime(clip) - startTime,
        duration: clipDurationTime(clip),
        offset: clipOffsetTime(clip),
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        gain: clip.gain,
      }));

      playout.addTrack({
        clips: clipInfos,
        track: trackObj,
      });
    }

    playout.applyInitialSoloState();
  }

  return {
    async init(): Promise<void> {
      if (playout) {
        await playout.init();
      }
    },

    setTracks(tracks: ClipTrack[]): void {
      buildPlayout(tracks);
    },

    async play(startTime: number, endTime?: number): Promise<void> {
      if (!playout) return;
      await playout.init();
      const duration = endTime !== undefined ? endTime - startTime : undefined;
      playout.play(now(), startTime, duration);
      _isPlaying = true;
    },

    pause(): void {
      playout?.pause();
      _isPlaying = false;
    },

    stop(): void {
      playout?.stop();
      _isPlaying = false;
    },

    seek(time: number): void {
      playout?.seekTo(time);
    },

    getCurrentTime(): number {
      return playout?.getCurrentTime() ?? 0;
    },

    isPlaying(): boolean {
      return _isPlaying;
    },

    setMasterVolume(volume: number): void {
      playout?.setMasterGain(volume);
    },

    setTrackVolume(trackId: string, volume: number): void {
      playout?.getTrack(trackId)?.setVolume(volume);
    },

    setTrackMute(trackId: string, muted: boolean): void {
      playout?.setMute(trackId, muted);
    },

    setTrackSolo(trackId: string, soloed: boolean): void {
      playout?.setSolo(trackId, soloed);
    },

    setTrackPan(trackId: string, pan: number): void {
      playout?.getTrack(trackId)?.setPan(pan);
    },

    dispose(): void {
      playout?.dispose();
      playout = null;
      _isPlaying = false;
    },
  };
}
```

**Step 2: Export from index.ts**

Add to `packages/playout/src/index.ts`:

```typescript
export { createToneAdapter } from './TonePlayoutAdapter';
export type { ToneAdapterOptions } from './TonePlayoutAdapter';
```

**Step 3: Run tests**

Run: `cd packages/playout && npx vitest run`
Expected: All tests PASS

**Step 4: Run typecheck and build**

Run: `cd packages/playout && pnpm typecheck && pnpm build`
Expected: No errors

**Step 5: Commit**

```bash
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts packages/playout/src/index.ts
git commit -m "feat(playout): add Tone.js PlayoutAdapter for engine integration"
```

---

### Task 7: Fix track-${index} in browser package

**Files:**
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx`

**Step 1: Find all `track-${index}` occurrences**

There are 5 occurrences in `WaveformPlaylistContext.tsx`:
1. Line ~472: `id: \`track-${index}\`` in Track object creation
2. Line ~890: `const trackId = \`track-${trackIndex}\`` in setTrackMute
3. Line ~901: `const trackId = \`track-${trackIndex}\`` in setTrackSolo
4. Line ~912: `const trackId = \`track-${trackIndex}\`` in setTrackVolume
5. Line ~926: `const trackId = \`track-${trackIndex}\`` in setTrackPan

**Step 2: Fix Track object creation (occurrence 1)**

Change:
```typescript
id: `track-${index}`,
```
To:
```typescript
id: track.id,
```

**Step 3: Fix track controls (occurrences 2-5)**

For each of setTrackMute, setTrackSolo, setTrackVolume, setTrackPan — the callback receives `trackIndex` (an array index). We need the real track ID instead.

The callbacks are called with a track index from the UI layer. We need to look up the actual `ClipTrack.id` from the tracks array using that index:

Change each:
```typescript
const trackId = `track-${trackIndex}`;
```
To:
```typescript
const trackId = tracks[trackIndex]?.id;
if (!trackId) return;
```

Where `tracks` is the tracks prop/state available in the closure.

**Step 4: Run typecheck**

Run: `pnpm --filter @waveform-playlist/browser typecheck`
Expected: No errors

**Step 5: Run E2E tests**

Run: `pnpm build && pnpm test`
Expected: All E2E tests pass (playback, mute/solo/volume still work)

**Step 6: Commit**

```bash
git add packages/browser/src/WaveformPlaylistContext.tsx
git commit -m "fix(browser): use real track.id instead of track-\${index} for playout"
```

---

### Task 8: Build verification and lint

**Files:** None (verification only)

**Step 1: Full monorepo build**

Run: `pnpm build`
Expected: All packages build successfully

**Step 2: Lint**

Run: `pnpm -w lint`
Expected: No errors

**Step 3: Run all unit tests**

Run: `cd packages/core && npx vitest run && cd ../engine && npx vitest run && cd ../playout && npx vitest run`
Expected: All tests pass across core, engine, and playout

**Step 4: Run E2E tests**

Run: `pnpm test`
Expected: All Playwright tests pass

**Step 5: Commit any fixes, then create PR**
