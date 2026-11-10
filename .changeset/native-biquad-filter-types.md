---
'@dawcore/components': patch
---

Built-in biquad filter types beyond lowpass: `native-highpass`, `native-bandpass`, `native-notch` (frequency + q), `native-peaking` (frequency + q + gain), `native-lowshelf` and `native-highshelf` (frequency + gain). `native-filter` is unchanged (lowpass), so persisted chains restore as before.
