# Understanding Audio Transport Systems

A guide to how DAW transport systems work at a fundamental level — the math, the timing models, and the engineering trade-offs.

## What Is a Transport?

A transport is the timing engine of a digital audio workstation (DAW). It answers three questions:

1. **Where are we?** — The current playback position on the timeline
2. **When does this sound?** — Converting a position on the timeline to a hardware scheduling time
3. **What plays next?** — Looking ahead to schedule audio before it's needed

Every DAW has a transport, though the implementation varies. This document describes the model used in `@dawcore/transport`, which is representative of modern Web Audio implementations.

## Two Clocks

A transport operates in two time spaces simultaneously:

| Clock | Unit | Example | Source |
|-------|------|---------|--------|
| **Transport time** | Seconds from timeline start | 0.0, 0.5, 1.0... | Software counter (elapsed time) |
| **Hardware time** | `AudioContext.currentTime` | 100.5, 101.0... | Audio hardware clock |

Transport time starts at 0 when you press play. Hardware time is a monotonically increasing counter driven by the audio device — it never resets and is independent of playback state.

**The critical conversion:**

```
audioTime = hardwareNow + (transportTime - clockElapsed)
```

This maps "where on the timeline" to "when on the hardware." Without this, all sounds in the lookahead window would fire immediately at the current hardware time.

> **Reference:** The Web Audio API specification defines `AudioContext.currentTime` as a double-precision floating-point number representing the hardware output time in seconds. See [W3C Web Audio API — BaseAudioContext](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-currenttime).

## The Lookahead Window

Audio hardware requires samples to be queued ahead of time. If you wait until the exact moment a sound should play, you're too late — the audio thread has already moved past that sample.

The solution: **schedule audio before it's needed.** A typical lookahead is 100–200ms:

```
|  already played  |  scheduled  |  not yet scheduled  |
|__________________|_____________|_____________________|
                   ^             ^
              clock time    clock + lookahead
```

On every animation frame (~16ms at 60fps), the transport:
1. Reads the current clock time
2. Computes the target: `clockTime + lookahead`
3. Generates audio events for any new portion of the window
4. Schedules them on the audio hardware using precise `source.start(when)` timestamps

The 200ms buffer absorbs timing jitter from the Worker tick (25 ms cadence, delivered as a message to the main thread). The audio thread plays samples at the exact scheduled time regardless of when the JavaScript ran.

> **Key insight:** The lookahead introduces no perceptible latency. `source.start(when)` schedules audio at the exact correct hardware time — the 200ms is scheduling headroom, not output delay.

## Coordinate Systems

### Samples

The most fundamental unit. One sample = one amplitude value at a specific moment. At 48,000 Hz, there are 48,000 samples per second. Audio clips are positioned in absolute sample counts:

```
clip.startSample = 96000    // starts at 2.0 seconds (at 48kHz)
clip.durationSamples = 48000 // plays for 1.0 second
```

Sample positions are integers. They do not change when tempo changes — a clip at sample 96000 stays at sample 96000 regardless of BPM. This is the "absolute" timeline.

### Ticks (PPQN)

Musical time is measured in **ticks** — subdivisions of a quarter note. The standard resolution is **960 PPQN** (Pulses Per Quarter Note), meaning one quarter note = 960 ticks.

```
1 quarter note = 960 ticks
1 bar of 4/4   = 3840 ticks  (4 × 960)
1 bar of 3/4   = 2880 ticks  (3 × 960)
1 bar of 6/8   = 2880 ticks  (6 × 480, since an eighth note = 480 ticks)
```

Ticks are integers. At 960 PPQN, one tick ≈ 0.52ms at 120 BPM — finer than human perception and finer than a single audio sample at 48kHz.

> **Why 960?** It divides evenly by 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32, 40, 48, 60, 64, 80, 96, 120, 160, 192, 240, 320, 480. This means tuplets, swing, and unusual subdivisions land on exact integer tick boundaries.

### Seconds

The bridge between ticks and samples. Converting between coordinate systems:

