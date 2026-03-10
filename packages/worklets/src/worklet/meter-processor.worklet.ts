/**
 * MeterProcessor — AudioWorklet processor for sample-accurate peak/RMS metering
 *
 * Pass-through node: audio flows through unchanged while levels are computed.
 * Accumulates peak (max absolute sample) and RMS (root mean square) across all
 * 128-sample quantums, posting results at ~updateRate Hz via postMessage.
 *
 * RMS Strategy: Simple interval average (not sliding window).
 * Trade-off: A sliding window (like openDAW's 100ms circular buffer) provides
 * smoother loudness display. Our interval-based approach may appear jumpier
 * since each update only reflects ~16ms of audio. For visual metering at 60fps
 * the difference is subtle. A circular buffer can be added later without
 * changing the message format or hook API.
 */

declare const sampleRate: number;

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: 'a-rate' | 'k-rate';
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}
declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): void;

interface MeterProcessorOptions {
  numberOfChannels: number;
  updateRate: number;
}

class MeterProcessor extends AudioWorkletProcessor {
  private numberOfChannels: number;
  private blocksPerUpdate: number;
  private blocksProcessed: number;
  private maxPeak: number[];
  private sumSquares: number[];
  private sampleCount: number[];

  constructor(options: { processorOptions: MeterProcessorOptions } & AudioWorkletNodeOptions) {
    super();
    const { numberOfChannels, updateRate } = options.processorOptions;
    this.numberOfChannels = numberOfChannels;
    this.blocksPerUpdate = Math.max(1, Math.floor(sampleRate / (128 * updateRate)));
    this.blocksProcessed = 0;
    this.maxPeak = new Array(numberOfChannels).fill(0);
    this.sumSquares = new Array(numberOfChannels).fill(0);
    this.sampleCount = new Array(numberOfChannels).fill(0);
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) {
      return true;
    }

    for (let ch = 0; ch < output.length; ch++) {
      const inputChannel = input[ch];
      const outputChannel = output[ch];
      if (inputChannel && outputChannel) {
        outputChannel.set(inputChannel);
      }
    }

    for (let ch = 0; ch < this.numberOfChannels; ch++) {
      const inputChannel = input[ch];
      if (!inputChannel) continue;

      let peak = this.maxPeak[ch];
      let sum = this.sumSquares[ch];

      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        sum += sample * sample;
      }

      this.maxPeak[ch] = peak;
      this.sumSquares[ch] = sum;
      this.sampleCount[ch] += inputChannel.length;
    }

    this.blocksProcessed++;

    if (this.blocksProcessed >= this.blocksPerUpdate) {
      const peak: number[] = [];
      const rms: number[] = [];

      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        peak.push(this.maxPeak[ch]);
        const count = this.sampleCount[ch];
        rms.push(count > 0 ? Math.sqrt(this.sumSquares[ch] / count) : 0);
      }

      this.port.postMessage({ peak, rms });

      this.maxPeak.fill(0);
      this.sumSquares.fill(0);
      this.sampleCount.fill(0);
      this.blocksProcessed = 0;
    }

    return true;
  }
}

registerProcessor('meter-processor', MeterProcessor);
