# dawcore SoundFont Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-06-09-dawcore-soundfont-design.md`

**Goal:** Let dawcore (web components) consumers play MIDI through SF2 soundfont samples like the React version, and let both stacks provide/swap the soundfont after tracks exist via a new `ToneAdapter.setSoundFontCache()`.

**Architecture:** `createToneAdapter` already accepts `soundFontCache` and routes MIDI clips to `SoundFontToneTrack` vs `MidiToneTrack` at track-add time. We add a `setSoundFontCache()` method that rebuilds *only* MIDI tracks whose effective routing changed, using a track snapshot the adapter maintains. dawcore needs no package changes (the consumer owns the adapter per issue #378). React's provider forwards late `soundFontCache` prop changes to the live adapter.

**Tech Stack:** TypeScript, Tone.js 15 (playout), React 19 (browser), Lit (dawcore — untouched), Vitest, Vite (examples).

**Working branch:** `feat/dawcore-soundfont` (already created; spec committed).

**Key background for the implementing engineer:**

- `createToneAdapter` in `packages/playout/src/TonePlayoutAdapter.ts` is a **closure factory** — all state is `let`/`const` bindings inside the function, returned object methods close over them. Follow that pattern; do not convert to a class.
- The MIDI-vs-soundfont decision creates **different track classes** (`TonePlayout.addMidiTrack` vs `TonePlayout.addSoundFontTrack`), so a swap must remove + recreate the MIDI playout track. The existing incremental path (`playout.removeTrack(id)` + re-add) is the mechanism.
- A track with both audio and MIDI clips gets **two** playout tracks: audio under `track.id`, MIDI under `track.id + ':midi'` (see `TonePlayoutAdapter.ts:90`).
- Unit tests mock `TonePlayout` entirely (no AudioContext) — see `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts:12-39`.
- Run tests from the package dir: `cd packages/playout && npx vitest run`. After running tests, check for orphaned vitest processes (`pgrep -f vitest`, kill with `pkill -f vitest`).
- `pnpm typecheck` resolves workspace deps via `dist/` — **build playout before typechecking browser** (`pnpm --filter @waveform-playlist/playout build`).
- `pnpm lint` runs from repo root only. Run before every commit.
- Git commands always from repo root.

---

### Task 1: Characterization tests for existing soundfont routing

The soundfont routing in `addTrackToPlayout` currently has **zero test coverage** (the `TonePlayout` mock doesn't even stub `addMidiTrack`/`addSoundFontTrack`). Lock in current behavior before refactoring.

**Files:**
- Modify: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts`

- [ ] **Step 1: Extend the TonePlayout mock**

In the `vi.mock('../TonePlayout', ...)` block (line 12), add two stubs to the returned implementation object, after `addTrack: vi.fn(),`:

```typescript
      addMidiTrack: vi.fn(),
      addSoundFontTrack: vi.fn(),
```

- [ ] **Step 2: Add MIDI test helpers**

After the existing `makeTrack` helper (line 67-69), add:

```typescript
function makeMidiClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    midiChannel: 0,
    midiProgram: 5,
    ...overrides,
  };
}
```

Note: NO `audioBuffer` — MIDI-only clips have none. Add `import type { SoundFontCache } from '../SoundFontCache';` to the imports and define fake caches near the helpers:

```typescript
const loadedCache = { isLoaded: true } as unknown as SoundFontCache;
const unloadedCache = { isLoaded: false } as unknown as SoundFontCache;
```

- [ ] **Step 3: Write characterization tests**

Add a new `describe` block at the end of the top-level `describe('createToneAdapter', ...)`:

```typescript
  describe('soundfont routing', () => {
    it('routes MIDI tracks to addSoundFontTrack when cache is loaded at creation', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addMidiTrack).not.toHaveBeenCalled();

      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      expect(arg.track.id).toBe('t1');
      expect(arg.programNumber).toBe(5);
      expect(arg.isPercussion).toBe(false);
      expect(arg.soundFontCache).toBe(loadedCache);
    });

    it('sets isPercussion for MIDI channel 9', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100, midiChannel: 9 }),
        ]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack.mock.calls[0][0].isPercussion).toBe(true);
    });

    it('falls back to addMidiTrack when no cache is provided', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
    });

    it('falls back to addMidiTrack (with warning) when cache is not loaded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter({ soundFontCache: unloadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SoundFont not loaded'));
      warnSpy.mockRestore();
    });

    it('uses :midi suffixed id for tracks with both audio and MIDI clips', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [
          makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addTrack.mock.calls[0][0].track.id).toBe('t1');
      expect(instance.addSoundFontTrack.mock.calls[0][0].track.id).toBe('t1:midi');
    });
  });
