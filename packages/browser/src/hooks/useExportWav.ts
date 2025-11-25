import { useState, useCallback } from 'react';
import type { ClipTrack, AudioClip, Fade, FadeType } from '@waveform-playlist/core';
import { encodeWav, downloadBlob, type WavEncoderOptions } from '../utils/wavEncoder';

export interface ExportOptions extends WavEncoderOptions {
  /** Filename for download (without extension) */
  filename?: string;
  /** Export mode: 'master' for stereo mix, 'individual' for single track */
  mode?: 'master' | 'individual';
  /** Track index for individual export (only used when mode is 'individual') */
  trackIndex?: number;
  /** Whether to trigger automatic download */
  autoDownload?: boolean;
  /** Whether to apply effects (fades, etc.) - defaults to true */
  applyEffects?: boolean;
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
  exportWav: (tracks: ClipTrack[], trackStates: TrackState[], options?: ExportOptions) => Promise<ExportResult>;
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
 * Hook for exporting the waveform playlist to WAV format
 * Uses OfflineAudioContext for fast, non-real-time rendering
 */
export function useExportWav(): UseExportWavReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportWav = useCallback(async (
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

      if (mode === 'individual' && (trackIndex === undefined || trackIndex < 0 || trackIndex >= tracks.length)) {
        throw new Error('Invalid track index for individual export');
      }

      // Get sample rate from first clip
      const sampleRate = tracks[0].clips[0]?.audioBuffer.sampleRate || 44100;

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

      // Create offline context for rendering
      const offlineCtx = new OfflineAudioContext(2, totalDurationSamples, sampleRate);

      // Determine which tracks to render
      const tracksToRender = mode === 'individual'
        ? [{ track: tracks[trackIndex!], state: trackStates[trackIndex!], index: trackIndex! }]
        : tracks.map((track, index) => ({ track, state: trackStates[index], index }));

      // Check for solo - if any track is soloed, only play soloed tracks
      const hasSolo = trackStates.some(state => state.soloed);

      // Schedule all clips for rendering
      let scheduledClips = 0;
      const totalClips = tracksToRender.reduce((sum, { track }) => sum + track.clips.length, 0);

      for (const { track, state, index } of tracksToRender) {
        // Skip muted tracks (unless soloed)
        if (state.muted && !state.soloed) continue;
        // If there's a solo and this track isn't soloed, skip it
        if (hasSolo && !state.soloed) continue;

        for (const clip of track.clips) {
          await scheduleClip(offlineCtx, clip, state, sampleRate, applyEffects);
          scheduledClips++;
          const currentProgress = scheduledClips / totalClips * 0.5; // First 50% is scheduling
          setProgress(currentProgress);
          onProgress?.(currentProgress);
        }
      }

      // Render the audio
      setProgress(0.5);
      onProgress?.(0.5);

      const renderedBuffer = await offlineCtx.startRendering();

      setProgress(0.9);
      onProgress?.(0.9);

      // Encode to WAV
      const blob = encodeWav(renderedBuffer, { bitDepth });

      setProgress(1);
      onProgress?.(1);

      // Auto download if requested
      if (autoDownload) {
        const exportFilename = mode === 'individual'
          ? `${filename}_${tracks[trackIndex!].name}`
          : filename;
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
  }, []);

  return {
    exportWav,
    isExporting,
    progress,
    error,
  };
}

/**
 * Schedule a single clip in the offline context
 */
async function scheduleClip(
  ctx: OfflineAudioContext,
  clip: AudioClip,
  trackState: TrackState,
  sampleRate: number,
  applyEffects: boolean
): Promise<void> {
  const { audioBuffer, startSample, durationSamples, offsetSamples, gain: clipGain, fadeIn, fadeOut } = clip;

  // Convert samples to seconds for Web Audio API
  const startTime = startSample / sampleRate;
  const duration = durationSamples / sampleRate;
  const offset = offsetSamples / sampleRate;

  // Create buffer source
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  // Create gain node for clip + track volume
  const gainNode = ctx.createGain();
  const baseGain = clipGain * trackState.volume;

  // Create stereo panner for track pan
  const pannerNode = ctx.createStereoPanner();
  pannerNode.pan.value = trackState.pan;

  // Connect: source -> gain -> panner -> destination
  source.connect(gainNode);
  gainNode.connect(pannerNode);
  pannerNode.connect(ctx.destination);

  // Apply effects (fades) if enabled
  if (applyEffects) {
    // Set initial gain (may be 0 if fade in starts at 0)
    if (fadeIn && fadeIn.start === 0) {
      gainNode.gain.setValueAtTime(0, startTime);
    } else {
      gainNode.gain.setValueAtTime(baseGain, startTime);
    }

    // Apply fade in
    if (fadeIn) {
      const fadeInStart = startTime + fadeIn.start;
      const fadeInEnd = startTime + fadeIn.end;
      applyFadeEnvelope(gainNode.gain, fadeInStart, fadeInEnd, 0, baseGain, fadeIn.type);
    }

    // Apply fade out
    if (fadeOut) {
      const fadeOutStart = startTime + fadeOut.start;
      const fadeOutEnd = startTime + fadeOut.end;
      // Ensure we're at baseGain before fade out starts
      if (!fadeIn || fadeIn.end < fadeOut.start) {
        gainNode.gain.setValueAtTime(baseGain, fadeOutStart);
      }
      applyFadeEnvelope(gainNode.gain, fadeOutStart, fadeOutEnd, baseGain, 0, fadeOut.type);
    }
  } else {
    // No effects - just set constant gain
    gainNode.gain.setValueAtTime(baseGain, startTime);
  }

  // Schedule playback
  source.start(startTime, offset, duration);
}

/**
 * Apply a fade envelope to a gain parameter using Web Audio automation
 */
function applyFadeEnvelope(
  gainParam: AudioParam,
  startTime: number,
  endTime: number,
  startValue: number,
  endValue: number,
  fadeType: FadeType
): void {
  const duration = endTime - startTime;
  if (duration <= 0) return;

  switch (fadeType) {
    case 'linear':
      gainParam.setValueAtTime(startValue, startTime);
      gainParam.linearRampToValueAtTime(endValue, endTime);
      break;

    case 'exponential':
      // Exponential can't handle 0 values, use small value instead
      const expStart = Math.max(startValue, 0.0001);
      const expEnd = Math.max(endValue, 0.0001);
      gainParam.setValueAtTime(expStart, startTime);
      gainParam.exponentialRampToValueAtTime(expEnd, endTime);
      // Set to actual 0 if needed
      if (endValue === 0) {
        gainParam.setValueAtTime(0, endTime);
      }
      break;

    case 'logarithmic':
      // Logarithmic fade - more aggressive at start, gentler at end
      // Implemented using setValueCurveAtTime with calculated curve
      const logCurve = generateFadeCurve(startValue, endValue, 256, 'logarithmic');
      gainParam.setValueCurveAtTime(logCurve, startTime, duration);
      break;

    case 'sCurve':
      // S-curve (ease-in-out) - smooth start and end
      const sCurve = generateFadeCurve(startValue, endValue, 256, 'sCurve');
      gainParam.setValueCurveAtTime(sCurve, startTime, duration);
      break;

    default:
      // Default to linear
      gainParam.setValueAtTime(startValue, startTime);
      gainParam.linearRampToValueAtTime(endValue, endTime);
  }
}

/**
 * Generate a fade curve for setValueCurveAtTime
 */
function generateFadeCurve(
  startValue: number,
  endValue: number,
  numPoints: number,
  curveType: 'logarithmic' | 'sCurve'
): Float32Array {
  const curve = new Float32Array(numPoints);
  const range = endValue - startValue;

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1); // 0 to 1

    let curveValue: number;
    if (curveType === 'logarithmic') {
      // Logarithmic: fast at start, slow at end (for fade out)
      // or slow at start, fast at end (for fade in)
      if (range > 0) {
        // Fade in: use log curve
        curveValue = Math.log10(1 + t * 9) / Math.log10(10);
      } else {
        // Fade out: use inverse log curve
        curveValue = 1 - Math.log10(1 + (1 - t) * 9) / Math.log10(10);
      }
    } else {
      // S-curve (smoothstep)
      curveValue = t * t * (3 - 2 * t);
    }

    curve[i] = startValue + range * curveValue;
  }

  return curve;
}

/**
 * Export types
 */
export type { WavEncoderOptions };
