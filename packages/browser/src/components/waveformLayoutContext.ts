/**
 * What the root of the multitrack view works out once and its parts read
 * (#685). Internal: not exported from the package.
 *
 * Two values, by what changes them. The extent changes with the timeline's
 * length and the zoom; the row layout changes with every clip edit (the peaks
 * are part of the row heights). The timescale, the loop region and the
 * annotation row read the extent only, so a trim that leaves the length alone
 * does not render them.
 */
import { createContext, useContext } from 'react';
import type { RenderMode } from '@waveform-playlist/core';
import type { TrackLayout } from '../utils/trackOrderPreview';
import type { SpectrogramTrackHelpers } from './TrackRows';

export interface WaveformExtentValue {
  /** Length of the drawn timeline in seconds (at least the audio's). */
  displayDuration: number;
  /** The same length in pixels at the current zoom. */
  tracksFullWidth: number;
}

export interface WaveformRowsValue {
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
}

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
