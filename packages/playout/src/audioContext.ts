/**
 * Global AudioContext Manager
 *
 * Provides a single AudioContext shared across the entire application.
 * This context is used by Tone.js for playback and by all recording/monitoring hooks.
 */

let globalAudioContext: AudioContext | null = null;

/**
 * Get or create the global AudioContext
 * @returns The global AudioContext instance
 */
export function getGlobalAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}

/**
 * Resume the global AudioContext if it's suspended
 * Should be called in response to a user gesture (e.g., button click)
 * @returns Promise that resolves when context is running
 */
export async function resumeGlobalAudioContext(): Promise<void> {
  const context = getGlobalAudioContext();
  if (context.state !== 'running') {
    await context.resume();
  }
}

/**
 * Get the current state of the global AudioContext
 * @returns The AudioContext state ('suspended', 'running', or 'closed')
 */
export function getGlobalAudioContextState(): AudioContextState {
  return globalAudioContext?.state || 'suspended';
}

/**
 * Close the global AudioContext
 * Should only be called when the application is shutting down
 */
export async function closeGlobalAudioContext(): Promise<void> {
  if (globalAudioContext && globalAudioContext.state !== 'closed') {
    await globalAudioContext.close();
    globalAudioContext = null;
  }
}
