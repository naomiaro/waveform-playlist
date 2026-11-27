---
'@waveform-playlist/recording': major
'@waveform-playlist/browser': patch
---

Recording hooks: a take is no longer lost when it ends without `stopRecording()`, and the hooks' state follows what their cleanups stop (#822).

**Fixed:**

- `useIntegratedRecording` adds the take to its track when the microphone is unplugged mid-take (it was stopped and dropped; `error` still says "Microphone disconnected during recording"), and when the component using the hook unmounts or is hidden by `<Activity>` mid-take.
- `useRecording`: after an `<Activity>` hide or a Fast Refresh mid-take, `isRecording` and `isPaused` are `false` and `audioBuffer` holds what was received (the worklet had been stopped while `isRecording` stayed `true`).
- `useMicrophoneAccess` no longer throws on mount where `navigator.mediaDevices` is undefined (an `http` origin that is not `localhost`); `requestAccess()` there sets an `error` that names the secure-context requirement. After an `<Activity>` hide or a Fast Refresh, `stream` is `null` and `hasPermission` is `false` (it kept returning the stopped stream).
- `useIntegratedRecording` does not fall back to another microphone while a take is running (asking for it stopped the stream the take was reading); the fallback happens when the take ends. `requestMicAccess` and `changeDevice` keep their identity when `audioConstraints` is written inline.
- `useMicrophoneAccess` logs failures with `console.warn` and the `[waveform-playlist]` prefix, the error as text.

- `useIntegratedRecording`: two `stopRecording()` calls for one take add it once (the second added it again, as a second undo step). A `startRecording()` still waiting when the component is hidden and shown again resolves `false` (it started a take on the stopped stream).

**Changed:** `UseIntegratedRecordingReturn.stopRecording` is typed `() => Promise<void>` (it always returned a promise; the type said `void`).

**Breaking:** the types `RecordingState` and `RecordingData`, and the `deviceId` and `audioConstraints` fields of `RecordingOptions`, are removed. Nothing read them: `useRecording` records the stream it is given. Choose the device and constraints with `useMicrophoneAccess().requestAccess(deviceId, audioConstraints)` or `useIntegratedRecording`'s `changeDevice` and `audioConstraints` option.

`@waveform-playlist/browser`: the doc comment of `useRecordingSession` says what an `<Activity>` hide does now (no code change).
