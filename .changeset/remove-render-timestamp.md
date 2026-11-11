---
'@waveform-playlist/browser': major
---

**Breaking: the deprecated `renderTimestamp` prop of `<Waveform>` is removed.** It was typed as receiving a time in milliseconds but received the minutes part of the formatted tick label (`"0:30"` gave `0`, `"1:00"` gave `1`), or the bar and beat read as a decimal number in beats mode (`"2.3"` gave `2.3`) (#714). Use `renderTick(label, pixelPosition)`; the upgrade guide at `/docs/react/upgrading` shows how to get milliseconds from the label.
