---
'@waveform-playlist/browser': major
---

**Breaking: `interactiveClips` and `touchOptimized` are removed from `<Waveform>` and `<PlaylistVisualization>`; the new `ClipInteractionOptions` is their one source (#690).** Each clip reads the two options from context. `ClipInteractionProvider` sets them, so `<ClipInteractionProvider touchOptimized>` now also widens the trim handles (8px to 24px) with no second flag. With your own `DragDropProvider`, wrap the waveform in `<ClipInteractionOptions enabled touchOptimized>`. Nested inside a provider it changes one option for part of the tree (`touchOptimized={false}`, `enabled={false}`). `<PlaylistVisualization>` used directly inside a `ClipInteractionProvider` now has interactive clips. See `/docs/react/upgrading`.
