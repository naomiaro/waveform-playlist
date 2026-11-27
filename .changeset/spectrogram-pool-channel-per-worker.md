---
'@dawcore/spectrogram': patch
---

The spectrogram worker pool gives each worker only the audio it can be asked to compute. Worker 0 still holds every channel of a clip (it also computes the mono mix); worker k ≥ 1 now holds channel k alone, where it used to hold a copy of every channel. For a stereo clip on the default pool of two, that is three channel copies in the workers instead of four (a 3-minute stereo clip at 48 kHz: about 35 MB less); for an N-channel clip, 2N − 1 copies instead of N², (N − 1)² fewer. The clips replayed into a worker the pool adds for a clip with more channels follow the same rule. Audio sent with a multi-channel `computeFFT` request for audio that was not registered first is cut to the one channel each worker computes, worker 0 included: N copies per request instead of N². An id registered again with fewer channels than before is now dropped by the workers past the new count; they used to keep the old audio. What a spectrogram draws does not change.
