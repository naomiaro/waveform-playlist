/**
 * What `MediaElementPlaylistProvider` shares with the library's own
 * MediaElement components and nobody else (#769): the frame-callback
 * registry and the time selection. Not exported from the package. The public
 * names for these come with the shared playback interface (#688), so that a
 * consumer learns them once.
 */
import { createContext } from 'react';
import type { FrameCallback } from './useFrameCallbacks';
import { useRequiredContext } from './useRequiredContext';

/** Never changes after mount. */
export interface MediaElementInternalsValue {
  registerFrameCallback: (id: string, cb: FrameCallback) => void;
  unregisterFrameCallback: (id: string) => void;
  /**
   * Where to draw the playhead when no frame is running. The media element
   * reports the audible position, so this is `currentTimeRef` itself.
   */
  visualTimeRef: React.RefObject<number>;
  /** Stores the selection. It does not seek and playback does not use it. */
  setSelection: (start: number, end: number) => void;
}

/**
 * The selection. While a drag is in progress `selectionStart` is where the
 * press landed and `selectionEnd` where the pointer is, so start can be the
 * larger; a release stores them ordered. Changes on every pointer move of a
 * selection drag.
 */
export interface MediaElementSelectionValue {
  selectionStart: number;
  selectionEnd: number;
}

export const MediaElementInternalsContext = createContext<MediaElementInternalsValue | null>(null);
export const MediaElementSelectionContext = createContext<MediaElementSelectionValue | null>(null);

const PROVIDER = 'MediaElementPlaylistProvider';

export const useMediaElementInternals = () =>
  useRequiredContext(MediaElementInternalsContext, 'useMediaElementInternals', PROVIDER);

export const useMediaElementSelection = () =>
  useRequiredContext(MediaElementSelectionContext, 'useMediaElementSelection', PROVIDER);
