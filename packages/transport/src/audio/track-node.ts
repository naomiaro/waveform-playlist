export class TrackNode {
  readonly id: string;
  private _volumeNode: GainNode;
  private _panNode: StereoPannerNode;
  private _muteNode: GainNode;
  private _destination: AudioNode | null = null;
  private _effectsInput: AudioNode | null = null;

  constructor(id: string, audioContext: AudioContext) {
    this.id = id;
    this._volumeNode = audioContext.createGain();
    this._panNode = audioContext.createStereoPanner();
    this._panNode.channelCount = 2;
    this._muteNode = audioContext.createGain();

    // Wire: volume → pan → mute (caller connects output via connectOutput)
    this._volumeNode.connect(this._panNode);
    this._panNode.connect(this._muteNode);
  }

  /** Where clip sources connect */
  get input(): GainNode {
    return this._volumeNode;
  }

  /** Connect this track's output to a destination (master node) */
  connectOutput(destination: AudioNode): void {
    this._destination = destination;
    this._muteNode.connect(destination);
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
    // Clean up previous effects connection first
    if (this._effectsInput) {
      this.disconnectEffects();
    }
    // Disconnect mute from destination
    this._muteNode.disconnect();
    // Route mute → effects input
    this._muteNode.connect(effectsInput);
    this._effectsInput = effectsInput;
  }

  disconnectEffects(): void {
    if (this._effectsInput && this._destination) {
      this._muteNode.disconnect();
      // Restore direct routing: mute → destination
      this._muteNode.connect(this._destination);
      this._effectsInput = null;
    }
  }

  dispose(): void {
    for (const node of [this._volumeNode, this._panNode, this._muteNode]) {
      try {
        node.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] TrackNode.dispose: error disconnecting node:',
          String(err)
        );
      }
    }
  }
}
