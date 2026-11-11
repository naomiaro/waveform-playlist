---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': minor
---

**Breaking: `audioBuffers` is removed from `usePlaylistData()`.** It was a flat list of every clip's `AudioBuffer`, filled in by an effect, and nothing in the library read it. Read `clip.audioBuffer` from `tracks` instead; the upgrade guide at `/docs/react/upgrading` has the replacement.

`duration` and `peaksDataArray` are now derived from `tracks` during render instead of being set by effects, so they match `tracks` in the same render and a `tracks` change no longer renders the playlist a second time with fresh peaks. Peaks are cached per clip: an edit to one clip gives new arrays to that clip only, and every other clip, entry and per-track array of `peaksDataArray` keeps its identity. On the multi-clip example, trimming a clip went from 26 canvas redraws and 3 React commits per pointer move to 1 and 1 (counted with a Playwright probe in a development build; not a React Profiler measurement).

Worker-generated waveform data is looked up by `AudioBuffer`, and a worker job now keeps running when `tracks` changes instead of being started again for the same buffer.

`<Waveform>` no longer renders the text "Loading waveform..." before the first peaks exist; clips render at once and their waveforms fill in. Its `className` used to reach only that placeholder; it is now set on the playlist's outermost element (the one carrying `data-playlist-state`), through a new `className` prop on `Playlist` in `@waveform-playlist/ui-components`.
