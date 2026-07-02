# WAM-Aware WAV Export in React (`useExportWav`) — Design

**Issue:** #536 · **Branch:** `wam-export-react` · **Date:** 2026-07-02

## Goal

`useExportWav` renders WAM plugin entries (master and per-track chains) into the
exported WAV instead of skipping them, so exports match live playback. Mirrors
dawcore's `editor.exportAudio` (#426): native `OfflineAudioContext` render with
plugins re-instantiated from URL-cached factories via state transfer
(`cloneInstanceInto`).

**Non-goals:** Faust surface in React (none exists — all React WAM entries carry
URLs); changes to dawcore or `@dawcore/wam` (`cloneInstanceInto`/`ensureWamHost`
already ship what we need); changes to the live playback path.

## Spike results (verified 2026-07-02, Chromium, Tone 15.1.22)

Both spikes ran against the real Tone build via a Vite example page:

1. **`new Tone.OfflineContext(nativeOfflineCtx)` works.** The constructor's
   wrap-existing branch (`isOfflineAudioContext(arguments[0])`) delegates to
   standardized-audio-context's `isAnyOfflineAudioContext`, which is
   `instanceof OfflineAudioContext` — true for native. Verified:
   `octx.rawContext === nativeCtx`, `transport.start(0)` + `render()` produce
   correct audio, `setContext` restore works.
2. **The exact `renderOffline` topology works on the wrapped native context.**
   `Player → fadeGain → Volume → Panner({channelCount: 2}) → Gain(mute) →
   Volume(master) → native AudioWorkletNode → destination` rendered a stereo
   buffer with channels preserved exactly (L +0.5 / R −0.5, no downmix), clean
   stop, silence after. A native worklet node (WAM stand-in) bridges into the
   Tone chain via `Tone.connect` in both directions.

## Decisions

1. **Unified render path (no branch on WAM presence).** `renderOffline` stops
   calling `Tone.Offline` and uses a hand-rolled ~20-line equivalent whose only
   mode-dependent piece is context construction:
   - `isNativeGlobalContext()` → `new OfflineContext(new OfflineAudioContext({
     numberOfChannels, length, sampleRate }))` — native, WAM-capable.
   - otherwise → `new OfflineContext(channels, duration, sampleRate)` —
     byte-identical to what `Tone.Offline` constructs today (SAC-backed).

   Rationale: the codebase already learned that dual offline render paths
   diverge (the stereo→mono Panner bug recorded in browser/CLAUDE.md). Bonus
   fix over upstream: restore the global context in `finally` —
   `Tone.Offline` leaks the offline context as the app's global context if the
   build callback throws.

2. **Offline effects functions become possibly-async.** WAM cloning
   (`ensureWamHost` + `cloneInstanceInto`) is async but `EffectsFunction` is
   sync. New browser-local types widen only the *return*:

   ```ts
   type OfflineEffectsCleanup = void | (() => void);
   type OfflineEffectsFunction = (
     masterVolume: Volume, destination: ToneAudioNode, isOffline: boolean
   ) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;
   // OfflineTrackEffectsFunction: same widening of TrackEffectsFunction
   ```

   `ExportOptions.effectsFunction` / `createOfflineTrackEffects` accept the
   widened types (non-breaking — strictly more permissive), `renderOffline`
   awaits them, and playout's live `EffectsFunction` stays untouched so an
   async function can never be handed to the live path un-awaited.

3. **Shared offline chain builder.** `createOfflineEffectsFunction` (master)
   and `createOfflineTrackEffectsFunction` (per-track) are near-duplicates
   today and both need identical WAM logic. Extract
   `packages/browser/src/effects/offlineChain.ts`:

   ```ts
   buildOfflineChain(
     entries: ActiveEffect[],                     // non-bypassed, order preserved
     getLivePlugin: (instanceId: string) => WamPluginInstance | undefined,
     rawContext: BaseAudioContext,                // the offline context
   ): Promise<{ instances: EffectInstance[]; dispose: () => void }>
   ```

   Per entry, in chain order: `kind === 'native'` →
   `createEffectInstance(definition, params)` (sync, unchanged); `kind ===
   'wam'` → `loadWamModule()` → `ensureWamHost(rawContext)` →
   `cloneInstanceInto(livePlugin, rawContext, hostGroupId)` →
   `createWamEffectInstance(clone)`. State capture happens inside
   `cloneInstanceInto` via the live plugin's `getState()` at export time (the
   #541 decision — React has no persistence layer). Sequential instantiation
   (dawcore parity). On partial failure: dispose already-created instances,
   rethrow.

4. **Fail the export on WAM clone failure** (user-confirmed). No silent
   skip, no warnings list — the error propagates through `exportWav`'s
   existing catch → `setError` → rethrow. `createWamInstance` errors already
   name the plugin.

5. **Raw offline context derived from the node, not new parameters.** Inside
   the offline callback, Tone nodes are created on the current (offline)
   global context, so the wiring functions derive
   `(masterVolume as ToneAudioNode).context.rawContext`. No signature churn on
   `EffectsFunction`-shaped contracts.

6. **Defensive native-mode guard.** If a chain contains a non-bypassed WAM
   entry but `isNativeGlobalContext()` is false (unreachable today —
   `addWamEffect` throws in non-native mode), the offline factory throws a
   clear error instead of failing deep inside worklet loading.

