---
'@waveform-playlist/ui-components': major
'@waveform-playlist/browser': major
---

**Breaking: `parseTime` returns `null` for text that is not a time, and a `TimeInput` no longer commits it as 0** (#717, #815).

- `parseTime(text, format)` (`@waveform-playlist/ui-components`) and `useTimeFormat().parseTime` (`@waveform-playlist/browser`) return `number | null`. `null` is empty text, letters, a negative number, a number followed by anything else (`'1.5abc'` was 1.5), more than three `:` parts, minutes or seconds of 60 or more after a larger part (`00:75:00`) and decimals before the last part. Spaces around the text are ignored.
- The clock formats also read `1.5` (seconds) and `1:30` (minutes and seconds) besides `01:02:03.5`; the first part may be any size (`90`, `120:00`). `seconds` and `thousandths` read a plain number.
- `TimeInput` and both `SelectionTimeInputs` call nothing for text that is not a time and show the value again; until now `1.5` typed in an `hh:mm:ss.uuu` field moved the selection edge to 0.
- `formatTime` carries a rounding into the minutes and hours (`59.9996` in `hh:mm:ss.uuu` is `00:01:00.000`, not `00:00:60.000`), no longer wraps hours at 24 (`90061` is `25:01:01`), and prints a negative, `NaN` or infinite time as 0. Every other value prints as before.

See the upgrade guide, "`parseTime` returns `null` for text that is not a time".
