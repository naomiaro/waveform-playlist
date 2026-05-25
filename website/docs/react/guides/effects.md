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

```tsx
import { useDynamicEffects, effectDefinitions } from '@waveform-playlist/browser';

function EffectsPanel() {
  const {
    activeEffects,
    availableEffects,
    addEffect,
    removeEffect,
    updateParameter,
    masterEffects,
  } = useDynamicEffects();

  return (
    <WaveformPlaylistProvider effects={masterEffects} tracks={tracks}>
      {/* Effect selector */}
      <select onChange={(e) => addEffect(e.target.value)}>
        <option value="">Add Effect...</option>
        {availableEffects.map((def) => (
          <option key={def.id} value={def.id}>{def.name}</option>
        ))}
      </select>

      {/* Active effects with controls */}
      {activeEffects.map((effect) => (
        <div key={effect.instanceId}>
          <h4>{effect.definition.name}</h4>
          {effect.definition.parameters.map((param) => (
            <input
              key={param.name}
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={effect.params[param.name] as number}
              onChange={(e) =>
                updateParameter(effect.instanceId, param.name, parseFloat(e.target.value))
              }
            />
          ))}
          <button onClick={() => removeEffect(effect.instanceId)}>Remove</button>
        </div>
      ))}
    </WaveformPlaylistProvider>
  );
}
```

## Effect Categories

Effects are organized into categories for easier discovery:

- **Reverb** - Room simulation and ambience
- **Delay** - Echo and time-based effects
- **Modulation** - Chorus, phaser, tremolo, vibrato
- **Filter** - EQ, wah, and filter sweeps
- **Distortion** - Overdrive and bit reduction
- **Dynamics** - Compression, limiting, gating
- **Spatial** - Stereo width and positioning

## Learn More

For deeper understanding of audio effects and Tone.js:

- [Tone.js Documentation](https://tonejs.github.io/docs/)
- [Mastering Tone.js Book](https://masteringtonejs.com/)
