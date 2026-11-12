---
'@waveform-playlist/browser': minor
---

**`<ClipInteractionProvider touchOptimized>` now also widens the clip trim handles (#690).** Before, the provider's flag only configured the drag sensors, and the wider handles needed a second `touchOptimized` on `<Waveform>`; setting one without the other gave touch-delay sensors with small targets. The provider now publishes the flag and each clip reads it. The `touchOptimized` and `interactiveClips` props of `<Waveform>` are unchanged and still work alone, for a custom `DragDropProvider` setup.
