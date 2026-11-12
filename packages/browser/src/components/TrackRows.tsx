import React, { useCallback, useSyncExternalStore } from 'react';
import {
  Track as TrackComponent,
  Clip,
  SpectrogramLabels,
  useTheme,
  waveformColorToCss,
  type WaveformPlaylistTheme,
} from '@waveform-playlist/ui-components';
import {
  resolveRecordingOffsetSamples,
  trackKind,
  type ClipTrack,
  type Peaks,
  type RenderMode,
  type TrackKind,
  type SpectrogramConfig,
} from '@waveform-playlist/core';
import {
  usePlaybackAnimation,
  type ClipPeaks,
  type TrackClipPeaks,
} from '../WaveformPlaylistContext';
import type { SpectrogramIntegration } from '../SpectrogramIntegrationContext';
import type { TrackLayout } from '../utils/trackOrderPreview';
import { useClipInteraction } from '../contexts/ClipInteractionContext';
import { ChannelWithProgress } from './ChannelWithProgress';
import {
  TrackRowPositioner,
  TracksLayout,
  getTrackChannelCount,
  type VisualizationRecordingState,
} from './visualizationLayout';

type FrequencyScaleFn = (f: number, minF: number, maxF: number) => number;

/** Options that are the same for every clip of the playlist. */
interface ClipDisplayOptions {
  samplesPerPixel: number;
  sampleRate: number;
  showClipHeaders: boolean;
  gainScaledWaveforms: boolean;
  interactiveClips: boolean;
  showFades: boolean;
  touchOptimized: boolean;
  selectTrack: (trackIndex: number) => void;
  registerSpectrogramCanvas: SpectrogramIntegration['registerSpectrogramCanvas'] | undefined;
  unregisterSpectrogramCanvas: SpectrogramIntegration['unregisterSpectrogramCanvas'] | undefined;
}

interface ClipViewProps extends ClipDisplayOptions {
  clip: ClipPeaks;
  trackId: string;
  trackIndex: number;
  clipIndex: number;
  isSelected: boolean;
  renderMode: RenderMode;
}

/**
 * One clip with its channels.
 *
 * Memoized (#693): `clip` keeps its identity while nothing about the clip
 * changed (see utils/derivePeaks.ts) and everything else is a primitive or a
 * stable callback, so an edit to one clip re-renders that clip only. Each
 * `Clip` runs three `useDraggable` hooks, which is what made re-rendering all
 * of them per pointer move expensive.
 */
const ClipView = React.memo(function ClipView({
  clip,
  trackId,
  trackIndex,
  clipIndex,
  isSelected,
  renderMode,
  samplesPerPixel,
  sampleRate,
  showClipHeaders,
  gainScaledWaveforms,
  interactiveClips: interactiveClipsProp,
  showFades,
  touchOptimized: touchOptimizedProp,
  selectTrack,
  registerSpectrogramCanvas,
  unregisterSpectrogramCanvas,
}: ClipViewProps) {
  // A `ClipInteractionProvider` above turns both on by itself (#690). The
  // props are for a consumer with their own DragDropProvider, who has no
  // provider of ours to say it.
  const clipInteraction = useClipInteraction();
  const interactiveClips = interactiveClipsProp || clipInteraction.enabled;
  const touchOptimized = touchOptimizedProp || clipInteraction.touchOptimized;
  const peaksData = clip.peaks;
  const width = peaksData.length;

  // Pressing a clip selects its track, except when the press starts a drag.
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="button"][aria-roledescription="draggable"]')) {
        return;
      }
      selectTrack(trackIndex);
    },
    [selectTrack, trackIndex]
  );

  return (
    <Clip
      clipId={clip.clipId}
      trackIndex={trackIndex}
      clipIndex={clipIndex}
      trackName={clip.trackName}
      startSample={clip.startSample}
      durationSamples={clip.durationSamples}
      samplesPerPixel={samplesPerPixel}
      showHeader={showClipHeaders}
      disableHeaderDrag={!interactiveClips}
      isSelected={isSelected}
      trackId={trackId}
      fadeIn={clip.fadeIn}
      fadeOut={clip.fadeOut}
      sampleRate={sampleRate}
      showFades={showFades}
      touchOptimized={touchOptimized}
      onMouseDown={handleMouseDown}
    >
      {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => (
        <ChannelWithProgress
          key={`${clip.clipId}-${channelIndex}`}
          index={channelIndex}
          data={channelPeaks}
          bits={peaksData.bits}
          length={width}
          isSelected={isSelected}
          gain={gainScaledWaveforms ? (clip.gain ?? 1) : 1}
          clipStartSample={clip.startSample}
          clipDurationSamples={clip.durationSamples}
          renderMode={renderMode}
          midiNotes={clip.midiNotes}
          clipSampleRate={clip.sampleRate}
          clipOffsetSeconds={
            clip.offsetSamples != null ? clip.offsetSamples / (clip.sampleRate || sampleRate) : 0
          }
          samplesPerPixel={samplesPerPixel}
          spectrogramClipId={clip.clipId}
          spectrogramOnCanvasRegister={registerSpectrogramCanvas}
          spectrogramOnCanvasUnregister={unregisterSpectrogramCanvas}
        />
      ))}
    </Clip>
  );
});

