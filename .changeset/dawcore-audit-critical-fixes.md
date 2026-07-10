---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (top findings):

- Handle `pointercancel` in the timeline and clip drag handlers — a canceled drag (touch interruption, pen leaving range, OS gesture) no longer leaves the drag armed on hover, no longer strands an open engine transaction (which silently broke undo for every subsequent edit), and no longer leaves moved clips visually desynced from audio.
- `<daw-player>` `play()` now resumes from the current position (pause→play and paused-seek→play keep their place; play-after-stop still starts at 0). Previously every `play()` restarted from 0.
- Recording controller teardown hardening: the "no audio data captured" path restores the armed-track transient mute (previously the punch-in track stayed engine-muted forever); a throw during stop finalization (buffer allocation, host stop) now cleans up the session and dispatches `daw-recording-error` instead of permanently wedging `isRecording` with a live mic graph; and a stop or host disconnect that lands during `startRecording`'s async setup window now cancels the start instead of being silently lost (lost stop / leaked capture session).
