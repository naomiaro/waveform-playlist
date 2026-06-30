# `<daw-player>` Core Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `<daw-player>` Web Component — a lightweight single-track `HTMLMediaElement` player with waveform, transport methods, and events — to `@dawcore/components`.

**Architecture:** A Lit element (`DawPlayerElement`) wraps a `MediaElementPlayout` engine (Approach A, from `@waveform-playlist/media-element-playout`) for playback, and composes the existing `<daw-ruler>` / `<daw-waveform>` / `<daw-playhead>` elements for visuals. Peaks come from a pre-computed `peaks-src` only (scrubber-only fallback when absent); the waveform is fit-to-width with no scroll. No PlaylistEngine, no PlayoutAdapter, no AudioContext.

**Tech Stack:** Lit 3, TypeScript, `@waveform-playlist/media-element-playout`, `waveform-data`, vitest + happy-dom.

**Design doc:** `docs/specs/2026-06-29-daw-player-core-design.md`.

## Global Constraints

- **Branch:** all work on `feat/daw-player-core` (already created). Never commit to `main`.
- **Commit messages:** `<type>: <description>` (feat/fix/docs/test/chore). No `Co-Authored-By` (attribution disabled globally).
- **Immutability:** never mutate arrays/objects in place — build new `Peaks` arrays and fresh event-detail objects.
- **No `console.log`** in production code; `console.warn` is the project's user-facing warning channel (string concatenation only — never pass objects to `console.*`).
- **Boolean props default to `false`** (`timescale`, `mono`) so JSX/HTML shorthand enables them.
- **Validated numeric properties** that feed render math or have a constrained range use the dawcore `@property({ noAccessor: true })` + custom getter/setter pattern (`playback-rate`, clamped `0.25–4.0`).
- **Events** are dispatched as `new CustomEvent<Detail>(name, { bubbles: true, composed: true, detail })` and typed in `src/events.ts` `DawEventMap`.
- **Lint/typecheck before commit:** `pnpm -w lint` (require 0 errors) and `pnpm --filter <pkg> typecheck`. The repo-wide `pnpm typecheck` has a known pre-existing failure in `dawcore-midi` — verify touched packages individually.
- **Build order:** after changing `media-element-playout` source, run `pnpm --filter @waveform-playlist/media-element-playout build` before dawcore typecheck/tests (downstream resolves it via `dist/`).

---

### Task 1: Widen `media-element-playout` playback-rate clamp to 0.25–4.0

**Files:**
- Modify: `packages/media-element-playout/src/MediaElementTrack.ts` (`setPlaybackRate`, line ~397-404; doc comments lines ~28-29)
- Modify: `packages/media-element-playout/src/MediaElementPlayout.ts` (`setPlaybackRate`, line ~234-242; doc comment line ~10-11)
- Modify: `packages/media-element-playout/package.json` (version bump)
- Test: `packages/media-element-playout/__tests__/MediaElementTrack.test.ts` (add cases; create test if the exact file differs — check `__tests__/` for the existing track test)

**Interfaces:**
- Consumes: nothing.
- Produces: `MediaElementTrack.setPlaybackRate(rate)` and `MediaElementPlayout.setPlaybackRate(rate)` now clamp to `[0.25, 4.0]`. The dawcore element (Task 3) relies on this wider range.

- [ ] **Step 1: Find the existing track test file**

Run: `ls packages/media-element-playout/__tests__/`
Note the file that tests `MediaElementTrack` (e.g. `MediaElementTrack.test.ts`). Use it below.

- [ ] **Step 2: Write failing tests for the wider clamp**

Add to the track test file (inside a `describe('setPlaybackRate', ...)`, creating it if needed). These use the existing `MockAudioElement` test harness already registered as `globalThis.Audio` in that file:

```typescript
it('allows rates down to 0.25', () => {
  const track = new MediaElementTrack({ source: 'test.mp3' });
  track.setPlaybackRate(0.25);
  expect(track.playbackRate).toBe(0.25);
});

it('allows rates up to 4.0', () => {
  const track = new MediaElementTrack({ source: 'test.mp3' });
  track.setPlaybackRate(4.0);
  expect(track.playbackRate).toBe(4.0);
});

it('clamps below 0.25 up to 0.25 and above 4.0 down to 4.0', () => {
  const track = new MediaElementTrack({ source: 'test.mp3' });
  track.setPlaybackRate(0.1);
  expect(track.playbackRate).toBe(0.25);
  track.setPlaybackRate(8);
  expect(track.playbackRate).toBe(4.0);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @waveform-playlist/media-element-playout test`
Expected: FAIL — `0.25` cases receive `0.5`, `4.0` cases receive `2.0` (current clamp).

- [ ] **Step 4: Widen the clamp in `MediaElementTrack.setPlaybackRate`**

Replace the body of `setPlaybackRate` (lines ~400-404):

```typescript
  /**
   * Set playback rate (0.25 to 4.0, pitch preserved)
   */
  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.25, Math.min(4.0, rate));
    this._playbackRate = clampedRate;
    this.audioElement.playbackRate = clampedRate;
  }
```

Also update the `MediaElementTrackOptions.playbackRate` doc comment (line ~28) from `0.5 to 2.0` to `0.25 to 4.0`.

