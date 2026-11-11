import styled from 'styled-components';
import type { ClipPeaks } from '../WaveformPlaylistContext';

/** Live recording state for the real-time waveform preview. */
export interface VisualizationRecordingState {
  isRecording: boolean;
  trackId: string;
  startSample: number;
  durationSamples: number;
  peaks: (Int8Array | Int16Array)[];
  bits: 8 | 16;
  /**
   * Latency offset (seconds) to skip in the live preview. Absolute replacement
   * for the auto-computed outputLatency + lookAhead value. Pass the same value
   * given to useIntegratedRecording so preview and finalized clip match.
   */
  latencyOffset?: number;
}

interface PositionedRowProps {
  readonly $top: number;
  readonly $animate: boolean;
}

/**
 * Shared relative container for absolutely-positioned track rows. Explicit
 * height because absolute children don't size their parent.
 */
export const TracksLayout = styled.div.attrs<{ $height: number }>((props) => ({
  style: { height: `${props.$height}px` },
}))<{ $height: number }>`
  position: relative;
`;

/**
 * Positions one waveform track row from the shared layout map. Positioned
 * via `top`, NOT `translateY` — a transform (even translateY(0)) creates a
 * stacking context on every row, which flattens the clips' z-index: 105
 * beneath the ClickOverlay (z-index: 1) and blocks all clip interactions
 * (header drag, boundary trim, split). `top` moves the row without a
 * stacking context, so clip z-indexes keep competing globally as before.
 * Transition only while a track drag is active (+trailing window) so
 * unrelated layout changes stay instant.
 */
export const TrackRowPositioner = styled.div.attrs<PositionedRowProps>((props) => ({
  style: { top: `${props.$top}px` },
}))<PositionedRowProps>`
  position: absolute;
  left: 0;
  right: 0;
  ${(props) => props.$animate && 'transition: top 150ms ease;'}
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

interface ControlSlotProps {
  readonly $height: number;
  readonly $top: number;
  readonly $animate: boolean;
  readonly $isSelected?: boolean;
}

/**
 * Height-synced container for each track's controls in the ControlsColumn.
 * Uses the same height formula as Track: waveHeight * numChannels + clipHeaderHeight.
 */
export const ControlSlot = styled.div.attrs<ControlSlotProps>((props) => ({
  style: {
    height: `${props.$height}px`,
    top: `${props.$top}px`,
  },
}))<ControlSlotProps>`
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;
  ${(props) => props.$animate && 'transition: top 150ms ease, background 0.15s ease-in-out;'}
  @media (prefers-reduced-motion: reduce) {
    transition: background 0.15s ease-in-out;
  }
  ${(props) => props.$isSelected && `background: ${props.theme.selectedTrackControlsBackground};`}
`;

/**
 * The maximum channel count for a track, considering both clip peaks and a
 * live recording. `recordingChannels` is the channel count of the recording
 * into THIS track, 0 when it is not being recorded into. It is a number, not
 * the recording state object, so that track heights do not change identity on
 * every recording frame.
 */
export function getTrackChannelCount(
  trackClipPeaks: ClipPeaks[],
  recordingChannels: number
): number {
  const clipChannels =
    trackClipPeaks.length > 0
      ? Math.max(1, ...trackClipPeaks.map((clip) => clip.peaks.data.length))
      : 1;
  return Math.max(clipChannels, recordingChannels);
}
