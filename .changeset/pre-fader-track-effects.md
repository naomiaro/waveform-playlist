---
'@dawcore/transport': patch
'@dawcore/components': patch
'@waveform-playlist/playout': major
'@waveform-playlist/browser': major
'@waveform-playlist/core': patch
---

**Breaking: track effects are pre-fader inserts.** A track's effects now run before its volume, pan and mute — `clips → effects → volume → pan → mute → master` — the usual DAW convention, in every renderer: `@dawcore/transport`'s native track node, the Tone adapter (`ToneTrack`, `MidiToneTrack`, `SoundFontToneTrack`), `<daw-editor>.exportAudio()` and the React `useExportWav` render. Previously effects came last (`volume → pan → mute → effects`).

What changes in the sound:

- The volume fader sets the track's level in the mix; it no longer changes how hard a compressor, limiter or distortion works. Sessions with level-dependent track effects and a non-unity track volume will sound different.
- A mono clip reaches the chain as mono at full level (not two channels at −3 dB from a centred panner).
- Mute and solo silence a track including its effect tails.

API changes:

- `@dawcore/transport`: `connectTrackOutput(trackId, node)` / `disconnectTrackOutput(trackId)` are replaced by `connectTrackEffects(trackId, input, output)` / `disconnectTrackEffects(trackId)`. Pass the chain's first and last node; the transport returns the output into the track. Do not connect the chain to `masterOutputNode` yourself.
- `@waveform-playlist/playout`: the same rename on `adapter.transport` and `TonePlayout`; `ToneTrack.connectEffects(input, output)`. A `TrackEffectsFunction` is now called with the track's input and its fader input `(trackInput, faderInput, isOffline)` — a closure must end at its second argument; connecting to the master or `toDestination()` bypasses the track's volume, pan, mute and solo.
- `@waveform-playlist/browser`: `OfflineTrackEffectsFunction` follows the same `(trackInput, faderInput, isOffline)` contract.
- `@dawcore/components`: requires `@dawcore/transport` >= 0.0.16 (or `@waveform-playlist/playout` >= 13 on the Tone adapter); an adapter with only the old hook is refused with an upgrade hint.

Known limitation on Tone's default (standardized-audio-context) mode: a stereo effect on a mono track is summed to mono before the track's panner. Native-context mode (`configureGlobalContext({ nativeAudioContext: true })`) and `@dawcore/transport` keep it stereo.
