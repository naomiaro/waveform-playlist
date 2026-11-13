import React, { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
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
  type Peaks,
  type RenderMode,
  type TrackKind,
  type SpectrogramConfig,
} from '@waveform-playlist/core';
import { type ClipPeaks, type TrackClipPeaks } from '../WaveformPlaylistContext';
import {
  useEngineRefs,
  usePlaylistView,
  usePlaylistZoom,
  useSelectedRow,
} from '../contexts/playlistContexts';
import {
  SpectrogramIntegrationContext,
  type SpectrogramIntegration,
} from '../SpectrogramIntegrationContext';
import { useWaveformExtent, useWaveformRows } from './waveformLayoutContext';
import { useClipInteraction } from '../contexts/ClipInteractionContext';
import { ChannelWithProgress } from './ChannelWithProgress';
import {
  TrackRowPositioner,
  TracksLayout,
  getTrackChannelCount,
  type WaveformRecordingState,
} from './visualizationLayout';

type FrequencyScaleFn = (f: number, minF: number, maxF: number) => number;

/** Options that are the same for every clip of the playlist. */
interface ClipDisplayOptions {
  samplesPerPixel: number;
  sampleRate: number;
  showClipHeaders: boolean;
  gainScaledWaveforms: boolean;
  showFades: boolean;
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
  showFades,
  selectTrack,
  registerSpectrogramCanvas,
  unregisterSpectrogramCanvas,
}: ClipViewProps) {
  // The one source of both options (#690): set by `ClipInteractionProvider`
  // or `ClipInteractionOptions` above, never passed down as props.
  const { enabled: interactiveClips, touchOptimized } = useClipInteraction();
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
  recordingState: WaveformRecordingState;
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
  const { getLookAhead, getOutputLatency } = useEngineRefs();
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
  recordingState: WaveformRecordingState | undefined;
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

/**
 * Marker: clips get a header. With clip interaction enabled the header is also
 * what a clip is dragged by, and the trim handles come with it. It adds to the
 * height of every row, which is why the root must know of it before anything
 * is drawn: it renders nothing itself.
 */
export const WaveformClipHeaders: React.FC = () => null;

/** Marker: clips show their fade-in and fade-out curves. Renders nothing itself. */
export const WaveformFades: React.FC = () => null;

export interface WaveformRecordingPreviewProps {
  recordingState: WaveformRecordingState;
}

/**
 * Marker: the take being recorded is drawn into its track as it grows. The
 * preview clip is drawn by that track's row; this renders nothing itself.
 */
export const WaveformRecordingPreview: React.FC<WaveformRecordingPreviewProps> = () => null;

export interface TracksMarkers {
  showClipHeaders: boolean;
  showFades: boolean;
  recordingState: WaveformRecordingState | undefined;
}

/**
 * Which per-clip parts are among the children of the tracks part. Looks
 * through fragments; a part wrapped in another component is not seen.
 */
export function scanTracksParts(children: ReactNode): TracksMarkers {
  const found: TracksMarkers = {
    showClipHeaders: false,
    showFades: false,
    recordingState: undefined,
  };
  const visit = (node: ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === WaveformClipHeaders) found.showClipHeaders = true;
      else if (child.type === WaveformFades) found.showFades = true;
      else if (child.type === WaveformRecordingPreview) {
        found.recordingState = (child.props as WaveformRecordingPreviewProps).recordingState;
      } else if (child.type === React.Fragment) {
        visit((child.props as { children?: ReactNode }).children);
      }
    });
  };
  visit(children);
  return found;
}

export interface WaveformTracksProps {
  /** Draw each clip's waveform scaled by its gain. */
  gainScaled?: boolean;
  /** `WaveformClipHeaders`, `WaveformFades`, `WaveformRecordingPreview`. */
  children?: ReactNode;
}

/**
 * All track rows: the tracks part of the view (#685).
 *
 * It takes the rows, their peaks and the layout from the root's rows value
 * (not from a provider's track value, see waveformLayoutContext.ts) and the
 * selected row from a context both providers serve (`useSelectedRow`), so it
 * draws under either provider. It is
 * deliberately free of the time selection, the cursor and the annotation
 * state: those change on every pointer move of a selection drag and
 * throughout playback, and nothing in a track row depends on them. Read one
 * of them here and every row is back on that path (#693).
 *
 * It is not memoized: its children are new elements whenever the component
 * that composes the view renders. That costs this component's own render; the
 * rows below are memoized and get primitives, stable callbacks and the
 * identity-stable pieces of the peaks.
 */
export const WaveformTracks: React.FC<WaveformTracksProps> = ({ gainScaled = false, children }) => {
  const rows = useWaveformRows('The tracks');
  const { tracksFullWidth: width } = useWaveformExtent('The tracks');
  const { selectedTrackId } = useSelectedRow();
  const { sampleRate, waveHeight, mono } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const spectrogram = useContext(SpectrogramIntegrationContext);
  const { showFades, recordingState } = scanTracksParts(children);
  const {
    rows: rowList,
    peaksDataArray,
    dragSourceTrackId,
    trackLayout,
    renderModeById,
    spectrogramHelpersById,
    recordingChannelCount,
  } = rows;

  return (
    <TracksLayout $height={trackLayout.totalHeight}>
      {peaksDataArray.map((trackClipPeaks, trackIndex) => {
        const track = rowList[trackIndex];
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
            animate={rows.animateTrackLayout}
            width={width}
            isSelected={track.id === selectedTrackId}
            isDragSource={track.id === dragSourceTrackId}
            kind={track.kind}
            renderMode={renderModeById.get(track.id) ?? 'waveform'}
            numChannels={getTrackChannelCount(trackClipPeaks, recordingChannels)}
            waveHeight={waveHeight}
            mono={mono}
            recordingState={isArmed ? recordingState : undefined}
            spectrogramConfig={helpers?.config}
            frequencyScaleFn={helpers?.frequencyScaleFn}
            samplesPerPixel={samplesPerPixel}
            sampleRate={sampleRate}
            showClipHeaders={rows.showClipHeaders}
            gainScaledWaveforms={gainScaled}
            showFades={showFades}
            selectTrack={rows.selectTrack}
            registerSpectrogramCanvas={spectrogram?.registerSpectrogramCanvas}
            unregisterSpectrogramCanvas={spectrogram?.unregisterSpectrogramCanvas}
          />
        );
      })}
    </TracksLayout>
  );
};