```
ticks → seconds:  seconds = ticks × (60 / (BPM × PPQN))
seconds → ticks:  ticks = seconds × (BPM × PPQN) / 60
seconds → samples: samples = seconds × sampleRate
samples → seconds: seconds = samples / sampleRate
```

These formulas assume constant BPM. With tempo automation, the conversion becomes an integral (see below).

## Tempo and the Tick-to-Seconds Conversion

### Constant Tempo

At a constant BPM, converting ticks to seconds is a simple division:

```
seconds = ticks × 60 / (BPM × PPQN)
```

At 120 BPM, 960 PPQN: one tick = 60 / (120 × 960) = 0.000521 seconds ≈ 0.52ms.

### Variable Tempo (Linear Ramps)

When BPM changes over time, the conversion requires integration. For a linear ramp from `bpm₀` to `bpm₁` over `T` ticks, the BPM at tick `t` is:

```
bpm(t) = bpm₀ + (bpm₁ - bpm₀) × (t / T)
```

The time duration of `t` ticks is the integral of the reciprocal of the instantaneous BPM:

```
seconds(t) = ∫₀ᵗ 60 / (PPQN × bpm(u)) du
```

For a linear ramp, this integral has a closed-form solution using the natural logarithm:

```
seconds(t) = (T × 60) / (PPQN × (bpm₁ - bpm₀)) × ln(bpm(t) / bpm₀)
```

The inverse (seconds to ticks) uses the exponential function:

```
bpm(t) = bpm₀ × exp(seconds × (bpm₁ - bpm₀) × PPQN / (60 × T))
ticks = (bpm(t) - bpm₀) × T / (bpm₁ - bpm₀)
```

Both directions are closed-form and exact — no iterative approximation needed.

> **Degenerate case:** When `bpm₀ = bpm₁`, the logarithmic formula produces `ln(1) / 0 = 0/0`. The implementation detects `|bpm₁ - bpm₀| < ε` and falls back to the constant-tempo formula.

> **Reference:** This is a standard result from calculus — the antiderivative of `1/(a + bx)` is `ln(a + bx) / b`. See any introductory calculus text, e.g., Stewart, J., *Calculus: Early Transcendentals*, Section 7.2 (integration by substitution).

### Variable Tempo (Curves)

For non-linear tempo changes the integral `∫ 1/bpm(t) dt` looks like it needs numerical integration, but the Möbius-Ease curve (below) is an exponential in disguise, and `1/(A + B × e^(c·x))` has a closed-form antiderivative. Writing the curve as

```
bpm(x) = A + B × e^(c·x)          where x = t / T
  c = 2 × ln((1 - p) / p)
  B = (bpm₁ - bpm₀) × p² / (1 - 2p)
  A = bpm₀ - B
```

gives

```
seconds(t) = (T × 60 / PPQN) × (c·x - ln(bpm(x) / bpm₀)) / (c × A)
```

So the curved case is exact like the linear one: the only error is floating-point rounding (~1e-15 relative), independent of segment length. An earlier version used a 64-step trapezoid; its error grew with segment length (up to ~2e-3 relative at steep slopes — 2.8 ms per bar, 0.7 s over a 256-bar ramp), which is why the closed form replaced it.

Getting full precision out of that formula takes some care, because it has two removable singularities:

- **`slope → 0.5`:** `B → ∞` and `c → 0` while `c × B` stays finite (→ `bpm₁ − bpm₀`). The implementation therefore carries `c × A` and `c × B` rather than `A` and `B`, and sends only `|slope − 0.5| < 1e-12` to the linear formula (at exactly 0.5, `c` is 0 and the coefficients are 0/0).
- **`A → 0`** (e.g. 20 → 180 BPM at slope 0.25, where `bpm₀ = B`): the curve is a pure exponential and `(c·x − ln(bpm(x)/bpm₀)) / (c × A)` is `0/0`. Rewriting `c·x − ln(bpm(x)/bpm₀)` as `−log1p(y)` with `y = (A/bpm₀)(e^(−c·x) − 1)` gives

  ```
  seconds(t) = (T × 60 / PPQN) × (1 − e^(−c·x)) / (c × bpm₀) × log1p(y) / y
  ```

  where `log1p(y)/y → 1` as `y → 0`, so nothing divides by `A`. This form is exact for small `A` and small `c`, and is the one normally used.

