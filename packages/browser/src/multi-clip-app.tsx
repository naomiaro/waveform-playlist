import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClip, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
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

// Audio configuration - organized by instrument track
// Each track can have multiple clips demonstrating gaps and positioning
// All source files are 30s long and musically synchronized
const audioConfigs = [
  // Vocals track - Two clips with gap in middle (cutting out 10-20s)
  {
    src: 'media/audio/Vocals30.mp3',
    name: 'Vocals',
    clips: [
      { startTime: 0, duration: 10, offset: 0 },   // 0-10s from source
      { startTime: 20, duration: 10, offset: 20 }, // 20-30s from source (10s gap)
    ],
  },

  // Guitar track - Full 30 seconds
  {
    src: 'media/audio/Guitar30.mp3',
    name: 'Guitar',
    clips: [
      { startTime: 0, duration: 30, offset: 0 }, // Continuous playback
    ],
  },

  // Piano track - Two clips with different timing
  {
    src: 'media/audio/PianoSynth30.mp3',
    name: 'Piano',
    clips: [
      { startTime: 5, duration: 10, offset: 5 },  // 5-15s from source, starts at 5s
      { startTime: 20, duration: 10, offset: 20 }, // 20-30s from source, starts at 20s
    ],
  },

  // Bass track - Three clips showing gaps
  {
    src: 'media/audio/BassDrums30.mp3',
    name: 'Bass',
    clips: [
      { startTime: 0, duration: 8, offset: 0 },   // 0-8s from source
      { startTime: 10, duration: 6, offset: 10 }, // 10-16s from source (2s gap, skipping 8-10s)
      { startTime: 20, duration: 10, offset: 20 }, // 20-30s from source (4s gap, skipping 16-20s)
    ],
  },
];

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

        // Load each track's audio file and create multiple clips
        const loadPromises = audioConfigs.map(async (config) => {
          // Fetch and decode audio file once per track
          const response = await fetch(config.src);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${config.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Create multiple clips from the clips array
          const clips = config.clips.map((clipConfig) =>
            createClip({
              audioBuffer,
              startTime: clipConfig.startTime,
              duration: clipConfig.duration,
              offset: clipConfig.offset,
              name: `${config.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
            })
          );

          // Create the track with multiple clips
          return createTrack({
            name: config.name,
            clips,
            muted: false,
            soloed: false,
            volume: 1.0,
            pan: 0,
          });
        });

        const loadedTracks = await Promise.all(loadPromises);

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
    <>
      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        mono={true}
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
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

        <Waveform />
      </WaveformPlaylistProvider>
    </>
  );
};

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<MultiClipExample />);
}
