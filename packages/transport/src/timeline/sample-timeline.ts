export class SampleTimeline {
  private _sampleRate: number;

  constructor(sampleRate: number) {
    this._sampleRate = sampleRate;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  samplesToSeconds(samples: number): number {
    return samples / this._sampleRate;
  }

  secondsToSamples(seconds: number): number {
    return Math.round(seconds * this._sampleRate);
  }
}
