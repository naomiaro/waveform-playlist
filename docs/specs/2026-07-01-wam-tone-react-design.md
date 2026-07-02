# WAM 2.0 Plugins for the Tone Backend + React App — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorming session)
**Scope:** Three deliverables — (1) WAM hosting on the Tone.js backend of dawcore (`TonePlayoutAdapter`), (2) WAM support in the React app (`@waveform-playlist/browser` `/tone` surface), (3) a full-showcase WAM example page on the Docusaurus website.

## Background

WAM 2.0 (Web Audio Modules) plugins subclass the **native** `AudioWorkletNode`; their constructor rejects wrapper contexts. Playout's global Tone context is built from **standardized-audio-context** (SAC) — `new Context()` → `new stdAudioContext(...)` — a closed abstraction that never exposes its native nodes. The two are fundamentally incompatible on one graph, so the fix happens at context-construction time: hand Tone a native `AudioContext` (`new Context(new AudioContext())`), the documented Tone.js recipe for AudioWorklet interop. Reference snippet (user-provided) validates this: native ctx + `Tone.setContext(ctx)` + `initializeWamHost(ctx)` + `synth.connect(instance.audioNode)`.

dawcore already has full WAM machinery (`EffectsManager`: `addWamPlugin`, `addFaustEffect`, GUIs, persistence, offline export) — it only requires `adapter.transport` to implement five hooks (`EffectsTransportLike`). `TonePlayoutAdapter` implements none of them today; that is the entire dawcore-side gap. The React browser package has a separate closure-based effects model (`useDynamicEffects`/`useTrackDynamicEffects`, 20 native Tone effects) with no WAM concept.

### Tone.js version findings (local checkout `~/Code/Tone.js`, dev branch = 15.5.x)

