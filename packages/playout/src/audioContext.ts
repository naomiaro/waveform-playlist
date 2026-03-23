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
  // TODO: Tone.js Context doesn't pass sampleRate to standardized-audio-context.
  // Native AudioContext({ sampleRate }) works but causes issues with Tone.js internals.
  // For now, create a standard Context and let the rate comparison + worker fallback
  // handle mismatches. Revisit when Tone.js supports sampleRate passthrough.
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
