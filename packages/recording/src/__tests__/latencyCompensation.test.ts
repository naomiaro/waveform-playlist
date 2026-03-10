import { describe, it, expect } from 'vitest';

/**
 * Latency compensation logic extracted from useIntegratedRecording.stopRecording.
 *
 * Two sources of delay between worklet capture and audible playback:
 * 1. Tone.js lookAhead (~100ms) — Transport schedules audio ahead of real time
 * 2. outputLatency — hardware DAC delay before audio reaches speakers
 *
 * The clip's offsetSamples skips this combined latency period, and
 * durationSamples is reduced by the same amount.
 */

interface LatencyCompensationInput {
  bufferLength: number;
  sampleRate: number;
  outputLatency: number;
  lookAhead: number;
  recordingStartTime: number;
  lastClipEndSample: number;
}

interface LatencyCompensationResult {
  startSample: number;
  offsetSamples: number;
  durationSamples: number;
  discarded: boolean;
}

/**
 * Pure function mirroring the latency compensation logic from
 * useIntegratedRecording.stopRecording (lines 188-208)
 */
function computeLatencyCompensation(input: LatencyCompensationInput): LatencyCompensationResult {
  const {
    bufferLength,
    sampleRate,
    outputLatency,
    lookAhead,
    recordingStartTime,
    lastClipEndSample,
  } = input;

  const recordStartTimeSamples = Math.floor(recordingStartTime * sampleRate);
  const startSample = Math.max(recordStartTimeSamples, lastClipEndSample);

  const totalLatency = outputLatency + lookAhead;
  const latencyOffsetSamples = Math.floor(totalLatency * sampleRate);
  const effectiveDuration = Math.max(0, bufferLength - latencyOffsetSamples);

  return {
    startSample,
    offsetSamples: latencyOffsetSamples,
    durationSamples: effectiveDuration,
    discarded: effectiveDuration === 0,
  };
}

describe('latency compensation', () => {
  const defaultInput: LatencyCompensationInput = {
    bufferLength: 44100, // 1 second
    sampleRate: 44100,
    outputLatency: 0.01, // 10ms
    lookAhead: 0.1, // 100ms (Tone.js default)
    recordingStartTime: 0,
    lastClipEndSample: 0,
  };

  it('computes correct offset for typical latency values', () => {
    const result = computeLatencyCompensation(defaultInput);

    // totalLatency = 0.01 + 0.1 = 0.11s → floor(0.11 * 44100) = 4851 samples
    expect(result.offsetSamples).toBe(4851);
    expect(result.durationSamples).toBe(44100 - 4851);
    expect(result.discarded).toBe(false);
  });

  it('discards recording shorter than latency compensation', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      bufferLength: 100, // very short: 100 samples < 4851 offset
    });

    expect(result.durationSamples).toBe(0);
    expect(result.discarded).toBe(true);
  });

  it('handles zero latency', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      outputLatency: 0,
      lookAhead: 0,
    });

    expect(result.offsetSamples).toBe(0);
    expect(result.durationSamples).toBe(44100);
    expect(result.discarded).toBe(false);
  });

  it('handles only outputLatency (no lookAhead)', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      outputLatency: 0.02, // 20ms
      lookAhead: 0,
    });

    // floor(0.02 * 44100) = 882
    expect(result.offsetSamples).toBe(882);
    expect(result.durationSamples).toBe(44100 - 882);
  });

  it('handles only lookAhead (no outputLatency)', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      outputLatency: 0,
      lookAhead: 0.1,
    });

    // floor(0.1 * 44100) = 4410
    expect(result.offsetSamples).toBe(4410);
    expect(result.durationSamples).toBe(44100 - 4410);
  });

  it('uses recordingStartTime for clip placement', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      recordingStartTime: 2.5, // Start recording at 2.5s
    });

    // floor(2.5 * 44100) = 110250
    expect(result.startSample).toBe(110250);
  });

  it('clip starts after last clip end when recording starts earlier', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      recordingStartTime: 1.0,
      lastClipEndSample: 88200, // 2s in, later than recordingStartTime
    });

    // max(44100, 88200) = 88200
    expect(result.startSample).toBe(88200);
  });

  it('clip starts at recording time when past last clip', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      recordingStartTime: 3.0,
      lastClipEndSample: 44100, // 1s in, before recordingStartTime
    });

    // max(132300, 44100) = 132300
    expect(result.startSample).toBe(132300);
  });

  it('handles 48kHz sample rate', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      sampleRate: 48000,
      bufferLength: 48000,
    });

    // floor(0.11 * 48000) = 5280
    expect(result.offsetSamples).toBe(5280);
    expect(result.durationSamples).toBe(48000 - 5280);
  });

  it('buffer exactly equal to latency offset is discarded', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      bufferLength: 4851, // exactly the latency offset
    });

    expect(result.durationSamples).toBe(0);
    expect(result.discarded).toBe(true);
  });

  it('buffer one sample longer than latency offset is kept', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      bufferLength: 4852, // one sample more than latency offset
    });

    expect(result.durationSamples).toBe(1);
    expect(result.discarded).toBe(false);
  });

  it('large outputLatency does not produce negative duration', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      outputLatency: 1.0, // unrealistically large: 1s
      lookAhead: 0.1,
      bufferLength: 44100, // 1 second buffer
    });

    // totalLatency = 1.1s, offset = floor(1.1 * 44100) = 48510 > 44100
    expect(result.durationSamples).toBe(0);
    expect(result.offsetSamples).toBe(48510);
    expect(result.discarded).toBe(true);
  });
});
