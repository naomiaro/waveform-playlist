---
'@dawcore/components': patch
---

`<daw-ruler>`'s temporal ticks are each at the floor of their time's samples / `samplesPerPixel`, the pixel a clip starting at that time is drawn at. The previous formula rounded twice and put some ticks one pixel early (at 48000 Hz and 441 samples per pixel, `2:27` at 15999 instead of 16000). A duration that is not a number now gives an empty ruler; it used to loop until the tick map overflowed (`RangeError: Map maximum size exceeded`).
