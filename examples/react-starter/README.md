# React multitrack starter

The smallest **correct** setup for the full multitrack editor:
`WaveformPlaylistProvider` on the default Tone.js engine, three stem tracks with
the built-in track controls (mute / solo / volume / pan), transport buttons,
zoom, and master volume.

```bash
pnpm example:react-starter   # from the repo root → http://localhost:5177
```

## AudioContext and user gestures

> _"An AudioContext was prevented from starting automatically. It must be
> created or resumed after a user gesture on the page."_

**Seeing this warning in the console is normal and harmless — including in
this starter and in the online demos** (issue #620). Browsers log it whenever
an `AudioContext` is *created* outside a user gesture, even though the context
is only sitting there **suspended**. The provider deliberately creates its
audio engine eagerly on mount (so the first play/record never races an async
setup), which means the warning can appear at page load.

What matters is what happens on the first **Play** click:

- Decoding and waveform rendering happen up front (`useAudioTracks`) — that
  never needs a gesture.
- The first `play()` call *resumes* the suspended context (`Tone.start()`
  internally) — inside the click handler, i.e. a real user gesture. From that
  point audio runs normally.

So: **warning + audio works after clicking Play = everything is correct.** If
audio actually stays silent after a user clicks Play, that's a different
problem — the usual causes are:

1. **Creating your own AudioContext (or importing a library that does) at
   module load and playing through it programmatically.** `import * as Tone
   from 'tone'` eagerly creates a context — if you need Tone directly,
   dynamically `import('tone')` after a gesture. This starter never imports
   `tone` itself; the provider loads it lazily.
2. **Auto-playing on mount** (`useEffect(() => play(), [])`). A mount effect
   is not a gesture, so the resume is blocked. Let the user press Play.

## Adapting this to a standalone app

This example resolves the workspace packages from **source** via Vite aliases
(see `vite.config.ts`) so it always runs against the current checkout. In your
own app:

- `npm install @waveform-playlist/browser @waveform-playlist/playout tone react react-dom styled-components @dnd-kit/abstract @dnd-kit/dom @dnd-kit/react`
  and delete the `resolve.alias` / `resolve.dedupe` blocks — package resolution
  is normal outside the monorepo. (`@dnd-kit/*` are required peers of
  `@waveform-playlist/browser` even if you never enable clip dragging — they
  tree-shake out of the bundle.)
- Add `@vitejs/plugin-react` for Fast Refresh (this example skips it to avoid
  the dependency; esbuild's automatic JSX runtime is enough for a demo).
- Serve your own audio files and point `audioConfigs` at them (`publicDir`
  here borrows the repo's shared website assets).

## Where to go next

- Clip editing (drag / trim / split): wrap the UI in `ClipInteractionProvider`
  and pass `interactiveClips` — see the website's multi-clip example.
- Track reordering: `<Waveform trackReordering />` inside
  `ClipInteractionProvider` — see the stem-tracks example.
- Single-track playback without Tone.js: see `examples/media-element-player`.
