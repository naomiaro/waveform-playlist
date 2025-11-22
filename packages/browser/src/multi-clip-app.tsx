import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
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
import { Channel, CLIP_HEADER_HEIGHT, Clip, useTheme } from '@waveform-playlist/ui-components';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';

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
  const { samplesPerPixel, sampleRate, peaksDataArray, waveHeight } = usePlaylistData();
  const theme = useTheme();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fallback theme colors for DragOverlay (which renders to portal and loses context)
  // Use default theme colors from Waveform.tsx
  const themeColors = {
    waveFillColor: theme?.waveFillColor || '#FFD500',
    waveOutlineColor: theme?.waveOutlineColor || '#005BBB',
    waveProgressColor: theme?.waveProgressColor || '#ff0000',
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
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

      // Update the specific clip in this track
      const newClips = track.clips.map((clip, cIdx) => {
        if (cIdx !== clipIndex) return clip;

        // Calculate new start time, ensuring it doesn't go negative
        const newStartTime = Math.max(0, clip.startTime + timeDelta);

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

  // Get active clip info for drag overlay
  const activeClip = activeId ? (() => {
    const [trackIndexStr, clipIndexStr] = activeId.replace('clip-', '').split('-');
    const trackIndex = parseInt(trackIndexStr, 10);
    const clipIndex = parseInt(clipIndexStr, 10);
    const track = tracks[trackIndex];

    if (!track || !peaksDataArray[trackIndex]) return null;

    const clipPeaks = peaksDataArray[trackIndex][clipIndex];
    if (!clipPeaks) return null;

    return {
      clipId: clipPeaks.clipId,
      trackName: clipPeaks.trackName,
      trackIndex,
      clipIndex,
      peaks: clipPeaks.peaks,
      startTime: clipPeaks.startTime,
      duration: clipPeaks.duration,
    };
  })() : null;

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToHorizontalAxis]}
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

      <DragOverlay dropAnimation={null}>
        {activeClip ? (() => {
          // Calculate width to match Clip component's calculation
          const clipWidth = Math.floor((activeClip.duration * sampleRate) / samplesPerPixel);

          return (
            <Clip
              key={`drag-${activeClip.clipId}`}
              clipId={activeClip.clipId}
              trackIndex={activeClip.trackIndex}
              clipIndex={activeClip.clipIndex}
              trackName={activeClip.trackName}
              startTime={activeClip.startTime}
              duration={activeClip.duration}
              sampleRate={sampleRate}
              samplesPerPixel={samplesPerPixel}
              showHeader={true}
              disableHeaderDrag={true}
              isOverlay={true}
            >
              {activeClip.peaks.data.map((channelPeaks: Peaks, channelIndex: number) => (
                <Channel
                  key={channelIndex}
                  index={channelIndex}
                  data={channelPeaks}
                  bits={activeClip.peaks.bits}
                  length={clipWidth}
                  progress={0}
                  waveHeight={waveHeight}
                  waveFillColor={themeColors.waveFillColor}
                  waveOutlineColor={themeColors.waveOutlineColor}
                  waveProgressColor={themeColors.waveProgressColor}
                  devicePixelRatio={window.devicePixelRatio || 1}
                />
              ))}
            </Clip>
          );
        })() : null}
      </DragOverlay>
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
