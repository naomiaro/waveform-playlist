---
sidebar_position: 5
description: "Host Web Audio Modules (WAM 2.0) plugins in React or Web Components using native AudioContext mode"
---

# WAM Plugins

Waveform Playlist can host third-party [Web Audio Modules (WAM 2.0)](https://www.webaudiomodules.com/) plugins — synths and effects built once and pluggable into any compatible host — mixed freely alongside the built-in Tone.js effects. This guide covers both integration paths: React hooks and the Web Components `<daw-editor>` on the Tone.js backend.

## What WAMs are

[WAM 2.0](https://www.webaudiomodules.com/) is a community standard for portable Web Audio plugins. A WAM plugin ships as an ES module URL; any WAM-compatible host (Waveform Playlist, wam-studio, or your own app) can load it, wire it into an audio graph, and mount its GUI. The [webaudiomodules.com community registry](https://www.webaudiomodules.com/community/) lists dozens of ready-to-use effects and instruments you can insert by URL — no bundling or npm install of the plugin itself required.

## Enable native AudioContext mode

WAM plugins are `AudioWorkletNode`s that subclass the native Web Audio API. Tone.js normally runs on a `standardized-audio-context` wrapper (for cross-browser worklet support), but WAM worklets cannot join that wrapped graph. To host WAM plugins, opt the shared global context into native mode **before any audio initialization** — before the first track loads or `createToneAdapter()` runs:

```ts
import { configureGlobalContext } from '@waveform-playlist/playout';

configureGlobalContext({ nativeAudioContext: true });
```

`configureGlobalContext` must run before `getGlobalContext()` is called by anything else (any `useAudioTracks`/`WaveformPlaylistProvider` render, or `createToneAdapter()`) — once the context exists, native mode can no longer be applied and a console warning is logged instead.

### Browser support

| Browser | Native context mode |
|---|---|
| Chrome / Edge | ✅ |
| Safari | ✅ |
| Firefox | ❌ — falls back automatically |

Firefox does not implement the `AudioListener` position `AudioParam`s (`positionX`/`positionY`/`positionZ`, etc.) that Tone.js's `Listener` wraps eagerly at context initialization. `configureGlobalContext` feature-detects this (via `supportsNativeContextMode()`) and falls back to the default `standardized-audio-context` path with a `[playout]` console warning — built-in Tone.js effects keep working. Any subsequent WAM call (`addWamEffect`, `addWamEffectToTrack`, `editor.addWamPlugin`) throws with the same "requires a native AudioContext" instruction.

Check support yourself, and read back whether native mode actually activated:

```ts
import { supportsNativeContextMode, isNativeGlobalContext } from '@waveform-playlist/playout';

if (supportsNativeContextMode()) {
  configureGlobalContext({ nativeAudioContext: true });
}

// Later, anywhere in the app:
isNativeGlobalContext(); // true only once native mode is actually active
```

Side benefit of native mode: `sampleRate` is honored by the underlying `AudioContext` constructor. (Tone.js 15.1.22's default `standardized-audio-context` path compares the requested rate against the actual one and warns instead of forcing it.)

## React hooks

WAM support is layered onto the existing effects hooks — `useDynamicEffects()` (master chain) and `useTrackDynamicEffects()` (per-track chains), both from `@waveform-playlist/browser/tone`. Each active effect entry (`ActiveEffect` / `TrackActiveEffect`) carries a `kind: 'native' | 'wam'` discriminator and, for WAM entries, the plugin's module `url`.

### Adding a WAM plugin

```tsx
import { useDynamicEffects } from '@waveform-playlist/browser/tone';

function MasterRack() {
  const { activeEffects, addWamEffect, toggleBypass, removeEffect } = useDynamicEffects();

  const handleAddDelay = () =>
    addWamEffect('https://www.webaudiomodules.com/community/plugins/burns-audio/delay/index.js');

  return (
    <div>
      <button onClick={handleAddDelay}>+ Simple Delay</button>
      {activeEffects.map((effect) => (
        <div key={effect.instanceId}>
          {effect.definition.name}
          <button onClick={() => toggleBypass(effect.instanceId)}>
            {effect.bypassed ? 'Bypassed' : 'On'}
          </button>
          <button onClick={() => removeEffect(effect.instanceId)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

`addWamEffect(url, initialState?)` (master) and `addWamEffectToTrack(trackId, url, initialState?)` (per-track) dynamically import the optional `@dawcore/wam` peer, host the plugin on the global native context, and append it to the chain. Both resolve with the new entry's `instanceId`, and both throw if native-context mode isn't active (see [above](#enable-native-audiocontext-mode)). `initialState`, when provided, is passed to the plugin as its initial `setState()` snapshot.

### Bypass semantics

Built-in Tone effects bypass by zeroing their `wet` parameter — the node stays connected in the graph. WAM plugins have no `wet` parameter, so `toggleBypass` uses **disconnection bypass** instead: a bypassed WAM entry is dropped from the rebuilt chain entirely rather than silenced in place. Toggling it back on reinserts it at the same position.

### Mounting a plugin's GUI

`getWamPlugin(instanceId)` (master) / `getTrackWamPlugin(trackId, instanceId)` (per-track) return the live `WamPluginInstance` handle for a hosted entry — pass it to `WamEffectGui`:

```tsx
import { useDynamicEffects, WamEffectGui } from '@waveform-playlist/browser/tone';

function EffectPanel({ instanceId }: { instanceId: string }) {
  const { getWamPlugin } = useDynamicEffects();
  return <WamEffectGui plugin={getWamPlugin(instanceId)} />;
}
```

`WamEffectGui` mounts the plugin's own GUI (`plugin.createGui()`) when the plugin ships one, falling back to a generic parameter panel (from `@dawcore/wam`) for headless plugins. The GUI is destroyed on unmount — GUI and audio lifecycles are independent, so unmounting the GUI never interrupts sound.

### Discovering plugins

`fetchWamLibrary` / `fetchWamDescriptor` — imported directly from `@dawcore/wam`, not re-exported by `@waveform-playlist/browser` — fetch and validate community plugin manifests:

```ts
import { fetchWamLibrary, fetchWamDescriptor } from '@dawcore/wam';

const { entries, warnings } = await fetchWamLibrary(
  'https://www.webaudiomodules.com/community/plugins.json',
  { baseUrl: 'https://www.webaudiomodules.com/community/plugins/' }
);

// The community registry still lists some WAM 1.0 entries, which addWamEffect
// (createWamInstance) rejects by apiVersion. fetchWamDescriptor gives a more
// reliable per-entry audio-I/O check when the plugin ships a static descriptor.
const descriptor = await fetchWamDescriptor(entries[0].url);
```

Install note: `@dawcore/wam` is an **optional peer dependency** of `@waveform-playlist/browser` — install it explicitly:

```bash
npm install @dawcore/wam
```

Without it installed, `addWamEffect`/`addWamEffectToTrack` throw a friendly install-hint error on first call. Nothing is imported eagerly, so consumers who never touch WAM APIs pay zero bundle cost.

## Web Components (`<daw-editor>`) on the Tone backend

The same native-context requirement applies to `<daw-editor>` when using the Tone.js adapter. Call `configureGlobalContext` before `createToneAdapter()`:

```ts
import { createToneAdapter, configureGlobalContext } from '@waveform-playlist/playout';

configureGlobalContext({ nativeAudioContext: true });
const adapter = createToneAdapter();
editor.adapter = adapter;
```

Once wired up, the full dawcore effects surface works unchanged — `editor.addWamPlugin(url)`, per-track `addTrackWamPlugin(trackId, url)`, GUI mounting (`openEffectGui`/`closeEffectGui`), persistence (`getEffectsState`/`setEffectsState`), and offline `exportAudio()` all host WAM plugins on the Tone backend exactly as they do on the native `@dawcore/transport` adapter. See the [`@dawcore/components` README](https://github.com/naomiaro/waveform-playlist/blob/main/packages/dawcore/README.md#effects) for the full effects API — this guide covers only the additional step of enabling native-context mode for the Tone adapter.

Runnable demo: `examples/dawcore-tone/wam.html` (`pnpm example:dawcore-tone`).

## Limitations

- **WAV export skips WAM entries** (follow-up planned). `useExportWav()` renders offline via `Tone.Offline`, which creates its own `standardized-audio-context` context and cannot host WAM worklets. `createOfflineEffectsFunction()` and `createOfflineTrackEffectsFunction()` skip WAM entries with a console warning — only native Tone.js effects render into the exported WAV. A follow-up would render exports on a native `OfflineAudioContext` instead, mirroring dawcore's `exportAudio()`.
- **No tempo/transport broadcast on the Tone adapter** (follow-up planned). `@dawcore/wam`'s transport bridge (tempo-synced delays, LFOs, arpeggiators) needs a query surface the Tone adapter's `transport` doesn't implement yet. WAM plugins on the Tone backend receive audio but no transport/tempo events.
- **Web Components (`<daw-editor>`) on the Tone adapter:** per-track effect chains use the adapter's `transport.connectTrackOutput(trackId, node)` hook, which supports audio tracks only — adding a per-track chain to a MIDI-only track throws. Master chains work for all track types.
- **React hooks** are unaffected by this limitation: `useTrackDynamicEffects` wires chains through the track-effects closure, which applies to audio, MIDI, and SoundFont playout tracks alike.

## See also

- [Audio Effects](/docs/react/guides/effects) — built-in Tone.js effects and the core `useDynamicEffects`/`useTrackDynamicEffects` API
- [Hooks API Reference](/docs/react/api/hooks#effects-hooks) — full `UseDynamicEffectsReturn`/`UseTrackDynamicEffectsReturn` signatures
- [Web Components Getting Started](/docs/web-components/getting-started)
- Try it: [WAM! Kick It Up a Notch](pathname:///waveform-playlist/examples/wam-effects)
