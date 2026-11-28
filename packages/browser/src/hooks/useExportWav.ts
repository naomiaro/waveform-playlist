import { useState, useCallback, useRef } from 'react';
import {
  gainToDb,
  trackChannelCount,
  trackPanLaw,
  createPanStage,
  applyFadeIn,
  applyFadeOut,
  isDecidedPanLaw,
  type ClipTrack,
  type DecidedPanLaw,
  type FadeType,
  type PanLaw,
} from '@waveform-playlist/core';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import type { Volume, Gain, ToneAudioNode } from 'tone';
import { renderToneOffline } from '../utils/renderToneOffline';
import { encodeWav, downloadBlob, type WavEncoderOptions } from '../utils/wavEncoder';

/** Cleanup returned by an offline effects function (disposes offline instances / WAM clones). */
export type OfflineEffectsCleanup = void | (() => void);

/**
 * Master-chain effects function for offline rendering. May return a Promise —
 * WAM entries are re-instantiated asynchronously on the offline context.
 * Every live EffectsFunction is assignable to this type.
 */
export type OfflineEffectsFunction = (
  masterVolume: Volume,
  destination: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

/**
 * Per-track variant of OfflineEffectsFunction. Pre-fader, like the live
 * TrackEffectsFunction: wire `trackInput` through the effects into
 * `faderInput` (the track's volume stage) — never straight to the master.
 */
export type OfflineTrackEffectsFunction = (
  trackInput: Gain,
  faderInput: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

export interface ExportOptions extends WavEncoderOptions {
  /**
   * Filename for download (without extension). A single track's file is
   * named `<filename>_<track name>`.
   */
  filename?: string;
  /**
   * The id of the one track to export. Left out, the mix of every audible track
   * is exported. Given, that track alone is exported as it sounds on its own:
   * with its volume, pan and effects, its mute and the other tracks' solo
   * ignored. An id that is not among the tracks rejects the export.
   */
  trackId?: string;
  /** Whether to trigger automatic download */
  autoDownload?: boolean;
  /**
   * Optional effects function for master effects. When provided, export renders
   * through the effects chain (WAM entries included — re-instantiated on the
   * offline context). The function receives isOffline=true and may be async.
   * Clip fades are always rendered, with or without effect chains.
   */
  effectsFunction?: OfflineEffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns an offline effects function for that track.
   * The live chain cannot be used: its nodes belong to the live AudioContext.
   */
  createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined;
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void;
}

export interface ExportResult {
  /** The rendered audio buffer */
  audioBuffer: AudioBuffer;
  /** The WAV file as a Blob */
  blob: Blob;
  /** Duration in seconds */
  duration: number;
}

export interface UseExportWavReturn {
  /**
   * Export the playlist to WAV. `trackStates[i]` is the mix of `tracks[i]`; a
   * track with no entry is rendered with its own `muted`, `soloed`, `volume`
   * and `pan`.
   */
  exportWav: (
    tracks: readonly ClipTrack[],
    trackStates: readonly (TrackState | undefined)[],
    options?: ExportOptions
  ) => Promise<ExportResult>;
  /** True while any export started from this hook call is running */
  isExporting: boolean;
  /** Progress (0-1) of the export started last from this hook call */
  progress: number;
  /**
   * Message of the last export from this hook call that failed; cleared when an
   * export starts
   */
  error: string | null;
}

interface TrackState {
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  /** The track's pan law. Left out or `'auto'`: the track's own, else the law of its clips. */
  panLaw?: PanLaw;
}

/** The law a track is rendered with: the state's when decided, else the track's (`trackPanLaw`). */
function renderPanLaw(track: ClipTrack, state: TrackState): DecidedPanLaw {
  return isDecidedPanLaw(state.panLaw) ? state.panLaw : trackPanLaw(track);
}

/**
 * Hook for exporting the waveform playlist to WAV format.
 * Uses a Tone offline render (native OfflineAudioContext in native-context mode),
 * mirroring the live playback graph.
 */
export function useExportWav(): UseExportWavReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Exports of this hook call that have not settled, and the number of the
  // last one started: `isExporting` ends with the last of them, and only the
  // export started last writes `progress`.
  const runningRef = useRef(0);
  const startedRef = useRef(0);

  const exportWav = useCallback(
    async (
      tracks: readonly ClipTrack[],
      trackStates: readonly (TrackState | undefined)[],
      options: ExportOptions = {}
    ): Promise<ExportResult> => {
      const {
        filename = 'export',
        trackId,
        autoDownload = true,
        effectsFunction,
        createOfflineTrackEffects,
        bitDepth = 16,
        onProgress,
      } = options;

      startedRef.current += 1;
      const exportNumber = startedRef.current;
      runningRef.current += 1;
      setIsExporting(true);
      setProgress(0);
      setError(null);

      try {
        // Validate inputs
        if (tracks.length === 0) {
          throw new Error('No tracks to export');
        }

        const chosenIndex =
          trackId === undefined ? -1 : tracks.findIndex((track) => track.id === trackId);
        if (trackId !== undefined && chosenIndex === -1) {
          throw new Error(`No track with id "${trackId}" to export`);
        }

        // Use AudioContext sample rate — the single source of truth for all audio
        const sampleRate = getGlobalAudioContext().sampleRate;

        // Calculate total duration from all clips (in samples)
        let totalDurationSamples = 0;
        for (const track of tracks) {
          for (const clip of track.clips) {
            const clipEndSample = clip.startSample + clip.durationSamples;
            totalDurationSamples = Math.max(totalDurationSamples, clipEndSample);
          }
        }

        // Add a small buffer at the end (0.1 seconds) to avoid cutting off
        totalDurationSamples += Math.round(sampleRate * 0.1);

        const duration = totalDurationSamples / sampleRate;

        // Determine which tracks to render. `trackStates[i]` is the mix of
        // `tracks[i]`; under the provider both have one entry per track. A
        // direct caller may pass fewer states: a track without one is
        // rendered with its own fields.
        const stateOf = (index: number): TrackState =>
          trackStates[index] ?? {
            muted: tracks[index].muted,
            soloed: tracks[index].soloed,
            volume: tracks[index].volume,
            pan: tracks[index].pan,
          };
        // One chosen track is exported as it sounds alone: choosing it is the
        // choice, so its own mute is ignored, as is every other track's solo.
        const tracksToRender =
          chosenIndex === -1
            ? tracks.map((track, index) => ({ track, state: stateOf(index), index }))
            : [
                {
                  track: tracks[chosenIndex],
                  state: { ...stateOf(chosenIndex), muted: false },
                  index: chosenIndex,
                },
              ];

        // In the mix, a soloed track silences every track that is not soloed.
        const hasSolo = chosenIndex === -1 && tracks.some((_, index) => stateOf(index).soloed);

        const reportProgress = (p: number) => {
          if (startedRef.current === exportNumber) setProgress(p);
          onProgress?.(p);
        };

        const renderedBuffer = await renderOffline(
          tracksToRender,
          hasSolo,
          duration,
          sampleRate,
          effectsFunction,
          createOfflineTrackEffects,
          reportProgress
        );

        reportProgress(0.9);

        // Encode to WAV
        const blob = encodeWav(renderedBuffer, { bitDepth });

        reportProgress(1);

        // Auto download if requested
        if (autoDownload) {
          const exportFilename =
            chosenIndex === -1 ? filename : `${filename}_${tracks[chosenIndex].name}`;
          downloadBlob(blob, `${exportFilename}.wav`);
        }

        return {
          audioBuffer: renderedBuffer,
          blob,
          duration,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        setError(message);
        throw err;
      } finally {
        runningRef.current -= 1;
        if (runningRef.current === 0) setIsExporting(false);
      }
    },
    []
  );

  return {
    exportWav,
    isExporting,
    progress,
    error,
  };
}

/**
 * Render the playlist offline. Uses renderToneOffline — a hand-rolled
 * Tone.Offline variant that renders on a NATIVE OfflineAudioContext in
 * native-context mode so mixed Tone + WAM chains can be hosted (#536).
 * Mirrors the live playback graph: Player → fadeGain → trackInput →
 * [track effects] → trackVolume → trackPan → trackMute → masterVolume →
 * destination. Track effects are pre-fader inserts (#660), as in live
 * playback. Effects chains (master and per-track) are inserted when their
 * functions are given; their cleanups (which destroy offline WAM clones)
 * always run after the render. Clip fades are always rendered.
 */
async function renderOffline(
  tracksToRender: { track: ClipTrack; state: TrackState; index: number }[],
  hasSolo: boolean,
  duration: number,
  sampleRate: number,
  effectsFunction: OfflineEffectsFunction | undefined,
  createOfflineTrackEffects:
    | ((trackId: string) => OfflineTrackEffectsFunction | undefined)
    | undefined,
  onProgress: (progress: number) => void
): Promise<AudioBuffer> {
  const { Volume, Gain, Player, ToneAudioBuffer, connect } = await import('tone');

  onProgress(0.1);

  // Derive output channel count from audible tracks only
  const audibleTracks = tracksToRender.filter(({ state }) => {
    if (state.muted && !state.soloed) return false;
    if (hasSolo && !state.soloed) return false;
    return true;
  });
  // Two channels when any audible track has the stereo law or a stereo clip.
  const outputChannels = audibleTracks.some(
    ({ track, state }) => renderPanLaw(track, state) === 'stereo' || trackChannelCount(track) >= 2
  )
    ? 2
    : 1;

  const cleanups: Array<() => void> = [];
  try {
    const audioBuffer = await renderToneOffline(
      async (context) => {
        // Master volume at unity gain
        const masterVolume = new Volume(0);

        // Insert the master effects chain when given (may be async — WAM cloning)
        if (effectsFunction) {
          const cleanup = await effectsFunction(masterVolume, context.destination, true);
          if (cleanup) cleanups.push(cleanup);
        } else {
          masterVolume.connect(context.destination);
        }

        for (const { track, state } of audibleTracks) {
          // Track-level nodes mirror ToneTrack: input → [effects] → volume → pan → mute
          const trackInput = new Gain({ gain: 1 });
          const trackVolume = new Volume(gainToDb(state.volume));
          // Same pan stage as live playback (core's createPanStage, native
          // nodes on the raw offline context): the law is the track's own, and
          // a stereo effect on a mono track stays stereo.
          const trackPan = createPanStage(
            context.rawContext as BaseAudioContext,
            state.pan,
            renderPanLaw(track, state)
          );
          const trackMute = new Gain(state.muted ? 0 : 1);

          // Insert the track's effects chain when given (may be async — WAM cloning)
          // PRE-FADER: trackInput → effects → trackVolume, so volume and pan
          // never change how hard the effects work (parity with ToneTrack).
          const trackEffects = createOfflineTrackEffects?.(track.id);
          if (trackEffects) {
            const cleanup = await trackEffects(trackInput, trackVolume, true);
            if (cleanup) cleanups.push(cleanup);
          } else {
            trackInput.connect(trackVolume);
          }

          // Connect track chain: trackVolume → trackPan → trackMute → master
          trackMute.connect(masterVolume);
          connect(trackPan.output, trackMute); // native → Tone edge
          trackVolume.connect(trackPan.input);

          // Schedule each clip
          for (const clip of track.clips) {
            const {
              audioBuffer: clipBuffer,
              startSample,
              durationSamples,
              offsetSamples,
              gain: clipGain,
              fadeIn,
              fadeOut,
            } = clip;

            // Skip clips without audioBuffer (peaks-only clips can't be exported)
            if (!clipBuffer) {
              console.warn(
                '[waveform-playlist] Skipping clip "' +
                  (clip.name || clip.id) +
                  '" - no audioBuffer for export'
              );
              continue;
            }

            // Convert samples to seconds
            const startTime = startSample / sampleRate;
            const clipDuration = durationSamples / sampleRate;
            const offset = offsetSamples / sampleRate;

            // Create player and clip-level fade gain
            const toneBuffer = new ToneAudioBuffer(clipBuffer);
            const player = new Player(toneBuffer);
            const fadeGain = new Gain(clipGain);

            // Connect: player → fadeGain → trackInput (pre-fader, pre-effects)
            player.connect(fadeGain);
            fadeGain.connect(trackInput);

            // Apply fade automation on the native AudioParam. `Gain.input` is
            // the native GainNode (public Tone API) — no private field needed.
            applyClipFades(fadeGain.input.gain, clipGain, startTime, clipDuration, fadeIn, fadeOut);

            player.start(startTime, offset, clipDuration);
          }
        }

        context.transport.start(0);
      },
      duration,
      outputChannels,
      sampleRate
    );

    return audioBuffer;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Offline rendering failed: ' + String(err));
  } finally {
    // Always dispose offline effect instances / destroy WAM clones —
    // success or failure. Warn-and-continue per cleanup.
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.warn(
          '[waveform-playlist] Export cleanup error: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }
  }
}

/**
 * Apply fade in/out automation to a clip's gain AudioParam.
 * Delegates to core's applyFadeIn/applyFadeOut for consistent curves
 * between live playback and offline export.
 */
function applyClipFades(
  gainParam: AudioParam,
  clipGain: number,
  startTime: number,
  clipDuration: number,
  fadeIn: { duration: number; type?: FadeType } | undefined,
  fadeOut: { duration: number; type?: FadeType } | undefined
): void {
  // Set initial gain (0 if fade in, clipGain otherwise)
  if (fadeIn) {
    gainParam.setValueAtTime(0, startTime);
  } else {
    gainParam.setValueAtTime(clipGain, startTime);
  }

  if (fadeIn) {
    applyFadeIn(gainParam, startTime, fadeIn.duration, fadeIn.type || 'linear', 0, clipGain);
  }

  if (fadeOut) {
    const fadeOutStart = startTime + clipDuration - fadeOut.duration;
    // Ensure we're at clipGain before fade out starts
    if (!fadeIn || fadeIn.duration < clipDuration - fadeOut.duration) {
      gainParam.setValueAtTime(clipGain, fadeOutStart);
    }
    applyFadeOut(gainParam, fadeOutStart, fadeOut.duration, fadeOut.type || 'linear', clipGain, 0);
  }
}

/**
 * Export types
 */
export type { WavEncoderOptions };
