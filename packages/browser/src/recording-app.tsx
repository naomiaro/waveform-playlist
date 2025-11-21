/**
 * Recording Example App
 *
 * Demonstrates the AudioWorklet-based recording functionality
 */

import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import {
  useRecording,
  useMicrophoneAccess,
  RecordButton,
  MicrophoneSelector,
  RecordingIndicator,
} from '@waveform-playlist/recording';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  StopButton,
  AudioPosition,
} from './components';
import { Track } from '@waveform-playlist/core';
import * as Tone from 'tone';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const ControlPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Section = styled.section`
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #2c3e50;
`;

const Subtitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
  color: #34495e;
`;

const TrackList = styled.div`
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  padding: 1rem;
  min-height: 100px;
`;

const TrackItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #e9ecef;

  &:last-child {
    border-bottom: none;
  }
`;

const TrackInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const TrackName = styled.span`
  font-weight: 500;
  color: #2c3e50;
`;

const TrackDuration = styled.span`
  font-size: 0.875rem;
  color: #6c757d;
`;

const DeleteButton = styled.button`
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #dc3545;
  border-radius: 0.25rem;
  background: white;
  color: #dc3545;
  cursor: pointer;

  &:hover {
    background: #dc3545;
    color: white;
  }
`;

const InfoBox = styled.div`
  padding: 1rem;
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  border-radius: 0.25rem;
  color: #0c5460;
  margin-bottom: 1rem;
`;

const PlaybackControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
`;

function RecordingApp() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>();
  const recordingCountRef = useRef(1);

  // Microphone access
  const { stream, devices, hasPermission, requestAccess, error: micError } = useMicrophoneAccess();

  // Recording
  const {
    isRecording,
    duration,
    peaks,
    audioBuffer,
    startRecording,
    stopRecording,
    error: recordError,
  } = useRecording(stream, {
    samplesPerPixel: 1024,
  });

  // Handle device selection
  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    await requestAccess(deviceId);
  };

  // Handle recording start/stop
  const handleRecordToggle = async () => {
    if (isRecording) {
      const buffer = await stopRecording();
      if (buffer) {
        // Add recorded track to playlist
        const newTrack: Track = {
          src: buffer,
          name: `Recording ${recordingCountRef.current}`,
          gain: 1,
          muted: false,
          stereoPan: 0,
        };
        setTracks([...tracks, newTrack]);
        recordingCountRef.current += 1;
      }
    } else {
      if (!hasPermission) {
        await requestAccess(selectedDevice);
      }
      await startRecording();
    }
  };

  // Handle track deletion
  const handleDeleteTrack = (index: number) => {
    setTracks(tracks.filter((_, i) => i !== index));
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const error = micError || recordError;

  return (
    <Container>
      <Section>
        <Title>Audio Recording with AudioWorklet</Title>
        <InfoBox>
          <p>
            <strong>Note:</strong> This example requires HTTPS or localhost. Make sure to grant
            microphone permissions when prompted.
          </p>
        </InfoBox>

        {error && (
          <InfoBox style={{ background: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' }}>
            <strong>Error:</strong> {error.message}
          </InfoBox>
        )}

        <ControlPanel>
          <MicrophoneSelector
            devices={devices}
            selectedDeviceId={selectedDevice}
            onDeviceChange={handleDeviceChange}
            disabled={isRecording}
          />

          <RecordButton
            isRecording={isRecording}
            onClick={handleRecordToggle}
            disabled={!hasPermission && !stream && devices.length === 0}
          />

          <RecordingIndicator isRecording={isRecording} duration={duration} />
        </ControlPanel>
      </Section>

      <Section>
        <Subtitle>Recorded Tracks ({tracks.length})</Subtitle>
        <TrackList>
          {tracks.length === 0 ? (
            <p style={{ color: '#6c757d', textAlign: 'center', margin: '2rem 0' }}>
              No recordings yet. Click the Record button to start recording.
            </p>
          ) : (
            tracks.map((track, index) => (
              <TrackItem key={index}>
                <TrackInfo>
                  <TrackName>{track.name}</TrackName>
                  <TrackDuration>
                    {typeof track.src === 'string'
                      ? 'Unknown duration'
                      : formatDuration(track.src.duration)}
                  </TrackDuration>
                </TrackInfo>
                <DeleteButton onClick={() => handleDeleteTrack(index)}>Delete</DeleteButton>
              </TrackItem>
            ))
          )}
        </TrackList>
      </Section>

      {tracks.length > 0 && (
        <Section>
          <Subtitle>Playback</Subtitle>
          <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
            <PlaybackControls>
              <PlayButton />
              <StopButton />
              <AudioPosition />
            </PlaybackControls>
            <Waveform />
          </WaveformPlaylistProvider>
        </Section>
      )}
    </Container>
  );
}

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<RecordingApp />);
}
