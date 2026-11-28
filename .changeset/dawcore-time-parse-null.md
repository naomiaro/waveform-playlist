---
'@dawcore/components': patch
---

`parseDisplayTime` returns `null` for text that is not a time instead of 0 (empty text, letters, a negative number, a number followed by other text, minutes or seconds of 60 or more after a larger part), and the clock formats read `1.5` and `1:30` as well as `00:01:30.000`: the same rule as `parseTime` in `@waveform-playlist/ui-components` (#815). Its type is `number | null`. `<daw-annotation-list>` carries milliseconds that round up to 1000 into the seconds: `1:00.000` for 59.9996 s, where it printed `0:59.1000`.
