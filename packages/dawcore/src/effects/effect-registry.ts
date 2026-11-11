/**
 * dawcore's built-in `native-*` effects. The registry itself lives in
 * `@waveform-playlist/core` (shared with the React effects hooks); importing
 * this module registers the built-ins there.
 */
import {
  getEffectDefinitions,
  registerEffect,
  unregisterEffect,
  type EffectParamDef,
  type NativeEffectDefinition,
} from '@waveform-playlist/core';

const MAX_DELAY_SECONDS = 10;

/** Test-only: restore the registry to just the built-ins. */
export function _resetEffectRegistryForTests(): void {
  for (const type of getEffectDefinitions().keys()) {
    unregisterEffect(type);
  }
  registerBuiltIns();
}

function singleNode(
  node: AudioNode,
  applyParams: (params: Record<string, number>) => void
): { input: AudioNode; output: AudioNode; applyParams: (params: Record<string, number>) => void } {
  return { input: node, output: node, applyParams };
}

type BiquadParam = 'frequency' | 'q' | 'gain';

const BIQUAD_PARAM_DEFS: Record<BiquadParam, EffectParamDef> = {
  frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
  q: { min: 0.1, max: 20, step: 0.1 },
  gain: { min: -24, max: 24, step: 0.5, unit: 'dB' },
};

/**
 * Web Audio gives `Q` two meanings. For bandpass, notch and peaking it is
 * the usual linear quality factor. For LOWPASS and HIGHPASS it is the
 * resonance peak in DECIBELS at the cutoff (Q_linear = 10^(Q/20)): 0 dB is a
 * slight bump, about -3 dB is a flat Butterworth response, and a linear-style
 * 0.707 would actually be +0.7 dB of resonance.
 */
const RESONANCE_DB_PARAM_DEF: EffectParamDef = { min: -12, max: 24, step: 0.1, unit: 'dB' };
/** Flat (Butterworth) response: 20·log10(1/√2). */
const BUTTERWORTH_RESONANCE_DB = -3;

interface BiquadFilterSpec {
  label: string;
  biquadType: BiquadFilterType;
  /** Only the params this biquad shape actually uses (the Web Audio spec
   *  ignores Q on shelves and gain on everything but peaking/shelves) — a
   *  generic parameter panel must not render dead sliders. */
  defaults: Partial<Record<BiquadParam, number>>;
  /** Per-type overrides of the shared param metadata. */
  paramDefs?: Partial<Record<BiquadParam, EffectParamDef>>;
}

/**
 * One registry type per biquad shape (#661). Effect params are numeric
 * (`Record<string, number>`), so the shape cannot be a param — sibling types
 * fit the model with no API change. `native-filter` keeps its original
 * (lowpass) meaning so persisted chains restore unchanged.
 */
const BIQUAD_FILTERS: Record<string, BiquadFilterSpec> = {
  // Unchanged since before #661 — including its q range, which predates the
  // dB reading above (q here is also resonance in dB; persisted chains rely
  // on these exact defaults and bounds).
  'native-filter': {
    label: 'Lowpass Filter',
    biquadType: 'lowpass',
    defaults: { frequency: 1000, q: 1 },
  },
  'native-highpass': {
    label: 'Highpass Filter',
    biquadType: 'highpass',
    defaults: { frequency: 80, q: BUTTERWORTH_RESONANCE_DB },
    paramDefs: { q: RESONANCE_DB_PARAM_DEF },
  },
  'native-bandpass': {
    label: 'Bandpass Filter',
    biquadType: 'bandpass',
    defaults: { frequency: 1000, q: 1 },
  },
  'native-notch': {
    label: 'Notch Filter',
    biquadType: 'notch',
    defaults: { frequency: 1000, q: 1 },
  },
  'native-peaking': {
    label: 'Peaking EQ',
    biquadType: 'peaking',
    defaults: { frequency: 1000, q: 1, gain: 0 },
  },
  'native-lowshelf': {
    label: 'Low Shelf',
    biquadType: 'lowshelf',
    defaults: { frequency: 200, gain: 0 },
  },
  'native-highshelf': {
    label: 'High Shelf',
    biquadType: 'highshelf',
    defaults: { frequency: 4000, gain: 0 },
  },
};

