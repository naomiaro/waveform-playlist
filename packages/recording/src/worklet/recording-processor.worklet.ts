/**
 * RecordingProcessor - AudioWorklet processor for capturing raw audio data
 *
 * This processor runs in the AudioWorklet thread and captures audio samples
 * at the browser's native sample rate. It buffers samples and sends them to
 * the main thread at regular intervals (~16ms) for peak generation and
 * waveform visualization.
 *
 * Message Format (to main thread):
 * {
 *   samples: Float32Array,  // Audio samples for this chunk
 *   sampleRate: number,     // Sample rate of the audio
 *   channelCount: number    // Number of channels
 * }
 *
 * Note: VU meter levels are handled by AnalyserNode in useMicrophoneLevel hook,
 * not by this worklet.
 */

// Type declarations for AudioWorklet context
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
  processorCtor: (new (
    options?: AudioWorkletNodeOptions
  ) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): void;

interface RecordingProcessorMessage {
  samples: Float32Array;
  sampleRate: number;
  channelCount: number;
}

class RecordingProcessor extends AudioWorkletProcessor {
  private buffers: Float32Array[];
  private bufferSize: number;
  private samplesCollected: number;
  private isRecording: boolean;
  private channelCount: number;

  constructor() {
    super();

    // Buffer size for ~16ms at 48kHz (approximately one animation frame)
    // This will be adjusted based on actual sample rate
    this.bufferSize = 0;
    this.buffers = [];
    this.samplesCollected = 0;
    this.isRecording = false;
    this.channelCount = 1;

    // Listen for control messages from main thread
    this.port.onmessage = (event) => {
      const { command, sampleRate, channelCount } = event.data;

      if (command === 'start') {
        this.isRecording = true;
        this.channelCount = channelCount || 1;

        // Calculate buffer size for ~16ms chunks (60 fps)
        // At 48kHz: 48000 * 0.016 = 768 samples
        this.bufferSize = Math.floor((sampleRate || 48000) * 0.016);

        // Initialize buffers for each channel
        this.buffers = [];
        for (let i = 0; i < this.channelCount; i++) {
          this.buffers[i] = new Float32Array(this.bufferSize);
        }
        this.samplesCollected = 0;
      } else if (command === 'stop') {
        this.isRecording = false;

        // Send any remaining buffered samples
        if (this.samplesCollected > 0) {
          this.flushBuffers();
        }
      }
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    if (!this.isRecording) {
      return true; // Keep processor alive
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true; // No input yet, keep alive
    }

    const frameCount = input[0].length;

    // Process each channel
    for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
      const inputChannel = input[channel];
      const buffer = this.buffers[channel];

      // Copy samples to buffer
      for (let i = 0; i < frameCount; i++) {
        buffer[this.samplesCollected + i] = inputChannel[i];
      }
    }

    this.samplesCollected += frameCount;

    // When buffer is full, send to main thread
    if (this.samplesCollected >= this.bufferSize) {
      this.flushBuffers();
    }

    return true; // Keep processor alive
  }

  private flushBuffers(): void {
    // For now, we'll mix down to mono or send the first channel
    // This simplifies peak generation and waveform display
    const samples = this.buffers[0].slice(0, this.samplesCollected);

    // Send to main thread
    this.port.postMessage({
      samples: samples,
      sampleRate: sampleRate,
      channelCount: this.channelCount,
    } as RecordingProcessorMessage);

    // Reset buffer
    this.samplesCollected = 0;
  }
}

// Register the processor
registerProcessor('recording-processor', RecordingProcessor);
