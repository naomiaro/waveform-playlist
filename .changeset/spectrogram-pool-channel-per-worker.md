---
'@dawcore/spectrogram': patch
---

The spectrogram worker pool gives each worker only the audio it computes. Worker 0 still holds every channel of a clip (it also computes the mono mix); worker k ≥ 1 now holds channel k alone, where it used to hold a copy of every channel. For a stereo clip on the default pool of two, that is three channel copies in the workers instead of four (a 3-minute stereo clip at 48 kHz: about 35 MB less); for an N-channel clip, 2N − 1 copies instead of N², (N − 1)² fewer. The same holds for the audio sent with a `computeFFT` request for audio that was not registered first, and for the clips replayed into a worker the pool adds for a clip with more channels. What a spectrogram draws does not change.
