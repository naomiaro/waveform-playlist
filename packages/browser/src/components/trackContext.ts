/**
 * The per-track context of the track controls (#687).
 *
 * `<WaveformTrackControls>` renders its children once per track; around each
 * copy it provides that track's value, which `useTrack()` reads. A value
 * changes only when something about ITS track changes, so a volume step on one
 * track renders the pieces of that track and of no other.
 *
 * This file imports no provider and no engine.
 */
import { createContext, useContext, type RefObject } from 'react';
import type { RenderMode, TrackKind } from '@waveform-playlist/core';
import type { TrackMenuItem } from '@waveform-playlist/ui-components';

/** What `useTrack()` returns: one track's identity, mixer state and bound actions. */
export interface TrackContextValue {
  /** The track's id. */
  id: string;
  /** `'audio'` or `'midi'`. */
  kind: TrackKind;
  /** The track's position in the list of tracks, from 0. Changes on a reorder. */
  index: number;

  /** The track's name, or "Track N" (N is the position, from 1) when it has none. */
  name: string;
  muted: boolean;
  soloed: boolean;
  /** 0 to 1. */
  volume: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** How the track is drawn. Always `'waveform'` for a MIDI track. */
  renderMode: RenderMode;

  /**
   * True while the provider has no mixer state for the track (it is still
   * loading): the engine does not know it yet, so the mixer actions and a
   * reorder would have no effect. The built-in pieces are disabled then.
   */
  isLoading: boolean;
  /** Whether this is the selected track. */
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  /**
   * True for an audio track under a `<SpectrogramProvider>`: `setRenderMode`
   * and `openSpectrogramSettings` then do something.
   */
  hasSpectrogram: boolean;

  // Actions. Each keeps its identity for as long as the track's slot is mounted.
  setMuted: (muted: boolean) => void;
  setSoloed: (soloed: boolean) => void;
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;
  /** Makes this the selected track. */
  select: () => void;
  /** Moves the track one position up. Nothing happens for the first track. */
  moveUp: () => void;
  /** Moves the track one position down. Nothing happens for the last track. */
  moveDown: () => void;
  /** Nothing happens without a `<SpectrogramProvider>`. */
  setRenderMode: (mode: RenderMode) => void;
  /** Opens the spectrogram settings of this track. Nothing happens without a `<SpectrogramProvider>`. */
  openSpectrogramSettings: () => void;
}

export const TrackContext = createContext<TrackContextValue | null>(null);

/**
 * The track whose control panel the calling component is part of. For the
 * children of `<WaveformTrackControls>`, which renders them once per track.
 */
export function useTrack(): TrackContextValue {
  const value = useContext(TrackContext);
  if (value === null) {
    throw new Error(
      'useTrack must be used within <WaveformTrackControls>: it reads the track whose control ' +
        'panel is being drawn, so the component that calls it (a built-in piece such as ' +
        '<TrackMuteButton />, or your own) must be among the children of ' +
        '<WaveformTrackControls>. Elsewhere, use usePlaylistMixer() and the setters of ' +
        'useEditorControls(), which take a track id.'
    );
  }
  return value;
}

/** What the items of a track menu are built from (the spectrogram integration's). */
export interface TrackMenuItemsArgs {
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  onOpenSettings: () => void;
  onClose?: () => void;
}

/**
 * Internal: what the controls part hands every slot and piece. The functions
 * read the spectrogram integration through a ref, so the value changes only
 * when a menu becomes available or stops being so.
 */
export interface TrackControlsShared {
  /** Whether the spectrogram integration offers menu items. */
  menuAvailable: boolean;
  menuItems: (args: TrackMenuItemsArgs) => TrackMenuItem[];
  setTrackRenderMode: (trackId: string, mode: RenderMode) => void;
  openSpectrogramSettings: (trackId: string) => void;
}

export const TrackControlsSharedContext = createContext<TrackControlsShared | null>(null);

/**
 * Internal: the wiring between a slot and the reorder handle inside it. The
 * slot's element is the item that is dragged; the handle says when it is.
 * Stable for the life of the slot.
 */
export interface TrackSlotWiring {
  elementRef: RefObject<HTMLDivElement | null>;
  setDragSource: (isDragSource: boolean) => void;
}

export const TrackSlotWiringContext = createContext<TrackSlotWiring | null>(null);
