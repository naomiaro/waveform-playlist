# media-element-playout Package (`@waveform-playlist/media-element-playout`)

**Purpose:** Lightweight single-track `HTMLAudioElement` playout engine — pitch-preserving playback rate, pre-computed peaks (no AudioBuffer decode), no Tone.js. Peer of `@waveform-playlist/playout` (TonePlayout); both implement the `PlayoutEngine` interface (`src/types.ts`). An optional `AudioContext` routes audio through Web Audio nodes for fades/effects.

**Two classes:** `MediaElementPlayout` (the engine — single track; warns + disposes on a second `addTrack`) wraps a `MediaElementTrack` (one `<audio>` element). `addTrack` returns the track for direct control.

## Player Mode (#531)

Second-persona affordances for single-track *players* (podcast/audiobook, `<daw-player>` #454), purely additive over the timeline/editor API:

- **`resume()`** (on both classes) — play from the current position. Plain `play()` with no offset resets to 0 (timeline semantics); `resume()` delegates to `play(currentTime)` so all the fade/AudioContext machinery is reused with no jump.
- **`setSource(options)` (playout) / `load(source, opts?)` (track)** — in-place `.src` swap. Reuses the existing element (so the once-per-element `MediaElementAudioSourceNode` and any effects survive), and is **silent** — no "Only one track is supported" warning (`addTrack()` keeps that warning as the genuine multi-track-misuse signal). `setSource`: existing track + string source → in-place `load()`; otherwise dispose + recreate. `load()` is owns-element-only (a borrowed `HTMLAudioElement` warns + no-ops). Peaks are replaced (`opts.peaks ?? null`); name patches only when provided.
- **Typed event emitter** — `MediaElementTrack.on<K>()/off<K>()` over `MediaElementTrackEvents` (`loadedmetadata` `play` `pause` `error(MediaError|null)` `ended` `timeupdate(time)`). `MediaElementPlayout.on()/off()` forward to the current track via a re-attach registry (`_attachListenersToTrack()` runs at the end of `addTrack()`), so subscriptions survive source swaps and pre-track subscription. Legacy `setOnStopCallback`/`setOnTimeUpdateCallback`/`setOnPlaybackComplete` are retained and fire alongside the emitter (back-compat).

## Gotchas

- **`.load()` / assigning `.src` resets `playbackRate` to 1.0** (HTML load algorithm → `defaultPlaybackRate`). `load()` must re-apply `this._playbackRate` after the swap, or a 1.5× player silently drops to 1.0× on the next source while the `playbackRate` getter still reports 1.5. `volume`/`muted`/`preservesPitch` are **not** reset — only `playbackRate`. In tests, a no-op `load = vi.fn()` mock hides this — model the reset (`load = vi.fn(() => { this.playbackRate = 1; })`) or the regression test has no teeth.
- **`createMediaElementSource()` is once-per-element** — in-place `load()` reuses the element precisely to keep that source node (and its effects routing) alive. Recreating the track builds a new element + node.
- **Event-listener `Set` type** — `Set<Function>` is a `@typescript-eslint/no-unsafe-function-type` ESLint *error* (see root CLAUDE.md "ESLint Baseline"). This package uses the typed-union `Set<MediaElementTrackEvents[keyof MediaElementTrackEvents]>` with one localized cast at the `_emit`/attach call site.

## Testing

Run `pnpm --filter @waveform-playlist/media-element-playout test` (or `npx vitest run` from the package dir). Tests inject a `MockAudioElement extends EventTarget` (real `dispatchEvent` for `play`/`pause`/`loadedmetadata`/`error`/`ended`/`timeupdate`, no DOM env) — register it as `globalThis.Audio` to exercise the owns-element string-source path. `__tests__/` is **outside** `typecheck` (`tsconfig` `include: ["src/**/*"]`) and lint (`packages/**/src/**`) scope, so only vitest checks it — type/lint errors in tests won't surface there; verify the **source** via `pnpm --filter @waveform-playlist/media-element-playout typecheck` + full `pnpm -w lint`.

**Build:** tsup → ESM + CJS + DTS into `dist/` (gitignored; built at publish time, not committed).
