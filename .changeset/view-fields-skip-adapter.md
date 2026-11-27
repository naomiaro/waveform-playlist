---
'@waveform-playlist/core': minor
'@waveform-playlist/engine': major
'@waveform-playlist/playout': patch
'@dawcore/transport': patch
---

A change to how a track is drawn no longer reaches the audio adapter. The fields that say how a track is drawn, `name`, `color`, `height`, `renderMode`, `spectrogramConfig` and `spectrogramColorMap`, are listed in core's new `TRACK_VIEW_FIELDS`. The engine gives a `PlayoutAdapter` its tracks without them, typed with core's new `PlayoutTrack` (`ClipTrack` without the view fields), and a change of those fields alone (`arrangement.updateTrack`, `engine.updateTrack`, an undo or redo of it) makes no adapter call. It is still an undo step and a `statechange`, and `getState().tracks` still has the fields.

Until now such a change was sent to the adapter as `updateTrack`, and on the native transport (`NativePlayoutAdapter`) an `updateTrack` stops the track's playing sources: a rename in `<daw-editor>` during playback cut the track's audio until its next clip started (read, from the same path the review of #930 ran for a render mode).

- `PlayoutAdapter.setTracks`, `addTrack` and `updateTrack` take `PlayoutTrack`. An adapter that reads one of the view fields gets `undefined`; with TypeScript, `track.name` on the parameter no longer compiles once the adapter's own signature says `PlayoutTrack`; an adapter whose methods still say `ClipTrack` keeps compiling (method parameters are checked bivariantly) and reads `undefined`.
- The adapter's tracks are copies of the engine's tracks that share their clips, so they are no longer the same objects as `getState().tracks`.
- `@waveform-playlist/playout`: the two SoundFont warnings of the Tone adapter ("SoundFont not loaded for track …", "SoundFont swap failed for track …") name the track by its id.

Migration: `website/docs/react/upgrading.md`, "Playout adapters are not given a track's view fields".