- [ ] **Step 5: Widen the clamp in `MediaElementPlayout.setPlaybackRate`**

Replace the body (lines ~237-242):

```typescript
  /**
   * Set playback rate (0.25 to 4.0, pitch preserved).
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.25, Math.min(4.0, rate));
    if (this.track) {
      this.track.setPlaybackRate(this._playbackRate);
    }
  }
```

Also update the `MediaElementPlayoutOptions.playbackRate` doc comment (line ~10) from `0.5 to 2.0` to `0.25 to 4.0`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @waveform-playlist/media-element-playout test`
Expected: PASS (all, including the three new cases).

- [ ] **Step 7: Bump the version and rebuild**

In `packages/media-element-playout/package.json`, bump the `version` minor (e.g. `12.1.0` → `12.2.0`).
Run: `pnpm --filter @waveform-playlist/media-element-playout build`
Expected: builds to `dist/` with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/media-element-playout/
git commit -m "feat(media-element-playout): widen playbackRate clamp to 0.25-4.0"
```

---

### Task 2: Scaffold the `<daw-player>` element (attributes, registration, event map, barrel)

**Files:**
- Create: `packages/dawcore/src/elements/daw-player.ts`
- Modify: `packages/dawcore/src/events.ts` (add two map entries)
- Modify: `packages/dawcore/src/index.ts` (import + export)
- Modify: `packages/dawcore/package.json` (add dependency)
- Test: `packages/dawcore/src/__tests__/daw-player.test.ts`

**Interfaces:**
- Consumes: `MediaElementPlayout` (Task 1).
- Produces: `DawPlayerElement` registered as `<daw-player>` with attributes `src`, `peaks-src`, `wave-height`, `timescale`, `mono`, `bar-width`, `bar-gap`, `playback-rate`. Properties added in later tasks. The `playbackRate` getter/setter (clamped `0.25–4.0`) exists now.

- [ ] **Step 1: Add the dependency**

In `packages/dawcore/package.json`, add to `dependencies` (keep alphabetical):

```json
"@waveform-playlist/media-element-playout": "workspace:*",
```

Run: `pnpm install`
Expected: links the workspace package; updates `pnpm-lock.yaml`.

- [ ] **Step 2: Add `daw-ready` and `daw-ended` to the event map**

In `packages/dawcore/src/events.ts`, inside `interface DawEventMap`, add next to `daw-stop` (line ~206):

```typescript
  'daw-ready': CustomEvent<void>;
  'daw-ended': CustomEvent<void>;
```

- [ ] **Step 3: Write the failing test (registration + attributes + clamp)**

Create `packages/dawcore/src/__tests__/daw-player.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type { DawPlayerElement } from '../elements/daw-player';

beforeAll(async () => {
  await import('../elements/daw-player');
});

function makePlayer(): DawPlayerElement {
  const el = document.createElement('daw-player') as DawPlayerElement;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.querySelectorAll('daw-player').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('DawPlayerElement — scaffold', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-player')).toBeDefined();
  });

  it('uses Shadow DOM', async () => {
    const el = makePlayer();
    await el.updateComplete;
    expect(el.shadowRoot).toBeTruthy();
  });

  it('defaults: waveHeight 128, timescale false, mono false, barWidth 1, barGap 0, rate 1', () => {
    const el = makePlayer();
    expect(el.waveHeight).toBe(128);
    expect(el.timescale).toBe(false);
    expect(el.mono).toBe(false);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.playbackRate).toBe(1);
  });

  it('reads attributes into properties', async () => {
    const el = makePlayer();
    el.setAttribute('wave-height', '64');
    el.setAttribute('timescale', '');
    el.setAttribute('bar-width', '2');
    await el.updateComplete;
    expect(el.waveHeight).toBe(64);
    expect(el.timescale).toBe(true);
    expect(el.barWidth).toBe(2);
  });

  it('clamps playback-rate into 0.25–4.0 with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makePlayer();
    el.playbackRate = 8;
    expect(el.playbackRate).toBe(4.0);
    el.playbackRate = 0.1;
    expect(el.playbackRate).toBe(0.25);
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: FAIL — cannot resolve `../elements/daw-player`.

- [ ] **Step 5: Create the element scaffold**

Create `packages/dawcore/src/elements/daw-player.ts`:

```typescript
import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

// Side-effect imports register the child custom elements used in the template.
import './daw-waveform';
import './daw-playhead';
import './daw-ruler';

const MIN_RATE = 0.25;
const MAX_RATE = 4.0;

/**
 * `<daw-player>` — lightweight single-track HTMLMediaElement player.
 * Wraps a MediaElementPlayout engine for playback and composes
 * <daw-ruler>/<daw-waveform>/<daw-playhead> for visuals. No PlaylistEngine,
 * no adapter, no AudioContext. See docs/specs/2026-06-29-daw-player-core-design.md.
 */
@customElement('daw-player')
export class DawPlayerElement extends LitElement {
  @property({ type: String }) src = '';
  @property({ type: String, attribute: 'peaks-src' }) peaksSrc = '';
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;

