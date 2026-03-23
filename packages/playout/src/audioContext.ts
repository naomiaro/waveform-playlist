/**
 * Global AudioContext Manager
 *
 * Provides a single AudioContext shared across the entire application.
 * This context is used by Tone.js for playback and by all recording/monitoring hooks.
 *
 * Uses Tone.js's Context class which wraps standardized-audio-context for
 * cross-browser compatibility (fixes Firefox AudioListener issues).
 */

import { Context, setContext } from 'tone';

let globalToneContext: Context | null = null;

export interface AudioContextOptions {
  /** Desired sample rate. When audioContext is provided, this is for comparison only.
   *  When audioContext is not provided, Tone.js 15.1.22 ignores this (unreleased fix
   *  in upstream). Pass your own AudioContext({ sampleRate }) for reliable control. */
  sampleRate?: number;
  /** Latency hint. Same caveat as sampleRate — pass your own AudioContext for control. */
  latencyHint?: AudioContextLatencyCategory | number;
  /** Pre-configured AudioContext. Use this for reliable sampleRate/latencyHint control:
   *  `new AudioContext({ sampleRate: 48000, latencyHint: 0 })` */
  audioContext?: AudioContext;
}

/**
 * Configure the global AudioContext.
 * Should be called BEFORE getGlobalContext(). If the context already exists
 * (e.g., from resumeGlobalAudioContext), warns and returns the existing rate.
 * Returns the actual sample rate.
 *
 * For reliable sample rate control, pass your own AudioContext:
 * ```ts
 * configureGlobalContext({ audioContext: new AudioContext({ sampleRate: 48000 }) })
 * ```
 */
export function configureGlobalContext(options: AudioContextOptions): number {
  if (globalToneContext) {
    const existingRate = (globalToneContext.rawContext as AudioContext).sampleRate;
    if (options.sampleRate !== undefined && options.sampleRate !== existingRate) {
      console.warn(
        '[playout] configureGlobalContext: context already created at ' +
          existingRate +
          ' Hz (requested ' +
          options.sampleRate +
          ' Hz). Call configureGlobalContext before any audio operations for sample rate control.'
      );
    }
    return existingRate;
  }
  if (options.audioContext) {
    // User-provided AudioContext — wrap in Tone.js Context
    globalToneContext = new Context(options.audioContext);
    setContext(globalToneContext);
    return options.audioContext.sampleRate;
  }
  // Fallback: create standard Tone.js Context (sampleRate/latencyHint not wired
  // through in Tone.js 15.1.22 — see playout CLAUDE.md)
  globalToneContext = new Context();
  setContext(globalToneContext);
  const actualRate = (globalToneContext.rawContext as AudioContext).sampleRate;
  if (options.sampleRate !== undefined && options.sampleRate !== actualRate) {
    console.warn(
      '[playout] Requested sampleRate ' +
        options.sampleRate +
        ' but AudioContext is running at ' +
        actualRate +
        ' — pre-computed peaks at ' +
        options.sampleRate +
        ' Hz will fall back to worker'
    );
  }
  return actualRate;
}

/**
 * Get the global Tone.js Context
 * This is the main context for cross-browser audio operations.
 * Use context.createAudioWorkletNode(), context.createMediaStreamSource(), etc.
 * @returns The Tone.js Context instance
 */
export function getGlobalContext(): Context {
  if (!globalToneContext) {
    globalToneContext = new Context();
    setContext(globalToneContext);
  }
  return globalToneContext;
}

/**
 * Get or create the global AudioContext
 * Uses Tone.js Context for cross-browser compatibility
 * @returns The global AudioContext instance (rawContext from Tone.Context)
 */
export function getGlobalAudioContext(): AudioContext {
  return getGlobalContext().rawContext as AudioContext;
}

/**
 * @deprecated Use getGlobalContext() instead
 * Get the Tone.js Context's rawContext typed as IAudioContext
 * @returns The rawContext cast as IAudioContext
 */
export function getGlobalToneContext(): Context {
  return getGlobalContext();
}

/**
 * Resume the global AudioContext if it's suspended
 * Should be called in response to a user gesture (e.g., button click)
 * @returns Promise that resolves when context is running
 */
export async function resumeGlobalAudioContext(): Promise<void> {
  const context = getGlobalContext();
  if (context.state !== 'running') {
    await context.resume();
  }
}

/**
 * Get the current state of the global AudioContext
 * @returns The AudioContext state ('suspended', 'running', or 'closed')
 */
export function getGlobalAudioContextState(): AudioContextState {
  return globalToneContext?.rawContext.state || 'suspended';
}

/**
 * Close the global AudioContext
 * Should only be called when the application is shutting down
 */
export async function closeGlobalAudioContext(): Promise<void> {
  if (globalToneContext && globalToneContext.rawContext.state !== 'closed') {
    await globalToneContext.close();
    globalToneContext = null;
  }
}
