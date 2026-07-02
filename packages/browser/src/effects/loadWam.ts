/**
 * Dynamic loader for the optional '@dawcore/wam' peer (the @dawcore/midi
 * loadMidiImpl pattern). Keeps WAM hosting out of the bundle for consumers
 * that never use it; `import type` from '@dawcore/wam' elsewhere is fine
 * (erased at runtime).
 */
export type WamModule = typeof import('@dawcore/wam');

export async function loadWamModule(): Promise<WamModule> {
  try {
    return await import('@dawcore/wam');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      "[waveform-playlist] WAM plugin support requires the optional '@dawcore/wam' package.\n" +
        'Install it with: npm install @dawcore/wam\n' +
        'Original error: ' +
        detail
    );
  }
}
