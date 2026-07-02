import { useState, useCallback } from 'react';
import {
  gainToDb,
  trackChannelCount,
  applyFadeIn,
  applyFadeOut,
  type ClipTrack,
  type FadeType,
} from '@waveform-playlist/core';
import { getUnderlyingAudioParam, getGlobalAudioContext } from '@waveform-playlist/playout';
import type { Volume, Gain, ToneAudioNode } from 'tone';
import { renderToneOffline } from '../utils/renderToneOffline';
import { encodeWav, downloadBlob, type WavEncoderOptions } from '../utils/wavEncoder';

/** Function type for per-track effects (same as in @waveform-playlist/core) */
export type TrackEffectsFunction = (
  graphEnd: unknown,
  destination: unknown,
  isOffline: boolean
) => void | (() => void);

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

/** Per-track variant of OfflineEffectsFunction. */
export type OfflineTrackEffectsFunction = (
  graphEnd: Gain,
  masterGainNode: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

export interface ExportOptions extends WavEncoderOptions {
  /** Filename for download (without extension) */
  filename?: string;
  /** Export mode: 'master' for full mixdown, 'individual' for single track */
  mode?: 'master' | 'individual';
  /** Track index for individual export (only used when mode is 'individual') */
  trackIndex?: number;
  /** Whether to trigger automatic download */
  autoDownload?: boolean;
  /** Whether to apply effects (fades, etc.) - defaults to true */
  applyEffects?: boolean;
  /**
   * Optional effects function for master effects. When provided, export renders
   * through the effects chain (WAM entries included — re-instantiated on the
   * offline context). The function receives isOffline=true and may be async.
   */
  effectsFunction?: OfflineEffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns an offline effects function for that track.
   * This is used instead of track.effects to avoid AudioContext mismatch issues.
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
  /** Export the playlist to WAV */
  exportWav: (
    tracks: ClipTrack[],
    trackStates: TrackState[],
    options?: ExportOptions
  ) => Promise<ExportResult>;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress (0-1) */
  progress: number;
  /** Error message if export failed */
  error: string | null;
}

interface TrackState {
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
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

  const exportWav = useCallback(
    async (
      tracks: ClipTrack[],
      trackStates: TrackState[],
      options: ExportOptions = {}
    ): Promise<ExportResult> => {
      const {
        filename = 'export',
        mode = 'master',
        trackIndex,
        autoDownload = true,
        applyEffects = true,
        effectsFunction,
        createOfflineTrackEffects,
        bitDepth = 16,
        onProgress,
      } = options;

      setIsExporting(true);
      setProgress(0);
      setError(null);

      try {
        // Validate inputs
        if (tracks.length === 0) {
          throw new Error('No tracks to export');
        }

        if (
          mode === 'individual' &&
          (trackIndex === undefined || trackIndex < 0 || trackIndex >= tracks.length)
        ) {
          throw new Error('Invalid track index for individual export');
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

        // Determine which tracks to render
        const tracksToRender =
          mode === 'individual'
            ? [{ track: tracks[trackIndex!], state: trackStates[trackIndex!], index: trackIndex! }]
            : tracks.map((track, index) => ({ track, state: trackStates[index], index }));

        // Check for solo - if any track is soloed, only play soloed tracks.
        // Skip solo logic for individual export — the user explicitly chose the track.
        const hasSolo = mode === 'master' && trackStates.some((state) => state.soloed);

        const reportProgress = (p: number) => {
          setProgress(p);
          onProgress?.(p);
        };

        const renderedBuffer = await renderOffline(
          tracksToRender,
          hasSolo,
          duration,
          sampleRate,
          applyEffects,
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
            mode === 'individual' ? `${filename}_${tracks[trackIndex!].name}` : filename;
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
        setIsExporting(false);
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
 * Mirrors the live playback graph: Player → fadeGain → trackVolume →
 * trackPan → trackMute → masterVolume → destination. Effects chains (master
 * and per-track) are conditionally inserted when provided; their cleanups
 * (which destroy offline WAM clones) always run after the render.
 */
async function renderOffline(
  tracksToRender: { track: ClipTrack; state: TrackState; index: number }[],
  hasSolo: boolean,
  duration: number,
  sampleRate: number,
  applyEffects: boolean,
  effectsFunction: OfflineEffectsFunction | undefined,
  createOfflineTrackEffects:
    | ((trackId: string) => OfflineTrackEffectsFunction | undefined)
    | undefined,
  onProgress: (progress: number) => void
): Promise<AudioBuffer> {
  const { Volume, Gain, Panner, Player, ToneAudioBuffer } = await import('tone');

  onProgress(0.1);

  // Derive output channel count from audible tracks only
  const audibleTracks = tracksToRender.filter(({ state }) => {
    if (state.muted && !state.soloed) return false;
    if (hasSolo && !state.soloed) return false;
    return true;
  });
  const outputChannels = audibleTracks.reduce(
    (max, { track }) => Math.max(max, trackChannelCount(track)),
    1
  );

  const cleanups: Array<() => void> = [];
  try {
    const audioBuffer = await renderToneOffline(
      async (context) => {
        // Master volume at unity gain
        const masterVolume = new Volume(0);

        // Conditionally insert master effects chain (may be async — WAM cloning)
        if (effectsFunction && applyEffects) {
          const cleanup = await effectsFunction(masterVolume, context.destination, true);
          if (cleanup) cleanups.push(cleanup);
        } else {
          masterVolume.connect(context.destination);
        }

        for (const { track, state } of audibleTracks) {
          // Track-level nodes mirror ToneTrack: volume → pan → mute
          const trackVolume = new Volume(gainToDb(state.volume));
          // Match channelCount to source material — Tone.js Panner defaults to 1
          // which forces stereo→mono downmix. Use 2 only for stereo sources.
          const trackPan = new Panner({ pan: state.pan, channelCount: trackChannelCount(track) });
          const trackMute = new Gain(state.muted ? 0 : 1);

          // Conditionally insert per-track effects chain (may be async — WAM cloning)
          const trackEffects = createOfflineTrackEffects?.(track.id);
          if (trackEffects && applyEffects) {
            const cleanup = await trackEffects(trackMute, masterVolume, true);
            if (cleanup) cleanups.push(cleanup);
          } else {
            trackMute.connect(masterVolume);
          }

          // Connect track chain: trackVolume → trackPan → trackMute
          trackPan.connect(trackMute);
          trackVolume.connect(trackPan);

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

            // Connect: player → fadeGain → trackVolume
            player.connect(fadeGain);
            fadeGain.connect(trackVolume);

            // Apply fade automation via native AudioParam
            if (applyEffects) {
              const audioParam = getUnderlyingAudioParam(fadeGain.gain);
              if (audioParam) {
                applyClipFades(audioParam, clipGain, startTime, clipDuration, fadeIn, fadeOut);
              } else if (fadeIn || fadeOut) {
                console.warn(
                  '[waveform-playlist] Cannot apply fades for clip "' +
                    (clip.name || clip.id) +
                    '" - AudioParam not accessible'
                );
              }
            }

            player.start(startTime, offset, clipDuration);
          }
        }

        context.transport.start(0);
      },
      duration,
      outputChannels,
      sampleRate
    );

    onProgress(0.9);
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
