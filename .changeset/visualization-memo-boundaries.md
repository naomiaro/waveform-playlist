---
'@waveform-playlist/browser': patch
---

A selection drag, a seek and an active-annotation change during playback no longer re-render every track, clip, channel and track control panel. `PlaylistVisualization` is split into memoized track rows, clips and control panels that take no selection, cursor or annotation state, and small overlays (selection, playhead, annotation boxes, loop region) that read that state themselves. The `PlaylistInfoContext` value it provides is memoized, and a channel's played-portion overlay is the only part of it that follows the cursor.

On the multi-clip example (7 tracks, 13 clips), React components rendered per pointer move of a selection drag went from about 440 to 31 when dragging right and 63 when dragging left, where the cursor moves as well (counted from the fiber tree with a Playwright probe in a development build; not a React Profiler measurement). An edit to one clip re-renders that clip only, and a mixer change re-renders that track's panel only.

One thing to know if you pass `renderTrackControls`: it is now called when the tracks, their mixer state, the layout or the function itself change, not on every selection or cursor change. Controls that read playlist state through the context hooks are unaffected. A `renderTrackControls` wrapped in `useCallback` must list everything it reads in its dependencies, as any memoized callback must.

No API changes. `PlaylistVisualization.tsx` is also back under the file-size budget (#614).
