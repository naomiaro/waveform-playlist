# media-element-playout player-mode ergonomics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three player-persona affordances to `@waveform-playlist/media-element-playout` — resume-in-place, in-place source swap, and a typed lifecycle event emitter — without changing any existing timeline/editor behavior.

**Architecture:** Purely additive. A new typed `on()/off()/_emit()` emitter lives on `MediaElementTrack` (copied verbatim from `PlaylistEngine`'s pattern). `MediaElementPlayout` forwards subscriptions to the current track via a small re-attach registry so listeners survive source swaps. `resume()` and `setSource()`/`load()` are thin wrappers over existing machinery. Existing `setOnXCallback` setters stay for back-compat.

**Tech Stack:** TypeScript, tsup (build), vitest (test). No new dependencies.

**Design doc:** `docs/specs/2026-06-29-media-element-player-mode-design.md` (issue #531).

## Global Constraints

- **Branch:** `feat/media-element-player-mode-ergonomics` (already checked out).
- **No mutation:** immutable patterns; new objects over in-place edits (project rule). The emitter registry mutates internal `Map`/`Set` collections, which matches `PlaylistEngine`'s own emitter — acceptable and consistent.
- **console.warn is string-only:** never pass an object to `console.warn`; concatenate with `String(x)` (project rule + this package's existing style). Do **not** copy `PlaylistEngine`'s `console.warn('msg:', error)` object-arg form.
- **Existing behavior unchanged:** `play(offset)`, `addTrack()`'s warning, and all existing tests must stay green.
- **Version:** bump `packages/media-element-playout/package.json` `12.1.0 → 12.2.0` (additive minor).
- **Build before done:** AC requires a rebuilt `dist/` (`pnpm --filter @waveform-playlist/media-element-playout build`).
- **Verify commands (from repo root):**
  - Single test: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run -t "<name>"`
  - Package tests: `pnpm --filter @waveform-playlist/media-element-playout test`
  - Package typecheck: `pnpm --filter @waveform-playlist/media-element-playout typecheck`
  - Lint (root-only): `pnpm -w lint` (require **0 errors**, exit 0)
- **Commit attribution disabled** globally — do not add `Co-Authored-By` trailers.

## File Structure

- `packages/media-element-playout/src/MediaElementTrack.ts` — add `MediaElementTrackEvents` interface, `on()/off()/_emit()`, native lifecycle event binding, `resume()`, `load()`, dispose cleanup.
- `packages/media-element-playout/src/MediaElementPlayout.ts` — add `resume()`, `setSource()`, `on()/off()` forwarder + `_eventListeners` registry + `_attachListenersToTrack()`, wire into `addTrack()`.
- `packages/media-element-playout/src/index.ts` — export `MediaElementTrackEvents` type.
- `packages/media-element-playout/__tests__/player-mode.test.ts` — **new** test file (shared `MockAudioElement` + global `Audio` injection; describe blocks added per task).
- `packages/media-element-playout/package.json` — version bump.
- `packages/media-element-playout/README.md` — document new API; fix the wrong `play(); // Resume` example.

---

## Task 1: Resume-in-place — `resume()` on track and playout

**Files:**
- Create: `packages/media-element-playout/__tests__/player-mode.test.ts`
- Modify: `packages/media-element-playout/src/MediaElementTrack.ts` (add `resume()` after `play()`, ~line 270)
- Modify: `packages/media-element-playout/src/MediaElementPlayout.ts` (add `resume()` after `play()`, ~line 134)

**Interfaces:**
- Produces:
  - `MediaElementTrack.resume(): void` — plays from the current `currentTime` without resetting it.
  - `MediaElementPlayout.resume(): void` — plays from `getCurrentTime()` without resetting position.
- Consumes: existing `MediaElementTrack.play(offset?: number): void`, `MediaElementPlayout.play(when?, offset?, duration?): void`, `MediaElementPlayout.getCurrentTime(): number`.

- [ ] **Step 1: Write the failing test** — create `packages/media-element-playout/__tests__/player-mode.test.ts` with the shared harness and the resume tests:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WaveformDataObject } from '@waveform-playlist/core';
import { MediaElementPlayout } from '../src/MediaElementPlayout';
import { MediaElementTrack } from '../src/MediaElementTrack';

/**
 * Controllable stand-in for HTMLAudioElement, built on the global `EventTarget`
 * so native media events ('play' / 'pause' / 'loadedmetadata' / 'error' /
 * 'ended' / 'timeupdate') dispatch for real with no DOM environment.
 *
 * Registering it as `globalThis.Audio` makes `new Audio(url)` (the string-source
 * construction path) return a mock, so tracks are created with `ownsElement = true`
 * — required to exercise the in-place `load()` swap.
 */
let created: MockAudioElement[] = [];

class MockAudioElement extends EventTarget {
  preload = '';
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  duration = NaN;
  preservesPitch = true;
  src: string;
  error: MediaError | null = null;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();

  constructor(src = '') {
    super();
    this.src = src;
    created.push(this);
  }
}

beforeEach(() => {
  created = [];
  (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;
});

afterEach(() => {
  delete (globalThis as unknown as { Audio?: unknown }).Audio;
});

describe('resume()', () => {
  it('resumes from the current position without resetting currentTime', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    el.currentTime = 30; // simulate having played to 30s, then paused
    playout.resume();

    expect(el.play).toHaveBeenCalled();
    expect(el.currentTime).toBe(30);
  });

  it('plain play() with no offset still resets to 0 (unchanged behavior)', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    el.currentTime = 30;
    playout.play();

    expect(el.currentTime).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run -t "resumes from the current position"`
Expected: FAIL — `playout.resume is not a function`.

- [ ] **Step 3: Add `resume()` to `MediaElementTrack`** — in `packages/media-element-playout/src/MediaElementTrack.ts`, immediately after the `play()` method (the closing brace near line 270), add:

```typescript
  /**
   * Resume playback from the current position without resetting currentTime.
   * Reuses play()'s fade re-scheduling and AudioContext-resume machinery —
   * passing the current position as the offset is a no-op seek that leaves
   * playback where it was.
   */
  resume(): void {
    this.play(this.currentTime);
  }
```

- [ ] **Step 4: Add `resume()` to `MediaElementPlayout`** — in `packages/media-element-playout/src/MediaElementPlayout.ts`, immediately after the `play()` method (closing brace near line 134), add:

```typescript
  /**
   * Resume playback from the current position (player-mode affordance).
   * Unlike play() with no offset (which resets to 0), this keeps currentTime.
   * Delegates to play() with the current position as the offset, so all of
   * play()'s machinery (AudioContext resume, fades, _isPlaying) is reused.
   */
  resume(): void {
    this.play(undefined, this.getCurrentTime());
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run player-mode`
Expected: PASS — both `resume()` tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/media-element-playout/__tests__/player-mode.test.ts packages/media-element-playout/src/MediaElementTrack.ts packages/media-element-playout/src/MediaElementPlayout.ts
git commit -m "feat(media-element-playout): add resume() for resume-in-place playback (#531)"
```

---

## Task 2: Typed lifecycle event emitter on `MediaElementTrack`

**Files:**
- Modify: `packages/media-element-playout/src/MediaElementTrack.ts` (add event-map type near top; add `_listeners` field; bind native events in constructor; add handlers; emit from existing handlers; add `on()/off()/_emit()`; clean up in `dispose()`)
- Modify: `packages/media-element-playout/__tests__/player-mode.test.ts` (append a describe block)

**Interfaces:**
- Produces:
  - `interface MediaElementTrackEvents { loadedmetadata: () => void; play: () => void; pause: () => void; error: (err: MediaError | null) => void; ended: () => void; timeupdate: (time: number) => void; }`
  - `MediaElementTrack.on<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void`
  - `MediaElementTrack.off<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void`
- Consumes: the `MockAudioElement` harness from Task 1.

- [ ] **Step 1: Write the failing test** — append to `packages/media-element-playout/__tests__/player-mode.test.ts` (imports already at the file top from Task 1):

```typescript
describe('MediaElementTrack lifecycle event emitter', () => {
  it('emits loadedmetadata / play / pause on dispatched native events', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onLoaded = vi.fn();
    const onPlay = vi.fn();
    const onPause = vi.fn();
    track.on('loadedmetadata', onLoaded);
    track.on('play', onPlay);
    track.on('pause', onPause);

    el.dispatchEvent(new Event('loadedmetadata'));
    el.dispatchEvent(new Event('play'));
    el.dispatchEvent(new Event('pause'));

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('emits error with the element MediaError', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];
    const mediaError = { code: 4, message: 'unsupported' } as unknown as MediaError;
    el.error = mediaError;

    const onError = vi.fn();
    track.on('error', onError);
    el.dispatchEvent(new Event('error'));

    expect(onError).toHaveBeenCalledWith(mediaError);
  });

  it('off() removes a listener', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPlay = vi.fn();
    track.on('play', onPlay);
    track.off('play', onPlay);
    el.dispatchEvent(new Event('play'));

    expect(onPlay).not.toHaveBeenCalled();
  });

  it('a throwing listener does not break sibling listeners', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    track.on('play', thrower);
    track.on('play', good);
    el.dispatchEvent(new Event('play'));

    expect(good).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('emits ended and timeupdate alongside the legacy callbacks', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onEnded = vi.fn();
    const onTime = vi.fn();
    const legacyStop = vi.fn();
    const legacyTime = vi.fn();
    track.on('ended', onEnded);
    track.on('timeupdate', onTime);
    track.setOnStopCallback(legacyStop);
    track.setOnTimeUpdateCallback(legacyTime);

    el.currentTime = 5;
    el.dispatchEvent(new Event('timeupdate'));
    el.dispatchEvent(new Event('ended'));

    expect(onTime).toHaveBeenCalledWith(5);
    expect(legacyTime).toHaveBeenCalledWith(5);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(legacyStop).toHaveBeenCalledTimes(1);
  });
});
```

(`MediaElementTrack` imported at the top is used directly in Task 4's borrowed-element test.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run -t "lifecycle event emitter"`
Expected: FAIL — `track.on is not a function`.

- [ ] **Step 3: Add the event-map type** — in `packages/media-element-playout/src/MediaElementTrack.ts`, after the `MediaElementTrackOptions` interface (near line 48, before the class doc comment), add:

```typescript
/**
 * Typed event map for MediaElementTrack's emitter. Mirrors the on()/off()
 * pattern used by @waveform-playlist/engine's PlaylistEngine so consumers and
 * the dawcore web-components layer can wire events uniformly across engines.
 */
export interface MediaElementTrackEvents {
  /** Fired when the element's metadata (duration, dimensions) has loaded. */
  loadedmetadata: () => void;
  /** Fired when native playback starts/resumes. */
  play: () => void;
  /** Fired when native playback pauses (including at end-of-media). */
  pause: () => void;
  /** Fired on a media error; carries the element's MediaError (or null). */
  error: (err: MediaError | null) => void;
  /** Fired when playback reaches the end of the media. */
  ended: () => void;
  /** Fired on each native timeupdate; carries the current time in seconds. */
  timeupdate: (time: number) => void;
}
```

- [ ] **Step 4: Add the `_listeners` field** — in the class field declarations (after `private onTimeUpdateCallback?: ...;` near line 72), add (same `Set<Function>` shape as `PlaylistEngine`, which is lint-clean on `main`):

```typescript
  private _listeners: Map<string, Set<Function>> = new Map();
```

- [ ] **Step 5: Bind the new native events in the constructor** — find the existing event-listener setup (near line 149):

```typescript
    // Set up event listeners
    this.audioElement.addEventListener('ended', this.handleEnded);
    this.audioElement.addEventListener('timeupdate', this.handleTimeUpdate);
```

Replace it with:

```typescript
    // Set up event listeners
    this.audioElement.addEventListener('ended', this.handleEnded);
    this.audioElement.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audioElement.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audioElement.addEventListener('play', this.handlePlay);
    this.audioElement.addEventListener('pause', this.handlePause);
    this.audioElement.addEventListener('error', this.handleError);
```

- [ ] **Step 6: Emit from the existing handlers + add the new handlers** — replace the existing `handleEnded` / `handleTimeUpdate` (near lines 153–164):

```typescript
  private handleEnded = () => {
    this._cancelFades();
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  };

  private handleTimeUpdate = () => {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.audioElement.currentTime);
    }
  };
```

with:

```typescript
  private handleEnded = () => {
    this._cancelFades();
    if (this.onStopCallback) {
      this.onStopCallback();
    }
    this._emit('ended');
  };

  private handleTimeUpdate = () => {
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.audioElement.currentTime);
    }
    this._emit('timeupdate', this.audioElement.currentTime);
  };

  private handleLoadedMetadata = () => {
    this._emit('loadedmetadata');
  };

  private handlePlay = () => {
    this._emit('play');
  };

  private handlePause = () => {
    this._emit('pause');
  };

  private handleError = () => {
    this._emit('error', this.audioElement.error);
  };
```

- [ ] **Step 7: Add `on()/off()/_emit()`** — add these methods just before the `dispose()` method (near line 396). Note `_emit` uses string concatenation for `console.warn` (project rule), unlike `PlaylistEngine`:

```typescript
  /**
   * Subscribe to a track lifecycle event. Multiple listeners per event are
   * supported. Mirrors PlaylistEngine's on()/off() emitter.
   */
  on<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  /**
   * Unsubscribe a previously registered listener.
   */
  off<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void {
    this._listeners.get(event)?.delete(listener);
  }

  private _emit(event: string, ...args: unknown[]): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.warn(
            '[waveform-playlist] MediaElementTrack: error in event listener: ' + String(error)
          );
        }
      }
    }
  }
```

- [ ] **Step 8: Clean up in `dispose()`** — find the listener-removal block at the top of `dispose()` (near line 397):

```typescript
    this.audioElement.removeEventListener('ended', this.handleEnded);
    this.audioElement.removeEventListener('timeupdate', this.handleTimeUpdate);
    this._cancelFades();
```

Replace with:

```typescript
    this.audioElement.removeEventListener('ended', this.handleEnded);
    this.audioElement.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.audioElement.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audioElement.removeEventListener('play', this.handlePlay);
    this.audioElement.removeEventListener('pause', this.handlePause);
    this.audioElement.removeEventListener('error', this.handleError);
    this._listeners.clear();
    this._cancelFades();
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run player-mode`
Expected: PASS — all Task 1 + Task 2 tests green.

- [ ] **Step 10: Commit**

```bash
git add packages/media-element-playout/src/MediaElementTrack.ts packages/media-element-playout/__tests__/player-mode.test.ts
git commit -m "feat(media-element-playout): add typed lifecycle event emitter to MediaElementTrack (#531)"
```

---

## Task 3: Playout-level event forwarding with re-attach registry

**Files:**
- Modify: `packages/media-element-playout/src/MediaElementPlayout.ts` (import the event-map type; add `_eventListeners` registry; add `on()/off()/_attachListenersToTrack()`; call `_attachListenersToTrack()` in `addTrack()`; clear registry in `dispose()`)
- Modify: `packages/media-element-playout/__tests__/player-mode.test.ts` (append a describe block)

**Interfaces:**
- Produces:
  - `MediaElementPlayout.on<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void`
  - `MediaElementPlayout.off<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void`
  - private `MediaElementPlayout._attachListenersToTrack(): void` (re-attaches all registered listeners to `this.track`)
- Consumes: `MediaElementTrack.on/off` and `MediaElementTrackEvents` from Task 2.

- [ ] **Step 1: Write the failing test** — append to `packages/media-element-playout/__tests__/player-mode.test.ts`:

```typescript
describe('MediaElementPlayout event forwarding', () => {
  it('forwards play events from the current track', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPlay = vi.fn();
    playout.on('play', onPlay);
    el.dispatchEvent(new Event('play'));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('listeners registered before any track re-attach to the first track', () => {
    const playout = new MediaElementPlayout();
    const onLoaded = vi.fn();
    playout.on('loadedmetadata', onLoaded); // no track yet

    playout.addTrack({ source: 'a.mp3' });
    created[0].dispatchEvent(new Event('loadedmetadata'));

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('off() stops forwarding', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPause = vi.fn();
    playout.on('pause', onPause);
    playout.off('pause', onPause);
    el.dispatchEvent(new Event('pause'));

    expect(onPause).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run -t "event forwarding"`
Expected: FAIL — `playout.on is not a function`.

- [ ] **Step 3: Import the event-map type** — in `packages/media-element-playout/src/MediaElementPlayout.ts`, change the top import (line 1):

```typescript
import { MediaElementTrack, type MediaElementTrackOptions } from './MediaElementTrack';
```

to:

```typescript
import {
  MediaElementTrack,
  type MediaElementTrackOptions,
  type MediaElementTrackEvents,
} from './MediaElementTrack';
```

- [ ] **Step 4: Add the registry field** — after `private onPlaybackCompleteCallback?: () => void;` (near line 36), add:

```typescript
  /** Consumer event listeners, retained so they re-attach across track swaps. */
  private _eventListeners: Map<string, Set<Function>> = new Map();
```

- [ ] **Step 5: Re-attach listeners when a track is created** — at the end of `addTrack()`, find the `return this.track;` (near line 82) and insert the attach call before it:

```typescript
    // Re-attach any consumer listeners to the newly created track (covers the
    // first track and the addTrack-replace path).
    this._attachListenersToTrack();

    return this.track;
```

- [ ] **Step 6: Add `on()/off()/_attachListenersToTrack()`** — add these methods after `setOnPlaybackComplete()` (near line 219):

```typescript
  /**
   * Subscribe to a lifecycle event (loadedmetadata / play / pause / error /
   * ended / timeupdate) without reaching into track.element. Listeners are
   * retained and re-attached automatically when the source is swapped.
   */
  on<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(listener);
    this.track?.on(event, listener);
  }

  /**
   * Unsubscribe a previously registered lifecycle listener.
   */
  off<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void {
    this._eventListeners.get(event)?.delete(listener);
    this.track?.off(event, listener);
  }

  /**
   * Attach every registered listener to the current track. Called after a new
   * track is created so subscriptions survive source swaps. The cast is safe:
   * the event→listener correlation was enforced by the typed on() that filled
   * the registry; TS cannot track it through this loop.
   */
  private _attachListenersToTrack(): void {
    const track = this.track;
    if (!track) return;
    for (const [event, listeners] of this._eventListeners) {
      for (const listener of listeners) {
        track.on(
          event as keyof MediaElementTrackEvents,
          listener as MediaElementTrackEvents[keyof MediaElementTrackEvents]
        );
      }
    }
  }
```

- [ ] **Step 7: Clear the registry in `dispose()`** — find `dispose()` (near line 224):

```typescript
  dispose(): void {
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
  }
```

Replace with:

```typescript
  dispose(): void {
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
    this._eventListeners.clear();
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run player-mode`
Expected: PASS — Task 1–3 tests green.

- [ ] **Step 9: Commit**

```bash
git add packages/media-element-playout/src/MediaElementPlayout.ts packages/media-element-playout/__tests__/player-mode.test.ts
git commit -m "feat(media-element-playout): forward lifecycle events from playout across source swaps (#531)"
```

---

## Task 4: In-place source swap — `track.load()` and `playout.setSource()`

**Files:**
- Modify: `packages/media-element-playout/src/MediaElementTrack.ts` (add `load()`)
- Modify: `packages/media-element-playout/src/MediaElementPlayout.ts` (add `setSource()`)
- Modify: `packages/media-element-playout/__tests__/player-mode.test.ts` (append a describe block)

**Interfaces:**
- Produces:
  - `MediaElementTrack.load(source: string, opts?: { peaks?: WaveformDataObject; name?: string }): void` — in-place `.src` swap (owns-element only).
  - `MediaElementPlayout.setSource(options: MediaElementTrackOptions): MediaElementTrack` — silent replace; in-place for string sources, recreate for element sources or first source.
- Consumes: existing `MediaElementTrack` private fields (`ownsElement`, `_peaks`, `_name`, `_cancelFades`), `WaveformDataObject` from `@waveform-playlist/core`, `addTrack()` + `_attachListenersToTrack()` from Task 3.

- [ ] **Step 1: Write the failing test** — append to `packages/media-element-playout/__tests__/player-mode.test.ts` (imports already at the file top from Task 1):

```typescript
function makePeaks(overrides: Partial<WaveformDataObject> = {}): WaveformDataObject {
  return { sample_rate: 44100, duration: 0, ...overrides } as WaveformDataObject;
}

describe('setSource() / in-place source swap', () => {
  it('replaces the source in place without warning and reuses the same element', () => {
    const playout = new MediaElementPlayout();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = playout.setSource({ source: 'a.mp3' });
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('a.mp3');

    const second = playout.setSource({ source: 'b.mp3' });

    expect(second).toBe(first); // same track instance — in-place reuse
    expect(created).toHaveLength(1); // no new element created
    expect(created[0].src).toBe('b.mp3'); // src swapped
    expect(created[0].load).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('updates peaks (replace) and name (when provided) on swap', () => {
    const playout = new MediaElementPlayout();
    const track = playout.setSource({ source: 'a.mp3', peaks: makePeaks({ duration: 10 }) });

    playout.setSource({ source: 'b.mp3', name: 'Show 2' });
    expect(track.peaks).toBeNull(); // peaks not provided for b.mp3 → cleared
    expect(track.name).toBe('Show 2');
  });

  it('keeps consumer listeners working across an in-place swap', () => {
    const playout = new MediaElementPlayout();
    const onLoaded = vi.fn();
    playout.on('loadedmetadata', onLoaded);

    playout.setSource({ source: 'a.mp3' });
    created[0].dispatchEvent(new Event('loadedmetadata'));
    playout.setSource({ source: 'b.mp3' }); // in-place, same element
    created[0].dispatchEvent(new Event('loadedmetadata'));

    expect(onLoaded).toHaveBeenCalledTimes(2);
  });

  it('addTrack() still warns when replacing an existing track', () => {
    const playout = new MediaElementPlayout();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    playout.addTrack({ source: 'a.mp3' });
    playout.addTrack({ source: 'b.mp3' }); // replace via addTrack → warns

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Only one track is supported')
    );
    warnSpy.mockRestore();
  });

  it('track.load() warns and no-ops for a borrowed element', () => {
    const borrowed = new MockAudioElement('borrowed.mp3');
    const track = new MediaElementTrack({ source: borrowed as unknown as HTMLAudioElement });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    track.load('new.mp3');

    expect(borrowed.src).toBe('borrowed.mp3'); // unchanged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('own their audio element'));
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run -t "in-place source swap"`
Expected: FAIL — `playout.setSource is not a function`.

- [ ] **Step 3: Add `load()` to `MediaElementTrack`** — in `packages/media-element-playout/src/MediaElementTrack.ts`, add this method right after `resume()` (added in Task 1):

```typescript
  /**
   * Swap the audio source in place, reusing the existing <audio> element.
   * Because the MediaElementAudioSourceNode is once-per-element, reusing the
   * element preserves any Web Audio routing/effects across the swap.
   *
   * Only supported when this track owns its element (constructed from a URL
   * string). A borrowed element (constructed from an HTMLAudioElement) warns
   * and no-ops — swapping a consumer-owned element's src is out of contract.
   *
   * Peaks are coupled to the specific audio, so they are replaced (defaulting
   * to null when omitted). Name is a label, so it updates only when provided.
   */
  load(source: string, opts: { peaks?: WaveformDataObject; name?: string } = {}): void {
    if (!this.ownsElement) {
      console.warn(
        '[waveform-playlist] MediaElementTrack: load() is only supported for tracks that ' +
          'own their audio element (constructed from a URL string). A track constructed from ' +
          'an existing HTMLAudioElement cannot swap its source in place.'
      );
      return;
    }
    this._cancelFades();
    this.audioElement.pause();
    this.audioElement.src = source;
    this.audioElement.load();
    this.audioElement.currentTime = 0;
    this._peaks = opts.peaks ?? null;
    if (opts.name !== undefined) {
      this._name = opts.name;
    }
  }
```

- [ ] **Step 4: Add `setSource()` to `MediaElementPlayout`** — in `packages/media-element-playout/src/MediaElementPlayout.ts`, add this method right after `addTrack()` (near line 84, before `removeTrack()`):

```typescript
  /**
   * Replace the playout's source (player-mode affordance). The documented
   * single-track replace path — does NOT warn like addTrack().
   *
   * For URL (string) sources with an existing track, swaps in place via
   * track.load(), reusing the element and preserving Web Audio routing. For a
   * provided HTMLAudioElement source, or when there is no track yet, (re)creates
   * the track. Returns the active track.
   */
  setSource(options: MediaElementTrackOptions): MediaElementTrack {
    if (this.track && typeof options.source === 'string') {
      this.track.load(options.source, { peaks: options.peaks, name: options.name });
      return this.track;
    }
    // First source, or swapping to a provided element: (re)create the track.
    // Dispose silently — this is the documented single-track replace path, not
    // the multi-track misuse that addTrack() warns about.
    if (this.track) {
      this.track.dispose();
      this.track = null;
    }
    return this.addTrack(options);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @waveform-playlist/media-element-playout exec vitest run player-mode`
Expected: PASS — Task 1–4 tests green.

- [ ] **Step 6: Run the full package test suite (existing tests stay green)**

Run: `pnpm --filter @waveform-playlist/media-element-playout test`
Expected: PASS — `player-mode.test.ts` and `peaks-optional.test.ts` all green.

- [ ] **Step 7: Commit**

```bash
git add packages/media-element-playout/src/MediaElementTrack.ts packages/media-element-playout/src/MediaElementPlayout.ts packages/media-element-playout/__tests__/player-mode.test.ts
git commit -m "feat(media-element-playout): add in-place setSource()/load() source swap (#531)"
```

---

## Task 5: Exports, docs, version bump, build, and final verification

**Files:**
- Modify: `packages/media-element-playout/src/index.ts` (export `MediaElementTrackEvents`)
- Modify: `packages/media-element-playout/README.md` (document new API; fix wrong resume example)
- Modify: `packages/media-element-playout/package.json` (version `12.1.0 → 12.2.0`)

**Interfaces:**
- Consumes: `MediaElementTrackEvents` (Task 2), `resume()`/`setSource()` (Tasks 1, 4).
- Produces: a published-shaped package — public type export, accurate README, bumped version, rebuilt `dist/`.

- [ ] **Step 1: Export the event-map type** — in `packages/media-element-playout/src/index.ts`, change:

```typescript
export type { MediaElementTrackOptions, FadeConfig } from './MediaElementTrack';
```

to:

```typescript
export type {
  MediaElementTrackOptions,
  MediaElementTrackEvents,
  FadeConfig,
} from './MediaElementTrack';
```

- [ ] **Step 2: Typecheck the package**

Run: `pnpm --filter @waveform-playlist/media-element-playout typecheck`
Expected: PASS — no type errors (verifies the `_attachListenersToTrack` cast compiles).

- [ ] **Step 3: Update the README usage example** — in `packages/media-element-playout/README.md`, replace the playback-control block (lines 54–59):

```typescript
// Control playback
playout.play(0);           // Play from beginning
playout.setPlaybackRate(0.75);  // Slow down to 75% speed (pitch preserved)
playout.pause();
playout.seekTo(30);        // Seek to 30 seconds
playout.play();            // Resume
```

with:

```typescript
// Control playback
playout.play(0);           // Play from beginning
playout.setPlaybackRate(0.75);  // Slow down to 75% speed (pitch preserved)
playout.pause();
playout.seekTo(30);        // Seek to 30 seconds
playout.resume();          // Resume from the current position (does NOT reset to 0)
```

- [ ] **Step 4: Add a player-mode README section** — in `packages/media-element-playout/README.md`, insert this section immediately before `## Generating Peaks` (line 116):

````markdown
## Player Mode

Beyond the timeline/editor API, three affordances make this engine pleasant to
reuse as a single-track **player** (podcast/audiobook players, `<daw-player>`):

```typescript
// Resume from the current position (play() with no offset resets to 0)
playout.resume();

// Swap to the next source in place — no "Only one track is supported" warning,
// and any Web Audio routing/effects are preserved across the swap
playout.setSource({ source: '/audio/episode-2.mp3', name: 'Episode 2' });

// Observe media lifecycle without reaching into the audio element
playout.on('loadedmetadata', () => console.log('duration:', playout.duration));
playout.on('play', () => updateTransportUI('playing'));
playout.on('pause', () => updateTransportUI('paused'));
playout.on('error', (err) => surfaceError(err));
playout.off('play', handler); // unsubscribe
```

`on()` listeners are retained across `setSource()` swaps — register them once.
The same `on()/off()` and `resume()`/`load()` methods exist on `MediaElementTrack`
for power users. Event names and payloads are typed via `MediaElementTrackEvents`.
````

- [ ] **Step 5: Document the new methods in the API reference** — in `packages/media-element-playout/README.md`, in the `class MediaElementPlayout` block, after the `play(...)` line (line 86), add `resume()` and `setSource()` plus the events. Replace the `// Playback` and `// Track management` sections so the class block reads:

```typescript
  // Track management
  addTrack(options: MediaElementTrackOptions): MediaElementTrack;
  setSource(options: MediaElementTrackOptions): MediaElementTrack;  // silent in-place replace
  removeTrack(trackId: string): void;
  getTrack(trackId: string): MediaElementTrack | undefined;

  // Playback
  play(when?: number, offset?: number, duration?: number): void;
  resume(): void;            // resume from current position (no reset to 0)
  pause(): void;
  stop(): void;
  seekTo(time: number): void;
  getCurrentTime(): number;

  // Lifecycle events (typed via MediaElementTrackEvents)
  on<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void;
  off<K extends keyof MediaElementTrackEvents>(event: K, listener: MediaElementTrackEvents[K]): void;
```

- [ ] **Step 6: Bump the package version** — in `packages/media-element-playout/package.json`, change `"version": "12.1.0"` to `"version": "12.2.0"`.

- [ ] **Step 7: Build the package**

Run: `pnpm --filter @waveform-playlist/media-element-playout build`
Expected: PASS — tsup emits ESM + CJS + DTS into `dist/`; `dist/index.d.ts` includes `MediaElementTrackEvents`.

- [ ] **Step 8: Run lint (root-only) and the package tests**

Run: `pnpm -w lint`
Expected: `✖ 0 errors` / exit 0 (pre-existing `no-explicit-any` *warnings* are fine — require 0 errors).

Run: `pnpm --filter @waveform-playlist/media-element-playout test`
Expected: PASS — all tests green.

- [ ] **Step 9: Commit**

```bash
git add packages/media-element-playout/src/index.ts packages/media-element-playout/README.md packages/media-element-playout/package.json packages/media-element-playout/dist
git commit -m "feat(media-element-playout): export event types, document player mode, bump to 12.2.0 (#531)"
```

---

## Final Self-Review Checklist (run after all tasks)

- [ ] Every acceptance criterion in the design doc maps to a task:
  - resume-in-place → Task 1
  - silent source replace → Task 4 (`setSource`); `addTrack` warning kept → Task 4 test
  - lifecycle observable without `track.element` → Tasks 2 (track) + 3 (playout)
  - existing consumers unchanged / existing tests pass → Task 4 Step 6 + Task 5 Step 8
  - covered by tests; `dist/` rebuilt → all tasks + Task 5 Step 7
  - README documents new API → Task 5
  - version `12.2.0` → Task 5 Step 6
- [ ] `pnpm -w lint` → 0 errors.
- [ ] `pnpm --filter @waveform-playlist/media-element-playout typecheck` → clean.
- [ ] `pnpm --filter @waveform-playlist/media-element-playout test` → green.

## Post-merge follow-ups (NOT part of this plan)

- Per project convention, `git rm` the design doc (`docs/specs/2026-06-29-media-element-player-mode-design.md`) and this plan before the PR merges — the PR description is the durable record.
- Range-support (206-vs-200) detection is deferred to #454.
