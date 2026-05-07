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
 *   channelCount: number       // Number of channels
 * }
 *
 * Note: VU meter levels are handled by the meter-processor worklet in
 * useMicrophoneLevel hook, not by this worklet.
 */

interface RecordingProcessorMessage {
  channels: Float32Array[];
  channelCount: number;
  /** Set on the final message after a `stop` command — main thread awaits this
   * before reading accumulated chunks, otherwise the partial buffer flushed at
   * stop time arrives after the AudioBuffer is built and is lost. */
  done?: boolean;
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
      const { command, channelCount } = event.data;

      if (command === 'start') {
        this.isRecording = true;
        this.channelCount = channelCount || 1;

        // Calculate buffer size for ~16ms chunks (60 fps)
        // At 48kHz: 48000 * 0.016 = 768 samples
        // Uses the AudioWorklet global `sampleRate` — always correct for this context
        this.bufferSize = Math.floor(sampleRate * 0.016);

        // Initialize buffers for each channel
        this.buffers = [];
        for (let i = 0; i < this.channelCount; i++) {
          this.buffers[i] = new Float32Array(this.bufferSize);
        }
        this.samplesCollected = 0;
      } else if (command === 'pause') {
        this.isRecording = false;
        // Flush partial buffer so peaks are up to date at pause point
        if (this.samplesCollected > 0) {
          this.flushBuffers();
        }
      } else if (command === 'resume') {
        this.isRecording = true;
      } else if (command === 'stop') {
        this.isRecording = false;

        // Always send a terminal message with done:true so the main thread
        // can await the partial-buffer flush before reading accumulated chunks.
        this.flushBuffers(true);

        // After the final flush the underlying buffers are detached. Drop
        // them and zero bufferSize so a stray resume can't write into
        // detached memory (writes would silently no-op in V8).
        this.buffers = [];
        this.bufferSize = 0;
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

  private flushBuffers(final = false): void {
    // Transfer underlying buffers (no slice / no structured-clone copy).
    // Detaches this.buffers[i]; non-final flushes reallocate replacements.
    const channels: Float32Array[] = [];
    const transfer: ArrayBuffer[] = [];
    for (let i = 0; i < this.channelCount; i++) {
      const buf = this.buffers[i];
      channels.push(buf.subarray(0, this.samplesCollected));
      // Float32Array.buffer is ArrayBufferLike (ArrayBuffer | SharedArrayBuffer)
      // in modern lib types. AudioWorklet inputs are always ArrayBuffer-backed.
      transfer.push(buf.buffer as ArrayBuffer);
    }

    const message: RecordingProcessorMessage = {
      channels,
      channelCount: this.channelCount,
    };
    if (final) message.done = true;

    this.port.postMessage(message, transfer);

    if (!final) {
      for (let i = 0; i < this.channelCount; i++) {
        this.buffers[i] = new Float32Array(this.bufferSize);
      }
    }
    this.samplesCollected = 0;
  }
}

// Register the processor
registerProcessor('recording-processor', RecordingProcessor);
