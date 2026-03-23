/**
 * Shared AudioContext for all example components.
 * Created at 48000 Hz to match pre-computed .dat peaks.
 * Singleton — persists across Docusaurus SPA navigation.
 */
let sharedContext: AudioContext | undefined;

export function getExampleAudioContext(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  if (!sharedContext) {
    sharedContext = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
  }
  return sharedContext;
}
