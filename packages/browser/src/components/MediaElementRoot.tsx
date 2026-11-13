import React, { useCallback, useMemo, type ReactNode } from 'react';
import { DevicePixelRatioProvider, CLIP_HEADER_HEIGHT } from '@waveform-playlist/ui-components';
import type { RenderMode } from '@waveform-playlist/core';
import {
  MEDIA_ELEMENT_TRACK_ID,
  useMediaElementTrack,
  usePlaybackControls,
  usePlaylistView,
} from '../contexts/playlistContexts';
import { computeTrackLayout } from '../utils/trackOrderPreview';
import type { SpectrogramTrackHelpers } from './TrackRows';
import { getTrackChannelCount } from './visualizationLayout';
import type { WaveformRow, WaveformRowsValue } from './waveformLayoutContext';
import { useWaveformFrame, useWaveformParts } from './waveformFrame';

// A MediaElement player has one audio track and nothing a row can be asked to
// do: module constants, so the rows value changes only with the peaks.
const ONE_ROW: ReadonlyArray<WaveformRow> = [{ id: MEDIA_ELEMENT_TRACK_ID, kind: 'audio' }];
const NO_ROWS: ReadonlyArray<WaveformRow> = [];
const NO_RENDER_MODES: ReadonlyMap<string, RenderMode> = new Map();
const NO_SPECTROGRAM_HELPERS: ReadonlyMap<string, SpectrogramTrackHelpers> = new Map();
const nothing = () => {};

export interface MediaElementRootProps {
  className?: string;
  /** The parts, and anything else to draw over the track. */
  children?: ReactNode;
}

/**
 * The root of the MediaElement view (#685). Internal for now.
 *
 * The counterpart of `WaveformRoot` for `MediaElementPlaylistProvider`: it
 * works out what only this provider knows (the timeline is as long as the
 * audio; there is one row, when its peaks could be extracted) and hands it to
 * the shared frame. The parts are the multitrack view's.
 *
 * It renders on what the frame follows (a drag in progress, play and stop, the
 * view settings, the theme), when the track or its peaks change, when the
 * player becomes ready, and whenever the component that composes it renders.
 * None of that renders a part by itself; see `WaveformRoot`.
 *
 * No controls column is drawn: there is no controls part for this provider.
 */
export const MediaElementRoot: React.FC<MediaElementRootProps> = ({ className, children }) => {
  const { setSelection } = usePlaybackControls();
  const { duration, peaksDataArray, isReady } = useMediaElementTrack();
  const { waveHeight } = usePlaylistView();

  const parts = useWaveformParts(children);
  const { showClipHeaders } = parts.tracksOptions;

  const rows = useMemo<WaveformRowsValue>(() => {
    // No peaks: they could not be extracted (the provider logged it). The
    // timeline is drawn without a row.
    const rowList = peaksDataArray.length > 0 ? ONE_ROW : NO_ROWS;
    const trackHeightById = new Map<string, number>();
    rowList.forEach((row, index) => {
      const channels = getTrackChannelCount(peaksDataArray[index], 0);
      trackHeightById.set(
        row.id,
        waveHeight * channels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0)
      );
    });
    return {
      rows: rowList,
      peaksDataArray,
      showClipHeaders,
      trackHeightById,
      trackLayout: computeTrackLayout(
        rowList.map((row) => row.id),
        trackHeightById
      ),
      animateTrackLayout: false,
      renderModeById: NO_RENDER_MODES,
      spectrogramHelpersById: NO_SPECTROGRAM_HELPERS,
      selectTrack: nothing,
      setSettingsModalTrackId: nothing,
      recordingChannelCount: 0,
      dragSourceTrackId: null,
    };
  }, [peaksDataArray, waveHeight, showClipHeaders]);

  // A click while stopped collapses the selection at its time, which moves
  // the cursor.
  const collapseSelectionAt = useCallback(
    (time: number) => setSelection(time, time),
    [setSelection]
  );

  const frame = useWaveformFrame({
    className,
    parts,
    displayDuration: duration,
    rows,
    playlistState: isReady ? 'ready' : 'loading',
    controlsWidth: 0,
    onClickWhileStopped: collapseSelectionAt,
  });

  return <DevicePixelRatioProvider>{frame}</DevicePixelRatioProvider>;
};