  @property({ type: Number, attribute: 'playback-rate', noAccessor: true })
  get playbackRate(): number {
    return this._playbackRate;
  }
  set playbackRate(value: number) {
    const valid = Number.isFinite(value);
    if (!valid || value < MIN_RATE || value > MAX_RATE) {
      console.warn(
        '[dawcore] <daw-player> playback-rate ' +
          value +
          ' out of range ' +
          MIN_RATE +
          '–' +
          MAX_RATE +
          ' — clamping'
      );
    }
    const clamped = Math.max(MIN_RATE, Math.min(MAX_RATE, valid ? value : 1));
    const old = this._playbackRate;
    this._playbackRate = clamped;
    this.requestUpdate('playbackRate', old);
  }
  private _playbackRate = 1;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-background, #1a1a2e);
    }
    .waveform-area {
      position: relative;
      width: 100%;
      overflow: hidden;
    }
  `;

  render() {
    return html`
      ${this.timescale ? html`<daw-ruler></daw-ruler>` : null}
      <div class="waveform-area">
        <daw-playhead></daw-playhead>
      </div>
    `;
  }

  protected updated(_changed: PropertyValues): void {
    // Wiring added in later tasks.
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-player': DawPlayerElement;
  }
}
```

- [ ] **Step 6: Register + export from the barrel**

In `packages/dawcore/src/index.ts`, add the side-effect import next to the others (line ~19):

```typescript
import './elements/daw-player';
```

and the class export next to the others (line ~41):

```typescript
export { DawPlayerElement } from './elements/daw-player';
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm --filter @dawcore/components typecheck && pnpm -w lint`
Expected: typecheck clean for dawcore; lint summary `0 errors`.

- [ ] **Step 9: Commit**

```bash
git add packages/dawcore/src/elements/daw-player.ts packages/dawcore/src/events.ts packages/dawcore/src/index.ts packages/dawcore/package.json pnpm-lock.yaml packages/dawcore/src/__tests__/daw-player.test.ts
git commit -m "feat(dawcore): scaffold <daw-player> element (#473)"
```

---

### Task 3: Wire `MediaElementPlayout` — load src, transport methods, properties

**Files:**
- Modify: `packages/dawcore/src/elements/daw-player.ts`
- Test: `packages/dawcore/src/__tests__/daw-player.test.ts`

**Interfaces:**
- Consumes: `MediaElementPlayout` — `new MediaElementPlayout({ playbackRate })`, `setSource({ source })`, `getTrack(id)`, `play(_when?, offset?)`, `pause()`, `stop()`, `seekTo(time)`, `setMasterVolume(v)`, `setPlaybackRate(r)`, `getCurrentTime()`, getters `isPlaying`/`duration`/`masterVolume`, `dispose()`. `MediaElementTrack.element` getter for `audioElement`.
- Produces: methods `play()`, `pause()`, `stop()`, `seekTo(time)`, `setVolume(v)`, `setPlaybackRate(r)`; properties `isPlaying` (ro), `currentTime` (rw), `duration` (ro), `volume` (rw), `audioElement` (ro). The engine loads a track whenever `src` is non-empty.

- [ ] **Step 1: Write the failing tests (mock Audio + transport forwarding)**

Add to `daw-player.test.ts`. The mock mirrors `media-element-playout`'s test harness — a minimal `EventTarget` with the media properties the engine touches:

```typescript
class MockAudio extends EventTarget {
  currentTime = 0;
  duration = 120;
  paused = true;
  ended = false;
  playbackRate = 1;
  volume = 1;
  muted = false;
  preservesPitch = true;
  preload = '';
  src = '';
  constructor(source?: string) {
    super();
    if (source) this.src = source;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.playbackRate = 1; // model the HTML load-algorithm reset
  }
}

describe('DawPlayerElement — playback wiring', () => {
  let OriginalAudio: typeof Audio;
  beforeAll(() => {
    OriginalAudio = globalThis.Audio;
    // @ts-expect-error test double
    globalThis.Audio = MockAudio;
  });

  function loaded(): DawPlayerElement {
    const el = makePlayer();
    el.src = 'episode.mp3';
    return el;
  }

  it('exposes the underlying audio element after src is set', async () => {
    const el = loaded();
    await el.updateComplete;
    expect(el.audioElement).toBeInstanceOf(MockAudio);
  });

  it('play()/pause()/stop() drive the engine', async () => {
    const el = loaded();
    await el.updateComplete;
    el.play();
    expect(el.isPlaying).toBe(true);
    el.pause();
    expect(el.isPlaying).toBe(false);
    el.stop();
    expect(el.audioElement!.currentTime).toBe(0);
  });

  it('seekTo() and currentTime setter move the element', async () => {
    const el = loaded();
    await el.updateComplete;
    el.seekTo(30);
    expect(el.audioElement!.currentTime).toBe(30);
    el.currentTime = 45;
    expect(el.audioElement!.currentTime).toBe(45);
  });

  it('setVolume clamps and reads back via volume', async () => {
    const el = loaded();
    await el.updateComplete;
    el.setVolume(0.5);
    expect(el.volume).toBe(0.5);
    el.setVolume(2);
    expect(el.volume).toBe(1);
  });

  it('duration reads from the engine', async () => {
    const el = loaded();
    await el.updateComplete;
    expect(el.duration).toBe(120);
  });

  it('changing src swaps the source in place', async () => {
    const el = loaded();
    await el.updateComplete;
    const first = el.audioElement;
    el.src = 'episode-2.mp3';
    await el.updateComplete;
    // in-place load() reuses the same element instance
    expect(el.audioElement).toBe(first);
    expect(el.audioElement!.src).toContain('episode-2.mp3');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: FAIL — `audioElement`, `play`, `isPlaying`, etc. are undefined.

- [ ] **Step 3: Add the engine, load logic, methods, and properties**

In `daw-player.ts`, add the import at the top:

```typescript
import { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
```

Add the engine field near `_playbackRate`:

```typescript
  private _engine: MediaElementPlayout = new MediaElementPlayout();
  private _trackId: string | null = null;
```

Add the load logic and a rate getter that forwards to the engine. Replace the `updated()` stub with:

```typescript
  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this._loadSource();
    if (changed.has('playbackRate')) this._engine.setPlaybackRate(this._playbackRate);
  }

  private _loadSource(): void {
    if (!this.src) return;
    const track = this._engine.setSource({ source: this.src });
    this._trackId = track.id;
    this._engine.setPlaybackRate(this._playbackRate);
  }