The two forms are algebraically identical, but they cancel in different places: the `log1p` form loses digits when `1 + y = bpm(x) × e^(−c·x) / bpm₀` is tiny (a very steep concave ramp near its end, or a convex descending ramp), and the plain form loses digits when `A ≈ 0`. Those regimes are disjoint: when `1 + y ≤ 0.5` the plain form's numerator `−ln(1 + y)` is at least `ln 2` in magnitude, and `A = 0` would force `1 + y = 1`, so nothing cancels there. The implementation picks the plain form exactly when `1 + y ≤ 0.5` and the `log1p` form otherwise.

The inverse (seconds → ticks) also has a closed form, obtained by solving the `log1p` form for `x`:

```
K = seconds × c × A / base            base = T × 60 / PPQN
z = e^(−c·x) − 1 = −(bpm₀ × seconds × c / base) × (1 − e^(−K)) / K
x = −log1p(z) / c
```

with `(1 − e^(−K))/K → 1` as `K → 0` making `A → 0` exact, and `c → 0` exact because `z ∝ c` and `log1p(z)/c` keeps the ratio. When `e^(−c·x)` is small and `|B| < |A|/2`, forming it as `1 + z` loses digits and the equal product form `e^(−c·x) = (c·bpm₀·e^(−K) − c·B) / (c·A)` is used instead. Both directions are O(1); the previous implementation bisected the forward integral.