```

- [ ] **Step 4: Run the tests — all should PASS (characterizing existing behavior)**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayoutAdapter.test.ts`
Expected: all tests pass, including the 5 new ones. If a new test fails, the test is wrong (it must describe current behavior) — fix the test, not the source.

- [ ] **Step 5: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
pnpm lint && git add packages/playout/src/__tests__/TonePlayoutAdapter.test.ts && git commit -m "test(playout): characterize soundfont vs PolySynth routing in ToneAdapter"
```

---

### Task 2: Refactor — split `addTrackToPlayout` into audio/MIDI halves

Pure refactor, no behavior change. Tests from Task 1 are the safety net.

**Files:**
- Modify: `packages/playout/src/TonePlayoutAdapter.ts:49-137` (the `addTrackToPlayout` function)
- Modify: `packages/playout/src/TonePlayoutAdapter.ts:250-259` (the `updateTrack` MIDI-companion path)

- [ ] **Step 1: Split the function**

Replace the body of `addTrackToPlayout` (lines 49-137) with three functions. The audio half and MIDI half are verbatim moves of the existing code — only the shared `trackId` computation changes (the MIDI half can no longer see `audioClips`, so it derives the same answer from `track.clips`):

```typescript
  // A track with both audio and MIDI clips becomes TWO playout tracks:
  // audio under track.id, MIDI under track.id + ':midi'.
  function midiPlayoutTrackId(track: ClipTrack): string {
    const hasAudio = track.clips.some((c) => c.audioBuffer && !c.midiNotes);
    return hasAudio ? `${track.id}:midi` : track.id;
  }

  function addAudioTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    const audioClips = track.clips.filter((c) => c.audioBuffer && !c.midiNotes);
    if (audioClips.length === 0) return;

    const startTime = Math.min(...audioClips.map(clipStartTime));
    const endTime = Math.max(...audioClips.map(clipEndTime));

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

    const clipInfos: ClipInfo[] = audioClips.map((clip) => ({
      buffer: clip.audioBuffer!,
      startTime: clipStartTime(clip) - startTime,
      duration: clipDurationTime(clip),
      offset: clipOffsetTime(clip),
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      gain: clip.gain,
    }));

    p.addTrack({
      clips: clipInfos,
      track: trackObj,
      effects: track.effects,
      channelCount: trackChannelCount(track),
    });
  }

  function addMidiTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    const midiClips = track.clips.filter((c) => c.midiNotes && c.midiNotes.length > 0);
    if (midiClips.length === 0) return;

    const startTime = Math.min(...midiClips.map(clipStartTime));
    const endTime = Math.max(...midiClips.map(clipEndTime));

    const trackId = midiPlayoutTrackId(track);

    const trackObj: Track = {
      id: trackId,
      name: track.name,
      gain: track.volume,
      muted: track.muted,
      soloed: track.soloed,
      stereoPan: track.pan,
      startTime,
      endTime,
    };

    const midiClipInfos: MidiClipInfo[] = midiClips.map((clip) => ({
      notes: clip.midiNotes!,
      startTime: clipStartTime(clip) - startTime,
      duration: clipDurationTime(clip),
      offset: clipOffsetTime(clip),
    }));

    if (options?.soundFontCache?.isLoaded) {
      const firstClip = midiClips[0];
      const midiChannel = firstClip.midiChannel;
      const isPercussion = midiChannel === 9;
      const programNumber = firstClip.midiProgram ?? 0;

      p.addSoundFontTrack({
        clips: midiClipInfos,
        track: trackObj,
        soundFontCache: options.soundFontCache,
        programNumber,
        isPercussion,
        effects: track.effects,
      });
    } else {
      if (options?.soundFontCache) {
        console.warn(
          `[waveform-playlist] SoundFont not loaded for track "${track.name}" — falling back to PolySynth.`
        );
      }
      p.addMidiTrack({
        clips: midiClipInfos,
        track: trackObj,
        effects: track.effects,
      });
    }
  }

  // Add a single ClipTrack to the playout (shared by buildPlayout and addTrack)
  function addTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    addAudioTrackToPlayout(p, track);
    addMidiTrackToPlayout(p, track);
  }
