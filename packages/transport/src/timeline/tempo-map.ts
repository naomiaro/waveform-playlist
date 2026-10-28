import type { Tick, TempoInterpolation } from '../types';

const CURVE_EPSILON = 1e-15;
/** |slope − 0.5| below this is treated as a linear ramp. The curve's exponent
 *  rate c is exactly 0 at slope 0.5 (0/0 in the coefficients); the formulas
 *  below are stable for every other slope, so the window only has to exclude
 *  that point. At 1e-12 the curve differs from linear by < 1e-11 relative. */
const CURVE_LINEAR_SLOPE_EPSILON = 1e-12;

/** The Möbius-Ease curve written as an exponential: normalized value
 *  k·(r^(2x) − 1) = (p²/(1 − 2p))·(e^(c·x) − 1) with r = (1 − p)/p and
 *  c = 2·ln r. */
interface CurveCoefficients {
  /** Exponent rate c. Negative for slope > 0.5, zero at slope 0.5. */
  c: number;
  /** Amplitude pre-multiplied by c: c·p²/(1 − 2p). The amplitude and 1/c
   *  both diverge as slope → 0.5 while this product stays finite (→ 1). */
  cB: number;
}

/** Per-segment constants of bpm(x) = A + B·e^(c·x), carried as c·A and c·B,
 *  plus base = T·60/ppqn (the seconds the whole segment would take at 1 BPM). */
interface CurveSegment {
  c: number;
  cB: number;
  cA: number;
  base: number;
}

function isNearLinearSlope(slope: number): boolean {
  return Math.abs(slope - 0.5) < CURVE_LINEAR_SLOPE_EPSILON;
}

function curveCoefficients(slope: number): CurveCoefficients {
  const p = Math.max(CURVE_EPSILON, Math.min(1 - CURVE_EPSILON, slope));
  const d = 1 - 2 * p;
  // ln((1 − p)/p) = log1p((1 − 2p)/p): keeps precision when p ≈ 0.5.
  // (1 − 2p is exact for p ≥ 0.25 — Sterbenz subtraction — which covers the p ≈ 0.5 regime.)
  const c = 2 * Math.log1p(d / p);
  return { c, cB: (c * p * p) / d };
}

/** log1p(y)/y with the removable singularity filled in (→ 1 as y → 0). */
function log1pOverY(y: number): number {
  return y === 0 ? 1 : Math.log1p(y) / y;
}

/** (1 − e^(−k))/k with the removable singularity filled in (→ 1 as k → 0). */
function expm1NegOverK(k: number): number {
  return k === 0 ? 1 : -Math.expm1(-k) / k;
}

/**
 * Möbius-Ease curve: maps x in [0,1] to [0,1] with shape controlled by slope.
 * slope = 0.5 → linear. slope < 0.5 → concave. slope > 0.5 → convex.
 * Reference: http://werner.yellowcouch.org/Papers/fastenv12/index.html
 */
function curveNormalizedAt(x: number, slope: number): number {
  if (isNearLinearSlope(slope)) return x;
  const { c, cB } = curveCoefficients(slope);
  // (p²/(1 − 2p))·(e^(c·x) − 1), via expm1 so small c·x keeps precision
  return (cB / c) * Math.expm1(c * x);
}

/** Mutable internal version of TempoEntry (exported interface has readonly fields) */
interface MutableTempoEntry {
  tick: Tick;
  bpm: number;
  interpolation: TempoInterpolation;
  secondsAtTick: number;
}

function assertFiniteInput(what: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('[waveform-playlist] TempoMap: ' + what + ' must be finite, got ' + value);
  }
}

/** A finite input far outside a ramp's domain (e.g. −10 000 s into a curved
 *  first segment) overflows the ramp formula; surface that rather than hand
 *  NaN/±Infinity to the scheduler, where it stalls scheduling silently. */
function assertFiniteResult(input: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      '[waveform-playlist] TempoMap: ' +
        input +
        ' is outside the domain of the tempo map (result not finite)'
    );
  }
  return value;
}

