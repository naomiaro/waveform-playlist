import type { CreatedEffect, EffectDefinition } from './types';

const MAX_DELAY_SECONDS = 10;

let registry = new Map<string, EffectDefinition>();

export function registerEffect(type: string, definition: EffectDefinition): void {
  if (registry.has(type)) {
    console.warn(
      '[waveform-playlist] registerEffect: overwriting existing effect type "' + type + '"'
    );
  }
  registry.set(type, definition);
}

/** A copy — mutating the returned map does not affect the registry. */
export function getEffectDefinitions(): Map<string, EffectDefinition> {
  return new Map(registry);
}

export function createEffectInstance(
  type: string,
  audioContext: BaseAudioContext,
  params: Record<string, number> = {}
): CreatedEffect {
  const definition = registry.get(type);
  if (!definition) {
    throw new Error(
      '[waveform-playlist] createEffectInstance: unknown effect type "' +
        type +
        '". Available types: ' +
        [...registry.keys()].join(', ')
    );
  }
  const merged = { ...definition.defaults, ...params };
  const instance = definition.create(audioContext, merged);
  instance.applyParams(merged);
  return { instance, params: merged, wetParam: definition.wetParam };
}

/** Test-only: restore the registry to just the built-ins. */
export function _resetEffectRegistryForTests(): void {
  registry = new Map();
  registerBuiltIns();
}

function singleNode(
  node: AudioNode,
  applyParams: (params: Record<string, number>) => void
): { input: AudioNode; output: AudioNode; applyParams: (params: Record<string, number>) => void } {
  return { input: node, output: node, applyParams };
}

function registerBuiltIns(): void {
  registry.set('native-gain', {
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

  registry.set('native-filter', {
    label: 'Lowpass Filter',
    category: 'filter',
    defaults: { frequency: 1000, q: 1 },
    params: {
      frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
      q: { min: 0.1, max: 20, step: 0.1 },
    },
    create: (ctx) => {
      const node = ctx.createBiquadFilter();
      node.type = 'lowpass';
      return singleNode(node, (p) => {
        if (p.frequency !== undefined) node.frequency.value = p.frequency;
        if (p.q !== undefined) node.Q.value = p.q;
      });
    },
  });

  registry.set('native-compressor', {
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

  registry.set('native-stereo-panner', {
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

  registry.set('native-delay', {
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
