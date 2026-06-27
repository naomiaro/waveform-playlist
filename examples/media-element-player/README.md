# MediaElement starter

A minimal **single-track audio player** built on `MediaElementPlaylistProvider` —
waveform, transport, and **pitch-preserving playback speed** (0.5×–2×).

The point of this example is the dependency list. It uses **only**:

- `@waveform-playlist/browser`
- `@waveform-playlist/media-element-playout`
- `react`, `react-dom`, `styled-components`

There is **no `@waveform-playlist/playout` and no `tone`** — the MediaElement
playback path (`HTMLAudioElement`, no Web Audio graph) needs neither. As of
v14 those engines are optional peer dependencies, so a MediaElement-only app
never installs or bundles them. (`@dnd-kit/*` are required peers of `browser`
for its editing path; they tree-shake out of a MediaElement-only bundle.)

## Run it (in this repo)

```bash
pnpm install
pnpm example:media-element     # → http://localhost:5176
```

The dev server resolves the workspace packages from source (see `vite.config.ts`),
so edits to the library are picked up without a rebuild. Audio + pre-computed
`.dat` peaks are served from `website/static`.

## What it shows

- `loadWaveformData(peaksSrc)` → a `MediaElementTrackConfig` (`{ source, waveformData, name }`).
- `MediaElementPlaylistProvider` + `MediaElementWaveform` for rendering.
- The four context hooks: `useMediaElementAnimation`, `useMediaElementState`,
  `useMediaElementControls`, `useMediaElementData`.
- Pitch-preserving rate control + a preserve-pitch toggle.
- The v14 `onError` prop surfacing init failures (e.g. a missing peer) in the UI.

## Using it in your own app

Install only what the MediaElement path needs:

```bash
npm install @waveform-playlist/browser @waveform-playlist/media-element-playout \
  @dnd-kit/abstract @dnd-kit/dom @dnd-kit/react react react-dom styled-components
```

A standalone (non-monorepo) `vite.config.ts` is just the standard React setup —
no source aliases needed, since you import the published packages:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

Copy `index.html` and `src/` as-is; point `AUDIO_SRC` / `PEAKS_SRC` in `src/App.tsx`
at your own audio file and its pre-computed peaks (generate `.dat`/`.json` with
[audiowaveform](https://github.com/bbc/audiowaveform) or the `waveform-data` library).
