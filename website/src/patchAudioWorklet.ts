/**
 * Patch global AudioWorkletNode and GainNode with standardized-audio-context versions.
 *
 * Tone.js uses standardized-audio-context (SAC) internally, so its AudioContext
 * is a SAC wrapper — not a native BaseAudioContext. Libraries like SoundTouchNode
 * that extend AudioWorkletNode fail because the native constructor rejects the
 * SAC context. Patching the globals with SAC versions fixes this.
 *
 * The PatchedAudioWorkletNode fixes a bug in SAC where .parameters returns a
 * ReadOnlyMap wrapper instead of the native AudioParamMap. The ._map property
 * holds the actual Map that AudioWorkletNode consumers expect.
 *
 * Snippet from the standardized-audio-context author.
 * This runs once via Docusaurus clientModules before any component code loads.
 */
if (typeof window !== 'undefined') {
  import('standardized-audio-context').then(({ AudioWorkletNode, GainNode }) => {
    class PatchedAudioWorkletNode extends AudioWorkletNode {
      get parameters() {
        return (super.parameters as any)._map;
      }
    }

    (window as any).AudioWorkletNode = PatchedAudioWorkletNode;
    (window as any).GainNode = GainNode;
  });
}
