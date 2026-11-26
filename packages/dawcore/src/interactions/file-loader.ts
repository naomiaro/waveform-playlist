/**
 * File loading (#848): each dropped file enters the editor's arrangement as a
 * track with one loading clip whose source is the `File` itself (a File
 * cannot be an attribute, so a dropped track has no `<daw-track>` element).
 * The arrangement reads and decodes it. A file that cannot be loaded is
 * removed again without an undo step: it was never a declaration.
 */

import type { DawFilesLoadErrorDetail, LoadFilesResult } from '../events';

export interface FileLoaderHost {
  readonly isConnected: boolean;
  /** Add the file as a track; resolves with its id once it has entered. */
  _addDroppedFile(file: File): Promise<string>;
  /** Resolves when the track has loaded or the editor was disconnected; rejects when its audio failed. */
  _whenTrackLoaded(trackId: string): Promise<void>;
  /** Take a track out for good: no undo step, and no undo brings it back. */
  _discardTrack(trackId: string): void;
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
    // A disconnect ends the call: the file loading then is kept (it loads
    // after a reparent); the ones not started are not added (#917).
    if (!host.isConnected) {
      dispatchLoadError(file, new Error('<daw-editor> was disconnected'));
      continue;
    }
    // file.type can be '' for valid audio (.opus on some browsers) — only
    // reject explicitly non-audio MIME types.
    if (file.type && !file.type.startsWith('audio/')) {
      const error = new Error('Non-audio MIME type: ' + file.type);
      console.warn('[dawcore] Skipping non-audio file: ' + file.name + ' (' + file.type + ')');
      dispatchLoadError(file, error);
      continue;
    }
    let trackId: string | null = null;
    try {
      // Sequential on purpose: preserves drop order as track order.
      trackId = await host._addDroppedFile(file);
      await host._whenTrackLoaded(trackId);
      loaded.push(trackId);
    } catch (err) {
      console.warn('[dawcore] Failed to load file: ' + file.name + ' — ' + String(err));
      if (trackId !== null) host._discardTrack(trackId);
      dispatchLoadError(file, err);
    }
  }

  return { loaded, failed };
}
