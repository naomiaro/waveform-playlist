---
'@waveform-playlist/browser': patch
'@waveform-playlist/recording': patch
---

- `useDynamicTracks` works under `<StrictMode>`: decoded tracks were dropped and placeholders stayed "(loading...)".
- A placeholder track that gets its audio is applied to the running engine instead of rebuilding it, so dropping several files no longer rebuilds the engine once per file. In general, a `tracks` change in which an empty track gets its clips is now incremental.
- Peak generation gives up on an audio buffer after three failed attempts instead of copying and sending it again on every `tracks` change.
- `useRecording` detaches the worklet message handler when it unmounts.
