---
'@waveform-playlist/recording': major
---

`useIntegratedRecording`'s `selectedDevice` is the microphone that is open, and the hooks say when the device list can be offered before one is open (#945).

**Breaking:** `selectedDevice` is the id the open stream reports (`getSettings().deviceId`), and `null` while no microphone is open. It named the first device of the list once access was granted, until `changeDevice()` chose another, whether or not that device was the one open (with the `audioConstraints` option naming a device, that device was opened and the first of the list named), and it kept naming a device after a `changeDevice()` that failed. After `requestMicAccess()` it names the microphone that was opened: the default (`'default'` in Chromium, the id of its list's "Default" entry), or the one the `audioConstraints` option names. It is also `null` while a request is opening a microphone. A picker gives a `selectedDevice` that `devices` does not hold, `null` included, an option of its own ("Choose a microphone") in place of showing the first device.

**Added:** `hasLabels` on `useMicrophoneAccess` and `useIntegratedRecording`: `true` when `devices` names the real microphones. Browsers hide them until microphone permission is granted. In our runs (headless browsers, fake devices) Chromium holding the permission named them before any microphone was open, so an app can offer the list and open only the one chosen, with `changeDevice(id)` (or `requestAccess(id)`), without opening the default microphone first. Firefox and WebKit (Safari's engine) named them only once a microphone was open: there the first open is still `requestMicAccess()`.
