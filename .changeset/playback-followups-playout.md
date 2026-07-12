---
'@waveform-playlist/playout': patch
---

TonePlayoutAdapter reports duration-limited playback completion through onPlaybackEnded — the engine now observes bounded play(start, end) ending on the Tone path (#608)
