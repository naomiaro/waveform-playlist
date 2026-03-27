import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';

export interface DecodeOptions {
  /** Extra properties merged into each createTrack call (e.g., spectrogramConfig). */
  trackDefaults?: Partial<ClipTrack>;
}

/**
 * Decode audio files in parallel and return an array of ClipTracks.
 * Failed decodes are logged and skipped — only successful tracks are returned.
 *
 * Usage:
 *   const newTracks = await decodeAudioFiles(audioContext, files);
 *   setTracks(prev => [...prev, ...newTracks]);
 */
export async function decodeAudioFiles(
  audioContext: AudioContext,
  files: File[],
  options?: DecodeOptions,
): Promise<ClipTrack[]> {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const name = file.name.replace(/\.[^/.]+$/, '');
      const clip = createClipFromSeconds({
        audioBuffer,
        startTime: 0,
        duration: audioBuffer.duration,
        offset: 0,
        name,
      });
      return createTrack({
        name,
        clips: [clip],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
        ...options?.trackDefaults,
      });
    }),
  );

  const tracks = results
    .filter((r): r is PromiseFulfilledResult<ClipTrack> => r.status === 'fulfilled')
    .map((r) => r.value);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(
        '[waveform-playlist] Error decoding audio file: ' +
          files[i].name +
          ' — ' +
          String(r.reason),
      );
    }
  });

  return tracks;
}
