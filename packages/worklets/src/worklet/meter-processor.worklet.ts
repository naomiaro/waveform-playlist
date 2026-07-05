/**
 * MeterProcessor — AudioWorklet processor for sample-accurate peak/RMS metering
 *
 * Pass-through node: audio flows through unchanged while levels are computed.
 * Accumulates peak (max absolute sample) and RMS (root mean square) across all
 * 128-sample quantums, posting results at ~updateRate Hz via postMessage.
 *
 * Message format: a single reused Float32Array of length 2*N (N = channel
 * count) — indices [0..N-1] are per-channel peak, [N..2N-1] are per-channel
 * RMS (see MeterMessage in ../index.ts). All accumulators and the message
 * buffer are pre-allocated at construction; steady-state process()/flush does
 * no allocation on the audio thread.
 *
 * RMS Strategy: Simple interval average (not sliding window).
 * Trade-off: A sliding window (like openDAW's 100ms circular buffer) provides
 * smoother loudness display. Our interval-based approach may appear jumpier
 * since each update only reflects ~16ms of audio. For visual metering at 60fps
 * the difference is subtle. A circular buffer can be added later without
 * changing the message format or hook API.
 */

interface MeterProcessorOptions {
  numberOfChannels: number;
  updateRate: number;
}

class MeterProcessor extends AudioWorkletProcessor {
  private numberOfChannels: number;
  private blocksPerUpdate: number;
  private blocksProcessed: number;
  private maxPeak: Float32Array;
  /** Float64 to avoid precision drift when summing many squared samples */
  private sumSquares: Float64Array;
  private sampleCount: Uint32Array;
  /** Reused message buffer: [0..N-1] peak, [N..2N-1] rms */
  private levels: Float32Array;

  constructor(options: { processorOptions: MeterProcessorOptions }) {
    super();
    const { numberOfChannels, updateRate } = options.processorOptions;
    this.numberOfChannels = numberOfChannels;
    this.blocksPerUpdate = Math.max(1, Math.floor(sampleRate / (128 * updateRate)));
    this.blocksProcessed = 0;
    this.maxPeak = new Float32Array(numberOfChannels);
    this.sumSquares = new Float64Array(numberOfChannels);
    this.sampleCount = new Uint32Array(numberOfChannels);
    this.levels = new Float32Array(2 * numberOfChannels);
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
      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        this.levels[ch] = this.maxPeak[ch];
        const count = this.sampleCount[ch];
        this.levels[this.numberOfChannels + ch] =
          count > 0 ? Math.sqrt(this.sumSquares[ch] / count) : 0;
      }

      // Structured clone copies the contents; the worklet keeps its buffer.
      // Transferring would detach it and force a per-flush reallocation.
      this.port.postMessage(this.levels);

      this.maxPeak.fill(0);
      this.sumSquares.fill(0);
      this.sampleCount.fill(0);
      this.blocksProcessed = 0;
    }

    return true;
  }
}

registerProcessor('meter-processor', MeterProcessor);
