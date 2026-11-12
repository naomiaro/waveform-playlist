---
'@waveform-playlist/core': major
'@waveform-playlist/engine': major
'@waveform-playlist/playout': major
'@waveform-playlist/browser': major
'@waveform-playlist/recording': major
'@waveform-playlist/midi': minor
'@dawcore/components': patch
---

A track has a kind, audio or MIDI, and holds clips of that kind only (#756).

**Breaking:**

- `@waveform-playlist/core`: `ClipTrack.kind: 'audio' | 'midi'` is required. `createTrack()` takes an optional `kind` (default `'audio'`). New: the `TrackKind` type, `clipKind(clip)`, `trackKind(track)`, `assertTrackKind(track)` (throws when a clip is not of the track's kind) and `splitTrackByKind(track, midiTrackId?)` (turns a track from before this change, mixed or without a kind, into valid tracks).
- `@waveform-playlist/engine`: `setTracks`, `addTrack` and `updateTrack(id, track)` throw on a track whose clips do not match its kind, before changing any state.
- `@waveform-playlist/playout`: `createToneAdapter` builds one playout track per track, from its kind. The second playout track of a mixed track (`id + ':midi'`) and the code that kept the two in step are removed, with the `ToneTrack.trackInput` getter that joined them.
- `@waveform-playlist/browser`: the render mode follows the kind. A MIDI track is a piano roll (also while empty); an audio track never is. A track the engine rejects is reported through the provider's `onError` and the playlist stays in its loading state. Each track row carries `data-track-kind="audio|midi"`.
- `@waveform-playlist/recording`: `useIntegratedRecording().startRecording()` refuses a MIDI track (returns `false`, sets `error`). Before, the take was added to the MIDI track and carved its MIDI clips. A take is added to the track it was started on, not to the track selected when it stops: the target cannot be switched mid-take. New return field `recordingTrackId` (that track's id, `null` when no take is running) for the live preview's `recordingState.trackId`.
- `@dawcore/components`: `<daw-track kind="audio|midi">` (reflected, default `audio`); `TrackConfig.kind` and `TrackDescriptor.kind`. `render-mode="piano-roll"` no longer makes a MIDI track. A clip of the wrong kind is not added and is reported with `daw-clip-error`; recording onto a MIDI track dispatches `daw-recording-error`. `loadMidi()` and `addTrack({ midi })` set the kind.

**Not breaking:** `@waveform-playlist/midi`: `useMidiTracks` returns tracks with `kind: 'midi'`.

**Why:** a track with both kinds became two playout tracks in the Tone.js adapter, and every per-track operation (mute, solo, volume, pan, effects, removal, SoundFont swap) had to address both; that pairing was the source of several bugs. The native transport never played MIDI clips, both WAV exports skip them, and the views drew such a track with one render mode for both kinds.

Migration: `website/docs/react/upgrading.md`, "A track has a kind: audio or MIDI, never both" and "Web components: `<daw-track kind="midi">` declares a MIDI track".
