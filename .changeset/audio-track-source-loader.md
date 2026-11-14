---
'@waveform-playlist/core': minor
'@waveform-playlist/engine': patch
---

Add `createSourceLoader`, the `LoadingClip` and `PlaylistTrack` types (with `isLoadingClip`, `ClipSource` and `AudioClip.src`) and `audioTrack()`, which builds a track whose one clip names its audio by URL, `Blob`, `File`, `AudioBuffer` or peaks; `createClip`, `createClipFromSeconds` and `createClipFromTicks` take an optional `src`. The engine's `splitClip` keeps a clip's `src` on both halves.
