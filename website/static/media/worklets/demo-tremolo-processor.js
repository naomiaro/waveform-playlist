// A hand-written AudioWorklet effect for the custom-effect demo: tremolo
// (amplitude modulation). Loaded with audioWorklet.addModule() from the
// effect definition's prepare() hook, once per AudioContext.
class DemoTremoloProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 6, minValue: 0.1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'depth', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const rate = parameters.rate[0];
    const depth = parameters.depth[0];
    const step = (2 * Math.PI * rate) / sampleRate;
    const frames = output[0] ? output[0].length : 0;

    for (let i = 0; i < frames; i++) {
      // 1 at the top of the cycle, 1 - depth at the bottom.
      const gain = 1 - depth * (0.5 - 0.5 * Math.cos(this.phase + i * step));
      for (let channel = 0; channel < output.length; channel++) {
        const source = input[channel];
        output[channel][i] = source ? source[i] * gain : 0;
      }
    }
    this.phase = (this.phase + frames * step) % (2 * Math.PI);
    return true;
  }
}

registerProcessor('demo-tremolo', DemoTremoloProcessor);
