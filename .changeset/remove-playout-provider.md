---
'@waveform-playlist/ui-components': major
'@waveform-playlist/browser': major
---

**Breaking: `PlayoutProvider`, `usePlayoutStatus` and `usePlayoutStatusUpdate` are removed.** They were a standalone playback-status context that nothing in Waveform Playlist read or wrote, so it never reflected real playback. Use the hooks of the playlist provider instead (`usePlaybackAnimation`, `usePlaylistState`, `usePlaylistControls` from `@waveform-playlist/browser`); the upgrade guide at `/docs/react/upgrading` has the full mapping.

**Breaking: `TimeInput` calls `onChange` only after an edit.** It used to call it on every blur with the displayed text parsed back, so moving focus through a selection input rounded the selection to the display format. `SelectionTimeInputs` calls `onSelectionChange` under the same condition, and so the `SelectionTimeInputs` of `@waveform-playlist/browser` no longer sets the selection when focus merely passes through.

Also in `TimeInput`: the displayed value is derived during render instead of in an effect. The first render shows the formatted value (it was an empty string) and a `value` change renders once instead of twice. Text being typed is no longer overwritten when `value` changes mid-edit; a `format` change still abandons the edit.