interface RecordingPreviewClipProps {
  recordingState: VisualizationRecordingState;
  trackId: string;
  trackIndex: number;
  clipIndex: number;
  isSelected: boolean;
  samplesPerPixel: number;
  sampleRate: number;
  showClipHeaders: boolean;
  mono: boolean;
}

/**
 * The live preview of the take being recorded into a track.
 *
 * Strips leading-silence peaks so the visible preview matches audible content.
 * The recorder runs at real time, but the user's first reaction lands
 * ~outputLatency+lookAhead seconds into the buffer (they hadn't heard the
 * backing track yet). Without this, the playhead — which uses audible time —
 * would appear behind the right edge of the recorded waveform. Mirrors
 * useIntegratedRecording's finalization compensation (shared
 * `resolveRecordingOffsetSamples`) and dawcore's preview-skip pattern.
 * `getLookAhead()` reads from the same engine the playhead's animation loop
 * uses — keeps the two in lockstep.
 */
const RecordingPreviewClip: React.FC<RecordingPreviewClipProps> = ({
  recordingState,
  trackId,
  trackIndex,
  clipIndex,
  isSelected,
  samplesPerPixel,
  sampleRate,
  showClipHeaders,
  mono,
}) => {
  const { getLookAhead, getOutputLatency } = usePlaybackAnimation();
  // The one place that follows the take frame by frame (#695).
  // Called as methods (not destructured), so a source written as a class works.
  const source = recordingState.progress;
  const subscribe = useCallback((onChange: () => void) => source.subscribe(onChange), [source]);
  const getSnapshot = useCallback(() => source.getSnapshot(), [source]);
  const progress = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const durationSamples = Math.floor(progress.duration * sampleRate);

  const latencyOffsetSamples = resolveRecordingOffsetSamples({
    overrideSeconds: recordingState.latencyOffset,
    outputLatency: getOutputLatency(),
    lookAhead: getLookAhead(),
    sampleRate,
  });
  const latencyPixels = Math.floor(latencyOffsetSamples / samplesPerPixel);
  const skipPeakElements = latencyPixels * 2; // each pixel is a min/max pair
  const previewDuration = Math.max(0, durationSamples - latencyOffsetSamples);
  const previewChannels = (mono ? progress.peaks.slice(0, 1) : progress.peaks).map(
    (channelPeaks) =>
      skipPeakElements > 0 && skipPeakElements < channelPeaks.length
        ? channelPeaks.subarray(skipPeakElements)
        : channelPeaks
  );

  // Nothing to draw until the first peaks arrive.
  if (!(progress.peaks[0]?.length > 0)) return null;

  return (
    <Clip
      clipId="recording-preview"
      trackIndex={trackIndex}
      clipIndex={clipIndex}
      trackName="Recording..."
      startSample={recordingState.startSample}
      durationSamples={previewDuration}
      samplesPerPixel={samplesPerPixel}
      showHeader={showClipHeaders}
      disableHeaderDrag={true}
      isSelected={isSelected}
      trackId={trackId}
    >
      {previewChannels.map((channelPeaks, chIdx) => (
        <ChannelWithProgress
          key={`${trackId}-recording-${chIdx}`}
          index={chIdx}
          data={channelPeaks}
          bits={recordingState.bits}
          length={Math.floor(channelPeaks.length / 2)}
          isSelected={isSelected}
          clipStartSample={recordingState.startSample}
          clipDurationSamples={previewDuration}
        />
      ))}
    </Clip>
  );
};

interface TrackRowProps extends ClipDisplayOptions {
  trackId: string;
  trackIndex: number;
  trackClipPeaks: TrackClipPeaks;
  top: number;
  animate: boolean;
  width: number;
  isSelected: boolean;
  isDragSource: boolean;
  /** Audio or MIDI: a MIDI track is drawn as a piano roll. */
  kind: TrackKind;
  renderMode: RenderMode;
  numChannels: number;
  waveHeight: number;
  mono: boolean;
  /** Set only on the track being recorded into. */
  recordingState: VisualizationRecordingState | undefined;
  /** Set only for a spectrogram track whose config asks for labels. */
  spectrogramConfig: SpectrogramConfig | undefined;
  frequencyScaleFn: FrequencyScaleFn | undefined;
}

/**
 * One track row: its background, spectrogram labels, clips and (while
 * recording into it) the live preview.
 *
 * Memoized (#693): `trackClipPeaks` keeps its identity while no clip of the
 * track changed, and the rest are primitives and stable callbacks.
 */
