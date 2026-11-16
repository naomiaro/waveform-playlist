---
'@waveform-playlist/midi': major
---

`useMidiTracks` is removed, with its types `MidiTrackConfig`, `UseMidiTracksOptions` and `UseMidiTracksReturn` (part 6 of 6 for #812). It returned a `tracks` array for the `tracks` prop `WaveformPlaylistProvider` no longer has. Load a file with `loadMidiTracks(src, { sampleRate })` and add its tracks to the arrangement; for notes you already have, build the track with `createClipFromSeconds({ midiNotes, … })` and `createTrack({ kind: 'midi', … })` from `@waveform-playlist/core`. The package no longer has a `react` peer dependency. The upgrade guide has the replacement for each option of the hook: "`useMidiTracks` is removed: load with `loadMidiTracks`".
