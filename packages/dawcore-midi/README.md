# @dawcore/midi

Framework-agnostic MIDI file loading and parsing for the dawcore family.

Used by `@dawcore/components` (the Lit web component layer, via `editor.loadMidi()`) and `@waveform-playlist/midi` (the React `useMidiTracks` hook).

## Exports

- `parseMidiFile(data, options?)` — parse a MIDI `ArrayBuffer`
- `parseMidiUrl(url, options?, signal?)` — fetch and parse a `.mid` URL
- Types: `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`, `MidiLoadOptions`, `MidiLoadResult`

## License

MIT
