import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

/** Options for {@link resolveMediaElementPlayout}. */
export interface ResolveMediaElementPlayoutOptions {
  /** Consumer-supplied factory. When present, the default engine is never imported. */
  createPlayout?: () => MediaElementPlayout;
  /** Initial playback rate forwarded to the default engine. */
  playbackRate?: number;
  /** Whether to preserve pitch on rate change (default engine only). */
  preservesPitch?: boolean;
}

const INSTALL_HINT =
  '@waveform-playlist/media-element-playout is required for the default MediaElement engine. ' +
  'Install with: npm install @waveform-playlist/media-element-playout — or pass a custom `createPlayout`.';

/**
 * Resolve a MediaElement playout. With `createPlayout`, returns its result and
 * never imports the default engine. Otherwise dynamically imports
 * `@waveform-playlist/media-element-playout`, rethrowing a friendly install hint
 * (and console.warn-ing the original error) when the optional peer is absent.
 */
export async function resolveMediaElementPlayout(
  opts: ResolveMediaElementPlayoutOptions
): Promise<MediaElementPlayout> {
  if (opts.createPlayout) {
    return opts.createPlayout();
  }

  let mod: typeof import('@waveform-playlist/media-element-playout');
  try {
    mod = await import('@waveform-playlist/media-element-playout');
  } catch (originalErr) {
    console.warn(
      '[waveform-playlist] @waveform-playlist/media-element-playout dynamic import failed: ' +
        String(originalErr)
    );
    throw new Error(INSTALL_HINT);
  }

  return new mod.MediaElementPlayout({
    playbackRate: opts.playbackRate,
    preservesPitch: opts.preservesPitch,
  });
}
