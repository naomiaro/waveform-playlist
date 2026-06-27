import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { EffectsFunction, SoundFontCache } from '@waveform-playlist/playout';

/** Options for {@link resolvePlayoutAdapter}. */
export interface ResolvePlayoutAdapterOptions {
  /** Consumer-supplied factory. When present, the default engine is never imported. */
  createAdapter?: () => PlayoutAdapter;
  /** Master effects function — forwarded to the default Tone.js adapter only. */
  effects?: EffectsFunction;
  /** SoundFont cache — forwarded to the default Tone.js adapter only. */
  soundFontCache?: SoundFontCache;
  /** Desired AudioContext sample rate — configures the global Tone context (default path only). */
  sampleRate?: number;
}

const INSTALL_HINT =
  '@waveform-playlist/playout (and its peer `tone`) is required for the default WebAudio engine. ' +
  'Install with: npm install @waveform-playlist/playout tone — or pass a custom `createAdapter`.';

/**
 * Resolve a {@link PlayoutAdapter}. With `createAdapter`, returns its result and
 * never touches the default engine — so consumers with a custom adapter install
 * neither `@waveform-playlist/playout` nor `tone`. Otherwise dynamically imports
 * the Tone.js engine, rethrowing a friendly install hint (and console.warn-ing the
 * original error) when the optional peer is absent.
 */
export async function resolvePlayoutAdapter(
  opts: ResolvePlayoutAdapterOptions
): Promise<PlayoutAdapter> {
  if (opts.createAdapter) {
    return opts.createAdapter();
  }

  let mod: typeof import('@waveform-playlist/playout');
  try {
    mod = await import('@waveform-playlist/playout');
  } catch (originalErr) {
    console.warn(
      '[waveform-playlist] @waveform-playlist/playout dynamic import failed: ' + String(originalErr)
    );
    throw new Error(INSTALL_HINT);
  }

  if (opts.sampleRate !== undefined) {
    // Non-fatal: a failed context configuration falls back to the default rate
    // (restores pre-#510 behavior — it was caught in the old mount-time initializer).
    try {
      mod.configureGlobalContext({ sampleRate: opts.sampleRate });
    } catch (ctxErr) {
      console.warn(
        '[waveform-playlist] configureGlobalContext failed (continuing with default rate): ' +
          String(ctxErr)
      );
    }
  }
  return mod.createToneAdapter({ effects: opts.effects, soundFontCache: opts.soundFontCache });
}
