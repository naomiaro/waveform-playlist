import { useState, useEffect } from 'react';
import { ClipTrack, createTrack, createClip } from '@waveform-playlist/core';
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
  effects?: any; // TrackEffectsFunction
}

/**
 * Hook to load audio from URLs and convert to ClipTrack format
 *
 * This hook fetches audio files, decodes them, and creates ClipTrack objects
 * with a single clip per track (positioned at startTime: 0).
 *
 * @param configs - Array of audio track configurations
 * @returns Object with tracks array and loading state
 *
 * @example
 * ```typescript
 * const { tracks, loading, error } = useAudioTracks([
 *   { src: 'audio/vocals.mp3', name: 'Vocals' },
 *   { src: 'audio/drums.mp3', name: 'Drums' },
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

          // Create a single clip for this track
          const clip = createClip({
            audioBuffer,
            startTime: 0,  // Single clip starts at beginning
            duration: audioBuffer.duration,  // Full duration
            offset: 0,  // No trim
            name: config.name || `Track ${index + 1}`,
          });

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
