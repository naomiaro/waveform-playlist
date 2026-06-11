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

## Status

Part of the [WAM 2.0 plugin support epic](https://github.com/naomiaro/waveform-playlist/issues/413). Plugin loading, chain integration, GUI embedding, persistence, and transport sync land in subsequent releases.
