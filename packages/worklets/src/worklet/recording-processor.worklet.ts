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
 *   channels: Float32Array[],  // Per-channel audio samples for this chunk
 *   sampleRate: number,        // Sample rate of the audio
 *   channelCount: number       // Number of channels
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
  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): void;

interface RecordingProcessorMessage {
  channels: Float32Array[];
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
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    if (!this.isRecording) {
      return true; // Keep processor alive
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true; // No input yet, keep alive
    }

    const frameCount = input[0].length;

    if (this.bufferSize <= 0) {
      return true; // Not yet configured via 'start' command
    }

    let offset = 0;

    // Process samples in chunks that fit within the buffer.
    // The AudioWorklet quantum (128 samples) may not divide evenly into
    // bufferSize (e.g., 705 at 44100Hz), so a single frame can cross
    // the buffer boundary. Without this loop, samples beyond bufferSize
    // are silently dropped by the typed array, causing audio gaps.
    while (offset < frameCount) {
      const remaining = this.bufferSize - this.samplesCollected;
      const toCopy = Math.min(remaining, frameCount - offset);

      for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
        const inputChannel = input[channel];
        const buffer = this.buffers[channel];

        for (let i = 0; i < toCopy; i++) {
          buffer[this.samplesCollected + i] = inputChannel[offset + i];
        }
      }

      this.samplesCollected += toCopy;
      offset += toCopy;

      // When buffer is full, send to main thread
      if (this.samplesCollected >= this.bufferSize) {
        this.flushBuffers();
      }
    }

    return true; // Keep processor alive
  }

  private flushBuffers(): void {
    // Send all channel buffers to main thread
    const channels: Float32Array[] = [];
    for (let i = 0; i < this.channelCount; i++) {
      channels.push(this.buffers[i].slice(0, this.samplesCollected));
    }

    this.port.postMessage({
      channels,
      sampleRate: sampleRate,
      channelCount: this.channelCount,
    } as RecordingProcessorMessage);

    // Reset buffer
    this.samplesCollected = 0;
  }
}

// Register the processor
registerProcessor('recording-processor', RecordingProcessor);
