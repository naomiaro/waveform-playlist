import { Gain, Merge, Split, type ToneAudioNode } from 'tone';

/**
 * A track's pan stage: `input → … → output`, with `setPan(-1 … 1)`.
 *
 * Why this is not a Tone `Panner`: with pre-fader effects (#660) the pan
 * stage is fed by the track's effects chain, whose channel layout is no
 * longer the source's. Tone's `Panner` pins `channelCountMode: 'explicit'`
 * with a fixed `channelCount` (Panner.js: "this._panner.channelCountMode =
 * 'explicit'"), and standardized-audio-context — Tone's default context —
 * throws NotSupportedError on any attempt to change it (its bug #105: the
 * Safari StereoPanner polyfill cannot implement 'clamped-max', so every
 * browser is pinned). A mono track's panner is therefore locked to ONE
 * channel, and a stereo effect on that track (reverb, ping-pong delay, most
 * WAM plugins) would be summed to mono before panning.
 *
 * This stage is a 2×2 gain matrix built from plain gain, splitter and merger
 * nodes — none of which is restricted — so it behaves identically on native
 * and standardized contexts, and always passes stereo through.
 */
export interface TrackPanStage {
  readonly input: ToneAudioNode;
  readonly output: ToneAudioNode;
  setPan(pan: number): void;
  dispose(): void;
}

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
 * material — exactly the two algorithms of the Web Audio `StereoPannerNode`,
 * so replacing Tone's `Panner` changes no level and no pan position.
 *
 * - Mono source — equal-power pan, θ = (pan + 1)·π/4: L × cos θ, R × sin θ.
 *   For a mono signal (taken as L = R) that is the mono law, L = m·cos θ and
 *   R = m·sin θ: −3 dB per side at centre. A stereo signal from the track's
 *   effects is balanced by the same gains, so it stays stereo at the same
 *   centre level as the dry signal.
 * - Stereo source — the stereo law: centre passes both channels at unity;
 *   panning left folds the right channel into the left
 *   (L + R·cos x, R·sin x with x = (pan + 1)·π/2), and symmetrically right.
 */
export function panMatrix(pan: number, sourceChannelCount: number): PanMatrix {
  const p = Math.max(-1, Math.min(1, pan));
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
 * Build the pan stage for a track whose source material has
 * `sourceChannelCount` channels (1 for mono clips and synth voices).
 */
export function createTrackPanStage(pan: number, sourceChannelCount: number): TrackPanStage {
  // Take the incoming signal as stereo regardless of its layout: with an
  // explicit count of 2 (speakers interpretation) mono is upmixed to L = R
  // and stereo passes through unchanged.
  const upmix = new Gain({ gain: 1 });
  upmix.channelCount = 2;
  upmix.channelCountMode = 'explicit';
  upmix.channelInterpretation = 'speakers';
  const split = new Split(2);
  const merge = new Merge(2);
  const initial = panMatrix(pan, sourceChannelCount);
  const ll = new Gain({ gain: initial.ll });
  const lr = new Gain({ gain: initial.lr });
  const rl = new Gain({ gain: initial.rl });
  const rr = new Gain({ gain: initial.rr });

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
      const next = panMatrix(value, sourceChannelCount);
      ll.gain.value = next.ll;
      lr.gain.value = next.lr;
      rl.gain.value = next.rl;
      rr.gain.value = next.rr;
    },
    dispose: () => {
      for (const node of [upmix, split, ll, lr, rl, rr, merge]) {
        node.dispose();
      }
    },
  };
}
