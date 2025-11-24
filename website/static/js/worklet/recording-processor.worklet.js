"use strict";

// src/worklet/recording-processor.worklet.ts
var RecordingProcessor = class extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 0;
    this.buffers = [];
    this.samplesCollected = 0;
    this.isRecording = false;
    this.channelCount = 1;
    this.port.onmessage = (event) => {
      const { command, sampleRate: sampleRate2, channelCount } = event.data;
      if (command === "start") {
        this.isRecording = true;
        this.channelCount = channelCount || 1;
        this.bufferSize = Math.floor((sampleRate2 || 48e3) * 0.016);
        this.buffers = [];
        for (let i = 0; i < this.channelCount; i++) {
          this.buffers[i] = new Float32Array(this.bufferSize);
        }
        this.samplesCollected = 0;
      } else if (command === "stop") {
        this.isRecording = false;
        if (this.samplesCollected > 0) {
          this.flushBuffers();
        }
      }
    };
  }
  process(inputs, outputs, parameters) {
    if (!this.isRecording) {
      return true;
    }
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const frameCount = input[0].length;
    for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
      const inputChannel = input[channel];
      const buffer = this.buffers[channel];
      for (let i = 0; i < frameCount; i++) {
        buffer[this.samplesCollected + i] = inputChannel[i];
      }
    }
    this.samplesCollected += frameCount;
    if (this.samplesCollected >= this.bufferSize) {
      this.flushBuffers();
    }
    return true;
  }
  flushBuffers() {
    const samples = this.buffers[0].slice(0, this.samplesCollected);
    this.port.postMessage({
      samples,
      sampleRate,
      channelCount: this.channelCount
    });
    this.samplesCollected = 0;
  }
};
registerProcessor("recording-processor", RecordingProcessor);
//# sourceMappingURL=recording-processor.worklet.js.map