import type { DecidedPanLaw } from './panLaw';

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
 * The gains of a pan law at a pan position: exactly the two algorithms of
 * the Web Audio `StereoPannerNode`. Which law a track has is the track's own
 * value (`trackPanLaw`), not a property of the signal that reaches the stage.
 *
 * - `'mono'` — equal-power pan, θ = (pan + 1)·π/4: L × cos θ, R × sin θ.
 *   For a mono signal (taken as L = R) that is the mono law, L = m·cos θ and
 *   R = m·sin θ: −3 dB per side at centre. A stereo signal from the track's
 *   effects is balanced by the same gains, so it stays stereo at the same
 *   centre level as the dry signal.
 * - `'stereo'` — the stereo law: centre passes both channels at unity;
 *   panning left folds the right channel into the left
 *   (L + R·cos x, R·sin x with x = (pan + 1)·π/2), and symmetrically right.
 *
 * `pan` is clamped to −1 … 1; a non-finite value is treated as centre.
 */
export function panMatrix(pan: number, panLaw: DecidedPanLaw): PanMatrix {
  const p = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
  if (panLaw === 'mono') {
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
  'createGain' | 'createChannelSplitter' | 'createChannelMerger' | 'currentTime'
>;

/** How long a switch of pan law takes: the four gains ramp, so a switch during playback does not click (#684). */
export const PAN_LAW_RAMP_SECONDS = 0.01;

/** A track's pan stage: `input → … → output`, with `setPan(-1 … 1)`. */
export interface PanStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setPan(pan: number): void;
  /**
   * Switch the pan law, keeping the pan. The four gains ramp to the new
   * matrix over `PAN_LAW_RAMP_SECONDS`; the law the stage already has does
   * nothing.
   */
  setPanLaw(panLaw: DecidedPanLaw): void;
  /** Disconnect every node of the stage. */
  dispose(): void;
}

/**
 * Build the pan stage for a track with the pan law `panLaw` (core's
 * `trackPanLaw(track)`; `'mono'` for synth voices).
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
  panLaw: DecidedPanLaw
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
  let currentLaw = panLaw;
  // True from a law switch until the next pan move: a ramp may be scheduled.
  let rampScheduled = false;
  const targets = (): Array<[GainNode, number]> => {
    const matrix = panMatrix(currentPan, currentLaw);
    return [
      [ll, matrix.ll],
      [lr, matrix.lr],
      [rl, matrix.rl],
      [rr, matrix.rr],
    ];
  };
  /** Set the gains now. A scheduled ramp is cancelled first, or its end would override the value. */
  const apply = (): void => {
    for (const [node, value] of targets()) {
      if (rampScheduled) node.gain.cancelScheduledValues(context.currentTime);
      node.gain.value = value;
    }
    rampScheduled = false;
  };
  /** Move the gains to the current matrix over the ramp time, from where each is now. */
  const ramp = (): void => {
    const now = context.currentTime;
    for (const [node, value] of targets()) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(value, now + PAN_LAW_RAMP_SECONDS);
    }
    rampScheduled = true;
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
    setPanLaw: (value) => {
      if (value === currentLaw) return;
      currentLaw = value;
      ramp();
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
