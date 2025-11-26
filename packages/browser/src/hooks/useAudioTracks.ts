import { useState, useEffect } from 'react';
import { ClipTrack, createTrack, createClipFromSeconds, type Fade, type TrackEffectsFunction } from '@waveform-playlist/core';
import * as Tone from 'tone';

/**
 * Configuration for a single audio track to load
 */
export interface AudioTrackConfig {
  src: string;  // URL to audio file
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  effects?: TrackEffectsFunction;
  // Multi-clip support
  startTime?: number;  // When the clip starts on the timeline (default: 0)
  duration?: number;   // Duration of the clip (default: full audio duration)
  offset?: number;     // Offset into the source audio file (default: 0)
  // Fade support
  fadeIn?: Fade;       // Fade in configuration
  fadeOut?: Fade;      // Fade out configuration
}

/**
 * Hook to load audio from URLs and convert to ClipTrack format
 *
 * This hook fetches audio files, decodes them, and creates ClipTrack objects
 * with a single clip per track. Supports custom positioning for multi-clip arrangements.
 *
 * @param configs - Array of audio track configurations
 * @returns Object with tracks array and loading state
 *
 * @example
 * ```typescript
 * // Basic usage (clips positioned at start)
 * const { tracks, loading, error } = useAudioTracks([
 *   { src: 'audio/vocals.mp3', name: 'Vocals' },
 *   { src: 'audio/drums.mp3', name: 'Drums' },
 * ]);
 *
 * // Multi-clip positioning (clips at different times with gaps)
 * const { tracks, loading, error } = useAudioTracks([
 *   { src: 'audio/guitar.mp3', name: 'Guitar Clip 1', startTime: 0, duration: 3 },
 *   { src: 'audio/guitar.mp3', name: 'Guitar Clip 2', startTime: 5, duration: 3, offset: 5 },
 *   { src: 'audio/vocals.mp3', name: 'Vocals', startTime: 2, duration: 4 },
 * ]);
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return <WaveformPlaylistProvider tracks={tracks}>...</WaveformPlaylistProvider>;
 * ```
 */
export function useAudioTracks(configs: AudioTrackConfig[]) {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configs.length === 0) {
      setTracks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);

        const audioContext = Tone.getContext().rawContext as AudioContext;

        // Fetch and decode all audio files
        const loadPromises = configs.map(async (config, index) => {
          const response = await fetch(config.src);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${config.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Validate audioBuffer
          if (!audioBuffer || !audioBuffer.sampleRate || !audioBuffer.duration) {
            throw new Error(`Invalid audio buffer for ${config.src}`);
          }

          // Calculate clip duration
          const clipDuration = config.duration ?? audioBuffer.duration;

          // Create a single clip for this track (using createClipFromSeconds for backwards compatibility)
          // Fades now use simple duration-based API: { duration: number, type?: FadeType }
          const clip = createClipFromSeconds({
            audioBuffer,
            startTime: config.startTime ?? 0,  // Use config or default to 0
            duration: clipDuration,
            offset: config.offset ?? 0,  // Use config or no trim
            name: config.name || `Track ${index + 1}`,
            fadeIn: config.fadeIn,
            fadeOut: config.fadeOut,
          });

          // Validate clip values
          if (isNaN(clip.startSample) || isNaN(clip.durationSamples) || isNaN(clip.offsetSamples)) {
            console.error('Invalid clip values:', clip);
            throw new Error(`Invalid clip values for ${config.src}`);
          }

          // Create the track with the single clip
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
            effects: config.effects, // Add effects if provided
          };

          return track;
        });

        const loadedTracks = await Promise.all(loadPromises);

        if (!cancelled) {
          setTracks(loadedTracks);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error loading audio';
          setError(errorMessage);
          setLoading(false);
          console.error('Error loading audio tracks:', err);
        }
      }
    };

    loadTracks();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      cancelled = true;
    };
  }, [configs]);

  return { tracks, loading, error };
}