export interface SetTempoOptions {
  interpolation?: TempoInterpolation;
}

export class TempoMap {
  private _ppqn: number;
  private _entries: MutableTempoEntry[];

  constructor(ppqn: number = 960, initialBpm: number = 120) {
    TempoMap._validateBpm(initialBpm);
    this._ppqn = ppqn;
    this._entries = [{ tick: 0 as Tick, bpm: initialBpm, interpolation: 'step', secondsAtTick: 0 }];
  }

  /** A non-finite or non-positive BPM silently corrupts the secondsAtTick
   *  cache (Infinity, or non-monotonic values that break the binary search
   *  in secondsToTicks) — reject it at the boundary instead. */
  private static _validateBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) {
      throw new Error(
        '[waveform-playlist] TempoMap: bpm must be a finite positive number, got ' + bpm
      );
    }
  }

  getTempo(atTick: Tick = 0 as Tick): number {
    return this._getTempoAt(atTick);
  }

  /** Number of tempo entries in the map. Always >= 1 — the tick-0 entry is
   *  permanent. Used by Transport.setTempo to detect multi-entry maps. */
  get entryCount(): number {
    return this._entries.length;
  }

  setTempo(bpm: number, atTick: Tick = 0 as Tick, options?: SetTempoOptions): void {
    TempoMap._validateBpm(bpm);
    const interpolation = options?.interpolation ?? 'step';

    if (typeof interpolation === 'object' && interpolation.type === 'curve') {
      const s = interpolation.slope;
      if (!Number.isFinite(s) || s <= 0 || s >= 1) {
        throw new Error(
          '[waveform-playlist] TempoMap: curve slope must be between 0 and 1 (exclusive), got ' + s
        );
      }
    }

    if (atTick === 0) {
      // First entry is always 'step' — there's no previous entry to ramp from
      this._entries[0] = { ...this._entries[0], bpm, interpolation: 'step' };
      this._recomputeCache(0);
      return;
    }
    // Find insertion point
    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > atTick) i--;

    if (this._entries[i].tick === atTick) {
      this._entries[i] = { ...this._entries[i], bpm, interpolation };
    } else {
      const secondsAtTick = this._ticksToSecondsInternal(atTick);
      this._entries.splice(i + 1, 0, { tick: atTick, bpm, interpolation, secondsAtTick });
      i = i + 1;
    }
    this._recomputeCache(i);
  }

  /** Tick position → seconds. Accepts a fractional position (e.g. the value
   *  secondsToTicksExact returned) as well as an integer Tick. */
  ticksToSeconds(ticks: number): number {
    assertFiniteInput('ticks', ticks);
    return assertFiniteResult('ticks ' + ticks, this._ticksToSecondsInternal(ticks));
  }

  /** Seconds → integer ticks, rounded once here at the `Tick` boundary.
   *  Use secondsToTicksExact() for sub-tick placement. */
  secondsToTicks(seconds: number): Tick {
    return Math.round(this.secondsToTicksExact(seconds)) as Tick;
  }

  /** Seconds → fractional tick position (unrounded). The integer producers
   *  round this once at their own boundary (secondsToTicks,
   *  SampleTimeline.samplesToTicks); sub-tick consumers (placing a recorded
   *  note between ticks before quantising, continuous beat positions) use it
   *  directly. Not clamped: negative seconds convert at the constant initial
   *  tempo to negative ticks (whatever the first segment's interpolation),
   *  and seconds past the last entry extrapolate the last tempo forwards. */
  secondsToTicksExact(seconds: number): number {
    assertFiniteInput('seconds', seconds);
    return assertFiniteResult('seconds ' + seconds, this._secondsToTicksRaw(seconds));
  }

  private _secondsToTicksRaw(seconds: number): number {
    // Before tick 0 the tempo is the initial tempo: a ramp's formula is
    // undefined past its asymptote when extrapolated backwards.
    if (seconds < 0) return (seconds * this._entries[0].bpm * this._ppqn) / 60;
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].secondsAtTick <= seconds) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const entry = this._entries[lo];
    const secondsIntoSegment = seconds - entry.secondsAtTick;

    const nextEntry = lo < this._entries.length - 1 ? this._entries[lo + 1] : null;
    if (nextEntry && nextEntry.interpolation === 'linear') {
      return (
        entry.tick +
        this._secondsToTicksLinear(
          secondsIntoSegment,
          entry.bpm,
          nextEntry.bpm,
          nextEntry.tick - entry.tick
        )
      );
    }

    if (nextEntry && typeof nextEntry.interpolation === 'object') {
      return (
        entry.tick +
        this._secondsToTicksCurve(
          secondsIntoSegment,
          entry.bpm,
          nextEntry.bpm,
          nextEntry.tick - entry.tick,
          nextEntry.interpolation.slope
        )
      );
    }

    // Step: constant BPM
    const ticksPerSecond = (entry.bpm / 60) * this._ppqn;
    return entry.tick + secondsIntoSegment * ticksPerSecond;
  }

  beatsToSeconds(beats: number): number {
    return this.ticksToSeconds(beats * this._ppqn);
  }

  /** Continuous beat position (fractional) — not quantised to whole ticks. */
  secondsToBeats(seconds: number): number {
    return this.secondsToTicksExact(seconds) / this._ppqn;
  }

  clearTempos(): void {
    const first = this._entries[0];
    this._entries = [{ tick: 0 as Tick, bpm: first.bpm, interpolation: 'step', secondsAtTick: 0 }];
  }

  /** Remove the tempo entry at exactly `atTick`, if one exists. The tick-0
   *  entry is permanent (a map must always have a tempo) — removing it is a
   *  no-op, matching removeMeter's treatment of the initial meter. The
   *  seconds cache is recomputed from the removal point, the same partial
   *  update setTempo uses. */
  removeTempo(atTick: Tick): void {
    if (atTick === 0) return;
    const i = this._entries.findIndex((e) => e.tick === atTick);
    if (i === -1) return;
    this._entries = [...this._entries.slice(0, i), ...this._entries.slice(i + 1)];
    this._recomputeCache(i);
  }

  /** Get the interpolated BPM at a tick position */
  private _getTempoAt(atTick: Tick): number {
    const entryIndex = this._entryIndexAt(atTick);
    const entry = this._entries[entryIndex];
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;

    if (nextEntry && nextEntry.interpolation !== 'step') {
      const segmentTicks = nextEntry.tick - entry.tick;
      const ticksInto = atTick - entry.tick;
      if (segmentTicks > 0) {
        const progress = ticksInto / segmentTicks;
        if (nextEntry.interpolation === 'linear') {
          return entry.bpm + (nextEntry.bpm - entry.bpm) * progress;
        }
        // Curve (Möbius-Ease)
        const t = curveNormalizedAt(progress, nextEntry.interpolation.slope);
        return entry.bpm + (nextEntry.bpm - entry.bpm) * t;
      }
    }

    return entry.bpm;
  }

  private _ticksToSecondsInternal(ticks: number): number {
    if (ticks < 0) return (ticks * 60) / (this._entries[0].bpm * this._ppqn);
    const entryIndex = this._entryIndexAt(ticks);
    const entry = this._entries[entryIndex];
    const ticksIntoSegment = ticks - entry.tick;
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;

    if (nextEntry && nextEntry.interpolation === 'linear') {
      const segmentTicks = nextEntry.tick - entry.tick;
      return (
        entry.secondsAtTick +
        this._ticksToSecondsLinear(ticksIntoSegment, entry.bpm, nextEntry.bpm, segmentTicks)
      );
    }

    if (nextEntry && typeof nextEntry.interpolation === 'object') {
      const segmentTicks = nextEntry.tick - entry.tick;
      return (
        entry.secondsAtTick +
        this._ticksToSecondsCurve(
          ticksIntoSegment,
          entry.bpm,
          nextEntry.bpm,
          segmentTicks,
          nextEntry.interpolation.slope
        )
      );
    }

    // Step: constant BPM
    const secondsPerTick = 60 / (entry.bpm * this._ppqn);
    return entry.secondsAtTick + ticksIntoSegment * secondsPerTick;
  }

  /**
   * Exact integration for a linear BPM ramp using the logarithmic formula.
   * For bpm(t) = bpm0 + r*t where r = (bpm1-bpm0)/T:
   *   seconds = (T * 60) / (ppqn * (bpm1-bpm0)) * ln(bpmAtTick / bpm0)
   */
  private _ticksToSecondsLinear(
    ticks: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0) return 0;
    const bpmAtTick = bpm0 + (bpm1 - bpm0) * (ticks / totalSegmentTicks);
    // Degenerate case: no ramp (avoids ln(1)/0 = 0/0)
    if (Math.abs(bpm1 - bpm0) < 1e-10) {
      return (ticks * 60) / (bpm0 * this._ppqn);
    }
    // Exact: ∫₀ᵗ 60/(ppqn * bpm(u)) du = (T * 60 / (ppqn * deltaBpm)) * ln(bpmAtTick/bpm0)
    const deltaBpm = bpm1 - bpm0;
    return ((totalSegmentTicks * 60) / (this._ppqn * deltaBpm)) * Math.log(bpmAtTick / bpm0);
  }

  /**
   * Inverse of _ticksToSecondsLinear: given seconds, return ticks.
   * Closed-form via exponential: bpmAtTick = bpm0 * exp(seconds * deltaBpm * ppqn / (60 * T))
   * then ticks = (bpmAtTick - bpm0) * T / deltaBpm
   *
   * Note: exp(log(x)) has ~1 ULP floating-point error, so integer round-trips
   * rely on the rounding in secondsToTicks; secondsToTicksExact returns the
   * raw value. Sufficient for all tested BPM ranges (10–300 BPM).
   */
  private _secondsToTicksLinear(
    seconds: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0 || seconds === 0) return 0;
    // Degenerate case: no ramp
    if (Math.abs(bpm1 - bpm0) < 1e-10) {
      return (seconds * bpm0 * this._ppqn) / 60;
    }
    const deltaBpm = bpm1 - bpm0;
    const bpmAtTick = bpm0 * Math.exp((seconds * deltaBpm * this._ppqn) / (60 * totalSegmentTicks));
    return ((bpmAtTick - bpm0) / deltaBpm) * totalSegmentTicks;
  }

  /**
   * Exact integration for a Möbius-Ease tempo curve.
   * With x = ticks / T the BPM is bpm0 + Δ·(p²/(1 − 2p))·(e^(c·x) − 1), i.e.
   * A + B·e^(c·x) for B = Δ·p²/(1 − 2p), A = bpm0 − B. Its reciprocal has the
   * antiderivative u/A − ln(A + B·e^(c·u))/(c·A), so
   *   seconds = base · (c·x − ln(bpm(x)/bpm0)) / (c·A),   base = T·60/ppqn.
   * Everything is carried as c·A and c·B so the slope → 0.5 limit (B → ∞,
   * c → 0) stays finite. Two algebraically equal forms are used, chosen per
   * call so neither one cancels:
   *   - log1p form: base · (1 − e^(−c·x))/(c·bpm0) · log1p(y)/y with
   *     y = (A/bpm0)·(e^(−c·x) − 1). Exact as A → 0 (the plain form is 0/0
   *     there) and as c → 0. Used while 1 + y = bpm(x)·e^(−c·x)/bpm0 > 0.5.
   *   - plain form, when 1 + y ≤ 0.5 (steep concave ramps near their end, or
   *     convex descending ramps, where forming 1 + y loses digits). There the
   *     numerator −ln(1 + y) is at least ln 2 in magnitude, and A ≠ 0 (A = 0
   *     forces 1 + y = 1), so nothing cancels.
   * Error is floating-point only (≈1e-15 relative), independent of segment
   * length — the previous 64-step trapezoid drifted by up to ~2e-3 relative
   * (2.8 ms per bar, 0.7 s over a 256-bar ramp at steep slopes).
   */
  private _ticksToSecondsCurve(
    ticks: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number,
    slope: number
  ): number {
    if (totalSegmentTicks === 0 || ticks === 0) return 0;
    if (isNearLinearSlope(slope)) {
      return this._ticksToSecondsLinear(ticks, bpm0, bpm1, totalSegmentTicks);
    }
    const { c, cB, cA, base } = this._curveSegment(bpm0, bpm1, totalSegmentTicks, slope);
    const x = ticks / totalSegmentTicks;
    const expm1NegCx = Math.expm1(-c * x); // e^(−c·x) − 1
    const y = (cA / (c * bpm0)) * expm1NegCx;
    if (1 + y > 0.5) {
      return base * (-expm1NegCx / (c * bpm0)) * log1pOverY(y);
    }
    const logRatio = Math.log1p((cB / (c * bpm0)) * Math.expm1(c * x)); // ln(bpm(x)/bpm0)
    return (base * (c * x - logRatio)) / cA;
  }

  /**
   * Closed-form inverse of _ticksToSecondsCurve. Solving the log1p form for x:
   *   K = seconds·c·A/base
   *   z = e^(−c·x) − 1 = −(bpm0·seconds·c/base) · (1 − e^(−K))/K
   *   x = −log1p(z)/c
   * (1 − e^(−K))/K → 1 as K → 0 makes A → 0 exact; c → 0 is exact because
   * z ∝ c and log1p(z)/c keeps the ratio. When e^(−c·x) is small (z ≤ −0.5: a
   * steep concave ramp near its end) and |B| < |A|/2, forming it as 1 + z
   * loses digits; there the equal product form
   * e^(−c·x) = (c·bpm0·e^(−K) − c·B)/(c·A) is used — its digit loss is
   * |B|/|A| times the 1 + z form's, so the guard makes it the better choice by
   * at least 2×. Returns fractional ticks; callers round at their unit boundary.
   */
  private _secondsToTicksCurve(
    seconds: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number,
    slope: number
  ): number {
    if (totalSegmentTicks === 0 || seconds === 0) return 0;
    if (isNearLinearSlope(slope)) {
      return this._secondsToTicksLinear(seconds, bpm0, bpm1, totalSegmentTicks);
    }
    const { c, cB, cA, base } = this._curveSegment(bpm0, bpm1, totalSegmentTicks, slope);
    const k = (seconds * cA) / base;
    const z = -((bpm0 * seconds * c) / base) * expm1NegOverK(k);
    if (z > -0.5 || Math.abs(cB) >= 0.5 * Math.abs(cA)) {
      return (-Math.log1p(z) / c) * totalSegmentTicks;
    }
    const expNegCx = (c * bpm0 * Math.exp(-k) - cB) / cA;
    return (-Math.log(expNegCx) / c) * totalSegmentTicks;
  }

  private _curveSegment(
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number,
    slope: number
  ): CurveSegment {
    const { c, cB: cBNormalized } = curveCoefficients(slope);
    const cB = cBNormalized * (bpm1 - bpm0);
    return { c, cB, cA: c * bpm0 - cB, base: (totalSegmentTicks * 60) / this._ppqn };
  }

  private _entryIndexAt(tick: number): number {
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].tick <= tick) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tickDelta = this._entries[i].tick - prev.tick;
      const entry = this._entries[i];

      let segmentSeconds: number;
      if (entry.interpolation === 'linear') {
        segmentSeconds = this._ticksToSecondsLinear(tickDelta, prev.bpm, entry.bpm, tickDelta);
      } else if (typeof entry.interpolation === 'object') {
        segmentSeconds = this._ticksToSecondsCurve(
          tickDelta,
          prev.bpm,
          entry.bpm,
          tickDelta,
          entry.interpolation.slope
        );
      } else {
        // Step: constant BPM from previous entry
        const secondsPerTick = 60 / (prev.bpm * this._ppqn);
        segmentSeconds = tickDelta * secondsPerTick;
      }

      this._entries[i] = {
        ...entry,
        secondsAtTick: prev.secondsAtTick + segmentSeconds,
      };
    }
  }
}