```

- [ ] **Step 2: Fix the `updateTrack` MIDI-companion path to re-add only the MIDI half**

In `updateTrack` (around line 250), the existing companion-MIDI branch calls `addTrackToPlayout(playout, track)` after `replaceTrackClips` already updated the audio clips in place — re-adding the audio track too. Change it to use the new MIDI-only helper:

```typescript
        // Also update companion MIDI track if present
        const midiClips = track.clips.filter((c) => c.midiNotes && c.midiNotes.length > 0);
        if (midiClips.length > 0) {
          const midiTrackId = trackId + ':midi';
          playout.removeTrack(midiTrackId);
          addMidiTrackToPlayout(playout, track);
          if (_isPlaying) {
            playout.resumeTrackMidPlayback(midiTrackId);
          }
        }
```

(Only the `addTrackToPlayout` → `addMidiTrackToPlayout` call changes.)

- [ ] **Step 3: Run the full playout test suite**

Run: `cd packages/playout && npx vitest run`
Expected: all tests pass (Task 1 characterization tests prove routing unchanged).

- [ ] **Step 4: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
pnpm lint && git add packages/playout/src/TonePlayoutAdapter.ts && git commit -m "refactor(playout): split addTrackToPlayout into audio/MIDI halves"
```

---

### Task 3: `ToneAdapter.setSoundFontCache()` — TDD

