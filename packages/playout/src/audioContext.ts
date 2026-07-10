/**
 * Global AudioContext Manager
 *
 * Provides a single AudioContext shared across the entire application.
 * This context is used by Tone.js for playback and by all recording/monitoring hooks.
 *
 * Supports both native AudioContext (WAM 2.0 plugin hosting, requires
 * AudioListener AudioParams — Firefox fallback to standardized-audio-context)
 * and standardized-audio-context wrapper for cross-browser compatibility.
 */

import { Context, setContext } from 'tone';

let globalToneContext: Context | null = null;
let _nativeMode = false;

export interface AudioContextOptions {
  /**
   * Create the global context around a NATIVE AudioContext instead of
   * standardized-audio-context. Required for WAM 2.0 plugin hosting — WAM
   * worklets subclass the native AudioWorkletNode and cannot join a
   * standardized-audio-context graph. Falls back to the default context
   * (with a console warning) on browsers missing AudioListener AudioParams
   * (Firefox), where Tone.js Listener initialization would throw.
   */
  nativeAudioContext?: boolean;
  /** Desired sample rate. Creates a standardized-audio-context AudioContext
   *  at this rate, bypassing Tone.js 15.1.22's limitation. Cross-browser safe. */
  sampleRate?: number;
  /** Latency hint passed to the AudioContext constructor. */
  latencyHint?: AudioContextLatencyCategory | number;
}

/**
 * Whether this browser can run Tone.js on a raw native AudioContext.
 * Firefox lacks the AudioListener AudioParams (positionX/…/upZ) that Tone's
 * Listener wraps eagerly at context initialization (Tone.js #681) —
 * standardized-audio-context polyfills them, native contexts cannot.
 */
export function supportsNativeContextMode(): boolean {
  return (
    typeof AudioContext !== 'undefined' &&
    typeof AudioListener !== 'undefined' &&
    'positionX' in AudioListener.prototype
  );
}

/**
 * True when the global context wraps a native AudioContext (WAM-capable).
 */
export function isNativeGlobalContext(): boolean {
  return _nativeMode && globalToneContext !== null;
}

/** Test-only: clears the module singleton. Not exported from the package index. */
export function _resetGlobalContextForTests(): void {
  globalToneContext = null;
  _nativeMode = false;
}

/**
 * Configure the global AudioContext with sample rate and latency hints.
 * Supports both native AudioContext (for WAM 2.0 hosting) and standardized-audio-context.
 *
 * Should be called BEFORE getGlobalContext(). If the context already exists
 * (e.g., from resumeGlobalAudioContext), warns and returns the existing rate.
 *
 * ```ts
 * configureGlobalContext({ sampleRate: 48000, latencyHint: 0 })
 * configureGlobalContext({ nativeAudioContext: true, sampleRate: 48000 })
 * ```
 */
export function configureGlobalContext(options: AudioContextOptions): number {
  if (globalToneContext) {
    const existingRate = (globalToneContext.rawContext as AudioContext).sampleRate;
    if (options.nativeAudioContext && !_nativeMode) {
      console.warn(
        '[playout] configureGlobalContext: context already created — nativeAudioContext ' +
          'ignored. Call configureGlobalContext before any audio operations.'
      );
    }
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

  if (options.nativeAudioContext) {
    if (supportsNativeContextMode()) {
      const nativeCtx = new AudioContext({
        ...(options.sampleRate !== undefined ? { sampleRate: options.sampleRate } : {}),
        ...(options.latencyHint !== undefined ? { latencyHint: options.latencyHint } : {}),
      });
      // Tone's Context constructor accepts an existing context; its typing is
      // standardized-audio-context's, so cast through the constructor params.
      globalToneContext = new Context(
        nativeCtx as unknown as ConstructorParameters<typeof Context>[0]
      );
      setContext(globalToneContext);
      _nativeMode = true;
      return nativeCtx.sampleRate;
    }
    console.warn(
      '[playout] nativeAudioContext requested but this browser does not implement the ' +
        'AudioListener AudioParams Tone.js needs on a native context (Firefox). Falling back ' +
        'to the standardized-audio-context default — WAM plugin hosting is unavailable.'
    );
  }

  // Default (standardized-audio-context) path. latencyHint IS supported by
  // Tone's Context constructor (unlike sampleRate, which Tone 15.1.22 drops).
  // Tone's ContextOptions types it category-only, but runtime forwards numeric
  // seconds to the underlying AudioContext constructor unchanged — cast.
  globalToneContext =
    options.latencyHint !== undefined
      ? new Context({ latencyHint: options.latencyHint as AudioContextLatencyCategory })
      : new Context();
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
  if (!globalToneContext) return;
  // Skip close() when the raw context is already closed (a consumer can close
  // it directly via getGlobalAudioContext()), but ALWAYS reset the singleton —
  // otherwise every future getGlobalContext() returns the dead context forever.
  if (globalToneContext.rawContext.state !== 'closed') {
    await globalToneContext.close();
  }
  globalToneContext = null;
  _nativeMode = false;
}
