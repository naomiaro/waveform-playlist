---
'@waveform-playlist/core': minor
'@dawcore/transport': patch
'@dawcore/components': patch
'@waveform-playlist/playout': patch
'@waveform-playlist/browser': patch
---

**One pan stage for every renderer, and the native transport's pan law no longer follows the effects chain (#669).**

`@waveform-playlist/core` gains `createPanStage(audioContext, pan, sourceChannelCount)` and `panMatrix(pan, sourceChannelCount)`: a track pan stage built from plain gain, splitter and merger nodes, with the two Web Audio `StereoPannerNode` pan laws chosen by the track's **source** channel count (`trackChannelCount(track)`, which now accepts any `{ clips: [{ audioBuffer? }] }`). The stage has `setPan`, `setSourceChannelCount` and `dispose`.

- `@dawcore/transport`: `TrackNode` pans with the core stage instead of a `StereoPannerNode`. A `StereoPannerNode` picks its law from the signal it receives, which with pre-fader effects is the chain's output — a mono track with a stereo effect (a stereo reverb, most WAM plugins) was about 3 dB louder at centre, with a different pan curve. Now the law follows the track's clips, re-evaluated on `setTracks`, `addTrack` and `updateTrack`; `TrackNode` takes an optional `sourceChannelCount` (default 1) and has `setSourceChannelCount()`. **`@waveform-playlist/core` is now a runtime dependency of the transport** (its first; installed automatically).
- `@dawcore/components`: `exportAudio()` renders with the same stage and law as playback. Requires `@waveform-playlist/core` >= 12.7.0.
- `@waveform-playlist/playout` and `@waveform-playlist/browser`: the Tone adapter's tracks and the React WAV export use the core stage (native nodes on Tone's raw context). Sound is unchanged. The playout-local `createTrackPanStage` / `panMatrix` introduced alongside pre-fader effects were never published and are gone — import `createPanStage` / `panMatrix` from `@waveform-playlist/core`.

Behaviour change on the native transport: a track holding both mono and stereo clips is panned with the stereo law for all of its clips, so its mono clips play 3 dB louder at centre than on a mono-only track (the Tone adapter already worked this way). Previously the law depended on which clips were sounding at that moment. Tracks with only mono or only stereo clips and no stereo-widening effect sound exactly as before.
