---
'@waveform-playlist/core': minor
'@dawcore/transport': patch
'@dawcore/components': patch
'@waveform-playlist/playout': patch
'@waveform-playlist/browser': patch
---

**One pan stage for every renderer, and the native transport's pan law no longer follows the effects chain (#669).**

`@waveform-playlist/core` gains `createPanStage(audioContext, pan, panLaw)` and `panMatrix(pan, panLaw)`: a track pan stage built from plain gain, splitter and merger nodes, with the two Web Audio `StereoPannerNode` pan laws chosen by the caller (`'mono'` or `'stereo'`; which law a track has is described in `track-pan-law.md`, #684). `trackChannelCount(track)` now accepts any `{ clips: [{ audioBuffer? }] }`. The stage has `setPan`, `setPanLaw` and `dispose`.

- `@dawcore/transport`: `TrackNode` pans with the core stage instead of a `StereoPannerNode`. A `StereoPannerNode` picks its law from the signal it receives, which with pre-fader effects is the chain's output — a mono track with a stereo effect (a stereo reverb, most WAM plugins) was about 3 dB louder at centre, with a different pan curve. Now the law is the track's own (#684), read on `setTracks`, `addTrack` and `updateTrack`; `TrackNode` takes an optional `panLaw` (default `'mono'`) and has `setPanLaw()`. **`@waveform-playlist/core` is now a runtime dependency of the transport** (its first; installed automatically).
- `@dawcore/components`: `exportAudio()` renders with the same stage and law as playback. Requires `@waveform-playlist/core` >= 12.7.0.
- `@waveform-playlist/playout` and `@waveform-playlist/browser`: the Tone adapter's tracks and the React WAV export use the core stage (native nodes on Tone's raw context). `adapter.updateTrack` now passes the track's law with the clips (`ToneTrack.setPanLaw`, and an optional fourth `panLaw` argument on `TonePlayout.replaceTrackClips`), where before the law was fixed when the track was first built — so playback and the WAV export could use different laws for a track whose clips had changed. Otherwise sound is unchanged. The playout-local `createTrackPanStage` / `panMatrix` introduced alongside pre-fader effects were never published and are gone — import `createPanStage` / `panMatrix` from `@waveform-playlist/core`.

Tracks with only mono or only stereo clips and no stereo-widening effect sound exactly as before. What a track that mixes mono and stereo clips does is in `track-pan-law.md` (#684): it keeps the law of its first audio.
