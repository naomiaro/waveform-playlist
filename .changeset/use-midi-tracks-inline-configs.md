---
'@waveform-playlist/midi': patch
---

`useMidiTracks` no longer loops when `configs` is written inline. The hook's effect was keyed on the identity of the `configs` array, so the documented usage, an array literal in the call, re-ran the load after every render without end. `configs` is now compared by value and tracks reload only when a config actually changes. Also: several `src` files are fetched in parallel instead of one after another (a URL shared by several configs is fetched once, tracks keep the config order), a config with neither `src` nor `midiNotes` is reported before anything is fetched, and deriving the duration of a very large `midiNotes` array no longer fails with "Maximum call stack size exceeded".
