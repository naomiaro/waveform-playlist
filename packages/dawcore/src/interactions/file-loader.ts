/**
 * File loading: routes dropped files through the same element pipeline as
 * editor.addTrack() — each file becomes a real `<daw-track><daw-clip>` in the
 * editor's light DOM, "as a fresh page load would have" (#612). The existing
 * daw-track-connected → _loadTrack pipeline does the fetch/decode.
 */

import type { DawTrackElement } from '../elements/daw-track';
import type { DawFilesLoadErrorDetail, LoadFilesResult } from '../events';
import type { TrackConfig } from '../types';

export interface FileLoaderHost {
  readonly isConnected: boolean;
  _audioCache: Map<string, Promise<AudioBuffer>>;
  addTrack(config: TrackConfig): Promise<DawTrackElement>;
  dispatchEvent(event: Event): boolean;
}

export async function loadFiles(
  host: FileLoaderHost,
  files: FileList | File[]
): Promise<LoadFilesResult> {
  if (!files) {
    console.warn('[dawcore] loadFiles called with null/undefined');
    return { loaded: [], failed: [] };
  }

  const fileArray = Array.from(files);
  const loaded: string[] = [];
  const failed: Array<{ file: File; error: unknown }> = [];

  const dispatchLoadError = (file: File, error: unknown) => {
    failed.push({ file, error });
    if (host.isConnected) {
      host.dispatchEvent(
        new CustomEvent<DawFilesLoadErrorDetail>('daw-files-load-error', {
          bubbles: true,
          composed: true,
          detail: { file, error },
        })
      );
    }
  };

  for (const file of fileArray) {
    // file.type can be '' for valid audio (.opus on some browsers) — only
    // reject explicitly non-audio MIME types.
    if (file.type && !file.type.startsWith('audio/')) {
      const error = new Error('Non-audio MIME type: ' + file.type);
      console.warn('[dawcore] Skipping non-audio file: ' + file.name + ' (' + file.type + ')');
      dispatchLoadError(file, error);
      continue;
    }

    const blobUrl = URL.createObjectURL(file);
    const name = file.name.replace(/\.\w+$/, '');
    try {
      // Sequential on purpose: preserves drop order as DOM/track order.
      const trackEl = await host.addTrack({ name, clips: [{ src: blobUrl, name }] });
      loaded.push(trackEl.trackId);
      // daw-track-ready was dispatched by the load pipeline — don't re-dispatch.
    } catch (err) {
      console.warn('[dawcore] Failed to load file: ' + file.name + ' — ' + String(err));
      dispatchLoadError(file, err);
    } finally {
      // The decode is complete either way; the blob URL and its cache entry
      // (keyed by a URL that will never be fetched again) are dead weight.
      URL.revokeObjectURL(blobUrl);
      host._audioCache.delete(blobUrl);
    }
  }

  return { loaded, failed };
}
