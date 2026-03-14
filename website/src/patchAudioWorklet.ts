/**
 * Patch global AudioWorkletNode and GainNode with standardized-audio-context versions.
 *
 * Tone.js uses standardized-audio-context (SAC) internally, so its AudioContext
 * is a SAC wrapper — not a native BaseAudioContext. Libraries like SoundTouchNode
 * that extend AudioWorkletNode fail because the native constructor rejects the
 * SAC context. Patching the globals with SAC versions fixes this:
 *
 * - SoundTouchNode's `super(context, ...)` uses SAC's AudioWorkletNode (accepts SAC contexts)
 * - `.parameters.get('tempo')` works via SAC's ReadOnlyMap
 * - `.connect()` works between SAC-wrapped nodes
 *
 * This runs once via Docusaurus clientModules before any component code loads.
 */
import {
  AudioWorkletNode as SACWorkletNode,
  GainNode as SACGainNode,
} from 'standardized-audio-context';

if (typeof window !== 'undefined') {
  (window as any).AudioWorkletNode = SACWorkletNode;
  (window as any).GainNode = SACGainNode;
}
