---
'@dawcore/midi': patch
---

New: `loadMidiTracks(src, { sampleRate, flatten?, start?, duration?, name?, signal? })` and its options type `LoadMidiTracksOptions` (#807). It loads a URL, a `File` or a `Blob` as `kind: 'midi'` `ClipTrack[]` for an arrangement, without React. Both come from `@waveform-playlist/midi`, which is no longer published: after its React hook `useMidiTracks` was removed (#812), that package held only this function and a re-export of the parser defined here. Replace `@waveform-playlist/midi` with `@dawcore/midi` in your dependencies and imports (`parseMidiFile`, `parseMidiUrl`, `ParsedMidi`, `ParsedMidiTrack` and `ParseMidiOptions` keep their names). Coming from `useMidiTracks` (13.x): the upgrade guide, "`useMidiTracks` is removed: load with `loadMidiTracks`".
