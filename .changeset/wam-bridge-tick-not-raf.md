---
'@dawcore/wam': patch
---

The `wam-transport` bridge no longer polls on `requestAnimationFrame` to detect tempo/meter-map boundary crossings during playback. rAF stops in a hidden tab while the transport keeps playing, so tempo-synced plugins went stale until the tab was shown again (#645). The bridge now subscribes to the transport's `tick` event (`@dawcore/transport` ≥ 0.0.15; an older transport still gets every event-driven rebroadcast, just not boundary detection) and also rebroadcasts after a loop wrap (detected as the position reading lower on a tick — the transport emits no event for a wrap) and on `discontinuity`, since both move the position plugins extrapolate from.