> **Reference:** `∫ dx / (A + B × e^(cx)) = x/A − ln(A + B × e^(cx)) / (c × A)` — differentiate to verify, or see [Wikipedia — List of integrals of exponential functions](https://en.wikipedia.org/wiki/List_of_integrals_of_exponential_functions). Evaluating `ln(bpm(x)/bpm₀)` as `log1p((B/bpm₀) × expm1(c·x))` avoids cancellation when `c·x` is small; see Goldberg, D., *"What Every Computer Scientist Should Know About Floating-Point Arithmetic"*, ACM Computing Surveys 23(1), 1991.

#### The Möbius-Ease Curve

This implementation uses the Möbius-Ease function for non-linear tempo curves. It maps a progress value `x ∈ [0, 1]` to an output `y ∈ [0, 1]` with a single `slope` parameter controlling the shape:

```
f(x, slope) = (p² / (1 - 2p)) × ((1-p)/p)^(2x) - 1)    where p = slope
```

- `slope = 0.5` → linear (identity function)
- `slope < 0.5` → concave (slow start, fast end — like ease-in)
- `slope > 0.5` → convex (fast start, slow end — like ease-out)

Properties that make it suitable for tempo automation:
- **Monotonic** — output always increases with input (no overshoot)
- **Bounded** — output stays in [0, 1] for input in [0, 1]
- **Single parameter** — one `slope` value controls the entire curve shape
- **Has an efficient iterative form** — can be evaluated per-sample as `v[i+1] = m × v[i] + q` (two operations per sample, no `pow()`)

> **Reference:** Werner Van Belle, *""; Proc. of the Linux Audio Conference, 2012.* [Paper](http://werner.yellowcouch.org/Papers/fastenv12/index.html)

## Time Signatures and the Beat Grid

### The MeterMap

A MeterMap stores time signature entries at tick positions. Each entry defines:

- **Numerator** — beats per bar (e.g., 4 in 4/4, 6 in 6/8)
- **Denominator** — beat unit as a fraction of a whole note (e.g., 4 = quarter note, 8 = eighth note)

The denominator determines the tick duration of one beat:

```
ticksPerBeat = PPQN × (4 / denominator)
```

For 4/4 time: `ticksPerBeat = 960 × (4/4) = 960` (quarter note beats)
For 6/8 time: `ticksPerBeat = 960 × (4/8) = 480` (eighth note beats)

A metronome walks the beat grid by stepping through ticks in `ticksPerBeat` increments, re-querying the MeterMap at each step to handle mid-song meter changes.

### Bar Boundary Alignment

When a time signature changes mid-song, the new meter must start on a bar boundary of the previous meter. Otherwise, bar numbers become fractional and the beat grid is ambiguous. The MeterMap enforces this by snapping meter change positions to the nearest bar boundary.

## The Scheduling Loop

Putting it all together, the transport's main loop runs on every animation frame:

```
1. timer fires (Worker `setTimeout` tick, 25 ms)
2. read clockTime from Clock (seconds, from AudioContext.currentTime)
3. convert to ticks: targetTick = tempoMap.secondsToTicks(clockTime + lookahead)
4. for each new tick in [rightEdge, targetTick):
     a. ask each listener to generate events
     b. listeners convert ticks → samples (for clip scheduling) or stay in ticks (for metronome)
     c. consume each event: convert tick → seconds → audioTime, call source.start(audioTime)
5. advance rightEdge to targetTick
```

The `rightEdge` cursor tracks how far ahead we've already scheduled, preventing duplicate event generation.

### Looping

When the scheduling window crosses a loop boundary:

1. Generate events up to `loopEnd` (clip durations clamped at the boundary)
2. Notify listeners of the position jump
3. Seek the clock back — but not to `loopStart` exactly. Because the scheduler runs ahead by the lookahead, the clock must be seeked to `loopStart - timeToBoundary` so that post-wrap events schedule at the boundary's audio time, not at "now"
4. Continue generating from `loopStart` to fill the remaining lookahead window

This all happens within a single JavaScript task — the audio thread sees a seamless stream of precisely timed `source.start()` calls.

## Integer Precision

All timing comparisons in the scheduler use integer ticks, not floating-point seconds. This eliminates a class of bugs where accumulated rounding errors cause:

- Loop boundaries to drift (wrapping one beat too early after many iterations)
- Metronome accents to miss bar boundaries (`ticksIntoBar % ticksPerBar !== 0` due to float noise)
- Clip durations to have sub-sample gaps at loop points

The conversion from seconds (Clock) to ticks (Scheduler) happens once at the top of each scheduling frame. Everything downstream is integer arithmetic until the final tick → seconds → audioTime conversion for hardware scheduling.

> **Reference:** This is the same principle behind MIDI's use of integer ticks (typically 480 or 960 PPQN) rather than floating-point timestamps. The MIDI 1.0 specification uses integer delta-times for the same precision reason.

## Branded Types

TypeScript cannot distinguish between a `number` that represents ticks, samples, or seconds — they're all `number`. This implementation uses **branded types** to catch coordinate-space confusion at compile time:

```typescript
type Tick = number & { readonly [__tick]: never };
type Sample = number & { readonly [__sample]: never };
```

These have zero runtime cost (the brand exists only in the type system). Conversion functions are the canonical producers: `secondsToTicks()` returns `Tick`, `secondsToSamples()` returns `Sample`. Passing seconds where ticks are expected is a compile-time error.

## Further Reading

### Web Audio and Scheduling
- W3C Web Audio API specification — [AudioContext.currentTime](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-currenttime), [AudioBufferSourceNode.start()](https://webaudio.github.io/web-audio-api/#dom-audioscheduledsourcenode-start)
- Chris Wilson, *"A Tale of Two Clocks"* — [Article](https://web.dev/articles/audio-scheduling) (Web Audio scheduling with lookahead)
- MIDI 1.0 Specification — [midi.org](https://www.midi.org/specifications) (integer tick timing, PPQN)

### Numerical Methods
- [Wikipedia — List of integrals of exponential functions](https://en.wikipedia.org/wiki/List_of_integrals_of_exponential_functions) (`∫ dx / (a + b × e^(cx))`, the curved tempo segment's antiderivative)
- Goldberg, D., *"What Every Computer Scientist Should Know About Floating-Point Arithmetic"*, ACM Computing Surveys 23(1), 1991 (cancellation, why `log1p`/`expm1` exist)

### Tempo Curves
- Werner Van Belle, *"Fast Envelope Generation"*, Proc. of the Linux Audio Conference, 2012 — [Paper](http://werner.yellowcouch.org/Papers/fastenv12/index.html) (Möbius-Ease curve formula, efficient iterative `v[i+1] = m×v[i] + q` form)
