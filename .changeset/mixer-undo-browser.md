---
'@waveform-playlist/browser': major
---

browser: mixer moves are undo steps (#843). A mute, solo, volume or pan change is a step in the arrangement's history, with the clip edits, and an undo or a redo brings back the mix of the state it returns to: Undo after a fader move moves the fader back (before, it took back the previous edit and left the fader where it was). `usePlaylistMixer().trackStates` and `useTrack()` follow an undo.

- The setters of `useEditorControls()` (`setTrackMute`, `setTrackSolo`, `setTrackVolume`, `setTrackPan`) and the actions of `useTrack()` (`setMuted`, `setSoloed`, `setVolume`, `setPan`) take a last argument `options?: MixerChangeOptions` (from `@waveform-playlist/engine`): `{ gesture: id }` makes calls with one id one step, `{ undoable: false }` makes no step (for automation or a restored mix).
- `<TrackVolumeSlider />` and `<TrackPanSlider />` make one step per drag and per key press (a held key is one), with a `createMixerGesture()` each; a click on `<TrackMuteButton />` or `<TrackSoloButton />` is one step.
- A slider of the app's own that calls a setter on every move makes one step per move until it passes a gesture id (`createMixerGesture()` from `@waveform-playlist/core`, `gesture.attach(input)`, `{ gesture: gesture.id }`). A setter called from code is a step too.
- Keyboard Undo (`<KeyboardShortcuts undo />`) does not fire while a slider has focus (#730); an Undo button, or the key after focus has left the slider, works.

browser: the take's mute is the arrangement's. `setRecordingActive(true, trackId)` and `useRecordingSession` mark the track as the one the take is recording onto (`arrangement.setTrackRecording`) instead of muting it in the mix: the track plays muted, `trackStates` and `useTrack()` report it muted (`muted` is the track's own mute or the take's mute) and its `<TrackMuteButton />` is disabled, as before, while `arrangement.getMixer()` keeps the track's own mute. The take's mute is no undo step. A mute changed on the track during the take stays after it (before, the mute from before the take was written back whatever was set in between). `setRecordingActive(false)` and the provider's unmount clear it on every recording track. `TrackState.muted` and `TrackContextValue.muted` document this.