- `new Context({ sampleRate })` silently drops `sampleRate` in ≤15.1.22 (SAC path). Fixed by commit `23aeb41f` "Support sampleRate option for realtime AudioContext (#1355)" (Aug 2025) — shipped only in the `next` npm line (15.5.26); `latest` is still 15.1.22.
- **No Tone bump needed for v1:** we construct `new AudioContext({ sampleRate })` ourselves and pass it to `new Context(nativeCtx)`; the custom-context constructor path is already correct in 15.1.22 (stores as-is, doesn't override latencyHint). Native constructor honors `sampleRate` directly. A 15.5.x upgrade is a separate follow-up (playout pins private internals — `_param`, `_clock._lastUpdate` — that are version-sensitive).
- Tone's type guards (`isAudioContext` → SAC `isAnyAudioContext`) accept both native and wrapped contexts in both versions.
- **Firefox blocker (confirmed via MDN BCD data, 2026-06):** Firefox implements none of the nine `AudioListener` AudioParams (`positionX/Y/Z`, `forwardX/Y/Z`, `upX/Y/Z` all `version_added: false`). Tone's `Listener` eagerly wraps them at `context.initialize()` → `new Param({ param: undefined })` throws "param must be an AudioParam" (Tone #681). SAC polyfills these; native mode cannot. The reference snippet runs on Firefox only because it never triggers `initialize()` (no `Tone.start()`/`toDestination()`/Transport access). Playout initializes immediately → native mode must feature-detect and fall back.
- A previous native-context attempt was reverted for unspecified "Tone.js internal issues" (squashed into #348, no detail survives) → de-risked by an early real-browser spike.

## Scope decisions (user-confirmed)

| Question | Decision |
|---|---|
| React insertion points | Both master + per-track (mirror existing hooks) |
| Website page | Full showcase (library browser, GUIs, per-track + master, multitrack) |
| Faust | dawcore-Tone inherits `addFaustEffect` for free; **no** Faust in React hooks or website (webpack hard-blocks `@dawcore/faust`) |
| WAM in React WAV export | Follow-up issue; v1 skips WAM entries with one-time console warning + documented limitation |

## §1 Playout: opt-in native AudioContext

`configureGlobalContext()` (`packages/playout/src/audioContext.ts`) gains `nativeAudioContext?: boolean`:

- When set (before any context exists — same precondition as the existing `sampleRate` option), `getGlobalContext()` builds `new Context(new AudioContext({ sampleRate? }))` instead of `new Context()`.
- **Firefox feature detection first** (AudioListener params, e.g. `'positionX' in AudioListener.prototype`): if unsupported, `[waveform-playlist]`-prefixed warning + fall back to the SAC default so audio keeps working; WAM hosting then reports itself unavailable.
- New export `isNativeGlobalContext(): boolean` — downstream capability check; WAM entry points throw "call `configureGlobalContext({ nativeAudioContext: true })` before initializing audio" when false.
- Side benefit: in native mode `sampleRate` is honored on Tone 15.1.22 (fixes the documented SAC limitation for opted-in consumers).
- Everything downstream unchanged: the `rawContext as AudioContext` casts become true; recording/decode/effects/`_masterTap` keep working (Tone's `createAudioWorkletNode` already branches on native contexts).

**Risk mitigation:** early implementation task = real-browser spike (Chrome/Firefox/Safari) running existing dawcore-tone basic + recording demos in native mode, before building on top.

## §2a TonePlayoutAdapter effects transport hooks (packages/playout)

New `transport` getter on the Tone adapter implementing `EffectsTransportLike` (the structural interface in `packages/dawcore/src/effects/effects-manager.ts`):

- `connectTrackOutput(trackId, node)` — new `ToneTrack.connectEffects(node)`: disconnect `muteGain → destination`, connect `muteGain → node`. **Mutually exclusive** with the closure-based `TrackEffectsFunction`: throw a clear error if the track was built with an `effects` closure (dawcore never sets closures; guard is misuse protection).
- `disconnectTrackOutput(trackId)` — restore `muteGain → destination`.
- `masterOutputNode` (transport surface) — the native GainNode backing `masterVolume.input` (existing double-cast `Gain.input` pattern). Track chains reconnect into this junction, staying pre-master-volume. Deliberately different from `adapter.masterOutputNode` (post-volume `_masterTap`), matching `EffectsManager`'s expectations from the native transport.
- `connectMasterOutput(node)` — `_masterTap.disconnect(destination); _masterTap.connect(node)`; manager wires `chain.output → ctx.destination`. Resulting master graph: `masterVolume → [closure effects] → _masterTap → [EffectsManager chain] → destination` — both effects models compose.
- `disconnectMasterOutput()` — restore `_masterTap → destination`.

Guards: all hooks throw the enable-native-context error when the global context is SAC — deliberately including pure built-in-effect chains. Rationale: one mode for "effects on the Tone backend" gives a single clear error at the first `addEffect` of any kind, instead of chains half-working on SAC and then failing opaquely inside `ensureWamHost` when a WAM entry arrives (and dawcore's chain controller node construction against an SAC wrapper is untested territory). `TransportQueryLike` (wam-transport tempo bridge) **not** implemented in v1 — `EffectsManager` skips the bridge silently; follow-up issue. dawcore's `rewireTrackChains()` on `tracksVersion` statechange handles `setTracks` rebuilds for free.

Result: dawcore's whole effects surface (WAM, Faust, GUIs, persistence, `exportAudio`) works on the Tone backend with **zero `EffectsManager` changes**. Proven by new `examples/dawcore-tone/wam.html` demo.

## §2b React hooks: unified WAM entries (packages/browser, `/tone` subpath)

`useDynamicEffects` and `useTrackDynamicEffects` each gain:

- **`addWamEffect(url, initialState?)`** / **`addWamEffectToTrack(trackId, url, initialState?)`** — async: dynamic-import `@dawcore/wam` (new **optional peerDependency** of browser, install-hint rethrow — the midi pattern) → `ensureWamHost(nativeCtx)` → `createWamInstance(url, ctx, groupId)` → WAM-flavored `EffectInstance` (`effect` = plugin `audioNode`, `dispose` = `plugin.destroy()`, `setParameter` → `setParameterValues`). Throws configure-native-context error on SAC.
- `ActiveEffect` entries gain `kind: 'native' | 'wam'` + `url`/`label`; all chain operations (remove, reorder, toggleBypass, clearAll) stay kind-agnostic. WAM bypass = disconnection-based (no `wet` param), same as dawcore.
- **Chain linking** switches from `instance.connect(next)` to Tone's `connect()` helper (bridges native↔Tone both directions). Only change to existing rebuild mechanics; behavior-preserving for pure-Tone chains.
- **`WamEffectGui`** React component — mounts `instance.createGui()` (fallback: generic parameter panel from `@dawcore/wam`'s plain-DOM factories) into a ref'd div. Detach-but-cache on close, `destroyGui` on unmount/removal (dawcore lifecycle rules).
- **No re-exports**: consumers import `fetchWamLibrary`/`fetchWamDescriptor` from `@dawcore/wam` directly (no-cross-package-re-exports rule).
- **Export:** `createOfflineEffectsFunction()`/`createOfflineTrackEffectsFunction()` skip WAM entries with a one-time console warning. Documented limitation + follow-up issue (Tone.Offline creates its own SAC offline context; WAM-aware export needs native OfflineAudioContext rendering + plugin re-instantiation, as dawcore's `export-audio.ts` does).

## §3a Website WAM showcase page

- **Files:** `website/src/pages/examples/wam-effects.tsx` (thin `Layout`+`Head`) + `website/src/components/examples/WamEffectsExample.tsx` via `createLazyExample` (SSR/SSG-safe). `configureGlobalContext({ nativeAudioContext: true })` at top of the lazily-imported client-only module, before provider mount.
- **Content:** multitrack stems session (reuse stem-tracks assets in `website/static`); per-track + master racks mixing built-in Tone effects and WAM plugins in one chain; `WamEffectGui` panels; community plugin browser via `fetchWamLibrary` + `fetchWamDescriptor` (filter: descriptor audio-I/O flags `!== false`, category fallback — dawcore-wam demo rules; thumbnails/categories/vendor shown).
- **Graceful degradation:** library fetch failure → error state, page keeps working with built-in effects. Firefox → banner ("WAM plugins require Chrome/Safari/Edge"), built-in effects only.
- **Bundling:** `@dawcore/wam` as `workspace:*` dep of `website`, consumed via built `dist` (recording/annotations pattern; pure TS — no Lit decorators, no Node builtins → Rspack-safe). Browser's dynamic `import('@dawcore/wam')` resolves statically at build; fine. Faust stays aliased `false`, nowhere in this chain.
- Root README examples section updated in same PR; example page links to guide doc (no inlined code walkthroughs). Berlin-underground aesthetic per `website/CLAUDE.md`.

## §3b Docs surfaces (sync checklist)

New guide `website/docs/wam-plugins.md`: `configureGlobalContext` setup, `addWamEffect`, `WamEffectGui`, browser support matrix, export limitation, dawcore `<daw-editor>` + Tone adapter usage. Same-PR updates: `docs/api/hooks.md`, `docs/examples.md`, `docs/api/llm-reference.md`, `static/llms.txt`. Verify `pnpm --filter website build`.

## §3c Testing

TDD throughout (project workflow).

- **playout (vitest, mocked Tone):** native-mode `configureGlobalContext` (uses provided native ctx; Firefox feature-detect fallback; context-already-created warning); `ToneTrack.connectEffects`/`disconnectEffects` rewiring; the five transport hooks incl. closure-conflict throw and non-native-mode throw.
- **dawcore:** `EffectsManager` integration test against a mock Tone adapter exposing the hooks (`_requireWiring` passes; chains wire/rewire/dispose).
- **browser:** `vi.mock('@dawcore/wam')` with `vi.hoisted` (missing-peer test in its own file); WAM entry add/remove/reorder/bypass; chain rebuild via Tone `connect` helper; `WamEffectGui` mount/detach/destroy; export skip-warning.
- **Real-browser (mandatory):** §1 spike first; then `examples/dawcore-tone/wam.html` and website page via browser MCP (foreground tab, real pointer input). Chrome + Safari full; Firefox fallback-banner path. Existing Playwright suite stays green; no network-dependent WAM e2e (manual/MCP instead).

## §3d Rollout, versioning, follow-ups

- Feature branch `wam-tone-react`; three stacked milestones, each reviewable:
  1. playout native-context mode + spike + transport hooks (+ `examples/dawcore-tone/wam.html`)
  2. browser WAM hooks + `WamEffectGui`
  3. website page + docs
- **Versioning:** `playout` minor; `browser` minor (optional **peer** `@dawcore/wam` — no zerover pin-cascade); dawcore + `@dawcore/wam` untouched. Website workspace dep → `pnpm install` + commit lockfile (CI frozen-lockfile).
- **Follow-up issues to file:** WAM-aware React WAV export; `TransportQueryLike` tempo bridge on the Tone adapter; evaluate native-context-as-default after soak; library `apiVersion` filter (ties into #528); Tone.js upstream issue (Listener eager-init breaks custom native contexts on Firefox — repro from spike); WAM SDK DX report (clear error for non-native contexts instead of opaque `TypeError`). Both upstream drafts reviewed by the user before posting.

## Error handling summary

- WAM requested without native mode → throw with exact `configureGlobalContext` instruction.
- Firefox/no-AudioListener-params → warn + SAC fallback; WAM unavailable, UI surfaces degrade (banner).
- Plugin load/instantiation failures → existing `@dawcore/wam` behavior (validate-after-instantiate, destroy-before-throw); React hooks reject the `addWamEffect` promise; UI error states.
- Library fetch failures → error state; page functional without WAM.
- Track-with-closure + `connectTrackOutput` → explicit throw (mutually exclusive models).
