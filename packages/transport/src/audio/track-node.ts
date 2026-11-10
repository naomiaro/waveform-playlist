import { createPanStage, type PanStage } from '@waveform-playlist/core';

const PREFIX = '[waveform-playlist] ';

/**
 * One track's signal path:
 *
 *   clip sources → input → [effects insert] → volume → pan → mute → output
 *
 * Effects are PRE-FADER inserts (#660), the usual DAW convention: the
 * chain sees the clips' own level and channel layout, so the volume fader
 * and pan only place the processed track in the mix — they never change
 * how hard a compressor or distortion works. Mute sits last, so a muted
 * (or un-soloed) track is silent including its effect tails.
 *
 * Pan is core's gain-matrix stage, not a `StereoPannerNode` (#669): a
 * panner picks its law from the layout it RECEIVES, which pre-fader is the
 * effects chain's output — a stereo reverb on a mono track would sit ~3 dB
 * louder at centre. The stage takes its law from `sourceChannelCount`, the
 * max channel count of the track's clips, whatever the chain outputs.
 */
export class TrackNode {
  readonly id: string;
  private _inputNode: GainNode;
  private _volumeNode: GainNode;
  private _panStage: PanStage;
  private _muteNode: GainNode;
  private _effects: { input: AudioNode; output: AudioNode } | null = null;

  constructor(id: string, audioContext: AudioContext, sourceChannelCount = 1) {
    this.id = id;
    // Unity-gain summing point for the track's clip sources — the stable
    // node an effects chain is inserted after.
    this._inputNode = audioContext.createGain();
    this._volumeNode = audioContext.createGain();
    this._panStage = createPanStage(audioContext, 0, sourceChannelCount);
    this._muteNode = audioContext.createGain();

    // Wire: input → volume → pan → mute (caller connects output via connectOutput)
    this._inputNode.connect(this._volumeNode);
    this._volumeNode.connect(this._panStage.input);
    this._panStage.output.connect(this._muteNode);
  }

  /** Where clip sources connect (pre-fader, pre-effects). */
  get input(): GainNode {
    return this._inputNode;
  }

  /** Connect this track's output to a destination (master node) */
  connectOutput(destination: AudioNode): void {
    this._muteNode.connect(destination);
  }

  setVolume(value: number): void {
    this._volumeNode.gain.value = value;
  }

  setPan(value: number): void {
    this._panStage.setPan(value);
  }

  /** Select the pan law from the track's source material: 1 = mono law
   *  (−3 dB per side at centre), 2+ = stereo law (unity at centre). */
  setSourceChannelCount(sourceChannelCount: number): void {
    this._panStage.setSourceChannelCount(sourceChannelCount);
  }

  setMute(muted: boolean): void {
    this._muteNode.gain.value = muted ? 0 : 1;
  }

  /**
   * Insert an effects chain between the track input and the fader:
   * `input → effectsInput … effectsOutput → volume`. The transport owns
   * BOTH edges — the caller only builds what lies between the two nodes
   * (pass the same node twice for a single-node effect). Replaces any
   * chain connected earlier.
   */
  connectEffects(effectsInput: AudioNode, effectsOutput: AudioNode): void {
    this.disconnectEffects();
    this._inputNode.disconnect();
    this._inputNode.connect(effectsInput);
    effectsOutput.connect(this._volumeNode);
    this._effects = { input: effectsInput, output: effectsOutput };
  }

  /** Remove the effects chain and restore `input → volume`. No-op without one. */
  disconnectEffects(): void {
    if (!this._effects) {
      return;
    }
    this._releaseEffectsReturn();
    this._inputNode.disconnect();
    this._inputNode.connect(this._volumeNode);
    this._effects = null;
  }

  dispose(): void {
    // The chain's return edge would otherwise keep feeding (and retaining)
    // this dead track's volume node.
    this._releaseEffectsReturn();
    this._effects = null;
    for (const node of [this._inputNode, this._volumeNode, this._muteNode]) {
      try {
        node.disconnect();
      } catch (err) {
        console.warn(PREFIX + 'TrackNode.dispose: error disconnecting node:', String(err));
      }
    }
    this._panStage.dispose();
  }

  /** Targeted disconnect of `effectsOutput → volume` — other consumers of
   *  the chain's output (analyser taps) keep their edges. */
  private _releaseEffectsReturn(): void {
    if (!this._effects) {
      return;
    }
    try {
      this._effects.output.disconnect(this._volumeNode);
    } catch (err) {
      // The consumer may have torn its chain down first; the track must
      // still be able to restore its own routing.
      console.warn(
        PREFIX + 'TrackNode: effects chain was already disconnected from track "' + this.id + '": ',
        String(err)
      );
    }
  }
}
