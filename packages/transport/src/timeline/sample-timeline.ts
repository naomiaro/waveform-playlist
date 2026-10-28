import type { Tick, Sample } from '../types';
import type { TempoMap } from './tempo-map';

export class SampleTimeline {
  private _sampleRate: number;
  private _tempoMap: TempoMap | null = null;

  constructor(sampleRate: number) {
    this._sampleRate = sampleRate;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  setTempoMap(tempoMap: TempoMap): void {
    this._tempoMap = tempoMap;
  }

  samplesToSeconds(samples: Sample): number {
    return samples / this._sampleRate;
  }

  secondsToSamples(seconds: number): Sample {
    return Math.round(seconds * this._sampleRate) as Sample;
  }

  ticksToSamples(ticks: Tick): Sample {
    return Math.round(this._requireTempoMap().ticksToSeconds(ticks) * this._sampleRate) as Sample;
  }

  /** Samples → integer ticks. The integer `Tick` contract belongs to THIS
   *  boundary: exactly one rounding, applied to the fractional position. */
  samplesToTicks(samples: Sample): Tick {
    return Math.round(this.samplesToTicksExact(samples)) as Tick;
  }

  /** Samples → fractional tick position (unrounded), for sub-tick placement. */
  samplesToTicksExact(samples: Sample): number {
    return this._requireTempoMap().secondsToTicksExact(samples / this._sampleRate);
  }

  private _requireTempoMap(): TempoMap {
    if (!this._tempoMap) {
      throw new Error(
        '[waveform-playlist] SampleTimeline: tempoMap not set — call setTempoMap() first'
      );
    }
    return this._tempoMap;
  }
}
