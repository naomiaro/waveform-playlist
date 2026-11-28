---
'@waveform-playlist/recording': major
'@waveform-playlist/browser': patch
---

Recording hooks: a take is no longer lost when it ends without `stopRecording()`, and the hooks' state follows what their cleanups stop (#822).

**Fixed:**

- `useIntegratedRecording` adds the take to its track when the microphone is unplugged mid-take (it was stopped and dropped), and when the component using the hook unmounts or is hidden by `<Activity>` mid-take. After an unplug its `error` is `useMicrophoneAccess`'s ("The microphone was disconnected or its permission was revoked. Request microphone access again."); `useRecording` used alone still reports "Microphone disconnected during recording".
- `useRecording`: after an `<Activity>` hide or a Fast Refresh mid-take, `isRecording` and `isPaused` are `false` and `audioBuffer` holds what was received (the worklet had been stopped while `isRecording` stayed `true`).
- `useMicrophoneAccess` no longer throws on mount where `navigator.mediaDevices` is undefined (an `http` origin that is not `localhost`); `requestAccess()` there sets an `error` that names the secure-context requirement. After an `<Activity>` hide or a Fast Refresh, `stream` is `null` and `hasPermission` is `false` (it kept returning the stopped stream).
- `useMicrophoneAccess`: when the microphone's track ends (unplugged, permission revoked), `stream` is `null`, `hasPermission` is `false` and `error` says so (it kept offering the ended stream, and the next take recorded silence). `requestMicAccess` and `changeDevice` keep their identity when `audioConstraints` is written inline.
- `useMicrophoneAccess` logs failures with `console.warn` and the `[waveform-playlist]` prefix, the error as text.

- `useIntegratedRecording`: two `stopRecording()` calls for one take add it once (the second added it again, as a second undo step). A `startRecording()` still waiting when the component is hidden and shown again resolves `false` (it started a take on the stopped stream); the same in `useRecording`. `requestMicAccess()` resets `selectedDevice` to the first of the list: it opens the default device, and `selectedDevice` kept naming a device chosen earlier with `changeDevice()`. Choose it again with `changeDevice(id)`. `useRecording`'s `startRecording()` refuses a stream whose microphone track has ended, with an `error` (it recorded silence).

**Changed:** `UseIntegratedRecordingReturn.stopRecording` is typed `() => Promise<void>` (it always returned a promise; the type said `void`).

**Breaking:** `useIntegratedRecording` no longer opens another microphone when the selected one leaves the device list (it asked for the first remaining device by itself, also mid-take, which stopped the stream the take was reading). The hooks open a microphone only when the app asks: `requestMicAccess()` or `changeDevice(id)`. `selectedDevice` still moves to a device that is in the list.

**Breaking:** the types `RecordingState` and `RecordingData`, and the `deviceId` and `audioConstraints` fields of `RecordingOptions`, are removed. Nothing read them: `useRecording` records the stream it is given. Choose the device and constraints with `useMicrophoneAccess().requestAccess(deviceId, audioConstraints)` or `useIntegratedRecording`'s `changeDevice` and `audioConstraints` option.

`@waveform-playlist/browser`: the doc comment of `useRecordingSession` says what an `<Activity>` hide does now (no code change).
