---
'@waveform-playlist/core': minor
'@waveform-playlist/engine': minor
'@waveform-playlist/playout': major
'@waveform-playlist/browser': major
'@dawcore/transport': patch
'@dawcore/components': patch
---

**A track has a pan law of its own, decided by its first audio (#684).**

A track's pan law used to follow its clips (the highest channel count among them), so the law changed when the clips did: the first stereo clip joining a track of mono clips, or the last one leaving, moved the mono clips by 3 dB at centre, as a step; so did a stereo file that finished loading on a track already playing a mono clip.

Now every audio track has one law, `'mono'` (equal power, −3 dB per side at centre) or `'stereo'` (unity at centre, panning folds one channel into the other), and its clips never change it. The law is a mixer value of the arrangement, beside `pan`. It is `'auto'` until the track holds decoded audio; that audio decides it (stereo if a clip has two or more channels), in the same change that brings the audio. Adding or removing clips, recording a take, emptying the track or reusing its id for other material then leaves the law, and the level of what is on the track, where it was. The law converts no audio: a stereo clip on a `'mono'` track stays stereo, 3 dB lower at centre, and a hard pan mutes one side.

What changes for a track that mixes mono and stereo clips: it keeps the law of whichever audio came first, where before it had the stereo law whenever a stereo clip was on it. A new track whose first clips are a mono file and a stereo file that are both loading takes the law of whichever finishes first; give it a `panLaw` to choose. Tracks of one kind of clip sound as before.

- `@waveform-playlist/core`: `PanLaw` (`'auto' | 'mono' | 'stereo'`), `DecidedPanLaw`, `DEFAULT_PAN_LAW`, `isDecidedPanLaw`, `audioPanLaw(track)` and `trackPanLaw(track)` (the law a renderer pans with: the track's own when decided, else the law of its clips). `ClipTrack.panLaw` and `audioTrack({ panLaw })` are the law a track enters with. `createPanStage(context, pan, panLaw)` and `panMatrix(pan, panLaw)` take a law, `PanStage.setPanLaw(panLaw)` switches it with the four gains ramped over `PAN_LAW_RAMP_SECONDS` (10 ms), and `PanStageContext` includes `currentTime`.
- `@waveform-playlist/engine`: `TrackMixerValues.panLaw`; `setTrackPanLaw(trackId, 'mono' | 'stereo', options?)` on the arrangement and the engine, an undo step like the other mixer setters (any other value, `'auto'` included, throws a `TypeError`; nothing happens for a MIDI track). `PlayoutAdapter` gains an optional `setTrackPanLaw(trackId, panLaw)`; the tracks an adapter is sent carry the law in `panLaw`, and an adapter without the method is sent the track again when only the law changed. A file that finishes loading can turn `canUndo` false in one case: the law was set on a track whose only clip was still loading, and the clip turns out to have that law.
- `@waveform-playlist/playout`: the Tone adapter implements `setTrackPanLaw` and builds each track with `trackPanLaw(track)`; `ToneTrack.setPanLaw` and the fourth argument of `TonePlayout.replaceTrackClips` take a law. **Breaking:** `ToneTrackOptions.channelCount` is replaced by `panLaw` (`channelCount: 2` → `panLaw: 'stereo'`, `1` → `'mono'`); a leftover `channelCount` is ignored and the track gets the mono law.
- `@waveform-playlist/browser`: `TrackState.panLaw` (a new required field: add it where you build a `TrackState`), `useEditorControls().setTrackPanLaw`, `useTrack().panLaw` and `setPanLaw`. `exportWav` pans each track with the law in its state, else the track's own, and writes two channels when any audible track has the stereo law or a stereo clip.
- `@dawcore/transport`: `Transport.setTrackPanLaw` and `NativePlayoutAdapter.setTrackPanLaw` switch a track's law without touching its clips; `TrackNode` takes a law and has `setPanLaw`. Used without an engine, a track passed without `panLaw` still follows its clips (on `updateTrack` the step is now ramped); put `panLaw` on the tracks you pass in to keep the level where it is.
- `@dawcore/components`: `<daw-track pan-law="mono|stereo">` declares the law a track enters with, and the live `panLaw` property reads the arrangement's value (the editor writes no attribute). `addTrack` and `updateTrack` take `panLaw`, `editor.tracks` lists it (the exported `TrackDescriptor` gains a required `panLaw`), and `exportAudio()` pans each track with the law of its mix.

Measured in Chromium with a centred mono clip of constant 0.5, on the native transport and on the Tone adapter alike (a throwaway script): 0.3536 per side alone, with a stereo clip added to the track and after it was removed (before this change: 0.3536, 0.5, 0.3536); 0.5 after `setTrackPanLaw(id, 'stereo')` during playback, with the clip not interrupted; 0.3536 again after an undo.
