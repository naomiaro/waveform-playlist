const PREFIX = '[waveform-playlist] ';

/** Gains of the pan matrix: `out = [[ll, rl], [lr, rr]] · in`, where e.g.
 *  `rl` is how much of the input's RIGHT channel reaches the LEFT output. */
export interface PanMatrix {
  ll: number;
  lr: number;
  rl: number;
  rr: number;
}

/**
 * The pan law for a track, chosen by the channel count of its SOURCE
 * material — exactly the two algorithms of the Web Audio `StereoPannerNode`.
 *
 * - Mono source — equal-power pan, θ = (pan + 1)·π/4: L × cos θ, R × sin θ.
 *   For a mono signal (taken as L = R) that is the mono law, L = m·cos θ and
 *   R = m·sin θ: −3 dB per side at centre. A stereo signal from the track's
 *   effects is balanced by the same gains, so it stays stereo at the same
 *   centre level as the dry signal.
 * - Stereo source — the stereo law: centre passes both channels at unity;
 *   panning left folds the right channel into the left
 *   (L + R·cos x, R·sin x with x = (pan + 1)·π/2), and symmetrically right.
 *
 * `pan` is clamped to −1 … 1; a non-finite value is treated as centre.
 */
export function panMatrix(pan: number, sourceChannelCount: number): PanMatrix {
  const p = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
  if (sourceChannelCount < 2) {
    const theta = ((p + 1) * Math.PI) / 4;
    return { ll: Math.cos(theta), lr: 0, rl: 0, rr: Math.sin(theta) };
  }
  if (p <= 0) {
    const x = ((p + 1) * Math.PI) / 2;
    return { ll: 1, lr: 0, rl: Math.cos(x), rr: Math.sin(x) };
  }
  const x = (p * Math.PI) / 2;
  return { ll: Math.cos(x), lr: Math.sin(x), rl: 0, rr: 1 };
}

/**
 * The part of an audio context the pan stage needs. Any `AudioContext` or
 * `OfflineAudioContext` satisfies it, and so does the `rawContext` behind
 * Tone.js (native or standardized-audio-context).
 */
export type PanStageContext = Pick<
  BaseAudioContext,
  'createGain' | 'createChannelSplitter' | 'createChannelMerger'
>;

/** A track's pan stage: `input → … → output`, with `setPan(-1 … 1)`. */
export interface PanStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setPan(pan: number): void;
  /** Switch the pan law (1 = mono law, 2+ = stereo law), keeping the pan. */
  setSourceChannelCount(sourceChannelCount: number): void;
  /** Disconnect every node of the stage. */
  dispose(): void;
}

/**
 * Build the pan stage for a track whose source material has
 * `sourceChannelCount` channels (1 for mono clips and synth voices).
 *
 * Why this is not a `StereoPannerNode`: a track's pan stage is fed by its
 * effects chain (pre-fader inserts), whose channel layout is not the
 * source's. A `StereoPannerNode` picks its law from the layout it RECEIVES,
 * so a stereo effect on a mono track would jump ~3 dB at centre. And under
 * standardized-audio-context (Tone.js's default context) a panner's channel
 * mode cannot be changed at all (its bug #105), which pins a mono track's
 * panner to one channel.
 *
 * This stage is a 2×2 gain matrix built from plain gain, splitter and merger
 * nodes — none of which is restricted — so it behaves identically on every
 * context, always passes stereo through, and takes its law from the caller.
 */
export function createPanStage(
  context: PanStageContext,
  pan: number,
  sourceChannelCount: number
): PanStage {
  // Take the incoming signal as stereo regardless of its layout: with an
  // explicit count of 2 (speakers interpretation) mono is upmixed to L = R
  // and stereo passes through unchanged.
  const upmix = context.createGain();
  upmix.channelCount = 2;
  upmix.channelCountMode = 'explicit';
  upmix.channelInterpretation = 'speakers';
  const split = context.createChannelSplitter(2);
  const merge = context.createChannelMerger(2);
  const ll = context.createGain();
  const lr = context.createGain();
  const rl = context.createGain();
  const rr = context.createGain();

  let currentPan = pan;
  let currentChannelCount = sourceChannelCount;
  const apply = (): void => {
    const matrix = panMatrix(currentPan, currentChannelCount);
    ll.gain.value = matrix.ll;
    lr.gain.value = matrix.lr;
    rl.gain.value = matrix.rl;
    rr.gain.value = matrix.rr;
  };
  apply();

  upmix.connect(split);
  split.connect(ll, 0, 0);
  split.connect(lr, 0, 0);
  split.connect(rl, 1, 0);
  split.connect(rr, 1, 0);
  ll.connect(merge, 0, 0);
  rl.connect(merge, 0, 0);
  lr.connect(merge, 0, 1);
  rr.connect(merge, 0, 1);

  return {
    input: upmix,
    output: merge,
    setPan: (value) => {
      currentPan = value;
      apply();
    },
    setSourceChannelCount: (value) => {
      currentChannelCount = value;
      apply();
    },
    dispose: () => {
      for (const node of [upmix, split, ll, lr, rl, rr, merge]) {
        try {
          node.disconnect();
        } catch (err) {
          console.warn(PREFIX + 'pan stage: error disconnecting node: ' + String(err));
        }
      }
    },
  };
}
