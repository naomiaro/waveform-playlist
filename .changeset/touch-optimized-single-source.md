---
'@waveform-playlist/browser': minor
---

**`<ClipInteractionProvider touchOptimized>` now also widens the clip trim handles (#690).** Before, the provider's flag only configured the drag sensors, and the wider handles needed a second `touchOptimized` on `<Waveform>`; setting one without the other gave touch-delay sensors with small targets. The provider now publishes the flag and each clip reads it. The `touchOptimized` and `interactiveClips` props of `<Waveform>` are unchanged and still work alone, for a custom `DragDropProvider` setup.

Two visible consequences. An app that set `touchOptimized` on the provider only now gets 24px trim handles instead of 8px, and there is no way to keep the narrow handles under a touch-optimized provider. And `<PlaylistVisualization>` used directly inside a `ClipInteractionProvider` now gets interactive clips too; before, only `<Waveform>` read the provider.
