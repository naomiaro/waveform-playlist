export class Clock {
  private _audioContext: AudioContext;
  private _running = false;
  private _audioTimeAtStart = 0;
  private _clockTimeAtStart = 0;

  constructor(audioContext: AudioContext) {
    this._audioContext = audioContext;
  }

  start(): void {
    if (this._running) return;
    this._audioTimeAtStart = this._audioContext.currentTime;
    this._running = true;
  }

  stop(): void {
    if (!this._running) return;
    this._clockTimeAtStart = this.getTime();
    this._running = false;
  }

  reset(): void {
    this._running = false;
    this._clockTimeAtStart = 0;
    this._audioTimeAtStart = 0;
  }

  getTime(): number {
    if (this._running) {
      return this._clockTimeAtStart + (this._audioContext.currentTime - this._audioTimeAtStart);
    }
    return this._clockTimeAtStart;
  }

  seekTo(time: number): void {
    if (this._running) {
      this._clockTimeAtStart = time;
      this._audioTimeAtStart = this._audioContext.currentTime;
    } else {
      this._clockTimeAtStart = time;
    }
  }

  /**
   * Convert transport time to AudioContext.currentTime space.
   * Used by players to schedule AudioBufferSourceNode.start(when).
   */
  toAudioTime(transportTime: number): number {
    return this._audioContext.currentTime + (transportTime - this.getTime());
  }

  isRunning(): boolean {
    return this._running;
  }
}