7. **Bypass parity unchanged.** Bypassed WAM entries stay excluded from the
   offline chain (disconnection bypass, same as live). Bypassed native
   effects stay excluded as today. The factories now return `undefined` only
   when there are zero non-bypassed entries of *either* kind.

8. **Cleanup in `finally`.** `renderOffline` captures the cleanups returned by
   the master + track wiring functions (currently ignored!) and runs them in a
   `finally` around the render — this is what destroys the offline WAM clones
   (`plugin.destroy()`, dawcore pattern) and disposes offline Tone instances.
   Per-cleanup errors warn (string-concatenated messages), never mask the
   render result.

## Components

| File | Change |
| --- | --- |
| `packages/browser/src/utils/renderToneOffline.ts` (new) | Hand-rolled `Tone.Offline` variant: construct context by mode, `setContext`, await build callback, restore in `finally`, `render()`. Callback receives the `OfflineContext` (use `.transport`, `.destination`, `.rawContext`). |
| `packages/browser/src/effects/offlineChain.ts` (new) | `buildOfflineChain` shared by both factories (Decision 3). |
| `packages/browser/src/hooks/useExportWav.ts` | `renderOffline` uses `renderToneOffline`; awaits effects functions; runs captured cleanups in `finally`; `ExportOptions` types widened; stale JSDoc updated. |
| `packages/browser/src/hooks/useDynamicEffects.ts` | `createOfflineEffectsFunction`: drop WAM skip + warning; delegate to `buildOfflineChain`; wire chain + return dispose cleanup. JSDoc note about skipped WAM removed (line 41). |
| `packages/browser/src/hooks/useTrackDynamicEffects.ts` | Same treatment for `createOfflineTrackEffectsFunction` (line 42 JSDoc, line ~460 warning). |
| `website/docs/wam-plugins.md` | Replace the "WAV export skips WAM entries" limitation with a short "exports render WAM offline" note. |
| `website/docs/react/api/hooks.md` | Update the two mirrored JSDoc blocks (lines ~905, ~951). |
| `website/docs/framework-agnostic/llm-reference.md` + `website/static/llms.txt` | Audit for the skip note / widened types; update if present. |

No changes to `@waveform-playlist/playout`, `@dawcore/wam`, or dawcore.

## Data flow (export with WAM present)

```
exportWav(tracks, states, opts)
  └─ renderOffline(...)
       └─ renderToneOffline(build, duration, channels, sampleRate)
            ├─ native mode → OfflineContext(wrapping native OfflineAudioContext)
            ├─ setContext(offlineCtx)
            ├─ build(offlineCtx):
            │    ├─ masterVolume = new Volume(0)
            │    ├─ cleanupM = await effectsFunction(masterVolume, destination, true)
            │    │     └─ buildOfflineChain: natives + ensureWamHost(raw) +
            │    │        cloneInstanceInto(livePlugin, raw, hostGroupId) per WAM entry,
            │    │        wired in chain order via Tone connect()
            │    ├─ per audible track: players/fades/volume/pan/mute,
            │    │    cleanupT = await trackEffects(trackMute, masterVolume, true)
            │    └─ transport.start(0)
            ├─ finally: setContext(previous)
            └─ await offlineCtx.render() → AudioBuffer
       └─ finally: run cleanupM + cleanupT[] (destroys WAM clones, disposes Tone fx)
  └─ encodeWav → Blob
```

## Error handling

- WAM host init / factory load / clone / setState failure → dispose partial
  offline instances (in `buildOfflineChain`), restore global context
  (`renderToneOffline` `finally`), reject `exportWav` → hook `error` state +
  rethrow to caller. Export produces nothing (Decision 4).
- Cleanup failures: warn per cleanup (string-only console args per project
  convention), continue running remaining cleanups.
- Non-native context with WAM entries: early throw from the factory with an
  actionable message (Decision 6).

## Testing & verification

- **Unit (vitest, TDD):** update `useDynamicEffectsWam.test.ts` /
  `useTrackDynamicEffectsWam.test.ts` — the "skips WAM + warns" assertions
  become: offline function defined for WAM-only chains; `ensureWamHost` called
  with the raw context; `cloneInstanceInto` called with the live plugin;
  mixed-chain wiring order preserved (native→wam→native); bypassed WAM
  excluded; cleanup destroys clones; clone failure disposes partials and
  rejects. New tests for `offlineChain.ts` and `renderToneOffline.ts`
  (mock `tone` + `@dawcore/wam` + playout; assert context construction by
  mode and restore-on-throw).
- **Browser gate (the #426/#541 precedent):** on the website WAM example page,
  export with an audible community WAM (e.g. burns-audio distortion,
  `overdrive` cranked — defaults are near-transparent) in-chain; assert the
  exported buffer is non-silent and differs measurably (RMS) from a
  bypassed-WAM export; per-track and master chains both exercised. Driven via
  browser MCP; select measured signal, not context state.
- **Regression:** full `pnpm -w lint` (0 errors), `pnpm --filter
  @waveform-playlist/browser typecheck` + vitest run; existing export tests
  unchanged in SAC mode.

## Release

`@waveform-playlist/browser` **minor** bump (feature, non-breaking: widened
option types, new behavior only for chains that previously warned-and-skipped).
No other package publishes.
