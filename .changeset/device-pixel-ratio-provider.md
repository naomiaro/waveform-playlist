---
'@waveform-playlist/ui-components': patch
---

`DevicePixelRatioProvider` no longer adds a new `matchMedia` listener on every render. It now subscribes in an effect with cleanup (one listener at a time, re-subscribed when the ratio changes), and the module no longer reads `window.devicePixelRatio` when it is imported, so importing `@waveform-playlist/ui-components` on a server does not throw from this module.
