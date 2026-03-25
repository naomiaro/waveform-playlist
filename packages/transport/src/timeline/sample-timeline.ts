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
    if (!this._tempoMap) {
      throw new Error(
        '[waveform-playlist] SampleTimeline: tempoMap not set — call setTempoMap() first'
      );
    }
    return Math.round(this._tempoMap.ticksToSeconds(ticks) * this._sampleRate) as Sample;
  }

  samplesToTicks(samples: Sample): Tick {
    if (!this._tempoMap) {
      throw new Error(
        '[waveform-playlist] SampleTimeline: tempoMap not set — call setTempoMap() first'
      );
    }
    return this._tempoMap.secondsToTicks(samples / this._sampleRate);
  }
}
