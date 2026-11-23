import siteConfig from '@generated/docusaurus.config';

/**
 * A path below the site's base URL, for anything the page fetches or links to
 * by hand (audio, peaks, worklet modules, plain `<a href>`).
 *
 * The site is built twice: the stable docs at `/waveform-playlist/` and the
 * current work at `/waveform-playlist/next/`. A path written out with the base
 * in it makes the second build load the first one's files.
 *
 * `sitePath('/media/audio/sonnet.mp3')` → `/waveform-playlist/media/audio/sonnet.mp3`
 */
export function sitePath(path: string): string {
  return `${siteConfig.baseUrl}${path.replace(/^\/+/, '')}`;
}