**Files:**
- Modify: `packages/playout/src/TonePlayoutAdapter.ts`
- Modify: `packages/playout/src/index.ts:43`
- Test: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts`

**Design recap (from spec):**
- `_soundFontCache` becomes mutable closure state (initialized from options).
- `_currentTracks: Map<string, ClipTrack>` — snapshot of the adapter's tracks, kept fresh immutably (including volume/mute/solo/pan setters).
- `_midiTrackBuild: Map<string, SoundFontCache | null>` — keyed by **MIDI playout track id**, records the cache each MIDI track was actually built with (`null` = PolySynth). This is the no-op guard: `setSoundFontCache` rebuilds a track only when the *effective* routing (`cache?.isLoaded ? cache : null`) differs from what it was built with. A reference-equality guard would be wrong — the same cache object can transition `isLoaded: false → true` after a late `load()`.

- [ ] **Step 1: Write the failing tests**

Add to `TonePlayoutAdapter.test.ts`, inside the top-level describe:

```typescript
  describe('setSoundFontCache', () => {
    it('upgrades existing MIDI tracks from PolySynth to soundfont', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack.mock.calls[0][0].soundFontCache).toBe(loadedCache);
      expect(instance.applyInitialSoloState).toHaveBeenCalled();
    });

    it('leaves audio tracks untouched when swapping', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('audio', [makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 })]),
        makeTrack('midi', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(loadedCache);

      // Audio track was not removed or re-added
      expect(instance.addTrack).toHaveBeenCalledTimes(1);
      expect(instance.removeTrack).not.toHaveBeenCalledWith('audio');
      expect(instance.removeTrack).toHaveBeenCalledWith('midi');
    });

    it('reverts to PolySynth when called with undefined', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(undefined);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when effective routing is unchanged (same loaded cache)', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockClear();
      instance.addSoundFontTrack.mockClear();
      instance.applyInitialSoloState.mockClear();

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).not.toHaveBeenCalled();
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
      expect(instance.applyInitialSoloState).not.toHaveBeenCalled();
    });

    it('rebuilds when the SAME cache object finishes loading late', () => {
      // The late-load race: cache passed at creation, tracks added before load completes
      const lateCache = { isLoaded: false } as unknown as SoundFontCache;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter({ soundFontCache: lateCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      warnSpy.mockRestore();

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);

      // load() completes — same object, isLoaded flips
      (lateCache as unknown as { isLoaded: boolean }).isLoaded = true;
      adapter.setSoundFontCache(lateCache);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
    });

    it('resumes mid-playback when swapping during playback', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.resumeTrackMidPlayback).toHaveBeenCalledWith('t1');
    });

    it('rebuilt track reflects volume/mute changes made before the swap', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackVolume('t1', 0.5);
      adapter.setTrackMute('t1', true);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      expect(arg.track.gain).toBe(0.5);
      expect(arg.track.muted).toBe(true);
    });

    it('uses :midi suffixed id for mixed audio+MIDI tracks', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [
          makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]),
      ]);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.removeTrack).toHaveBeenCalledWith('t1:midi');
      expect(instance.addSoundFontTrack.mock.calls[0][0].track.id).toBe('t1:midi');
    });

    it('does not rebuild tracks removed via removeTrack', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.removeTrack!('t1');

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockClear();

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).not.toHaveBeenCalled();
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
    });

    it('is safe to call before setTracks and applies on later adds', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.setSoundFontCache(loadedCache)).not.toThrow();

      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addMidiTrack).not.toHaveBeenCalled();
    });

    it('is safe to call after dispose (stores only)', () => {
      const adapter = createToneAdapter();
      adapter.dispose();
      expect(() => adapter.setSoundFontCache(loadedCache)).not.toThrow();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayoutAdapter.test.ts`
Expected: FAIL — `adapter.setSoundFontCache is not a function` (TypeScript will also flag the property; that's fine, vitest runs through the type error via esbuild — if it refuses, temporarily cast, then remove the cast in Step 3).

- [ ] **Step 3: Implement in `TonePlayoutAdapter.ts`**

3a. Add the public interface after `ToneAdapterOptions` and change the factory signature:

```typescript
export interface ToneAdapter extends PlayoutAdapter {
  /**
   * Provide or swap the SoundFont after creation. Rebuilds only the MIDI
   * tracks whose routing changes; audio tracks keep playing untouched.
   * Pass undefined to revert MIDI tracks to PolySynth synthesis.
   */
  setSoundFontCache(cache: SoundFontCache | undefined): void;
}

export function createToneAdapter(options?: ToneAdapterOptions): ToneAdapter {
```

3b. Add closure state (after `let _bpm = 120;`):

```typescript
  let _soundFontCache = options?.soundFontCache;
  // Snapshot of the adapter's tracks, kept fresh by setTracks/addTrack/
  // updateTrack/removeTrack and the per-track control setters. Used by
  // setSoundFontCache to rebuild MIDI tracks without an engine round-trip.
  const _currentTracks = new Map<string, ClipTrack>();
  // What each MIDI playout track was built with (null = PolySynth). The
  // rebuild guard compares against this, NOT cache reference equality —
  // the same cache object can flip isLoaded after a late load().
  const _midiTrackBuild = new Map<string, SoundFontCache | null>();
```

3c. In `addMidiTrackToPlayout` (from Task 2), replace both `options?.soundFontCache` reads with `_soundFontCache` and record the build:

```typescript
    if (_soundFontCache?.isLoaded) {
      const firstClip = midiClips[0];
      const midiChannel = firstClip.midiChannel;
      const isPercussion = midiChannel === 9;
      const programNumber = firstClip.midiProgram ?? 0;

      p.addSoundFontTrack({
        clips: midiClipInfos,
        track: trackObj,
        soundFontCache: _soundFontCache,
        programNumber,
        isPercussion,
        effects: track.effects,
      });
      _midiTrackBuild.set(trackId, _soundFontCache);
    } else {
      if (_soundFontCache) {
        console.warn(
          `[waveform-playlist] SoundFont not loaded for track "${track.name}" — falling back to PolySynth.`
        );
      }
      p.addMidiTrack({
        clips: midiClipInfos,
        track: trackObj,
        effects: track.effects,
      });
      _midiTrackBuild.set(trackId, null);
    }
```

3d. Maintain the snapshot in the returned methods:

- `setTracks(tracks)` — first lines of the method body (before the `if (!playout)` branch):

```typescript
      _currentTracks.clear();
      _midiTrackBuild.clear();
      for (const track of tracks) {
        _currentTracks.set(track.id, track);
      }
```

(`_midiTrackBuild` repopulates because every track in the new list flows through `addMidiTrackToPlayout`, and tracks absent from the list are removed.)

- `updateTrack(trackId, track)` — first line: `_currentTracks.set(trackId, track);`
- `addTrack(track)` — first line (before the `!playout` guard is fine, after also fine — put it first): `_currentTracks.set(track.id, track);`
- `removeTrack(trackId)` — first lines:

```typescript
      _currentTracks.delete(trackId);
      _midiTrackBuild.delete(trackId);
      _midiTrackBuild.delete(trackId + ':midi');
```

- `setTrackVolume(trackId, volume)` — add before the playout call:

```typescript
      const existing = _currentTracks.get(trackId);
      if (existing) _currentTracks.set(trackId, { ...existing, volume });
```

- `setTrackMute(trackId, muted)`: same pattern with `{ ...existing, muted }`.
- `setTrackSolo(trackId, soloed)`: same pattern with `{ ...existing, soloed }`.
- `setTrackPan(trackId, pan)`: same pattern with `{ ...existing, pan }`.
- `dispose()` — add `_currentTracks.clear();` and `_midiTrackBuild.clear();` after `playout = null;`.

3e. Add the method to the returned object (a good spot: after `setLoop`):

```typescript
    setSoundFontCache(cache: SoundFontCache | undefined): void {
      _soundFontCache = cache;
      if (!playout) return;

      const effective = cache?.isLoaded ? cache : null;
      let changed = false;

      for (const track of _currentTracks.values()) {
        const hasMidi = track.clips.some((c) => c.midiNotes && c.midiNotes.length > 0);
        if (!hasMidi) continue;

        const midiTrackId = midiPlayoutTrackId(track);
        if (_midiTrackBuild.get(midiTrackId) === effective) continue;

        playout.removeTrack(midiTrackId);
        addMidiTrackToPlayout(playout, track);
        if (_isPlaying) {
          playout.resumeTrackMidPlayback(midiTrackId);
        }
        changed = true;
      }

      if (changed) {
        playout.applyInitialSoloState();
      }
    },
```

Note `_midiTrackBuild.get(...)` returns `undefined` for unknown ids and `null` for PolySynth builds — `undefined === null` is false, so an unknown id would rebuild. That can't happen for tracks in `_currentTracks` (every MIDI add records an entry), but the distinction is why the map stores `null` rather than deleting entries.

3f. Export the type from `packages/playout/src/index.ts` — change line 43:

```typescript
export type { ToneAdapterOptions, ToneAdapter } from './TonePlayoutAdapter';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/playout && npx vitest run`
Expected: ALL tests pass (new + existing).

- [ ] **Step 5: Typecheck and lint**

Run from repo root: `pnpm --filter @waveform-playlist/playout typecheck && pnpm lint`
Expected: clean. (`noUnusedLocals` will catch any helper not wired into call sites.)

- [ ] **Step 6: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/index.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts
git commit -m "feat(playout): ToneAdapter.setSoundFontCache for late soundfont load/swap"
```

---

### Task 4: React provider wiring (`@waveform-playlist/browser`)

Forward late `soundFontCache` prop changes to the live adapter.

**Files:**
- Create: `packages/browser/src/soundFontSync.ts`
- Test: `packages/browser/src/__tests__/soundFontSync.test.ts`
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx` (~line 375 refs block, ~line 785 adapter creation, new effect)

- [ ] **Step 1: Rebuild playout so browser sees the new type**

Run: `pnpm --filter @waveform-playlist/playout build`
(Workspace typecheck resolves via `dist/` — without this, `ToneAdapter` won't exist for the browser package.)

- [ ] **Step 2: Write the failing test**

Create `packages/browser/src/__tests__/soundFontSync.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '@waveform-playlist/playout';
import { syncSoundFontCacheToAdapter } from '../soundFontSync';

const cache = { isLoaded: true } as unknown as SoundFontCache;

describe('syncSoundFontCacheToAdapter', () => {
  it('forwards the cache to adapters that support soundfonts', () => {
    const setSoundFontCache = vi.fn();
    const adapter = { setSoundFontCache } as unknown as PlayoutAdapter;

    syncSoundFontCacheToAdapter(adapter, cache);

    expect(setSoundFontCache).toHaveBeenCalledWith(cache);
  });

  it('forwards undefined to revert to synthesis', () => {
    const setSoundFontCache = vi.fn();
    const adapter = { setSoundFontCache } as unknown as PlayoutAdapter;

    syncSoundFontCacheToAdapter(adapter, undefined);

    expect(setSoundFontCache).toHaveBeenCalledWith(undefined);
  });

  it('no-ops when the adapter is null', () => {
    expect(() => syncSoundFontCacheToAdapter(null, cache)).not.toThrow();
  });

  it('no-ops for adapters without soundfont support', () => {
    const adapter = {} as unknown as PlayoutAdapter;
    expect(() => syncSoundFontCacheToAdapter(adapter, cache)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/browser && npx vitest run src/__tests__/soundFontSync.test.ts`
Expected: FAIL — cannot resolve `../soundFontSync`.

- [ ] **Step 4: Implement `packages/browser/src/soundFontSync.ts`**

```typescript
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache, ToneAdapter } from '@waveform-playlist/playout';

/**
 * Forward a (possibly late-loaded or swapped) SoundFontCache to the live
 * adapter. Safe no-op when the adapter is absent or doesn't support
 * soundfonts. The adapter itself skips MIDI tracks whose routing is
 * unchanged, so redundant calls (e.g. on mount) cause no rebuild churn.
 */
export function syncSoundFontCacheToAdapter(
  adapter: PlayoutAdapter | null,
  cache: SoundFontCache | undefined
): void {
  const toneAdapter = adapter as Partial<ToneAdapter> | null;
  if (typeof toneAdapter?.setSoundFontCache !== 'function') return;
  toneAdapter.setSoundFontCache(cache);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/browser && npx vitest run src/__tests__/soundFontSync.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire into `WaveformPlaylistContext.tsx`**

6a. Add the import near the other local imports at the top of the file:

```typescript
import { syncSoundFontCacheToAdapter } from './soundFontSync';
```

(`PlayoutAdapter` type: check the existing imports — if not already imported from `@waveform-playlist/engine`, add `import type { PlayoutAdapter } from '@waveform-playlist/engine';`.)

6b. Add a ref next to `engineRef` (~line 375):

```typescript
  const adapterRef = useRef<PlayoutAdapter | null>(null);
```

6c. In `loadAudio` where the adapter is created (~line 785), capture it:

```typescript
        const adapter = createToneAdapter({ effects, soundFontCache: soundFontCacheRef.current });
        adapterRef.current = adapter;
```

6d. Add the effect AFTER the `loadAudio` effect (so on mount it runs after the adapter exists — though either order is safe):

```typescript
  // Forward late-arriving / swapped SoundFontCache to the live adapter so
  // MIDI tracks upgrade from PolySynth without an engine rebuild. The
  // adapter no-ops when routing is unchanged, so the mount-time call with
  // the creation-time cache is harmless.
  useEffect(() => {
    syncSoundFontCacheToAdapter(adapterRef.current, soundFontCache);
  }, [soundFontCache]);
```

- [ ] **Step 7: Typecheck, full browser tests, lint**

Run from repo root:
```bash
pnpm --filter @waveform-playlist/browser typecheck
cd packages/browser && npx vitest run; cd ../..
pnpm lint
```
Expected: clean. (If repo-wide `pnpm typecheck` is run instead, remember playout must be built first — done in Step 1.)

- [ ] **Step 8: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/soundFontSync.ts packages/browser/src/__tests__/soundFontSync.test.ts packages/browser/src/WaveformPlaylistContext.tsx
git commit -m "feat(browser): forward late soundFontCache prop changes to the adapter"
```

---

### Task 5: dawcore-tone soundfont example

**Files:**
- Create: `examples/dawcore-tone/soundfont.html`
- Modify: `examples/dawcore-tone/index.html` (add list entry)

- [ ] **Step 1: Create `examples/dawcore-tone/soundfont.html`**

Modeled on `midi-load.html` (same styling/log conventions):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dawcore + Tone.js — SoundFont MIDI</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f0f1a;
      color: #e0d4c8;
      padding: 24px;
    }
    h1 { font-size: 1.2rem; margin-bottom: 16px; }
    daw-editor {
      --daw-wave-color: #c49a6c;
      --daw-playhead-color: #d08070;
      --daw-background: #1a1a2e;
      --daw-track-background: #16213e;
      --daw-ruler-color: #c49a6c;
      --daw-ruler-background: #0f0f1a;
      --daw-piano-roll-note-color: #2a7070;
      --daw-piano-roll-selected-note-color: #3d9e9e;
      --daw-piano-roll-background: #1a1a2e;
      margin-bottom: 12px;
    }
    daw-transport { display: flex; gap: 8px; }
    #log {
      margin-top: 12px;
      font-family: monospace;
      font-size: 0.75rem;
      color: #888;
      max-height: 160px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <h1>dawcore + Tone.js — MIDI through SoundFont samples</h1>

  <script type="module">import '@dawcore/components';</script>

  <daw-editor id="editor" samples-per-pixel="2048" wave-height="120" timescale>
    <daw-keyboard-shortcuts playback></daw-keyboard-shortcuts>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
  </daw-transport>

  <div id="log"></div>

  <script type="module">
    import { createToneAdapter, SoundFontCache } from '@waveform-playlist/playout';

    const editor = document.getElementById('editor');
    const log = document.getElementById('log');

    function addLog(msg) {
      const line = document.createElement('div');
      line.textContent = msg;
      log.prepend(line);
      while (log.children.length > 30) log.lastChild.remove();
    }

    editor.addEventListener('daw-track-ready', (e) => addLog('track-ready: ' + e.detail.trackId));
    editor.addEventListener('daw-error', (e) => addLog('error: ' + e.detail.operation + ' — ' + String(e.detail.error)));

    async function start() {
      // 1. Load the SoundFont BEFORE creating the adapter — MIDI tracks added
      //    while the cache is still loading would fall back to PolySynth
      //    (recoverable later via adapter.setSoundFontCache(cache)).
      let soundFontCache;
      try {
        soundFontCache = new SoundFontCache();
        await soundFontCache.load('/media/soundfont/A320U.sf2');
        addLog('soundfont loaded: A320U.sf2');
      } catch (err) {
        console.error('[soundfont]', err);
        addLog('soundfont failed to load — falling back to PolySynth: ' + String(err));
        soundFontCache = undefined;
      }

      // 2. The consumer owns the adapter (issue #378) — soundfont config
      //    lives here, not on <daw-editor>.
      editor.adapter = createToneAdapter({ ppqn: 960, soundFontCache });

      // 3. Load a multi-track .mid file. Each track's GM program number is
      //    extracted from the file and selects the soundfont instrument;
      //    channel 9 routes to percussion samples.
      try {
        const result = await editor.loadMidi('/media/midi/RedHotChiliPeppers-Otherside.mid');
        addLog('loaded ' + result.trackIds.length + ' track(s); bpm=' + result.bpm.toFixed(1) + ' ts=' + result.timeSignature.join('/'));
        editor.bpm = result.bpm;
        editor.timeSignature = result.timeSignature;
      } catch (err) {
        console.error('[loadMidi]', err);
        addLog('loadMidi failed: ' + String(err));
      }
    }

    start();
  </script>
</body>
</html>
```

- [ ] **Step 2: Link it from `examples/dawcore-tone/index.html`**

Add after the `midi-load` list item:

```html
    <li>
      <a href="soundfont.html">soundfont</a>
      <div class="desc">MIDI playback through SF2 SoundFont samples via <code>createToneAdapter({ soundFontCache })</code></div>
    </li>
```

- [ ] **Step 3: Manual verification**

```bash
pnpm example:dawcore-tone
```
Open the URL from the server log (usually `http://localhost:5174/`, but Vite falls back to the next free port) → `soundfont.html`. Verify:
1. Log shows `soundfont loaded: A320U.sf2` then `loaded N track(s)`.
2. Press Play — playback uses sampled instruments (piano/bass/drums timbres), NOT the synthetic PolySynth beeps heard on `midi-load.html`.
3. Piano-roll clips render and the playhead moves.
4. No console errors (DevTools).

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
pnpm lint && git add examples/dawcore-tone/soundfont.html examples/dawcore-tone/index.html
git commit -m "feat(examples): dawcore-tone soundfont MIDI playback example"
```

---

### Task 6: Documentation sync

**Files:**
- Modify: `packages/playout/CLAUDE.md` (SoundFont Playback section)
- Modify: `website/docs/react/guides/midi.md` (SoundFont Playback section, ~line 106)
- Check/modify if they mention `createToneAdapter` or soundfonts: `website/docs/api/llm-reference.md`, `website/static/llms.txt`, dawcore docs (`packages/dawcore/README.md`, `packages/dawcore/COMPONENTS.md`)

- [ ] **Step 1: Update `packages/playout/CLAUDE.md`**

In the "SoundFont Playback (SoundFontToneTrack)" section, after the "Architecture:" paragraph, add:

```markdown
**Late load / swap (`ToneAdapter.setSoundFontCache`):** `createToneAdapter` returns `ToneAdapter` (extends engine `PlayoutAdapter`) with `setSoundFontCache(cache | undefined)`. The adapter snapshots its tracks (`_currentTracks`, kept fresh by the volume/mute/solo/pan setters via immutable copies) and records what each MIDI playout track was built with (`_midiTrackBuild: Map<midiTrackId, SoundFontCache | null>`). A swap rebuilds only MIDI tracks whose *effective* routing (`cache?.isLoaded ? cache : null`) differs from their build record — NOT a reference-equality guard, because the same cache object flips `isLoaded` after a late `load()`. Audio tracks are untouched; `resumeTrackMidPlayback` handles swap-during-playback.
```

- [ ] **Step 2: Update `website/docs/react/guides/midi.md`**

In the "SoundFont Playback" section (after the existing provider example, ~line 126), add a short subsection:

```markdown
#### Loading the SoundFont late

The SoundFont decision is made per-track when tracks are set up. If the `.sf2`
file finishes downloading *after* the playlist mounted, just pass the cache to
the provider when it's ready — the provider forwards it to the live adapter,
which upgrades MIDI tracks from PolySynth to samples in place:

```tsx
const [cache, setCache] = useState<SoundFontCache | undefined>(undefined);

useEffect(() => {
  const sf = new SoundFontCache();
  sf.load('/media/soundfont/A320U.sf2').then(() => setCache(sf));
}, []);

<WaveformPlaylistProvider soundFontCache={cache} tracks={tracks} />
```

For non-React consumers (e.g. `<daw-editor>` web components), the same
capability is `adapter.setSoundFontCache(cache)` on the adapter returned by
`createToneAdapter()`.
```

- [ ] **Step 3: Grep remaining doc surfaces and update only where the API is already documented**

```bash
grep -rn "createToneAdapter\|soundFontCache\|SoundFont" website/docs/api/llm-reference.md website/static/llms.txt packages/dawcore/README.md packages/dawcore/COMPONENTS.md website/docs/framework-agnostic/ 2>/dev/null
```

- If `llm-reference.md` documents `ToneAdapterOptions` or `createToneAdapter`: add the `ToneAdapter` interface (the two-line TypeScript signature from Task 3, no prose).
- If `llms.txt` describes playout's soundfont capability: append a clause "soundfont can be provided/swapped after creation via `adapter.setSoundFontCache()`".
- If dawcore README/COMPONENTS mention MIDI playback adapters: add one sentence pointing at `createToneAdapter({ soundFontCache })` and the new example.
- If a surface doesn't mention these APIs at all, leave it alone (don't introduce new sections).

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter website build`
Expected: success (CSS calc warnings are pre-existing and harmless).

- [ ] **Step 5: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
pnpm lint && git add -A packages/playout/CLAUDE.md website/docs website/static/llms.txt packages/dawcore
git commit -m "docs: soundfont late-load API (setSoundFontCache) across doc surfaces"
```

(If Step 3 changed nothing, drop the untouched paths from `git add`.)

---

### Task 7: Final verification

- [ ] **Step 1: Full build + typecheck + lint from repo root**

```bash
pnpm build && pnpm typecheck && pnpm lint
```
Expected: all clean. (`pnpm build` also reruns each package's typecheck.)

- [ ] **Step 2: Run unit tests for touched packages**

```bash
cd packages/playout && npx vitest run && cd ../..
cd packages/browser && npx vitest run && cd ../..
pgrep -f vitest && pkill -f vitest || true
```
Expected: all pass; no orphaned vitest processes.

- [ ] **Step 3: Re-run the manual example check (Task 5 Step 3) if any source changed since**

- [ ] **Step 4: Commit any stragglers, then review the branch diff**

```bash
git status
git diff main...HEAD --stat
```

Expected files changed: spec, this plan, `TonePlayoutAdapter.ts`, `TonePlayoutAdapter.test.ts`, playout `index.ts`, playout `CLAUDE.md`, `soundFontSync.ts` (+test), `WaveformPlaylistContext.tsx`, `soundfont.html`, example `index.html`, doc files.

**Done criteria (from spec):** dawcore example plays sampled MIDI; `setSoundFontCache` upgrades/reverts/swaps with MIDI-only rebuilds; React provider handles a late `soundFontCache` prop; all tests green; docs in sync.
