---
'@waveform-playlist/recording': major
---

`useIntegratedRecording`'s `selectedDevice` is the microphone that is open, and the hooks say when the device list can be offered before one is open (#945).

**Breaking:** `selectedDevice` is the id the open stream reports (`getSettings().deviceId`), and `null` while no microphone is open. It named the first device of the list once access was granted, which was not always the open one (in a browser whose list has no "default" entry, the default microphone can be listed second), and it kept naming a device after a `changeDevice()` that failed. After `requestMicAccess()` it names the default microphone that was opened (`'default'` in Chromium, the id of its list's "Default" entry). A picker gives `null` an option of its own ("Choose a microphone") in place of showing the first device.

**Added:** `hasLabels` on `useMicrophoneAccess` and `useIntegratedRecording`: `true` when `devices` names the real microphones. Browsers hide them until microphone permission is granted. Chromium, when it already holds the permission, names them before any microphone is open, so an app can offer the list and open only the one chosen, with `changeDevice(id)` (or `requestAccess(id)`), without opening the default microphone first. Firefox and Safari name them only once a microphone is open: there the first open is `requestMicAccess()`, the default microphone.
