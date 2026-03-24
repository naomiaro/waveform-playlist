export class MasterNode {
  private _gainNode: GainNode;

  constructor(audioContext: AudioContext) {
    this._gainNode = audioContext.createGain();
  }

  get input(): AudioNode {
    return this._gainNode;
  }

  get output(): AudioNode {
    return this._gainNode;
  }

  setVolume(value: number): void {
    this._gainNode.gain.value = value;
  }

  dispose(): void {
    try {
      this._gainNode.disconnect();
    } catch (err) {
      console.warn('[waveform-playlist] MasterNode.dispose: error disconnecting:', String(err));
    }
  }
}