```

Add the public methods and properties (after `render()`):

```typescript
  // --- Transport methods ---
  play(): void {
    this._engine.play();
  }
  pause(): void {
    this._engine.pause();
  }
  stop(): void {
    this._engine.stop();
  }
  seekTo(time: number): void {
    this._engine.seekTo(time);
  }
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate; // setter clamps + requestUpdate triggers engine forward
  }
  setVolume(volume: number): void {
    this._engine.setMasterVolume(volume);
  }

  // --- Properties ---
  get isPlaying(): boolean {
    return this._engine.isPlaying;
  }
  get duration(): number {
    return this._engine.duration;
  }
  get currentTime(): number {
    return this._engine.getCurrentTime();
  }
  set currentTime(time: number) {
    this._engine.seekTo(time);
  }
  get volume(): number {
    return this._engine.masterVolume;
  }
  set volume(value: number) {
    this._engine.setMasterVolume(value);
  }
  get audioElement(): HTMLAudioElement | null {
    return this._trackId ? (this._engine.getTrack(this._trackId)?.element ?? null) : null;
  }
```

Add cleanup:

```typescript
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._engine.dispose();
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @dawcore/components typecheck && pnpm -w lint`
Expected: dawcore typecheck clean; lint `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-player.ts packages/dawcore/src/__tests__/daw-player.test.ts
git commit -m "feat(dawcore): wire MediaElementPlayout playback into <daw-player> (#473)"
```

---

### Task 4: Map engine events → `daw-*` events + rAF playhead loop

**Files:**
- Modify: `packages/dawcore/src/elements/daw-player.ts`
- Test: `packages/dawcore/src/__tests__/daw-player.test.ts`

**Interfaces:**
- Consumes: `MediaElementPlayout.on(event, listener)` for `loadedmetadata`/`play`/`pause`/`ended`/`error`/`timeupdate` (listeners survive source swaps); `AnimationController` from `../controllers/animation-controller` (`start(cb)`, `stop()`, auto-stop on `hostDisconnected`); `DawPlayheadElement.setPosition(px)`.
- Produces: dispatches `daw-ready`, `daw-play`, `daw-pause`, `daw-stop`, `daw-ended`, `daw-timeupdate` (`{ time }`), `daw-error` (`{ operation, error }`). Drives the playhead each frame while playing.

- [ ] **Step 1: Write the failing tests (events + rAF)**

Add to `daw-player.test.ts` (inside the playback-wiring describe or a new one with the `MockAudio` global active):

```typescript
describe('DawPlayerElement — events', () => {
  function loadedPlayer(): DawPlayerElement {
    const el = makePlayer();
    el.src = 'episode.mp3';
    return el;
  }

  it('dispatches daw-ready when metadata loads', async () => {
    const el = loadedPlayer();
    await el.updateComplete;
    const ready = vi.fn();
    el.addEventListener('daw-ready', ready);
    el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('dispatches daw-play / daw-pause / daw-ended from native events', async () => {
    const el = loadedPlayer();
    await el.updateComplete;
    const play = vi.fn();
    const pause = vi.fn();
    const ended = vi.fn();
    el.addEventListener('daw-play', play);
    el.addEventListener('daw-pause', pause);
    el.addEventListener('daw-ended', ended);
    const audio = el.audioElement!;
    audio.dispatchEvent(new Event('play'));
    audio.dispatchEvent(new Event('pause'));
    audio.dispatchEvent(new Event('ended'));
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('dispatches daw-error with operation:load on a media error', async () => {
    const el = loadedPlayer();
    await el.updateComplete;
    const onError = vi.fn();
    el.addEventListener('daw-error', onError);
    // MediaElementTrack emits error(audioElement.error); our MockAudio.error is undefined → null path
    el.audioElement!.dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].detail.operation).toBe('load');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: FAIL — no `daw-ready`/`daw-play`/etc. dispatched.

- [ ] **Step 3: Subscribe to engine events + add the rAF loop**

In `daw-player.ts`, add the import:

```typescript
import { AnimationController } from '../controllers/animation-controller';
import type { DawPlayheadElement } from './daw-playhead';
```

Add fields:

```typescript
  private _anim = new AnimationController(this);
  private _metadataLoaded = false;
  private _readyDispatched = false;
```

Subscribe to engine events once in `connectedCallback` (listeners re-attach across source swaps via the engine's registry):

```typescript
  connectedCallback(): void {
    super.connectedCallback();
    this._engine.on('loadedmetadata', this._onLoadedMetadata);
    this._engine.on('play', this._onPlay);
    this._engine.on('pause', this._onPause);
    this._engine.on('ended', this._onEnded);
    this._engine.on('error', this._onError);
  }
```

Add the handlers (arrow-function fields so `this` binds and `off()` can match):

```typescript
  private _dispatch<T>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  private _onLoadedMetadata = (): void => {
    this._metadataLoaded = true;
    this._maybeDispatchReady();
  };
  private _onPlay = (): void => {
    this._dispatch('daw-play');
    this._anim.start(this._frame);
  };
  private _onPause = (): void => {
    this._anim.stop();
    this._updatePlayhead();
    this._dispatch('daw-pause');
  };
  private _onEnded = (): void => {
    this._anim.stop();
    this._dispatch('daw-ended');
  };
  private _onError = (err: MediaError | null): void => {
    console.warn('[dawcore] <daw-player> failed to load src: ' + (err?.message ?? 'unknown'));
    this._dispatch('daw-error', { operation: 'load', error: err });
  };

  /** rAF tick while playing: positions the playhead and emits daw-timeupdate. */
  private _frame = (): void => {
    this._updatePlayhead();
    this._dispatch('daw-timeupdate', { time: this._engine.getCurrentTime() });
  };

  private _maybeDispatchReady(): void {
    if (this._readyDispatched) return;
    if (this._metadataLoaded && (!this.peaksSrc || this._waveformData !== null)) {
      this._readyDispatched = true;
      this._dispatch('daw-ready');
    }
  }

  private get _playhead(): DawPlayheadElement | null {
    return this.shadowRoot?.querySelector('daw-playhead') ?? null;
  }
  private _updatePlayhead(): void {
    const d = this._engine.duration;
    if (d <= 0) return;
    const px = (this._engine.getCurrentTime() / d) * this._timelineWidth;
    this._playhead?.setPosition(px);
  }
```

Add the `_waveformData` field and a `_timelineWidth` getter as placeholders (the waveform task fills them in):

```typescript
  private _waveformData: import('waveform-data').default | null = null;
  private get _timelineWidth(): number {
    return this.shadowRoot?.querySelector<HTMLElement>('.waveform-area')?.clientWidth ?? 0;
  }
```

Stop the loop and unsubscribe on disconnect. Update `disconnectedCallback`:

```typescript
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._anim.stop();
    this._engine.off('loadedmetadata', this._onLoadedMetadata);
    this._engine.off('play', this._onPlay);
    this._engine.off('pause', this._onPause);
    this._engine.off('ended', this._onEnded);
    this._engine.off('error', this._onError);
    this._engine.dispose();
  }
```

> Note: `daw-stop` is dispatched from the `stop()` method (the engine has no separate `stop` event). Update `stop()`:
>
> ```typescript
>   stop(): void {
>     this._engine.stop();
>     this._anim.stop();
>     this._updatePlayhead();
>     this._dispatch('daw-stop');
>   }
> ```

- [ ] **Step 4: Add the daw-stop test**

Add to the events describe:

```typescript
  it('dispatches daw-stop when stop() is called', async () => {
    const el = loadedPlayer();
    await el.updateComplete;
    const stop = vi.fn();
    el.addEventListener('daw-stop', stop);
    el.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm --filter @dawcore/components typecheck && pnpm -w lint`
Expected: dawcore typecheck clean; lint `0 errors`. (If `react-hooks`/`no-unsafe-function-type` style errors appear, fix before continuing — only the full `pnpm -w lint` summary is authoritative.)

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/elements/daw-player.ts packages/dawcore/src/__tests__/daw-player.test.ts
git commit -m "feat(dawcore): map engine events + rAF playhead in <daw-player> (#473)"
```

---

### Task 5: Waveform rendering from `peaks-src` (fit-to-width) + ruler + scrubber fallback

**Files:**
- Modify: `packages/dawcore/src/elements/daw-player.ts`
- Test: `packages/dawcore/src/__tests__/daw-player.test.ts`

**Interfaces:**
- Consumes: `loadWaveformDataFromUrl(src)` from `../interactions/peaks-loader` (returns `WaveformData`); `extractPeaks(waveformData, samplesPerPixel, isMono)` from `../workers/waveformDataUtils` (returns `{ length, data: Peaks[], bits }`); `<daw-waveform>` props `.peaks`/`.length`/`.waveHeight`/`.barWidth`/`.barGap`; `<daw-ruler>` props `.samplesPerPixel`/`.sampleRate`/`.duration`/`.totalWidth`.
- Produces: waveform pixels fit to the host width (one `<daw-waveform>` per channel); ruler populated when `timescale`; `daw-ready` waits for the waveform when `peaks-src` is set.

- [ ] **Step 1: Write the failing tests**

Add to `daw-player.test.ts`. Mock the peaks loader and the canvas context (happy-dom returns `null` for `getContext`, which would crash the child `<daw-waveform>` draw):

```typescript
import * as peaksLoader from '../interactions/peaks-loader';

describe('DawPlayerElement — waveform', () => {
  beforeAll(() => {
    // happy-dom canvas has no 2D context; stub it so child <daw-waveform> draws are no-ops
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
  });

  function fakeWaveformData(channels: number) {
    // Minimal WaveformData-like stub matching what extractPeaks reads.
    return {
      bits: 16,
      channels,
      length: 100,
      scale: 256,
      sample_rate: 48000,
      duration: 100 * 256 / 48000,
      resample: () => fakeWaveformData(channels),
      channel: () => ({
        min_array: () => new Int16Array(50).fill(-10),
        max_array: () => new Int16Array(50).fill(10),
      }),
    };
  }

  it('renders one <daw-waveform> per channel when peaks-src loads', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
      fakeWaveformData(2) as never
    );
    const el = makePlayer();
    el.src = 'episode.mp3';
    el.peaksSrc = 'episode.dat';
    await el.updateComplete;
    await vi.waitFor(() => {
      const waves = el.shadowRoot!.querySelectorAll('daw-waveform');
      expect(waves.length).toBe(2);
    });
  });

  it('mono attribute collapses to a single waveform', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
      fakeWaveformData(2) as never
    );
    const el = makePlayer();
    el.mono = true;
    el.src = 'episode.mp3';
    el.peaksSrc = 'episode.dat';
    await el.updateComplete;
    await vi.waitFor(() => {
      expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(1);
    });
  });

  it('renders no waveform (scrubber-only) when peaks-src is absent', async () => {
    const el = makePlayer();
    el.src = 'episode.mp3';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(0);
  });

  it('falls back to scrubber-only when peaks-src fails to load', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockRejectedValue(new Error('404'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makePlayer();
    el.src = 'episode.mp3';
    el.peaksSrc = 'missing.dat';
    await el.updateComplete;
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(0);
  });

  it('renders a <daw-ruler> when timescale is set', async () => {
    const el = makePlayer();
    el.timescale = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('daw-ruler')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: FAIL — no `<daw-waveform>` rendered.

- [ ] **Step 3: Add peaks loading + fit-to-width channel rendering**

In `daw-player.ts`, add imports:

```typescript
import { loadWaveformDataFromUrl } from '../interactions/peaks-loader';
import { extractPeaks } from '../workers/waveformDataUtils';
import type { Peaks } from '@waveform-playlist/core';
import { repeat } from 'lit/directives/repeat.js';
```

Add state for the rendered channel peaks and sample rate:

```typescript
  @state() private _channelPeaks: Peaks[] = [];
  private _sampleRate = 48000;
  private _resizeObserver: ResizeObserver | null = null;
```

Extend `updated()` to load peaks and re-fit:

```typescript
  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this._loadSource();
    if (changed.has('playbackRate')) this._engine.setPlaybackRate(this._playbackRate);
    if (changed.has('peaksSrc')) this._loadPeaks();
    if (changed.has('mono') || changed.has('waveHeight')) this._renderWaveform();
  }
```

Add the peaks-loading and rendering logic:

```typescript
  private async _loadPeaks(): Promise<void> {
    this._waveformData = null;
    this._readyDispatched = false; // re-arm ready for the new source
    if (!this.peaksSrc) {
      this._renderWaveform();
      return;
    }
    const requested = this.peaksSrc;
    try {
      const wd = await loadWaveformDataFromUrl(requested);
      if (this.peaksSrc !== requested) return; // stale — a newer peaks-src won
      this._waveformData = wd;
      this._sampleRate = wd.sample_rate;
      this._renderWaveform();
      this._maybeDispatchReady();
    } catch (err) {
      console.warn('[dawcore] <daw-player> failed to load peaks-src: ' + String(err));
      this._renderWaveform(); // scrubber-only
    }
  }

  /** Recompute fit-to-width peaks from the loaded WaveformData. No-op without data. */
  private _renderWaveform(): void {
    const wd = this._waveformData;
    const width = this._timelineWidth;
    if (!wd || width <= 0) {
      this._channelPeaks = [];
      return;
    }
    // Resample so the peak count ≈ the host width (fit-to-width).
    const totalSamples = wd.length * wd.scale;
    const samplesPerPixel = Math.max(wd.scale, Math.ceil(totalSamples / width));
    const peakData = extractPeaks(wd, samplesPerPixel, this.mono);
    this._channelPeaks = peakData.data;
  }
```

Replace the `render()` body:

```typescript
  render() {
    const width = this._timelineWidth;
    const channels = this._channelPeaks.length;
    const channelHeight = channels > 0 ? this.waveHeight / channels : this.waveHeight;
    return html`
      ${this.timescale
        ? html`<daw-ruler
            .samplesPerPixel=${this._channelSpp(width)}
            .sampleRate=${this._sampleRate}
            .duration=${this._engine.duration}
            .totalWidth=${width}
          ></daw-ruler>`
        : null}
      <div class="waveform-area" style="height:${this.waveHeight}px">
        ${repeat(
          this._channelPeaks,
          (_p, i) => i,
          (peaks) =>
            html`<daw-waveform
              .peaks=${peaks}
              .length=${width}
              .waveHeight=${channelHeight}
              .barWidth=${this.barWidth}
              .barGap=${this.barGap}
            ></daw-waveform>`
        )}
        <daw-playhead></daw-playhead>
      </div>
    `;
  }

  /** samples-per-pixel used by the ruler so its time labels span the full width. */
  private _channelSpp(width: number): number {
    const d = this._engine.duration;
    if (d <= 0 || width <= 0) return 1;
    return Math.max(1, Math.ceil((d * this._sampleRate) / width));
  }
```

Add the `ResizeObserver` so fit-to-width tracks host width changes. In `connectedCallback`, after the engine `on(...)` calls:

```typescript
    this._resizeObserver = new ResizeObserver(() => this._renderWaveform());
    // Observe after first render so .waveform-area exists.
    requestAnimationFrame(() => {
      const area = this.shadowRoot?.querySelector('.waveform-area');
      if (area) this._resizeObserver?.observe(area);
    });
```

In `disconnectedCallback`, before `dispose()`:

```typescript
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: PASS. (happy-dom reports `clientWidth` as 0; if the per-channel tests need a non-zero width, stub it in the test via `Object.defineProperty(el.shadowRoot.querySelector('.waveform-area'), 'clientWidth', { value: 500 })` before awaiting — add this to the two channel tests if `_timelineWidth` returns 0 and `_renderWaveform` early-returns.)

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @dawcore/components typecheck && pnpm -w lint`
Expected: dawcore typecheck clean; lint `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-player.ts packages/dawcore/src/__tests__/daw-player.test.ts
git commit -m "feat(dawcore): fit-to-width waveform + ruler in <daw-player> (#473)"
```

---

### Task 6: Click/drag-to-seek on the waveform area

**Files:**
- Modify: `packages/dawcore/src/elements/daw-player.ts`
- Test: `packages/dawcore/src/__tests__/daw-player.test.ts`

**Interfaces:**
- Consumes: the engine `seekTo`; `.waveform-area` layout.
- Produces: a `pointerdown` (+ optional drag) on the waveform area seeks to `(offsetX / width) * duration`.

- [ ] **Step 1: Write the failing test**

Add to `daw-player.test.ts` (with the `MockAudio` global active):

```typescript
describe('DawPlayerElement — seek interaction', () => {
  it('click on the waveform area seeks proportionally', async () => {
    const el = makePlayer();
    el.src = 'episode.mp3'; // MockAudio.duration = 120
    await el.updateComplete;
    const area = el.shadowRoot!.querySelector<HTMLElement>('.waveform-area')!;
    Object.defineProperty(area, 'clientWidth', { value: 200, configurable: true });
    // 50% across a 200px area → 60s of a 120s track
    const ev = new MouseEvent('pointerdown', { clientX: 100, bubbles: true });
    Object.defineProperty(ev, 'offsetX', { value: 100 });
    area.dispatchEvent(ev);
    expect(el.audioElement!.currentTime).toBeCloseTo(60, 1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: FAIL — `currentTime` stays 0.

- [ ] **Step 3: Add the pointer handler**

In `daw-player.ts`, add a `@pointerdown` listener on `.waveform-area` in `render()`:

```typescript
      <div
        class="waveform-area"
        style="height:${this.waveHeight}px"
        @pointerdown=${this._onPointerDown}
      >
```

Add the handler:

```typescript
  private _onPointerDown = (e: PointerEvent): void => {
    const area = e.currentTarget as HTMLElement;
    const width = area.clientWidth;
    const d = this._engine.duration;
    if (width <= 0 || d <= 0) return;
    const ratio = Math.max(0, Math.min(1, e.offsetX / width));
    this.seekTo(ratio * d);
    this._updatePlayhead();
  };
```

> Drag-to-scrub (pointermove while down) is a refinement; a single click-to-seek satisfies the core. If adding drag, capture the pointer on down, seek on each move, release on up — wrap `releasePointerCapture` in try/catch per the dawcore pointer convention.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-player.test.ts`
Expected: PASS.

- [ ] **Step 5: Full dawcore test run + typecheck + lint**

Run: `cd packages/dawcore && npx vitest run && cd ../.. && pnpm --filter @dawcore/components typecheck && pnpm -w lint`
Expected: all dawcore tests pass; typecheck clean; lint `0 errors`. Kill stray vitest processes if any: `pgrep -f vitest && pkill -f vitest || true`.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-player.ts packages/dawcore/src/__tests__/daw-player.test.ts
git commit -m "feat(dawcore): click-to-seek on <daw-player> waveform (#473)"
```

---

### Task 7: Manual smoke demo + docs

**Files:**
- Create: `examples/dawcore-native/player.html`
- Modify: `README.md` (examples section)
- Modify: `packages/dawcore/CLAUDE.md` (document the new element under "Element Types")
- Modify: `docs/specs/web-components-migration.md` (mark `<daw-player>` core implemented under #473)

**Interfaces:**
- Consumes: the shipped `<daw-player>` element.
- Produces: a runnable demo + updated docs.

- [ ] **Step 1: Add a demo page**

Create `examples/dawcore-native/player.html` (match the existing example HTML style — these files are outside lint/prettier scope, so hand-match formatting):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>daw-player — lightweight HTMLMediaElement player</title>
    <style>
      body { background: #11111b; color: #cdd6f4; font-family: system-ui, sans-serif; padding: 2rem; }
      daw-player { --daw-wave-color: #89b4fa; --daw-playhead-color: #f38ba8; display: block; max-width: 800px; }
    </style>
  </head>
  <body>
    <h1>&lt;daw-player&gt;</h1>
    <daw-player
      id="player"
      src="/media/audio/Vincent_Augustus_-_TextMeWhenYouGetHome.mp3"
      wave-height="96"
      timescale
    ></daw-player>
    <div>
      <button id="play">Play</button>
      <button id="pause">Pause</button>
      <button id="stop">Stop</button>
    </div>
    <script type="module">
      import '@dawcore/components';
      const player = document.getElementById('player');
      document.getElementById('play').onclick = () => player.play();
      document.getElementById('pause').onclick = () => player.pause();
      document.getElementById('stop').onclick = () => player.stop();
      player.addEventListener('daw-ready', () => console.log('ready, duration', player.duration));
      player.addEventListener('daw-timeupdate', (e) => {
        document.title = e.detail.time.toFixed(1) + 's';
      });
    </script>
  </body>
</html>
```

(Verify the `src` points at an audio file that exists under `website/static/media/audio/` — `ls website/static/media/audio/` and substitute a real filename.)

- [ ] **Step 2: Verify in a real browser**

Run: `pnpm example:dawcore-native` (note the actual port from the startup log).
Open `http://localhost:<port>/player.html` in a foreground browser tab (rAF/timeupdate are throttled in backgrounded/automated tabs — see root CLAUDE.md). Confirm: waveform renders, ruler shows, Play advances the playhead, click-to-seek works, `daw-timeupdate` updates the tab title.

- [ ] **Step 3: Update docs**

- In `README.md`, add `player.html` to the dawcore-native examples list.
- In `packages/dawcore/CLAUDE.md`, add `<daw-player>` to the "Element Types" list (single-track HTMLMediaElement player; wraps `MediaElementPlayout`; peaks-src + scrubber fallback; fit-to-width).
- In `docs/specs/web-components-migration.md`, note the `<daw-player>` core (#473) is implemented (leave effects/playback-rate/transport-compat/annotations as outstanding under #475/#476/#474/#477).

- [ ] **Step 4: Verify docs build (if website touched)**

Only if you edited website docs: `pnpm --filter website build` (pre-existing CSS calc warnings are harmless).

- [ ] **Step 5: Commit**

```bash
git add examples/dawcore-native/player.html README.md packages/dawcore/CLAUDE.md docs/specs/web-components-migration.md
git commit -m "docs(dawcore): <daw-player> demo page + docs (#473)"
```

---

## Self-Review

**Spec coverage:**
- Attributes `src`/`peaks-src`/`wave-height`/`timescale`/`mono`/`bar-width`/`bar-gap`/`playback-rate` → Task 2. (`automatic-scroll` deferred per design.)
- Properties `isPlaying`/`currentTime`/`duration`/`volume`/`audioElement` → Task 3.
- Methods `play`/`pause`/`stop`/`seekTo`/`setPlaybackRate`/`setVolume` → Tasks 3–4.
- Events `daw-ready`/`daw-play`/`daw-pause`/`daw-stop`/`daw-timeupdate`/`daw-ended`/`daw-error` → Task 4 (+ map entries in Task 2).
- Waveform from `peaks-src`, scrubber fallback, fit-to-width → Task 5.
- Click-to-seek → Task 6.
- Reuse `MediaElementPlayout` → Tasks 1, 3. Playback-rate range 0.25–4.0 → Task 1.
- Deferred (effects/#475, playback-rate element/#476, transport-compat tests/#474, annotations/#477, automatic-scroll, theme JS prop, decode fallback) → not in plan, by design.

**Placeholder scan:** No TBD/TODO. The only "refinement" note (drag-to-scrub in Task 6) is explicitly optional with the click path fully specified.

**Type consistency:** `playbackRate` getter/setter (Task 2) is reused by `setPlaybackRate` (Task 3). `_waveformData`/`_timelineWidth`/`_maybeDispatchReady`/`_renderWaveform`/`_channelPeaks`/`_sampleRate` introduced in Task 4 as placeholders and filled in Task 5 — names match across tasks. Engine method names (`setSource`, `setMasterVolume`, `getCurrentTime`, `on/off`, `getTrack().element`) match `MediaElementPlayout`/`MediaElementTrack` verbatim. Event details: `daw-timeupdate` → `{ time }` (`DawTimeUpdateDetail`), `daw-error` → `{ operation, error }` (`DawErrorDetail`) — match `events.ts`.
