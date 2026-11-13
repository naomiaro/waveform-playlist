/**
 * What a root of the view works out once and its parts read
 * (#685). Internal: not exported from the package.
 *
 * Two values, by what changes them. The extent changes with the timeline's
 * length and the zoom; the rows value changes with every clip edit (it holds
 * one `{ id, kind }` per track and their peaks, and the row heights follow from them). The timescale, the loop region and the
 * annotation row read the extent only, so a trim that leaves the length alone
 * does not render them.
 */
import { createContext, useContext } from 'react';
import type { RenderMode, TrackKind } from '@waveform-playlist/core';
import type { TrackClipPeaks } from '../WaveformPlaylistContext';
import type { TrackLayout } from '../utils/trackOrderPreview';
import type { SpectrogramTrackHelpers } from './TrackRows';

export interface WaveformExtentValue {
  /** Length of the drawn timeline in seconds (at least the audio's). */
  displayDuration: number;
  /** The same length in pixels at the current zoom. */
  tracksFullWidth: number;
}

/** What the view needs to know of a track to draw its row. */
export interface WaveformRow {
  id: string;
  kind: TrackKind;
}

export interface WaveformRowsValue {
  /**
   * One entry per row, in timeline order, and the peaks of each (same index),
   * as the root read them from its provider. The parts take them from here and
   * do not read a provider's track value themselves: the multitrack timeline
   * value also changes with things no part draws (`isReady`, the identity of
   * `onTracksChange`), and a part that read it would render for those too;
   * and no part then needs a hook only one provider serves.
   */
  rows: ReadonlyArray<WaveformRow>;
  peaksDataArray: TrackClipPeaks[];
  showClipHeaders: boolean;
  trackHeightById: ReadonlyMap<string, number>;
  trackLayout: TrackLayout;
  animateTrackLayout: boolean;
  /** Render mode per track id (spectrogram override, else the track's own). */
  renderModeById: ReadonlyMap<string, RenderMode>;
  spectrogramHelpersById: ReadonlyMap<string, SpectrogramTrackHelpers>;
  /** Stable: reads the tracks through a ref. */
  selectTrack: (trackIndex: number) => void;
  /** Opens the spectrogram settings of a track (the modal is the root's). */
  setSettingsModalTrackId: (id: string | null) => void;
  /** Channels of the take being recorded (already 1 when `mono`), else 0. */
  recordingChannelCount: number;
  /** The row being dragged to a new position, else null. */
  dragSourceTrackId: string | null;
}

/**
 * Where in the root a part is being rendered: the timescale strip, the
 * controls column, or the scrolling tracks area (the default: everything the
 * root does not recognise lands there). Read only for the development
 * warning of a part that ended up in the wrong place, which happens when it
 * is wrapped in another component: the root sorts its children by type.
 */
export type WaveformPartPlace = 'timescale' | 'controls' | 'tracks';
export const WaveformPartPlaceContext = createContext<WaveformPartPlace>('tracks');

export const WaveformExtentContext = createContext<WaveformExtentValue | null>(null);
export const WaveformRowsContext = createContext<WaveformRowsValue | null>(null);

function required<T>(value: T | null, part: string): T {
  if (value === null) {
    throw new Error(`${part} must be rendered inside the waveform root`);
  }
  return value;
}

export const useWaveformExtent = (part: string) =>
  required(useContext(WaveformExtentContext), part);
export const useWaveformRows = (part: string) => required(useContext(WaveformRowsContext), part);
