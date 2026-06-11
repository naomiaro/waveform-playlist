export class MasterNode {
  private _gainNode: GainNode;
  private _destination: AudioNode | null = null;
  private _effectsInput: AudioNode | null = null;

  constructor(audioContext: AudioContext) {
    this._gainNode = audioContext.createGain();
  }

  get input(): AudioNode {
    return this._gainNode;
  }

  get output(): AudioNode {
    return this._gainNode;
  }

  /** Connect the master output to its final destination (audioContext.destination) */
  connectOutput(destination: AudioNode): void {
    this._destination = destination;
    this._gainNode.connect(destination);
  }

  /**
   * Insert an effects chain between the master gain and the destination.
   * Only the destination edge is severed (targeted disconnect), so parallel
   * taps on the master output (analyzers, recorders) keep working.
   * The caller is responsible for routing the chain's output onward.
   */
  connectEffects(effectsInput: AudioNode): void {
    if (this._effectsInput) {
      // Replace: sever the previous chain's edge; destination edge is already gone
      this._gainNode.disconnect(this._effectsInput);
    } else if (this._destination) {
      this._gainNode.disconnect(this._destination);
    }
    this._gainNode.connect(effectsInput);
    this._effectsInput = effectsInput;
  }

  /** Remove the effects chain and restore direct routing to the destination */
  disconnectEffects(): void {
    if (!this._effectsInput) {
      return;
    }
    this._gainNode.disconnect(this._effectsInput);
    if (this._destination) {
      this._gainNode.connect(this._destination);
    }
    this._effectsInput = null;
  }

  setVolume(value: number): void {
    this._gainNode.gain.value = value;
  }

  dispose(): void {
    try {
      this._gainNode.disconnect();
    } catch (err) {
      console.warn('[waveform-playlist] MasterNode.dispose: error disconnecting: ' + String(err));
    }
    this._destination = null;
    this._effectsInput = null;
  }
}
