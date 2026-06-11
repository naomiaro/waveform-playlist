# @dawcore/wam

Web Audio Modules (WAM 2.0) plugin hosting for the dawcore family. [WAM](https://github.com/webaudiomodules) is an open plugin standard for the Web Audio API — the browser equivalent of VST/AU. Plugins are ES modules loaded at runtime that expose an `AudioNode` for graph insertion plus their own GUIs.

This package is framework-agnostic (no Lit, no React). `@dawcore/components` consumes it as an **optional peer dependency** — `<daw-track>.addWamPlugin()` dynamic-imports it on first use, so non-WAM users pay zero bundle cost.

## Installation

```bash
npm install @dawcore/wam
```

## Usage

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

## Status

Part of the [WAM 2.0 plugin support epic](https://github.com/naomiaro/waveform-playlist/issues/413). Plugin loading, chain integration, GUI embedding, persistence, and transport sync land in subsequent releases.
