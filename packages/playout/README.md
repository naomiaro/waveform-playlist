# @waveform-playlist/playout

Tone.js-based `PlayoutAdapter` for [`@waveform-playlist/engine`](https://www.npmjs.com/package/@waveform-playlist/engine) — drives playback, recording, and effects on a shared global audio context. Used by `@waveform-playlist/browser` (the React surface). For native Web Audio (no Tone.js), see `@dawcore/transport`.

## Audio context is a standardized-audio-context ponyfill

`getGlobalContext()` / `getGlobalAudioContext()` return Tone.js's global context, whose `rawContext` is **always** a [`standardized-audio-context`](https://github.com/chrisguttandin/standardized-audio-context) ponyfill — **not** a native `BaseAudioContext` / `AudioContext`. This is deliberate: the ponyfill normalizes cross-browser differences (e.g. Firefox `AudioWorkletNode` / `AudioParam`).

Consequences for integration:

- `getGlobalAudioContext() instanceof window.AudioContext` is `false`.
- The **native** `AudioWorkletNode` constructor rejects it — `new AudioWorkletNode(getGlobalAudioContext(), 'my-processor')` throws `TypeError: parameter 1 is not of type 'BaseAudioContext'` (same in Chrome and Firefox).

Third-party worklet code should not hardcode the native constructor. Inject the `AudioWorkletNode` constructor and the module loader (the dependency-injection pattern from [`chrisguttandin/limiter-audio-worklet`](https://github.com/chrisguttandin/limiter-audio-worklet) — paired with [`limiter-audio-worklet-processor`](https://github.com/chrisguttandin/limiter-audio-worklet-processor)), or import `AudioWorkletNode` from `standardized-audio-context`, so the code works on a native **or** ponyfilled context. `@waveform-playlist/worklets` follows this exact pattern:

```ts
// caller supplies addModule for whichever context type is in use
await addRecordingWorkletModule((url) => ctx.audioWorklet.addModule(url));
```

If you genuinely need a native `AudioContext`, own it yourself via the web-components adapter surface (`@dawcore/*`), which uses native Web Audio rather than Tone.
