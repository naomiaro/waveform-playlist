---
'@waveform-playlist/recording': major
---

`useMicrophoneAccess` and `useIntegratedRecording` no longer return `hasPermission`; a microphone is open when `stream !== null` (#947). The field was a second copy of that and could disagree with it: a `stopStream()` during a device switch, or a hide (or Fast Refresh) while its grant arrived, left it `true` with no stream, so a Record button stayed enabled and `startRecording()` failed. During a device switch `stream` is `null` (the request stops the open microphone first), where `hasPermission` stayed `true`. Neither says whether the browser holds the permission.

- A request to `useMicrophoneAccess` that was waiting for the browser when the component was hidden (or on a Fast Refresh) opens nothing: the microphone it is granted is stopped, also when the grant arrives after the component is shown again, and a refusal sets no `error`. Before, a grant that arrived after the show was installed.
- `isLoading` is `false` after `stopStream()` and after a hide, also when a request was waiting. A `stopStream()` during a request left it `true`, and a hide left it `true` until the browser answered.
