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
  /** Desired sample rate. If hardware can't match, falls back to default. */
  sampleRate?: number;
  /** Latency hint: 'interactive', 'balanced', 'playback', or seconds (e.g., 0). */
  latencyHint?: AudioContextLatencyCategory | number;
}

/**
 * Configure the global AudioContext with sample rate and latency hints.
 * Must be called BEFORE getGlobalContext() — throws if context already exists.
 * Returns the actual sample rate (may differ from requested if hardware can't match).
 */
export function configureGlobalContext(options: AudioContextOptions): number {
  if (globalToneContext) {
    // Context already created (e.g., by resumeGlobalAudioContext before first track load).
    // Return the existing rate — the hint was too late but the context is usable.
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
  // Create a native AudioContext with the requested options — Tone.js's Context
  // constructor doesn't pass sampleRate through to standardized-audio-context.
  // Firefox has issues with the sampleRate option (despite MDN support docs),
  // so skip it on Firefox — same approach as openDAW.
  const isFirefox =
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('firefox');
  const nativeOptions: Record<string, unknown> = {};
  if (options.latencyHint !== undefined) {
    nativeOptions.latencyHint = options.latencyHint;
  }
  if (options.sampleRate !== undefined && !isFirefox) {
    nativeOptions.sampleRate = options.sampleRate;
  }
  if (isFirefox && options.sampleRate !== undefined) {
    console.warn(
      '[playout] Firefox does not reliably support AudioContext sampleRate option — using hardware default'
    );
  }
  let rawContext: AudioContext;
  try {
    rawContext = new AudioContext(nativeOptions as any);
  } catch {
    // Hardware doesn't support requested sampleRate — fall back to default
    console.warn(
      '[playout] Requested sampleRate ' +
        options.sampleRate +
        ' not supported — using hardware default'
    );
    const fallbackOptions: Record<string, unknown> = {};
    if (options.latencyHint !== undefined) {
      fallbackOptions.latencyHint = options.latencyHint;
    }
    rawContext = new AudioContext(fallbackOptions as any);
  }
  // Wrap in Tone.js Context for cross-browser compat (standardized-audio-context)
  globalToneContext = new Context(rawContext);
  setContext(globalToneContext);
  return rawContext.sampleRate;
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
