export class TrackNode {
  readonly id: string;
  private _volumeNode: GainNode;
  private _panNode: StereoPannerNode;
  private _muteNode: GainNode;
  private _output: AudioNode;
  private _effectsInput: AudioNode | null = null;

  constructor(id: string, audioContext: AudioContext) {
    this.id = id;
    this._volumeNode = audioContext.createGain();
    this._panNode = audioContext.createStereoPanner();
    this._muteNode = audioContext.createGain();

    // Default output is the mute node itself — caller connects to master
    this._output = this._muteNode;

    // Wire: volume → pan → mute → output
    this._volumeNode.connect(this._panNode);
    this._panNode.connect(this._muteNode);
  }

  /** Where clip sources connect */
  get input(): GainNode {
    return this._volumeNode;
  }

  /** Connect this track's output to a destination (master node) */
  connectOutput(destination: AudioNode): void {
    this._output.connect(destination);
  }

  setVolume(value: number): void {
    this._volumeNode.gain.value = value;
  }

  setPan(value: number): void {
    this._panNode.pan.value = value;
  }

  setMute(muted: boolean): void {
    this._muteNode.gain.value = muted ? 0 : 1;
  }

  connectEffects(effectsInput: AudioNode): void {
    // Disconnect mute from current output
    this._muteNode.disconnect();
    // Route mute → effects input
    this._muteNode.connect(effectsInput);
    this._effectsInput = effectsInput;
  }

  disconnectEffects(): void {
    if (this._effectsInput) {
      this._muteNode.disconnect();
      // Restore direct routing: mute → output
      this._muteNode.connect(this._output);
      this._effectsInput = null;
    }
  }

  dispose(): void {
    this._volumeNode.disconnect();
    this._panNode.disconnect();
    this._muteNode.disconnect();
  }
}