const TrackRow = React.memo(function TrackRow({
  trackId,
  trackIndex,
  trackClipPeaks,
  top,
  animate,
  width,
  isSelected,
  isDragSource,
  kind,
  renderMode,
  numChannels,
  waveHeight,
  mono,
  recordingState,
  spectrogramConfig,
  frequencyScaleFn,
  ...clipOptions
}: TrackRowProps) {
  const theme = useTheme() as WaveformPlaylistTheme;
  const { sampleRate, samplesPerPixel, showClipHeaders } = clipOptions;

  return (
    <TrackRowPositioner
      $top={top}
      $animate={animate}
      data-track-row=""
      data-track-id={trackId}
      data-track-kind={kind}
      data-selected={isSelected ? 'true' : undefined}
      data-track-drag-source={isDragSource ? 'true' : undefined}
    >
      <TrackComponent
        numChannels={numChannels}
        backgroundColor={
          kind === 'midi'
            ? theme.pianoRollBackgroundColor || '#1a1a2e'
            : waveformColorToCss(theme.waveOutlineColor)
        }
        offset={0}
        width={width}
        hasClipHeaders={showClipHeaders}
        trackId={trackId}
        isSelected={isSelected}
      >
        {renderMode !== 'waveform' && spectrogramConfig?.labels && frequencyScaleFn && (
          <SpectrogramLabels
            waveHeight={waveHeight}
            numChannels={numChannels}
            frequencyScaleFn={frequencyScaleFn}
            minFrequency={spectrogramConfig.minFrequency ?? 0}
            maxFrequency={spectrogramConfig.maxFrequency ?? sampleRate / 2}
            labelsColor={spectrogramConfig.labelsColor}
            labelsBackground={spectrogramConfig.labelsBackground}
            renderMode={renderMode as 'spectrogram' | 'both'}
            hasClipHeaders={showClipHeaders}
          />
        )}
        {trackClipPeaks.map((clip, clipIndex) => (
          <ClipView
            key={clip.clipId}
            clip={clip}
            trackId={trackId}
            trackIndex={trackIndex}
            clipIndex={clipIndex}
            isSelected={isSelected}
            renderMode={renderMode}
            {...clipOptions}
          />
        ))}
        {recordingState?.isRecording && (
          <RecordingPreviewClip
            key={`${trackId}-recording`}
            recordingState={recordingState}
            trackId={trackId}
            trackIndex={trackIndex}
            clipIndex={trackClipPeaks.length}
            isSelected={isSelected}
            samplesPerPixel={samplesPerPixel}
            sampleRate={sampleRate}
            showClipHeaders={showClipHeaders}
            mono={mono}
          />
        )}
      </TrackComponent>
    </TrackRowPositioner>
  );
});

export interface SpectrogramTrackHelpers {
  colorLUT: Uint8Array;
  frequencyScaleFn: FrequencyScaleFn;
  config: SpectrogramConfig | undefined;
}

export interface TrackRowsProps extends ClipDisplayOptions {
  tracks: ClipTrack[];
  peaksDataArray: TrackClipPeaks[];
  /** Render mode per track id, as resolved by the visualization. */
  renderModeById: ReadonlyMap<string, RenderMode>;
  spectrogramHelpersById: ReadonlyMap<string, SpectrogramTrackHelpers>;
  trackLayout: TrackLayout;
  animateTrackLayout: boolean;
  width: number;
  selectedTrackId: string | null;
  dragSourceTrackId: string | null;
  waveHeight: number;
  mono: boolean;
  recordingState: VisualizationRecordingState | undefined;
  /** Channels of the take being recorded (already 1 when `mono`). */
  recordingChannelCount: number;
}

/**
 * All track rows.
 *
 * Memoized (#693), and deliberately free of selection, cursor and annotation
 * state: those change on every pointer move of a selection drag and throughout
 * playback, and nothing in a track row depends on them. Add such a prop here
 * and every row is back on that path.
 */
export const TrackRows = React.memo(function TrackRows({
  tracks,
  peaksDataArray,
  renderModeById,
  spectrogramHelpersById,
  trackLayout,
  animateTrackLayout,
  width,
  selectedTrackId,
  dragSourceTrackId,
  waveHeight,
  mono,
  recordingState,
  recordingChannelCount,
  ...clipOptions
}: TrackRowsProps) {
  return (
    <TracksLayout $height={trackLayout.totalHeight}>
      {peaksDataArray.map((trackClipPeaks, trackIndex) => {
        const track = tracks[trackIndex];
        if (!track) return null;

        const isArmed = recordingState?.isRecording === true && recordingState.trackId === track.id;
        const recordingChannels = isArmed ? recordingChannelCount : 0;
        const helpers = spectrogramHelpersById.get(track.id);

        return (
          <TrackRow
            key={track.id}
            trackId={track.id}
            trackIndex={trackIndex}
            trackClipPeaks={trackClipPeaks}
            top={trackLayout.topById.get(track.id) ?? 0}
            animate={animateTrackLayout}
            width={width}
            isSelected={track.id === selectedTrackId}
            isDragSource={track.id === dragSourceTrackId}
            kind={trackKind(track)}
            renderMode={renderModeById.get(track.id) ?? 'waveform'}
            numChannels={getTrackChannelCount(trackClipPeaks, recordingChannels)}
            waveHeight={waveHeight}
            mono={mono}
            recordingState={isArmed ? recordingState : undefined}
            spectrogramConfig={helpers?.config}
            frequencyScaleFn={helpers?.frequencyScaleFn}
            {...clipOptions}
          />
        );
      })}
    </TracksLayout>
  );
});
