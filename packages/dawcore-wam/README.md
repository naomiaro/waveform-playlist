# @dawcore/wam

Web Audio Modules (WAM 2.0) plugin hosting for the dawcore family. [WAM](https://github.com/webaudiomodules) is an open plugin standard for the Web Audio API — the browser equivalent of VST/AU. Plugins are ES modules loaded at runtime that expose an `AudioNode` for graph insertion plus their own GUIs.

This package is framework-agnostic (no Lit, no React). `@dawcore/components` consumes it as an **optional peer dependency** — `<daw-track>.addWamPlugin()` dynamic-imports it on first use, so non-WAM users pay zero bundle cost.

## Installation

```bash
npm install @dawcore/wam
```

## Using with `@dawcore/components`

The typical path: install this package next to `@dawcore/components` and use the WAM methods on `<daw-editor>` (master chain) and `<daw-track>` (per-track chain). Host initialization is implicit — the first `addWamPlugin()` call sets up the WAM host on the editor's AudioContext.

```javascript
const editor = document.querySelector('daw-editor');
const track = document.querySelector('daw-track');

// Load a plugin into a chain (the AudioContext must be running — call this
// from a user gesture). WAM entries are ordinary chain entries: bypass,
// move, remove, and the daw-effect-* events all work.
const wamId = await track.addWamPlugin(
  'https://www.webaudiomodules.com/community/plugins/burns-audio/delay/index.js'
);
const masterId = await editor.addWamPlugin(url); // master chain

// Plugin GUIs mount into a container YOU provide. Close hides without
// interrupting audio; the element is cached for instant reopen.
await track.openEffectGui(wamId, myPanelElement);
track.closeEffectGui(wamId);

// Persistence: serialize chains (WAM entries carry the plugin's getState()
// snapshot), restore later. An unreachable URL becomes a bypassed
// passthrough placeholder (daw-effect-error fires, the rest restores).
const saved = await track.getEffectsState();
await track.setEffectsState(saved);

// Transport sync is automatic: dawcore broadcasts wam-transport events
// (tempo, time signature, bar position, playing state) to every loaded
// plugin on play/pause/stop/seek and tempo/meter changes.

// Offline export renders through all chains — WAM plugins are
// re-instantiated on the OfflineAudioContext with their saved state
// (worklets are bound to one context).
const audioBuffer = await editor.exportAudio();
```

See [`examples/dawcore-wam/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-wam) for a runnable end-to-end demo (`pnpm example:dawcore-wam`): URL paste, community-library picker, GUIs, bypass/reorder, localStorage persistence with reload, and WAV export.

**CORS note:** plugins load cross-origin via dynamic `import()`, so they must be served with permissive CORS headers. The [webaudiomodules.com community registry](https://www.webaudiomodules.com/community/plugins.json) plugins (the burns-audio / Sequencer Party pack and the Wimmics WAM 2.x plugins) work; self-hosted plugins need `Access-Control-Allow-Origin` on the plugin files. Note the registry also lists WAM 1.0 and instrument-only plugins — those are rejected at load time with a clear error (this host supports WAM 2.x effects with audio input and output).

## Standalone Usage

### Host initialization

The WAM host is a one-time per-AudioContext setup that creates a plugin group for event routing between plugins on the same context.

```typescript
import { ensureWamHost } from '@dawcore/wam';

// Idempotent: concurrent and repeated calls for the same context share
// one initialization and resolve to the same host group.
const { hostGroupId } = await ensureWamHost(audioContext);
```

- Realtime contexts must be **running** (resume after a user gesture first) — host init loads an AudioWorklet module.
- `OfflineAudioContext` is accepted while `'suspended'`: offline rendering initializes the host *before* `startRendering()`.

### Plugin discovery

Two standard ways to find plugins in the WAM ecosystem, both supported:

**URL paste** — a direct URL to a plugin's ES module (its `index.js`) loads as-is. The descriptor is validated at load time, so a pasted URL either becomes a live plugin or fails with a clear error:

```typescript
import { createWamInstance } from '@dawcore/wam';

const plugin = await createWamInstance(
  'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/index.js',
  audioContext,
  hostGroupId
);
```

**`library.json` manifests** — JSON files listing plugins with metadata, used by WAM plugin collections:

```typescript
import { fetchWamLibrary } from '@dawcore/wam';

const { entries, warnings } = await fetchWamLibrary(
  'https://www.webaudiomodules.com/community/plugins.json',
  { baseUrl: 'https://www.webaudiomodules.com/community/plugins/' }
);
// entries: [{ name, url, description?, vendor?, thumbnail?, keywords? }, ...]
// warnings: per-entry messages for invalid entries that were skipped
```

An entry's `url` feeds straight into `createWamInstance(url, ...)`. Descriptor validation still happens at load time — manifests can lie.

#### Supported manifest schema

`fetchWamLibrary` supports the common denominator of the public WAM collections (the [webaudiomodules.com community registry](https://www.webaudiomodules.com/community/plugins.json) with the burns-audio pack, and pedalboard2/wam-studio libraries listing wam-examples plugins). A manifest is either:

- a **top-level array** of entries, or
- an **object with a `plugins` array** of entries (extra fields like `name`, `id`, `version`, `presets`, `includes` are ignored).

Each entry is either:

- an **object** — `name` (required) plus a plugin URL in `url` or `path` (required). Optional fields are passed through when well-formed: `description` (string), `vendor` (string), `thumbnail` (string URL), `keywords` (string array). Unknown fields are ignored.
- a **bare URL string** — the plugin URL; a display name is derived from the URL path (generic segments like `index.js`, `dist`, `src` are skipped, so `…/quadrafuzz/dist/index.js` becomes `quadrafuzz`).

Relative plugin and thumbnail URLs are resolved against the manifest URL — or against `options.baseUrl` for registries (like webaudiomodules.com) that keep paths relative to a directory next to the manifest.

Invalid entries (missing name, missing/unresolvable URL) are skipped with a per-entry message collected into `warnings` — one bad entry never fails the manifest. An unreachable manifest, invalid JSON, an unrecognized shape, or zero valid entries rejects with a `[waveform-playlist]`-prefixed error.

### Plugin GUIs

WAM plugins ship their own GUIs. `createWamInstance` exposes them as optional passthroughs — `plugin.createGui()` returns an `HTMLElement` you mount anywhere; `plugin.destroyGui(el)` releases it. Both are `undefined` for headless plugins. The GUI lifecycle is independent of the audio lifecycle: hiding or destroying a GUI never stops audio processing.

```typescript
if (plugin.createGui) {
  const gui = await plugin.createGui();
  myPanel.appendChild(gui);
  // later: plugin.destroyGui?.(gui);
}
```

### Generic parameter panel

For plugins without a GUI (or when `createGui` throws), build a plain-DOM panel of labeled range sliders from the plugin's parameter metadata:

```typescript
import { createWamParameterPanel, createParameterPanel } from '@dawcore/wam';

// From a WamNode: await getParameterInfo(), sliders wired to setParameterValues
const panel = await createWamParameterPanel(plugin.audioNode);
myPanel.appendChild(panel);

// Or from your own metadata (one code path for any "no custom GUI" effect)
const generic = createParameterPanel(
  [{ id: 'frequency', min: 20, max: 20000, step: 1, value: 1000, unit: 'Hz' }],
  (paramId, value) => console.log(paramId, value)
);
```

The panel is unstyled-but-themable: it reads the dawcore CSS custom properties (`--daw-controls-text`, `--daw-controls-background`, `--daw-wave-color`) with sensible fallbacks, and exposes stable class names (`daw-param-panel`, `daw-param-row`, `daw-param-name`, `daw-param-value`, `daw-param-slider`) for external styling.

### Transport sync

`createWamTransportBridge(transport, getPluginNodes)` broadcasts `wam-transport` events (`{ playing, tempo, timeSigNumerator, timeSigDenominator, currentBar, currentBarStarted }`) to all live plugin nodes so tempo-synced effects (delays, LFOs, arpeggiators) lock to the timeline. It rebroadcasts on play/pause/stop/seek and tempo/meter changes, plus a rAF watcher (active only while playing) that catches variable-tempo map boundary crossings, which emit no transport event.

```typescript
import { createWamTransportBridge } from '@dawcore/wam';

const bridge = createWamTransportBridge(adapter.transport, () => liveNodes);
bridge.notifyNodeAdded(node); // push current state to a plugin added mid-playback
bridge.dispose();
```

The `transport` argument is structural (`TransportQueryLike`) — `@dawcore/transport`'s `Transport` satisfies it. `@dawcore/components` creates the bridge automatically on the first `addWamPlugin()`.

### Offline rendering

WAM plugin nodes are AudioWorklets bound to one AudioContext — they cannot be moved to an `OfflineAudioContext`. `cloneInstanceInto(instance, offlineCtx, hostGroupId)` re-instantiates a plugin from its URL-cached factory on the offline context and transfers its `getState()` snapshot:

```typescript
import { ensureWamHost, cloneInstanceInto } from '@dawcore/wam';

const { hostGroupId } = await ensureWamHost(offlineCtx); // OK while 'suspended'
const offlinePlugin = await cloneInstanceInto(plugin, offlineCtx, hostGroupId);
// ...render...
offlinePlugin.destroy();
```

This is how `<daw-editor>.exportAudio()` renders WAM chains offline: each persisted entry is re-instantiated on the `OfflineAudioContext` with its saved state, and all offline instances are destroyed after rendering.
