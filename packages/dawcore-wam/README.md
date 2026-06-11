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

## Custom effects with Faust

You don't have to wait for someone to publish the effect you need — [Faust](https://faust.grame.fr/) is a DSP language that compiles to a standard WAM 2.0 bundle via [faust2wam](https://github.com/webaudiomodules/faust2wam). The generated plugins load through `addWamPlugin(url)` with **zero special handling**: descriptor validation, chain insertion, bypass, the auto-generated GUI, `getState()`/`setState()` persistence, and offline export all work out of the box.

The complete workflow, starting from a one-line lowpass filter:

**1. Write the DSP** (`lowpass.dsp`) — every `hslider`/`vslider`/`checkbox` declaration becomes a WAM parameter _and_ a control in the auto-generated GUI:

```text
import("stdfaust.lib");
process = fi.lowpass(2, hslider("cutoff", 1000, 20, 20000, 1));
```

(That's a mono filter. Track chains are stereo, so in practice duplicate it across both channels: `cutoff = hslider("cutoff", 1000, 20, 20000, 1); process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);` — or reach for the stereo demos in the standard library like `dm.zita_light` or `dm.flanger_demo`.)

**2. Compile it** with the faust2wam CLI (Node 16+, no Faust toolchain needed — the compiler ships as WebAssembly):

```bash
git clone https://github.com/webaudiomodules/faust2wam
cd faust2wam && npm install
node faust2wam.js lowpass.dsp out/lowpass
```

**3. Host the bundle** — `out/lowpass/` is a self-contained static directory (`index.js`, `descriptor.json`, `dsp-module.wasm`, dsp metadata, and vendored `sdk/`, `sdk-parammgr/`, `faustwasm/`, `faust-ui/` runtimes). Serve it from any static host; cross-origin hosting needs `Access-Control-Allow-Origin` headers (see the CORS note above). The `fftw/` and `host/` directories and the `.map`/`.d.ts` files are only needed for `-fft` plugins and standalone testing — safe to omit when hosting plain effects.

**4. Load it**:

```javascript
await track.addWamPlugin('https://your-host/out/lowpass/index.js');
```

Three pre-compiled Faust effects (the stereo lowpass, a `dm.zita_light` reverb, a `dm.flanger_demo` flanger) are bundled with the repo's example under [`website/static/faust-wams/`](https://github.com/naomiaro/waveform-playlist/tree/main/website/static/faust-wams) — each directory includes its `.dsp` source. Run `pnpm example:dawcore-wam` and click the buttons in the "Faust effects" section.

Faust-generated plugins are well-behaved WAM citizens; quirks observed (none need host-side handling):

- `getState()` returns a **flat parameter map** keyed by Faust paths (`{ "/Lowpass/cutoff": 250 }`) rather than the `{ params: ... }` envelope some plugins use. State is treated as an opaque snapshot, so persistence and offline cloning work unchanged.
- The descriptor always reports `hasMidiInput: true`, even for pure audio effects — harmless (effect validation only requires audio input + output).
- The GUI element sizes itself from faust-ui's computed `minWidth`/`minHeight` (inline styles, scrollable container) — it lays out fine in a normal document flow without a fixed-size plugin window.
- Parameter names/addresses derive from the DSP source (`declare name` + control labels), and the descriptor identifier becomes `fr.grame.faust.<name>` with vendor `Faust User`.

Dynamic in-browser compilation (paste Faust code, get a live plugin — faust2wam also ships as a browser library) is tracked separately in [#430](https://github.com/naomiaro/waveform-playlist/issues/430).

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
- `OfflineAudioContext` is accepted while `'suspended'`: offline rendering initializes the host _before_ `startRendering()`.

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
