import { ClipTrack, createTrack, createClipFromSeconds } from '@waveform-playlist/core';
import type { AudioTrackConfig } from './useAudioTracks';

export interface BuildTrackOptions {
  /**
   * Suppress the "Cannot create track" warning when the duration is
   * underivable. Immediate mode passes true for configs still awaiting their
   * decode — a missing duration there is an expected transient state (the
   * track builds on the next pass once the buffer arrives), and warning on
   * every rebuild pass floods the console (#620 follow-up). Terminal call
   * sites (non-immediate mode, or configs with nothing left to load) keep
   * the warning.
   */
  suppressMissingDurationWarning?: boolean;
}

/** Build a ClipTrack from config + optional audioBuffer, preserving stable IDs. */
export function buildTrackFromConfig(
  config: AudioTrackConfig,
  index: number,
  audioBuffer: AudioBuffer | undefined,
  stableIds: Map<number, { trackId: string; clipId: string }>,
  contextSampleRate: number = 48000,
  options: BuildTrackOptions = {}
): ClipTrack | null {
  const buffer = audioBuffer ?? config.audioBuffer;

  // Determine if we have enough info to create the track
  // Prefer buffer/waveformData sample rate; fall back to the AudioContext's rate
  const sampleRate = buffer?.sampleRate ?? config.waveformData?.sample_rate ?? contextSampleRate;
  const sourceDuration =
    buffer?.duration ??
    config.waveformData?.duration ??
    (config.duration != null ? config.duration + (config.offset ?? 0) : undefined);

  if (sourceDuration === undefined) {
    if (!options.suppressMissingDurationWarning) {
      console.warn(
        `[waveform-playlist] Track ${index + 1} ("${config.name ?? 'unnamed'}"): ` +
          `Cannot create track — provide duration, audioBuffer, or waveformData with duration.`
      );
    }
    return null;
  }

  const clip = createClipFromSeconds({
    audioBuffer: buffer,
    sampleRate,
    sourceDuration,
    startTime: config.startTime ?? 0,
    duration: config.duration ?? sourceDuration,
    offset: config.offset ?? 0,
    name: config.name || `Track ${index + 1}`,
    fadeIn: config.fadeIn,
    fadeOut: config.fadeOut,
    waveformData: config.waveformData,
  });

  // Validate clip values
  if (isNaN(clip.startSample) || isNaN(clip.durationSamples) || isNaN(clip.offsetSamples)) {
    console.error(
      `[waveform-playlist] Invalid clip values for track ${index + 1} ("${config.name ?? 'unnamed'}"): ` +
        `startSample=${clip.startSample}, durationSamples=${clip.durationSamples}, offsetSamples=${clip.offsetSamples}`
    );
    return null;
  }

  const track: ClipTrack = {
    ...createTrack({
      name: config.name || `Track ${index + 1}`,
      clips: [clip],
      muted: config.muted ?? false,
      soloed: config.soloed ?? false,
      volume: config.volume ?? 1.0,
      pan: config.pan ?? 0,
      color: config.color,
    }),
    effects: config.effects,
    renderMode: config.renderMode,
    spectrogramConfig: config.spectrogramConfig,
    spectrogramColorMap: config.spectrogramColorMap,
  };

  // Preserve stable IDs across rebuilds so React doesn't unmount/remount tracks
  const existingIds = stableIds.get(index);
  if (existingIds) {
    track.id = existingIds.trackId;
    track.clips[0] = { ...track.clips[0], id: existingIds.clipId };
  } else {
    stableIds.set(index, { trackId: track.id, clipId: track.clips[0].id });
  }

  return track;
}
