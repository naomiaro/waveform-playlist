# media-element-playout Package (`@waveform-playlist/media-element-playout`)

**Purpose:** Lightweight single-track `HTMLAudioElement` playout engine — pitch-preserving playback rate, pre-computed peaks (no AudioBuffer decode), no Tone.js. Peer of `@waveform-playlist/playout` (TonePlayout); both implement the `PlayoutEngine` interface (`src/types.ts`). An optional `AudioContext` routes audio through Web Audio nodes for fades/effects.

**Two classes:** `MediaElementPlayout` (the engine — single track; warns + disposes on a second `addTrack`) wraps a `MediaElementTrack` (one `<audio>` element). `addTrack` returns the track for direct control.

## Player Mode (#531)

Second-persona affordances for single-track *players* (podcast/audiobook, `<daw-player>` #454), purely additive over the timeline/editor API:

- **`resume()`** (on both classes) — play from the current position. Plain `play()` with no offset resets to 0 (timeline semantics); `resume()` delegates to `play(currentTime)` so all the fade/AudioContext machinery is reused with no jump.
- **`setSource(options)` (playout) / `load(source, opts?)` (track)** — in-place `.src` swap. Reuses the existing element (so the once-per-element `MediaElementAudioSourceNode` and any effects survive), and is **silent** — no "Only one track is supported" warning (`addTrack()` keeps that warning as the genuine multi-track-misuse signal). `setSource`: existing track + string source → in-place `load()`; otherwise dispose + recreate. `load()` is owns-element-only (a borrowed `HTMLAudioElement` warns + no-ops). Peaks are replaced (`opts.peaks ?? null`); name patches only when provided.
- **Typed event emitter** — `MediaElementTrack.on<K>()/off<K>()` over `MediaElementTrackEvents` (`loadedmetadata` `play` `pause` `error(MediaError|null)` `ended` `timeupdate(time)`). `MediaElementPlayout.on()/off()` forward to the current track via a re-attach registry (`_attachListenersToTrack()` runs at the end of `addTrack()`), so subscriptions survive source swaps and pre-track subscription. Legacy `setOnStopCallback`/`setOnTimeUpdateCallback`/`setOnPlaybackComplete` are retained and fire alongside the emitter (back-compat).

## Gotchas

- **`setPlaybackRate` clamps to 0.25–4.0** (widened from 0.5–2.0 in v12.3.0 for `<daw-player>`) on both `MediaElementTrack` and `MediaElementPlayout`. `HTMLMediaElement` supports the wider range. The constructor-time `playbackRate` option is applied WITHOUT clamping — only `setPlaybackRate()` clamps.
- **`.load()` / assigning `.src` resets `playbackRate` to 1.0** (HTML load algorithm → `defaultPlaybackRate`). `load()` must re-apply `this._playbackRate` after the swap, or a 1.5× player silently drops to 1.0× on the next source while the `playbackRate` getter still reports 1.5. `volume`/`muted`/`preservesPitch` are **not** reset — only `playbackRate`. In tests, a no-op `load = vi.fn()` mock hides this — model the reset (`load = vi.fn(() => { this.playbackRate = 1; })`) or the regression test has no teeth.
- **`seekTo()` clamps to `duration`, which is `0` until `loadedmetadata` fires** (the `duration` getter is `audioElement.duration || peaks.duration || 0`). Seeking right after `addTrack()` in a real browser silently lands at 0 — await `loadedmetadata` (or supply `peaks` with a duration) before seeking. Unit tests sidestep this by setting the mock's `currentTime` directly.
- **`createMediaElementSource()` is once-per-element** — in-place `load()` reuses the element precisely to keep that source node (and its effects routing) alive. Recreating the track builds a new element + node.
- **Event-listener `Set` type** — `Set<Function>` is a `@typescript-eslint/no-unsafe-function-type` ESLint *error* (see root CLAUDE.md "ESLint Baseline"). This package uses the typed-union `Set<MediaElementTrackEvents[keyof MediaElementTrackEvents]>` with one localized cast at the `_emit`/attach call site.

## Testing

Run `pnpm --filter @waveform-playlist/media-element-playout test` (or `npx vitest run` from the package dir). Tests inject a `MockAudioElement extends EventTarget` (real `dispatchEvent` for `play`/`pause`/`loadedmetadata`/`error`/`ended`/`timeupdate`, no DOM env) — register it as `globalThis.Audio` to exercise the owns-element string-source path. `__tests__/` is **outside** `typecheck` (`tsconfig` `include: ["src/**/*"]`) and lint (`packages/**/src/**`) scope, so only vitest checks it — type/lint errors in tests won't surface there; verify the **source** via `pnpm --filter @waveform-playlist/media-element-playout typecheck` + full `pnpm -w lint`.

**Manual browser smoke:** reuse `examples/media-element-player/`'s Vite (it source-aliases this package + `core` and serves `website/static`) with a temp `smoke.html` that imports `MediaElementPlayout` directly (pure TS, no React) and is driven via Playwright MCP `browser_evaluate`. Use an **in-page WAV blob** as the source — headless Chromium won't reliably load a network `.mp3`, while PCM WAV fires `loadedmetadata` deterministically — await `loadedmetadata` before `seekTo`, and assert on synchronous state + real events rather than playback progress (autoplay is gesture-gated; MCP tabs throttle rAF/timers).

**Build:** tsup → ESM + CJS + DTS into `dist/` (gitignored; built at publish time, not committed).
