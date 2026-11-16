---
'@waveform-playlist/browser': patch
'@waveform-playlist/recording': patch
---

- A track that gets its audio is applied to the running engine instead of rebuilding it, so dropping several files no longer rebuilds the engine once per file.
- Peak generation gives up on an audio buffer after three failed attempts instead of copying and sending it again every time the tracks change.
- `useRecording` detaches the worklet message handler when it unmounts.
