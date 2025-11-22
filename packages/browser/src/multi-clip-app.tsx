import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClip, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  usePlaylistData,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
} from './index';

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  padding-right: 15px;
  border-right: 1px solid #ddd;

  &:last-child {
    border-right: none;
  }
`;


// Audio files - each file is loaded and decoded once
// Files can be referenced by multiple clips across different tracks
const audioFiles = [
  { id: 'vocals', src: 'media/audio/Vocals30.mp3' },
  { id: 'guitar', src: 'media/audio/Guitar30.mp3' },
  { id: 'piano', src: 'media/audio/PianoSynth30.mp3' },
  { id: 'bass', src: 'media/audio/BassDrums30.mp3' },
];

// Track configuration - organized by instrument track
// Each track can have multiple clips demonstrating gaps and positioning
// All source files are 30s long and musically synchronized
const trackConfigs = [
  // Vocals track - Two clips with gap in middle (cutting out 10-20s)
  {
    name: 'Vocals',
    clips: [
      { fileId: 'vocals', startTime: 0, duration: 10, offset: 0 },   // 0-10s from source
      { fileId: 'vocals', startTime: 20, duration: 10, offset: 20 }, // 20-30s from source (10s gap)
    ],
  },

  // Guitar track - Full 30 seconds
  {
    name: 'Guitar',
    clips: [
      { fileId: 'guitar', startTime: 0, duration: 30, offset: 0 }, // Continuous playback
    ],
  },

  // Piano track - Two clips with different timing
  {
    name: 'Piano',
    clips: [
      { fileId: 'piano', startTime: 5, duration: 10, offset: 5 },  // 5-15s from source, starts at 5s
      { fileId: 'piano', startTime: 20, duration: 10, offset: 20 }, // 20-30s from source, starts at 20s
    ],
  },

  // Bass track - Three clips showing gaps
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 0, duration: 8, offset: 0 },   // 0-8s from source
      { fileId: 'bass', startTime: 10, duration: 6, offset: 10 }, // 10-16s from source (2s gap, skipping 8-10s)
      { fileId: 'bass', startTime: 20, duration: 10, offset: 20 }, // 20-30s from source (4s gap, skipping 16-20s)
    ],
  },
];

// Inner component that handles drag events and has access to playlist context
interface PlaylistWithDragProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}

const PlaylistWithDrag: React.FC<PlaylistWithDragProps> = ({ tracks, onTracksChange }) => {
  const { samplesPerPixel, sampleRate } = usePlaylistData();

  // Custom modifier for real-time collision detection during drag
  const collisionModifier = React.useCallback((args: { transform: { x: number; y: number }; active: any }) => {
    const { transform, active } = args;

    if (!active?.data?.current) return transform;

    const { trackIndex, clipIndex } = active.data.current as {
      clipId: string;
      trackIndex: number;
      clipIndex: number;
    };

    const track = tracks[trackIndex];
    if (!track) return transform;

    const clip = track.clips[clipIndex];
    if (!clip) return transform;

    // Convert pixel delta to time delta
    const timeDelta = (transform.x * samplesPerPixel) / sampleRate;
    let newStartTime = clip.startTime + timeDelta;

    // Get sorted clips for collision detection
    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const sortedIndex = sortedClips.findIndex(c => c === clip);

    // Constraint 1: Cannot go before time 0
    newStartTime = Math.max(0, newStartTime);

    // Constraint 2: Cannot overlap with previous clip
    const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
    if (previousClip) {
      const previousEndTime = previousClip.startTime + previousClip.duration;
      newStartTime = Math.max(newStartTime, previousEndTime);
    }

    // Constraint 3: Cannot overlap with next clip
    const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
    if (nextClip) {
      const newEndTime = newStartTime + clip.duration;
      if (newEndTime > nextClip.startTime) {
        newStartTime = nextClip.startTime - clip.duration;
      }
    }

    // Convert constrained time back to pixel delta
    const constrainedTimeDelta = newStartTime - clip.startTime;
    const constrainedX = (constrainedTimeDelta * sampleRate) / samplesPerPixel;

    return {
      ...transform,
      x: constrainedX,
    };
  }, [tracks, samplesPerPixel, sampleRate]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    // Extract clip metadata from drag data
    const { trackIndex, clipIndex } = active.data.current as {
      clipId: string;
      trackIndex: number;
      clipIndex: number;
    };

    // Convert pixel delta to time (seconds)
    const timeDelta = (delta.x * samplesPerPixel) / sampleRate;

    // Create new tracks array with updated clip position
    const newTracks = tracks.map((track, tIdx) => {
      if (tIdx !== trackIndex) return track;

      // Get sorted clips for collision detection
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      const sortedIndex = sortedClips.findIndex(clip => clip === track.clips[clipIndex]);

      // Update the specific clip in this track
      const newClips = track.clips.map((clip, cIdx) => {
        if (cIdx !== clipIndex) return clip;

        // Calculate desired new start time
        let newStartTime = clip.startTime + timeDelta;

        // Collision detection constraints:
        // 1. Cannot go before time 0
        newStartTime = Math.max(0, newStartTime);

        // 2. Cannot overlap with previous clip
        const previousClip = sortedIndex > 0 ? sortedClips[sortedIndex - 1] : null;
        if (previousClip) {
          const previousEndTime = previousClip.startTime + previousClip.duration;
          newStartTime = Math.max(newStartTime, previousEndTime);
        }

        // 3. Cannot overlap with next clip
        const nextClip = sortedIndex < sortedClips.length - 1 ? sortedClips[sortedIndex + 1] : null;
        if (nextClip) {
          const newEndTime = newStartTime + clip.duration;
          if (newEndTime > nextClip.startTime) {
            // Push back to be adjacent to next clip
            newStartTime = nextClip.startTime - clip.duration;
          }
        }

        return {
          ...clip,
          startTime: newStartTime,
        };
      });

      return {
        ...track,
        clips: newClips,
      };
    });

    onTracksChange(newTracks);
  };

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      modifiers={[restrictToHorizontalAxis, collisionModifier]}
    >
      <Controls>
        <ControlGroup>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </ControlGroup>
        <ControlGroup>
          <ZoomInButton />
          <ZoomOutButton />
        </ControlGroup>
        <ControlGroup>
          <AudioPosition />
        </ControlGroup>
        <ControlGroup>
          <AutomaticScrollCheckbox />
        </ControlGroup>
        <ControlGroup>
          <MasterVolumeControl />
        </ControlGroup>
      </Controls>

      <Waveform showClipHeaders={true} />
    </DndContext>
  );
};

const MultiClipExample: React.FC = () => {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);

        const audioContext = getGlobalAudioContext();

        // Step 1: Load all audio files once and store in a Map by ID
        const fileLoadPromises = audioFiles.map(async (file) => {
          const response = await fetch(file.src);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          return { id: file.id, buffer: audioBuffer };
        });

        const loadedFiles = await Promise.all(fileLoadPromises);
        const fileBuffers = new Map(loadedFiles.map(f => [f.id, f.buffer]));

        // Step 2: Create tracks by referencing loaded audio buffers
        const loadedTracks = trackConfigs.map((trackConfig) => {
          // Create clips by looking up the audio buffer for each fileId
          const clips = trackConfig.clips.map((clipConfig) => {
            const audioBuffer = fileBuffers.get(clipConfig.fileId);
            if (!audioBuffer) {
              throw new Error(`Audio file not found for ID: ${clipConfig.fileId}`);
            }

            return createClip({
              audioBuffer,
              startTime: clipConfig.startTime,
              duration: clipConfig.duration,
              offset: clipConfig.offset,
              name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
            });
          });

          // Create the track with multiple clips
          return createTrack({
            name: trackConfig.name,
            clips,
            muted: false,
            soloed: false,
            volume: 1.0,
            pan: 0,
          });
        });

        if (!cancelled) {
          setTracks(loadedTracks);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error loading audio'));
          setLoading(false);
          console.error('Error loading audio tracks:', err);
        }
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio tracks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        Error loading audio: {error.message}
      </div>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      mono={true}
      waveHeight={100}
      automaticScroll={true}
      controls={{ show: true, width: 200 }}
      theme={{
        waveOutlineColor: '#005BBB',
        waveFillColor: '#FFD500',
        waveProgressColor: '#ff0000',
      }}
    >
      <PlaylistWithDrag tracks={tracks} onTracksChange={setTracks} />
    </WaveformPlaylistProvider>
  );
};

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<MultiClipExample />);
}
