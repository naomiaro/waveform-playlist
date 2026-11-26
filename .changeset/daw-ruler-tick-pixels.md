---
'@dawcore/components': patch
---

`<daw-ruler>`'s temporal ticks are each at the floor of their time's samples / `samplesPerPixel`, where the editor draws a clip starting at that time (when the time is a whole number of samples, which holds for every tick at the common sample rates except 11025 Hz). The previous formula rounded twice and put some ticks one pixel early, also at the default 1024 samples per pixel. A duration that is not a number now gives an empty ruler; it used to loop until the tick map overflowed (`RangeError: Map maximum size exceeded`).
