---
'@dawcore/components': patch
'@waveform-playlist/browser': patch
---

`openEffectGui()` and `<WamEffectGui>` now show the generic parameter panel for a WAM plugin that has no GUI of its own. The WAM SDK's base `createGui()` exists on every plugin and resolves with no element when the plugin ships no GUI; both hosts treated that as a GUI and failed to append it, so nothing was shown (`openEffectGui` rejected). Only GUIs the plugin created are passed to its `destroyGui`.

This is what a Faust plugin compiled with `faust2wam` looks like once `faust-ui` (GPL-3.0-or-later) is removed from it. See the new Precompiled Faust Effects guide.
