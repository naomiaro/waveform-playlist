---
'@dawcore/midi': patch
---

`MidiLoadOptions.signal` is documented as `<daw-editor>` now uses it: it cancels the fetch, the parse and the `addTrack` waits of `loadMidi()`, which rejects with the signal's `reason` and takes out the tracks it added with no undo step (#848).
