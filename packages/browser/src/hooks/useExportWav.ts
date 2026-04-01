import { useState, useCallback } from 'react';
import {
  gainToDb,
  trackChannelCount,
  applyFadeIn,
  applyFadeOut,
  type ClipTrack,
  type FadeType,
} from '@waveform-playlist/core';
import {
  type EffectsFunction,
  getUnderlyingAudioParam,
  getGlobalAudioContext,
} from '@waveform-playlist/playout';
import { encodeWav, downloadBlob, type WavEncoderOptions } from '../utils/wavEncoder';

/** Function type for per-track effects (same as in @waveform-playlist/core) */
export type TrackEffectsFunction = (
  graphEnd: unknown,
  destination: unknown,
  isOffline: boolean
) => void | (() => void);

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
   * Optional Tone.js effects function for master effects. When provided, export renders
   * through the effects chain. The function receives isOffline=true.
   */
  effectsFunction?: EffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns a TrackEffectsFunction for offline rendering.
   * This is used instead of track.effects to avoid AudioContext mismatch issues.
   */
  createOfflineTrackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
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
 * Uses Tone.Offline for non-real-time rendering, mirroring the live playback graph.
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
 * Render the playlist offline using Tone.Offline.
 * Mirrors the live playback graph: Player → fadeGain → trackVolume → trackPan → trackMute → masterVolume → destination.
 * Effects chains (master and per-track) are conditionally inserted when provided.
 */
async function renderOffline(
  tracksToRender: { track: ClipTrack; state: TrackState; index: number }[],
  hasSolo: boolean,
  duration: number,
  sampleRate: number,
  applyEffects: boolean,
  effectsFunction: EffectsFunction | undefined,
  createOfflineTrackEffects: ((trackId: string) => TrackEffectsFunction | undefined) | undefined,
  onProgress: (progress: number) => void
): Promise<AudioBuffer> {
  const { Offline, Volume, Gain, Panner, Player, ToneAudioBuffer } = await import('tone');

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

  let buffer;
  try {
    buffer = await Offline(
      async ({ transport, destination }) => {
        // Master volume at unity gain
        const masterVolume = new Volume(0);

        // Conditionally insert master effects chain
        if (effectsFunction && applyEffects) {
          effectsFunction(masterVolume, destination, true);
        } else {
          masterVolume.connect(destination);
        }

        for (const { track, state } of audibleTracks) {
          // Track-level nodes mirror ToneTrack: volume → pan → mute
          const trackVolume = new Volume(gainToDb(state.volume));
          // Match channelCount to source material — Tone.js Panner defaults to 1
          // which forces stereo→mono downmix. Use 2 only for stereo sources.
          const trackPan = new Panner({ pan: state.pan, channelCount: trackChannelCount(track) });
          const trackMute = new Gain(state.muted ? 0 : 1);

          // Conditionally insert per-track effects chain
          const trackEffects = createOfflineTrackEffects?.(track.id);
          if (trackEffects && applyEffects) {
            trackEffects(trackMute, masterVolume, true);
          } else {
            trackMute.connect(masterVolume);
          }

          // Connect track chain: trackVolume → trackPan → trackMute
          trackPan.connect(trackMute);
          trackVolume.connect(trackPan);

          // Schedule each clip
          for (const clip of track.clips) {
            const {
              audioBuffer,
              startSample,
              durationSamples,
              offsetSamples,
              gain: clipGain,
              fadeIn,
              fadeOut,
            } = clip;

            // Skip clips without audioBuffer (peaks-only clips can't be exported)
            if (!audioBuffer) {
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
            const toneBuffer = new ToneAudioBuffer(audioBuffer);
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

        transport.start(0);
      },
      duration,
      outputChannels,
      sampleRate
    );
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    } else {
      throw new Error('Tone.Offline rendering failed: ' + String(err));
    }
  }

  onProgress(0.9);

  const result = buffer.get();
  if (!result) {
    throw new Error('Offline rendering produced no audio buffer');
  }
  return result;
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