function biquadDefinition(spec: BiquadFilterSpec): NativeEffectDefinition {
  const names = Object.keys(spec.defaults) as BiquadParam[];
  return {
    label: spec.label,
    category: 'filter',
    defaults: { ...spec.defaults } as Record<string, number>,
    params: Object.fromEntries(
      names.map((name) => [name, spec.paramDefs?.[name] ?? BIQUAD_PARAM_DEFS[name]])
    ),
    create: (ctx) => {
      const node = ctx.createBiquadFilter();
      node.type = spec.biquadType;
      return singleNode(node, (p) => {
        if (names.includes('frequency') && p.frequency !== undefined) {
          node.frequency.value = p.frequency;
        }
        if (names.includes('q') && p.q !== undefined) node.Q.value = p.q;
        if (names.includes('gain') && p.gain !== undefined) node.gain.value = p.gain;
      });
    },
  };
}

function registerBuiltIns(): void {
  registerEffect('native-gain', {
    label: 'Gain',
    category: 'dynamics',
    defaults: { gain: 1 },
    params: { gain: { min: 0, max: 2, step: 0.01 } },
    create: (ctx) => {
      const node = ctx.createGain();
      return singleNode(node, (p) => {
        if (p.gain !== undefined) node.gain.value = p.gain;
      });
    },
  });

  for (const [type, definition] of Object.entries(BIQUAD_FILTERS)) {
    registerEffect(type, biquadDefinition(definition));
  }

  registerEffect('native-compressor', {
    label: 'Compressor',
    category: 'dynamics',
    defaults: { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 },
    params: {
      threshold: { min: -60, max: 0, step: 1, unit: 'dB' },
      knee: { min: 0, max: 40, step: 1, unit: 'dB' },
      ratio: { min: 1, max: 20, step: 0.5 },
      attack: { min: 0, max: 1, step: 0.001, unit: 's' },
      release: { min: 0, max: 1, step: 0.01, unit: 's' },
    },
    create: (ctx) => {
      const node = ctx.createDynamicsCompressor();
      return singleNode(node, (p) => {
        if (p.threshold !== undefined) node.threshold.value = p.threshold;
        if (p.knee !== undefined) node.knee.value = p.knee;
        if (p.ratio !== undefined) node.ratio.value = p.ratio;
        if (p.attack !== undefined) node.attack.value = p.attack;
        if (p.release !== undefined) node.release.value = p.release;
      });
    },
  });

  registerEffect('native-stereo-panner', {
    label: 'Stereo Panner',
    category: 'spatial',
    defaults: { pan: 0 },
    params: { pan: { min: -1, max: 1, step: 0.01 } },
    create: (ctx) => {
      const node = ctx.createStereoPanner();
      return singleNode(node, (p) => {
        if (p.pan !== undefined) node.pan.value = p.pan;
      });
    },
  });

  registerEffect('native-delay', {
    label: 'Delay',
    category: 'delay',
    defaults: { delayTime: 0.25, feedback: 0.4, wet: 0.35 },
    params: {
      delayTime: { min: 0, max: MAX_DELAY_SECONDS, step: 0.01, unit: 's' },
      feedback: { min: 0, max: 0.95, step: 0.01 },
      wet: { min: 0, max: 1, step: 0.01 },
    },
    wetParam: 'wet',
    create: (ctx) => {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const delay = ctx.createDelay(MAX_DELAY_SECONDS);
      const feedback = ctx.createGain();
      const wet = ctx.createGain();
      const dry = ctx.createGain();

      input.connect(dry);
      dry.connect(output);
      input.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(output);

      return {
        input,
        output,
        applyParams: (p) => {
          if (p.delayTime !== undefined) delay.delayTime.value = p.delayTime;
          if (p.feedback !== undefined) feedback.gain.value = p.feedback;
          if (p.wet !== undefined) {
            wet.gain.value = p.wet;
            dry.gain.value = 1 - p.wet;
          }
        },
      };
    },
  });
}

registerBuiltIns();
