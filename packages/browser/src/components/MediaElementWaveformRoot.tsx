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
import type { TrackClipPeaks } from '../WaveformPlaylistContext';
import type { SpectrogramTrackHelpers } from './TrackRows';
import { getTrackChannelCount } from './visualizationLayout';
import type { WaveformRow, WaveformRowsValue } from './waveformLayoutContext';
import { useWaveformFrame, useWaveformParts } from './waveformFrame';
import { warnMisplacedPart } from './partWarnings';

// A MediaElement player has one audio track and nothing a row can be asked to
// do: module constants, so the rows value changes only with the peaks, the
// wave height and the clip-headers marker.
const ONE_ROW: ReadonlyArray<WaveformRow> = [{ id: MEDIA_ELEMENT_TRACK_ID, kind: 'audio' }];
// The peaks of a row with no clip: what is drawn when the provider has none.
const ONE_EMPTY_ROW: TrackClipPeaks[] = [[]];
const NO_RENDER_MODES: ReadonlyMap<string, RenderMode> = new Map();
const NO_SPECTROGRAM_HELPERS: ReadonlyMap<string, SpectrogramTrackHelpers> = new Map();
const nothing = () => {};

export interface MediaElementWaveformRootProps {
  className?: string;
  /** The parts, and anything else to draw over the track. */
  children?: ReactNode;
}

/**
 * The root of the MediaElement view (#685), exported from the package.
 *
 * The counterpart of `WaveformRoot` for `MediaElementPlaylistProvider`: it
 * works out what only this provider knows (the timeline is as long as the
 * audio; there is one row, empty when its peaks could not be extracted) and hands it to
 * the shared frame. The parts are the multitrack view's.
 *
 * It renders on what the frame follows (a drag in progress, play and stop, a
 * zoom, the view settings, the theme), when the track or its peaks change, when the
 * player becomes ready, and whenever the component that composes it renders.
 * The root's render never renders a part; a part renders when a value it
 * reads changes. See `WaveformRoot`.
 *
 * No controls column is drawn: there is no controls part for this provider.
 */
export const MediaElementWaveformRoot: React.FC<MediaElementWaveformRootProps> = ({
  className,
  children,
}) => {
  const { setSelection } = usePlaybackControls();
  const { duration, peaksDataArray } = useMediaElementTrack();
  const { waveHeight } = usePlaylistView();

  const parts = useWaveformParts(children);
  if (parts.controls) {
    warnMisplacedPart(
      '<WaveformTrackControls> draws nothing inside <MediaElementWaveformRoot>: a MediaElement ' +
        'player has one track and no mixer. Remove it.'
    );
  }
  const { showClipHeaders } = parts.tracksOptions;

  const rows = useMemo<WaveformRowsValue>(() => {
    // No peaks: they could not be extracted (the provider logged it). The row
    // is drawn all the same, one channel tall and with no clip in it, so the
    // timeline keeps its height and can be clicked.
    const rowList = ONE_ROW;
    const rowPeaks = peaksDataArray.length > 0 ? peaksDataArray : ONE_EMPTY_ROW;
    const trackHeightById = new Map<string, number>();
    rowList.forEach((row, index) => {
      const channels = getTrackChannelCount(rowPeaks[index], 0);
      trackHeightById.set(
        row.id,
        waveHeight * channels + (showClipHeaders ? CLIP_HEADER_HEIGHT : 0)
      );
    });
    return {
      rows: rowList,
      peaksDataArray: rowPeaks,
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
    // The waveform is drawn from the provider's first render: it does not
    // wait for the player (`useMediaElementTrack().isReady` is that).
    playlistState: 'ready',
    controlsWidth: 0,
    onClickWhileStopped: collapseSelectionAt,
  });

  return <DevicePixelRatioProvider>{frame}</DevicePixelRatioProvider>;
};
