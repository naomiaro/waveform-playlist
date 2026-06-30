# media-element-playout: player-mode ergonomics — design

**Issue:** #531
**Package:** `@waveform-playlist/media-element-playout`
**Version impact:** additive, non-breaking → minor bump `12.1.0 → 12.2.0`
**Date:** 2026-06-29

## Problem

`@waveform-playlist/media-element-playout` is _transport-shaped_: its defaults
assume a timeline editor that owns the event loop (offset-based `play()`, one
track per editor, editor-owned events). Wiring it into a single-track **player**
(the `<radio-archive>` prototype, sibling to #529) surfaced three ergonomics gaps
that force every player consumer to reach into `track.element` and work around
transport-isms. `<daw-player>` (#454) will need all three.

A _player_ has different defaults than a _timeline_: resume where you are, swap
sources freely, react to media lifecycle. These are the missing second-persona
affordances. The hard constraint: **existing timeline/editor consumers must be
unchanged** — every change is purely additive.

## Architecture context

`MediaElementPlayout` is a plain class (not a DOM element) that is the direct
architectural peer of `@waveform-playlist/engine`'s `PlaylistEngine`. That peer
already exposes a typed `on<K>()/off<K>()/_emit()` emitter
(`Map<string, Set<Function>>`, try-catch around each listener, `EngineEvents`
type map) emitting `play`/`pause`/`stop`/`statechange`. The web-components layer
above (`dawcore`) dispatches `CustomEvent`s on the element (`daw-play`,
`daw-pause`, `daw-error`, …). The `setOnXCallback` single-callback style currently
in this package is the outlier; the lifecycle work aligns it with the emitter
idiom used both below (engine) and above (dawcore).

## Design

### 1. Resume-in-place — `resume()`

`play(_when?, offset?, duration?)` does `startPosition = offset ?? 0`, and
`MediaElementTrack.play(offset = 0)` sets `audioElement.currentTime = offset`. So
`play()` with no offset resets playback to 0 — a player calling `play()` to
resume from pause jumps to the start.

- **`MediaElementPlayout.resume(): void`** → `this.play(undefined, this.getCurrentTime())`.
  Reuses all of `play()`'s machinery (AudioContext resume, fade re-scheduling from
  the current offset, `_isPlaying`). Passing the current position as the offset
  sets `currentTime` to its own value — no jump.
- **`MediaElementTrack.resume(): void`** → `this.play(this.currentTime)`. Same
  reasoning, exposed at the track level for power users.
- `play(offset)` semantics are **unchanged** — zero risk to timeline consumers.

### 2. In-place source swap — `setSource()` / `track.load()`

`addTrack()` warns whenever a track already exists ("Only one track is supported.
Disposing previous track. For multi-track, use TonePlayout."). For a single-show
player, loading the next show is normal operation, not multi-track misuse — so it
logs on every source change.

- **`MediaElementTrack.load(source, opts?): void`** — swaps `audioElement.src` on
  the _existing_ element: `pause()` → `_cancelFades()` → set `.src` → `.load()` →
  reset `currentTime` to 0, update `_peaks`/`_name` from `opts`. The
  `MediaElementAudioSourceNode` stays connected (it is once-per-element), so **Web
  Audio routing/effects survive the swap**.
  - `opts` shape: `{ peaks?: WaveformDataObject; name?: string }` (a subset of
    `MediaElementTrackOptions`; `source` is the first positional arg).
  - Guard: in-place swap only when `ownsElement === true`. A borrowed element
    (`source` was an `HTMLAudioElement`) warns and does nothing — swapping `.src`
    on a consumer-owned element is out of this engine's contract.
  - `source` accepts `string` only for the in-place path (a URL/Blob URL). Passing
    an `HTMLAudioElement` is not supported by `load()` (that is the `addTrack`
    construction path).
- **`MediaElementPlayout.setSource(options): MediaElementTrack`** — if a track
  exists, `track.load(options.source, options)` (silent, in-place) and return the
  existing track; else `addTrack(options)`. No warning on the replace path.
  - `options` is `MediaElementTrackOptions` (same as `addTrack`), so callers can
    pass `{ source, peaks?, name?, … }` uniformly.
- **`addTrack()` keeps its warning** as the genuine multi-track-misuse signal.
  `setSource` is the documented silent single-track-replace path.

### 3. Lifecycle events — typed emitter (mirrors `PlaylistEngine`)

The track/playout expose `setOnTimeUpdateCallback`, `setOnStopCallback`, and
`setOnPlaybackComplete` — but not `loadedmetadata`, `play`, `pause`, or `error`.
A player needs all four (duration/seek-on-ready, transport state, error
surfacing), so the consumer must bind them on `track.element` directly, leaking
the abstraction.

- **`MediaElementTrack`** gains `on<K>()/off<K>()` plus a private `_emit()`,
  copied from `PlaylistEngine`'s implementation (`Map<string, Set<Function>>`,
  try-catch per listener so one throwing listener can't break the rest). Typed
  event map `MediaElementTrackEvents`:

  ```ts
  interface MediaElementTrackEvents {
    loadedmetadata: () => void;
    play: () => void;
    pause: () => void;
    error: (err: MediaError | null) => void;
    ended: () => void;
    timeupdate: (time: number) => void;
  }
  ```

  - The constructor binds the four new native element events
    (`loadedmetadata`, `play`, `pause`, `error`) alongside the existing `ended`
    and `timeupdate` listeners. Each handler `_emit`s its event; `error` passes
    `audioElement.error` (a `MediaError | null`).
  - The existing `setOnStopCallback` / `setOnTimeUpdateCallback` remain and fire
    alongside the emitter (back-compat). The legacy `handleEnded`/`handleTimeUpdate`
    handlers additionally `_emit('ended')` / `_emit('timeupdate', time)`.
  - `dispose()` removes the new listeners and clears the emitter registry.

- **`MediaElementPlayout.on<K>()/off<K>()`** — a thin forwarder to the current
  track's emitter, backed by a small internal registry
  (`Set<{ event; listener }>`) so subscriptions made _before_ a source loads (or
  carried across an `addTrack` replace) re-attach to the new track. Because
  `setSource` reuses the same track, the registry is mostly insurance for the
  pre-track and `addTrack`-replace cases. **One emitter implementation (on the
  track); the playout forwards.** The playout's public event surface is
  `MediaElementTrackEvents`.

### Exports (`index.ts`)

Add `export type { MediaElementTrackEvents }`.

## Testing

A new `__tests__/player-mode.test.ts` reusing the existing
`MockAudioElement extends EventTarget` pattern (it dispatches real `loadedmetadata`
/ `play` / `pause` / `error` / `ended` / `timeupdate` events with no DOM
environment):

- `resume()` plays without resetting `currentTime` (set `currentTime`, `resume()`,
  assert `el.play` called and `currentTime` unchanged).
- `MediaElementPlayout.setSource()` swaps `.src` and does **not** call
  `console.warn`; `addTrack()`-replace **still** warns (spy on `console.warn`).
- `setSource()` preserves the same track instance (in-place reuse) and updates
  `peaks`/`name` when provided.
- `on('play' | 'pause' | 'loadedmetadata' | 'error')` fire on dispatched native
  events; `error` listener receives `el.error`.
- `playout.on(...)` registered before `setSource()` still fires after the source
  loads (registry re-attach).
- `off()` removes a listener.
- Existing `peaks-optional.test.ts` stays green.

## Deliverables / acceptance criteria

- [ ] Player resumes from current position via no-arg `resume()`.
- [ ] Replacing the source on a single-track playout does not log the "Only one
      track is supported" warning (`setSource` path).
- [ ] `loadedmetadata` / `play` / `pause` / `error` observable without reaching
      into `track.element`.
- [ ] Existing timeline/editor consumers unchanged; existing tests pass.
- [ ] Covered by new tests; package rebuilt (`dist/`).
- [ ] `README.md` documents `resume()`, `setSource()`, and the event emitter.
- [ ] Version bumped to `12.2.0`.

## Out of scope

- **Range-support detection (206-vs-200).** Deferred to #454 per the issue — a
  layering decision worth its own discussion.
- **Multi-listener migration of existing callbacks.** The three existing
  `setOnXCallback` setters stay single-callback for back-compat; they are not
  re-pointed at the emitter beyond the additive `_emit` calls.
