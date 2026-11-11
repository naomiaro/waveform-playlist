---
sidebar_position: 5
description: "Add real-time audio effects like reverb, delay, chorus, and compression using Tone.js"
---

# Audio Effects

Waveform Playlist includes a comprehensive set of audio effects powered by [Tone.js](https://tonejs.github.io/). Effects can be applied to individual tracks or the master output.

## Available Effects

### Reverb Effects

#### Reverb
Simple convolution reverb with adjustable decay time.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| decay | 0.1 - 10 s | 1.5 | Reverb tail decay time |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

#### Freeverb
Classic Schroeder/Moorer reverb algorithm with room size and dampening controls.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| roomSize | 0 - 1 | 0.7 | Size of the simulated room |
| dampening | 0 - 10000 Hz | 3000 | High frequency dampening |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

#### JC Reverb
Emulation of the Roland JC-120 Jazz Chorus reverb.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| roomSize | 0 - 1 | 0.5 | Size of the simulated room |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

---

### Delay Effects

#### Feedback Delay
Delay line with regenerating feedback for echo effects.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| delayTime | 0 - 1 s | 0.25 | Delay time |
| feedback | 0 - 0.95 | 0.5 | Amount of signal fed back |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

#### Ping Pong Delay
Stereo delay that bounces between left and right channels.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| delayTime | 0 - 1 s | 0.25 | Delay time |
| feedback | 0 - 0.95 | 0.5 | Amount of signal fed back |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

---

### Modulation Effects

#### Chorus
Creates thickness by layering detuned copies of the signal.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 10 Hz | 1.5 | LFO modulation rate |
| delayTime | 0 - 20 ms | 3.5 | Base delay time |
| depth | 0 - 1 | 0.7 | Modulation depth |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

#### Phaser
Classic phaser effect using allpass filters.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 10 Hz | 0.5 | LFO modulation rate |
| octaves | 1 - 6 | 3 | Number of octaves to sweep |
| baseFrequency | 100 - 2000 Hz | 350 | Base filter frequency |
| wet | 0 - 1 | 0.5 | Dry/wet mix |

#### Tremolo
Rhythmic volume modulation.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 20 Hz | 4 | Modulation rate |
| depth | 0 - 1 | 0.5 | Modulation depth |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### Vibrato
Pitch modulation effect.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 20 Hz | 5 | Modulation rate |
| depth | 0 - 1 | 0.1 | Pitch deviation amount |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### Auto Panner
Automatic left-right panning.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 10 Hz | 1 | Panning rate |
| depth | 0 - 1 | 1 | Panning amount |
| wet | 0 - 1 | 1 | Dry/wet mix |

---

### Filter Effects

#### Auto Filter
Automated filter sweep with LFO.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| frequency | 0.1 - 10 Hz | 1 | LFO modulation rate |
| baseFrequency | 20 - 2000 Hz | 200 | Base filter frequency |
| octaves | 0.5 - 8 | 2.6 | Filter sweep range |
| depth | 0 - 1 | 1 | Modulation depth |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### Auto Wah
Envelope follower filter effect that responds to input dynamics.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| baseFrequency | 20 - 500 Hz | 100 | Base filter frequency |
| octaves | 1 - 8 | 6 | Filter sweep range |
| sensitivity | -40 - 0 dB | 0 | Input sensitivity |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### 3-Band EQ
Three band parametric equalizer.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| low | -24 - 24 dB | 0 | Low frequency gain |
| mid | -24 - 24 dB | 0 | Mid frequency gain |
| high | -24 - 24 dB | 0 | High frequency gain |
| lowFrequency | 20 - 500 Hz | 400 | Low band crossover |
| highFrequency | 1000 - 10000 Hz | 2500 | High band crossover |

---

### Distortion Effects

#### Distortion
Wave shaping distortion effect.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| distortion | 0 - 1 | 0.4 | Distortion amount |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### Bit Crusher
Reduces bit depth for lo-fi digital texture.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| bits | 1 - 16 | 4 | Bit depth |
| wet | 0 - 1 | 1 | Dry/wet mix |

#### Chebyshev
Waveshaping distortion using Chebyshev polynomials for rich harmonic content.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| order | 1 - 100 | 50 | Polynomial order (harmonic complexity) |
| wet | 0 - 1 | 1 | Dry/wet mix |

---

### Dynamics Effects

#### Compressor
Dynamic range compressor for controlling volume peaks.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| threshold | -60 - 0 dB | -24 | Level where compression starts |
| ratio | 1 - 20 | 4 | Compression ratio |
| attack | 0 - 1 s | 0.003 | Attack time |
| release | 0 - 1 s | 0.25 | Release time |
| knee | 0 - 40 dB | 30 | Soft knee width |

#### Limiter
Hard limiter to prevent clipping.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| threshold | -12 - 0 dB | -6 | Maximum output level |

#### Gate
Noise gate to silence signal below threshold.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| threshold | -100 - 0 dB | -40 | Gate threshold |
| attack | 0 - 0.3 s | 0.001 | Attack time |
| release | 0 - 0.5 s | 0.1 | Release time |

---

### Spatial Effects

#### Stereo Widener
Expands or narrows the stereo image.

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| width | 0 - 1 | 0.5 | Stereo width (0 = mono, 1 = wide) |

---

## Usage

### Dynamic Master Effects (Add/Remove at Runtime)

`useDynamicEffects()` owns the master chain. It returns the chain as a source (`effects`), not as React state, and everything it returns keeps its identity between renders. Read the list with `useActiveEffects(effects)` in the component that draws the rack: that component re-renders when the chain changes (an effect added, removed, moved, bypassed, or a parameter set), and the component that called `useDynamicEffects()` does not.

```tsx
import {
  useDynamicEffects,
  useActiveEffects,
  type UseDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

function App() {
  const masterFx = useDynamicEffects();

  return (
    <WaveformPlaylistProvider effects={masterFx.masterEffects} tracks={tracks}>
      <EffectsRack masterFx={masterFx} />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

// Only this component re-renders on a slider step.
function EffectsRack({ masterFx }: { masterFx: UseDynamicEffectsReturn }) {
  const { effects, availableEffects, addEffect, removeEffect, updateParameter, toggleBypass } =
    masterFx;
  const activeEffects = useActiveEffects(effects);

  return (
    <div>
      {/* Effect selector */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) addEffect(e.target.value).catch(console.error);
        }}
      >
        <option value="">Add Effect...</option>
        {availableEffects.map((def) => (
          <option key={def.id} value={def.id}>{def.name}</option>
        ))}
      </select>

      {/* Active effects with controls */}
      {activeEffects.map((effect) => (
        <div key={effect.instanceId}>
          <h4>{effect.definition.name}</h4>
          {effect.definition.parameters
            .filter((param) => param.type === 'number')
            .map((param) => (
              <input
                key={param.name}
                type="range"
                aria-label={param.label}
                min={param.min}
                max={param.max}
                step={param.step}
                value={effect.params[param.name] as number}
                onChange={(e) =>
                  updateParameter(effect.instanceId, param.name, parseFloat(e.target.value))
                }
              />
            ))}
          <button onClick={() => toggleBypass(effect.instanceId)}>
            {effect.bypassed ? 'Enable' : 'Bypass'}
          </button>
          <button onClick={() => removeEffect(effect.instanceId)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

`addEffect(id)` returns a `Promise<string>` that resolves with the new entry's `instanceId`. A built-in effect is in the chain before the call returns; the promise is there for [custom effects](#custom-effects), which may load a worklet first. An id that is neither a built-in nor a registered type rejects.

`availableEffects` lists the effects that can be added: the built-in effects and, when the app is in native AudioContext mode, the [custom effects](#custom-effects) registered so far. It is read when the component that called the hook renders and is not a subscription, so a type registered after that render appears only on that component's next render. Adding by id does not depend on the list: `addEffect('my-id')` works for any registered type. Effects that belong to another library's own catalogue in the shared registry are not listed: when `@dawcore/components` is loaded on the same page, its `native-*` effects stay out of the React list (they are marked `builtIn`), and can still be added by id.

### Lifetime of a chain

A chain behaves like React state: it survives a StrictMode remount, Fast Refresh and a hidden `<Activity>`, with its list and its live effect instances.

- To add default effects once on mount, guard the effect with a ref. An unguarded `useEffect(() => { addEffect('reverb'); }, [])` adds two reverbs under StrictMode in development, as any non-idempotent effect on surviving state does.

  ```tsx
  const addedDefaults = useRef(false);
  useEffect(() => {
    if (addedDefaults.current) return;
    addedDefaults.current = true;
    addEffect('reverb').catch(console.error);
  }, [addEffect]);
  ```

- When the component that owns the hook unmounts for good, its effect instances are not disposed at that moment. They are disposed when the chain is garbage-collected, which is best effort: not prompt and not guaranteed. To release them at a known moment (an AudioWorklet that keeps processing, a WAM plugin), call `clearAllEffects()`, or `clearTrackEffects(trackId)` for each track, before the component goes away.
- `clearAllEffects()` and `clearTrackEffects(trackId)` also drop an add that is still in flight (a custom effect's `prepare`, a WAM plugin loading): its promise rejects with an "aborted: the effects chain was cleared" error and nothing is appended. An unmount does not abort an add.

If a change cannot be wired (for example an effect whose nodes belong to another AudioContext), the previous chain is restored, the new instance is disposed, the list is left as it was, and the add rejects.

### Per-Track Effects

`useTrackDynamicEffects()` keeps one chain per track id. Pass its `getTrackEffectsFunction` to the provider's `trackEffects` prop, and read one track's chain with `useActiveEffects(getTrackEffects(trackId))`.

```tsx
import {
  useTrackDynamicEffects,
  useActiveEffects,
  type UseTrackDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

function App() {
  const trackFx = useTrackDynamicEffects();

  // The provider looks a track's effects function up by track id. `tracks` is
  // passed as it is: do not copy the track objects to attach anything to them.
  return (
    <WaveformPlaylistProvider tracks={tracks} trackEffects={trackFx.getTrackEffectsFunction}>
      {tracks.map((track) => (
        <TrackRack key={track.id} trackId={track.id} trackFx={trackFx} />
      ))}
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

function TrackRack({ trackId, trackFx }: { trackId: string; trackFx: UseTrackDynamicEffectsReturn }) {
  const entries = useActiveEffects(trackFx.getTrackEffects(trackId));

  return (
    <div>
      <button onClick={() => trackFx.addEffectToTrack(trackId, 'reverb').catch(console.error)}>
        Add reverb
      </button>
      {entries.map((effect, index) => (
        <div key={effect.instanceId}>
          {effect.definition.name}
          <button
            disabled={index === 0}
            onClick={() => trackFx.reorderTrackEffects(trackId, index, index - 1)}
          >
            Move up
          </button>
          <button onClick={() => trackFx.toggleBypass(trackId, effect.instanceId)}>
            {effect.bypassed ? 'Enable' : 'Bypass'}
          </button>
          <button onClick={() => trackFx.removeEffectFromTrack(trackId, effect.instanceId)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Bypass

`toggleBypass` takes an effect out of the signal without removing it from the list.

- An effect with a wet/dry control (`ActiveEffect.wetParam` is set) stays connected and its wet level is set to 0. Its stored wet value is restored when the bypass is turned off.
- An effect without one (the built-in compressor, limiter, gate and 3-band EQ, WAM plugins, and custom effects whose definition names no `wetParam`) is disconnected from the chain while bypassed.

Bypassed effects are left out of a WAV export.

### Exporting with Effects

Pass the offline effects functions to `useExportWav()` or `ExportWavButton`. Both hooks always return a function, the same one on every call, and it reads the chain when the export runs. With no active effect it passes the audio straight through.

```tsx
import { usePlaylistData } from '@waveform-playlist/browser';
import {
  useExportWav,
  type UseDynamicEffectsReturn,
  type UseTrackDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

// Rendered inside WaveformPlaylistProvider. masterFx and trackFx are the
// objects returned by the single useDynamicEffects() / useTrackDynamicEffects()
// calls in the component that renders the provider.
function ExportButton({
  masterFx,
  trackFx,
}: {
  masterFx: UseDynamicEffectsReturn;
  trackFx: UseTrackDynamicEffectsReturn;
}) {
  const { tracks, trackStates } = usePlaylistData();
  const { exportWav, isExporting } = useExportWav();

  const handleExport = async () => {
    try {
      await exportWav(tracks, trackStates, {
        filename: 'mix',
        effectsFunction: masterFx.createOfflineEffectsFunction(),
        createOfflineTrackEffects: trackFx.createOfflineTrackEffectsFunction,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button onClick={handleExport} disabled={isExporting}>
      Export WAV
    </button>
  );
}
```

The export rejects if an effect in the live chain cannot be rebuilt on the offline context. It does not render without it.

## Custom Effects

You can add your own effect, an `AudioWorkletNode` or any chain of native Web Audio nodes, to the same racks. Register it once with `registerEffect()` from `@waveform-playlist/core`, then add it by id like a built-in. The registry is shared with the web components: one registration serves the React hooks and `<daw-editor>`.

```bash
npm install @waveform-playlist/core
```

### Requirements

Custom effects are native nodes, so the app must run in native AudioContext mode, the same requirement as [WAM plugins](/docs/wam-plugins). Call this before any audio initialization:

```tsx
import { configureGlobalContext } from '@waveform-playlist/playout';

configureGlobalContext({ nativeAudioContext: true });
```

Without it, `addEffect` rejects for a custom effect. Native mode is not available in Firefox; see [browser support](/docs/wam-plugins#browser-support-tone-backends).

### Register the effect

This example is a tremolo written as an AudioWorklet processor. The processor file is served as a static file:

```javascript
// public/worklets/demo-tremolo-processor.js
// A hand-written AudioWorklet effect for the custom-effect demo: tremolo
// (amplitude modulation). Loaded with audioWorklet.addModule() from the
// effect definition's prepare() hook, once per AudioContext.
//
// Kept short for the demo: rate and depth are read once per block, so a fast
// slider move can click. A production effect would smooth them.
class DemoTremoloProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 6, minValue: 0.1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'depth', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
    this.alive = true;
    // The effect's dispose() posts this. Until then the processor must keep
    // returning true: in Chrome a processor that returned false while nothing
    // was connected (the effect bypassed) is not started again on reconnect.
    this.port.onmessage = (event) => {
      if (event.data === 'dispose') this.alive = false;
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const rate = parameters.rate[0];
    const depth = parameters.depth[0];
    const step = (2 * Math.PI * rate) / sampleRate;
    const frames = output[0] ? output[0].length : 0;

    for (let i = 0; i < frames; i++) {
      // 1 at the top of the cycle, 1 - depth at the bottom.
      const gain = 1 - depth * (0.5 - 0.5 * Math.cos(this.phase + i * step));
      for (let channel = 0; channel < output.length; channel++) {
        const source = input[channel];
        output[channel][i] = source ? source[i] * gain : 0;
      }
    }
    this.phase = (this.phase + frames * step) % (2 * Math.PI);
    // false only after dispose(): otherwise every removed tremolo would keep
    // running until the page closes.
    return this.alive;
  }
}

registerProcessor('demo-tremolo', DemoTremoloProcessor);
```

The processor keeps returning `true` from `process()` until the effect's `dispose` tells it to stop over the port. Do not return `false` as a way to stop while the effect may be used again: in Chrome, a processor that returned `false` while nothing was connected to it (the effect bypassed by disconnection) did not run again when it was reconnected.

The definition tells the hooks how to load and build it:

```typescript
import { getEffectDefinitions, registerEffect } from '@waveform-playlist/core';

/** The id the effect is added by: `addEffect(DEMO_TREMOLO)`. */
export const DEMO_TREMOLO = 'demo-tremolo';

const MODULE_URL = '/worklets/demo-tremolo-processor.js';

/**
 * Register a custom effect backed by an AudioWorkletNode. One registration
 * serves the React effects hooks and `<daw-editor>`.
 */
export function registerDemoTremolo(): void {
  if (getEffectDefinitions().has(DEMO_TREMOLO)) return;

  registerEffect(DEMO_TREMOLO, {
    label: 'Tremolo (custom AudioWorklet)',
    category: 'custom',
    defaults: { rate: 6, depth: 0.8 },
    params: {
      rate: { min: 0.1, max: 20, step: 0.1, unit: 'Hz', label: 'Rate' },
      depth: { min: 0, max: 1, step: 0.01, label: 'Depth' },
    },

    // Runs once per AudioContext: the live one, and the offline one of every
    // WAV export. A worklet module has to be added to each.
    prepare: (audioContext) => audioContext.audioWorklet.addModule(MODULE_URL),

    // Synchronous: the processor is registered on this context by now.
    create: (audioContext) => {
      const node = new AudioWorkletNode(audioContext, DEMO_TREMOLO);
      return {
        input: node,
        output: node,
        applyParams: (params) => {
          for (const name of ['rate', 'depth']) {
            const param = node.parameters.get(name);
            if (param && params[name] !== undefined) param.value = params[name];
          }
        },
        // Lets the processor stop; a worklet that returns true from process()
        // runs until the page closes otherwise.
        dispose: () => {
          node.port.postMessage('dispose');
          node.disconnect();
        },
      };
    },
  });
}
```

The fields of a definition (`NativeEffectDefinition` from `@waveform-playlist/core`):

| Field | Required | Description |
|-------|----------|-------------|
| `label` | Yes | Display name. Becomes `definition.name` in the rack. |
| `category` | Yes | Any string. Becomes `definition.category`. |
| `defaults` | Yes | Initial value of each parameter. Parameters are numbers. |
| `params` | Yes | Per parameter: `min`, `max`, and optional `step`, `unit`, `label`. The rack's `definition.parameters` is built from this. |
| `create(audioContext, params)` | Yes | Builds the nodes on the given context and returns `{ input, output, applyParams, dispose? }`. Synchronous. It is called with the live context and with the offline context of an export, so use the `audioContext` argument for every node. |
| `prepare(audioContext)` | No | Async setup that must finish before `create` can run on a context, typically `audioWorklet.addModule(url)`. It must be safe to run more than once on the same context. |
| `wetParam` | No | Name of the effect's wet/dry parameter. When set, bypass sets that parameter to 0 and leaves the effect connected. When omitted, bypass disconnects the effect. |

The host owns every connection out of the returned `output` node and disconnects all of them when it rewires the chain. Do not connect `output` to anything inside the effect (a feedback path, for example); take such a tap from a node before it.

### Add it

```tsx
import type {
  UseDynamicEffectsReturn,
  UseTrackDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';
import { registerDemoTremolo, DEMO_TREMOLO } from './demoTremoloEffect';

// Module scope: registered before any component that shows a picker renders.
registerDemoTremolo();

// masterFx and trackFx come from the single useDynamicEffects() /
// useTrackDynamicEffects() calls in the component that renders the provider
// (see the App components above).
function TremoloButtons({
  masterFx,
  trackFx,
  trackId,
}: {
  masterFx: UseDynamicEffectsReturn;
  trackFx: UseTrackDynamicEffectsReturn;
  trackId: string;
}) {
  const addToMaster = async () => {
    try {
      const instanceId = await masterFx.addEffect(DEMO_TREMOLO);
      masterFx.updateParameter(instanceId, 'rate', 8);
    } catch (err) {
      console.error(err); // e.g. the app is not in native AudioContext mode
    }
  };

  const addToTrack = () => {
    trackFx.addEffectToTrack(trackId, DEMO_TREMOLO).catch(console.error);
  };

  return (
    <>
      <button onClick={addToMaster}>Tremolo on master</button>
      <button onClick={addToTrack}>Tremolo on this track</button>
    </>
  );
}
```

`addEffect` awaits the definition's `prepare` hook on the live context and then creates the effect, so there is no separate prepare call in React. The entry has `kind: 'custom'`. Its sliders, bypass, reorder and remove work like any other entry. Its parameters are numbers: `updateParameter` ignores a value that is not a number for a custom effect. In native AudioContext mode the type is listed after the built-ins in `availableEffects`; register custom effects before the component that shows the picker renders, because the list is read at render and does not follow later registrations.

If the type is registered again while `prepare` is running, the effect is added from the new definition.

A built-in id wins over a registered type of the same name, so pick an id that does not collide with the [built-in ids](#available-effects).

### Export

Nothing extra is needed. The offline effects functions from [Exporting with Effects](#exporting-with-effects) run `prepare` on the export's offline context and create the effect there.

### Faust effects

A [Faust](https://faust.grame.fr/) effect compiled at build time registers the same way. See [Precompiled Faust Effects](/docs/faust-effects) for the compile step and the registration code.

## Effect Categories

Effects are organized into categories for easier discovery:

- **Reverb** - Room simulation and ambience
- **Delay** - Echo and time-based effects
- **Modulation** - Chorus, phaser, tremolo, vibrato
- **Filter** - EQ, wah, and filter sweeps
- **Distortion** - Overdrive and bit reduction
- **Dynamics** - Compression, limiting, gating
- **Spatial** - Stereo width and positioning

## Track Signal Chain and Panning

Track effects are **pre-fader inserts**: a track's clips run through its effects first, then its volume, pan and mute.

```
clips → effects → volume → pan → mute → master
```

So the volume fader sets the track's level in the mix without changing how hard a compressor or distortion works, and mute and solo silence a track including its effect tails.

### Why tracks are not panned with a `Panner` or `StereoPannerNode`

Waveform Playlist pans every track with its own small pan stage (`createPanStage` from `@waveform-playlist/core`) rather than Tone.js's `Panner` or the browser's built-in `StereoPannerNode`:

- A **`StereoPannerNode`** chooses its pan law from the signal it receives: equal-power for mono input (−3 dB per side at centre), a different law for stereo input (unity at centre). Because effects come before the pan, the panner would see the effects' output instead of the track's audio. A mono track would get about 3 dB louder at centre, and pan differently, as soon as you added a stereo reverb.
- Tone.js's **`Panner`** wraps a `StereoPannerNode` with a fixed channel count that cannot be changed on Tone's default audio context. A mono track's panner is locked to one channel, so a stereo effect on that track would be summed to mono.

The pan stage uses the same two pan laws as `StereoPannerNode`, so levels and pan positions are the ones you would expect, but it picks the law from the track's audio (mono or stereo clips) instead of from the effects' output, and it always keeps a stereo signal stereo. The same stage is used for playback and WAV export, with the Tone.js engine and with the native `@dawcore/transport`.

A track that mixes mono and stereo clips is panned with the stereo law, so its mono clips play 3 dB louder at centre than on a mono-only track. Keep mono and stereo material on separate tracks if you want a track's level to stay put when clips are added or removed.

You can still use `Panner`, `AutoPanner` or a `StereoPannerNode` as an **effect** inside a track's chain.

## Learn More

For deeper understanding of audio effects and Tone.js:

- [Tone.js Documentation](https://tonejs.github.io/docs/)
- [Mastering Tone.js Book](https://masteringtonejs.com/)
