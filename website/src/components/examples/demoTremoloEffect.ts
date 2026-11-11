import { getEffectDefinitions, registerEffect } from '@waveform-playlist/core';

/** The id the effect is added by: `addEffect(DEMO_TREMOLO)`. */
export const DEMO_TREMOLO = 'demo-tremolo';

const MODULE_URL = '/waveform-playlist/media/worklets/demo-tremolo-processor.js';

/**
 * Register a custom effect backed by an AudioWorkletNode. One registration
 * serves the React effects hooks and `<daw-editor>`.
 */
export function registerDemoTremolo(): void {
  if (getEffectDefinitions().has(DEMO_TREMOLO)) return;

  registerEffect(DEMO_TREMOLO, {
    label: 'Tremolo (custom AudioWorklet)',
    category: 'custom',
    defaults: { rate: 6, depth: 0.8 },
    params: {
      rate: { min: 0.1, max: 20, step: 0.1, unit: 'Hz', label: 'Rate' },
      depth: { min: 0, max: 1, step: 0.01, label: 'Depth' },
    },

    // Runs once per AudioContext: the live one, and the offline one of every
    // WAV export. A worklet module has to be added to each.
    prepare: (audioContext) => audioContext.audioWorklet.addModule(MODULE_URL),

    // Synchronous: the processor is registered on this context by now.
    create: (audioContext) => {
      const node = new AudioWorkletNode(audioContext, DEMO_TREMOLO);
      return {
        input: node,
        output: node,
        applyParams: (params) => {
          for (const name of ['rate', 'depth']) {
            const param = node.parameters.get(name);
            if (param && params[name] !== undefined) param.value = params[name];
          }
        },
        dispose: () => node.disconnect(),
      };
    },
  });
}
