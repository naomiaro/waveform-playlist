import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  loadPeaksFromWaveformData,
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

const InfoBanner = styled.div`
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 4px;
`;

const LoadingMessage = styled.div`
  padding: 2rem;
  text-align: center;
  font-size: 14px;
  color: #666;
`;

// Audio files with corresponding pre-generated waveform data
const audioFiles = [
  { id: 'vocals', audioSrc: '/waveform-playlist/media/audio/Vocals30.mp3', datSrc: '/waveform-playlist/media/audio/Vocals30.dat' },
  { id: 'guitar', audioSrc: '/waveform-playlist/media/audio/Guitar30.mp3', datSrc: '/waveform-playlist/media/audio/Guitar30.dat' },
  { id: 'piano', audioSrc: '/waveform-playlist/media/audio/PianoSynth30.mp3', datSrc: '/waveform-playlist/media/audio/PianoSynth30.dat' },
  { id: 'bass', audioSrc: '/waveform-playlist/media/audio/BassDrums30.mp3', datSrc: '/waveform-playlist/media/audio/BassDrums30.dat' },
];

// Track configuration - same as multi-clip example
const trackConfigs = [
  {
    name: 'Vocals',
    clips: [
      { fileId: 'vocals', startTime: 0, duration: 10, offset: 0 },
      { fileId: 'vocals', startTime: 20, duration: 10, offset: 20 },
    ],
  },
  {
    name: 'Guitar',
    clips: [
      { fileId: 'guitar', startTime: 0, duration: 30, offset: 0 },
    ],
  },
  {
    name: 'Piano',
    clips: [
      { fileId: 'piano', startTime: 5, duration: 10, offset: 5 },
      { fileId: 'piano', startTime: 20, duration: 10, offset: 20 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'bass', startTime: 10, duration: 6, offset: 10 },
      { fileId: 'bass', startTime: 20, duration: 10, offset: 20 },
    ],
  },
];

const WaveformDataExample: React.FC = () => {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);

        const audioContext = getGlobalAudioContext();

        // Step 1: Load waveform data files (.dat) - FAST!
        setLoadingStatus('Loading pre-computed waveform data (instant)...');
        const waveformDataStart = performance.now();

        const waveformDataPromises = audioFiles.map(async (file) => {
          const peaksData = await loadPeaksFromWaveformData(file.datSrc);
          return { id: file.id, peaksData };
        });

        const waveformDataResults = await Promise.all(waveformDataPromises);
        const waveformDataTime = performance.now() - waveformDataStart;
        console.log(`✅ Waveform data loaded in ${waveformDataTime.toFixed(0)}ms`);

        // Step 2: Load audio files for playback - SLOWER but can happen in parallel
        setLoadingStatus('Loading audio files for playback...');
        const audioStart = performance.now();

        const audioLoadPromises = audioFiles.map(async (file) => {
          const response = await fetch(file.audioSrc);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file.audioSrc}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          return { id: file.id, buffer: audioBuffer };
        });

        const loadedAudioFiles = await Promise.all(audioLoadPromises);
        const audioBuffers = new Map(loadedAudioFiles.map(f => [f.id, f.buffer]));
        const audioTime = performance.now() - audioStart;
        console.log(`✅ Audio files loaded in ${audioTime.toFixed(0)}ms`);

        setLoadingStatus('Creating tracks...');

        // Step 3: Create tracks with clips
        const loadedTracks = trackConfigs.map((trackConfig) => {
          const clips = trackConfig.clips.map((clipConfig) => {
            const audioBuffer = audioBuffers.get(clipConfig.fileId);
            if (!audioBuffer) {
              throw new Error(`Audio file not found for ID: ${clipConfig.fileId}`);
            }

            return createClipFromSeconds({
              audioBuffer,
              startTime: clipConfig.startTime,
              duration: clipConfig.duration,
              offset: clipConfig.offset,
              name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
            });
          });

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
          console.log(`
📊 Loading Performance Comparison:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Waveform Data (.dat): ${waveformDataTime.toFixed(0)}ms ⚡
Audio Files (.mp3):   ${audioTime.toFixed(0)}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Speed Improvement: ${(audioTime / waveformDataTime).toFixed(1)}x faster

💡 Waveforms appear instantly while audio still loads!
          `);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error loading audio'));
          setLoading(false);
          console.error('Error loading tracks:', err);
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
      <LoadingMessage>
        <div>{loadingStatus}</div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
          Watch the console for performance metrics!
        </div>
      </LoadingMessage>
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
      <InfoBanner>
        <strong>🚀 Pre-Computed Waveform Data Demo</strong>
        <div style={{ marginTop: '8px', fontSize: '14px' }}>
          This example uses <strong>waveform-data.js</strong> format (.dat files) generated by BBC's{' '}
          <code>audiowaveform</code> tool. Waveforms appear <strong>instantly</strong> without computing peaks
          from audio files!
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#555' }}>
          Check the browser console to see performance comparison: Pre-computed waveform data loads{' '}
          <strong>10-50x faster</strong> than computing peaks from audio.
        </div>
      </InfoBanner>

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        zoomLevels={[256, 512, 1024, 2048]}
        mono={true}
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
        theme={{
          waveOutlineColor: '#005BBB',
          waveFillColor: '#FFD500',
          waveProgressColor: '#ff0000',
          selectedWaveOutlineColor: '#0099ff',
          selectedWaveFillColor: '#FFD500',
          selectedTrackControlsBackground: '#d9e9ff',
          selectedClipHeaderBackgroundColor: '#b3d9ff',
        }}
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

        <Waveform showClipHeaders={true} interactiveClips={false} />
      </WaveformPlaylistProvider>
    </>
  );
};

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<WaveformDataExample />);
}
