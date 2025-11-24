import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  useWaveformPlaylist,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  MasterVolumeControl,
  TimeFormatSelect,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  AudioPosition,
  useMasterAnalyser,
  useTrackAutoWah,
  useTrackReverb,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TopBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
`;

const ControlsRow = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
`;

const VisualizerWrapper = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const VisualizerCanvas = styled.canvas`
  max-width: 100%;
  height: 100px;
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  background: var(--ifm-background-color, white);
`;

const TimeControlsBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Separator = styled.div`
  width: 1px;
  height: 2rem;
  background: var(--ifm-color-emphasis-300, #ddd);
`;

const EffectButton = styled.button<{ $active: boolean }>`
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? '#007bff' : '#6c757d'};
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$active ? '#0056b3' : '#5a6268'};
  }
`;

// Frequency visualizer component
const FrequencyVisualizer: React.FC<{ analyserRef: React.RefObject<any> }> = ({ analyserRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasAnalyser, setHasAnalyser] = useState(false);

  useEffect(() => {
    const checkAnalyser = setInterval(() => {
      if (analyserRef.current && !hasAnalyser) {
        setHasAnalyser(true);
      }
    }, 100);

    return () => clearInterval(checkAnalyser);
  }, [analyserRef, hasAnalyser]);

  useEffect(() => {
    if (!hasAnalyser || !canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [hasAnalyser, analyserRef]);

  return (
    <VisualizerCanvas ref={canvasRef} width={800} height={100} />
  );
};

// Inner component with access to playlist context
const EffectsControls: React.FC = () => {
  const { tracks, updateTrackEffect } = useWaveformPlaylist();
  const analyserRef = useMasterAnalyser();

  const track0Id = tracks[0]?.id;
  const track1Id = tracks[1]?.id;

  const [track0AutoWahEnabled, setTrack0AutoWahEnabled] = useState(false);
  const [track1ReverbEnabled, setTrack1ReverbEnabled] = useState(false);

  useTrackAutoWah(track0Id, track0AutoWahEnabled);
  useTrackReverb(track1Id, track1ReverbEnabled);

  return (
    <Container>
      <TopBar>
        <ControlsRow>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
          </ControlGroup>

          <ControlGroup>
            <MasterVolumeControl />
          </ControlGroup>

          <ControlGroup>
            <TimeFormatSelect />
          </ControlGroup>

          <ControlGroup>
            <AutomaticScrollCheckbox />
          </ControlGroup>
        </ControlsRow>

        <ControlsRow>
          <EffectButton
            $active={track0AutoWahEnabled}
            onClick={() => setTrack0AutoWahEnabled(!track0AutoWahEnabled)}
          >
            Guitar AutoWah
          </EffectButton>

          <EffectButton
            $active={track1ReverbEnabled}
            onClick={() => setTrack1ReverbEnabled(!track1ReverbEnabled)}
          >
            Piano Reverb
          </EffectButton>
        </ControlsRow>

        <VisualizerWrapper>
          <FrequencyVisualizer analyserRef={analyserRef} />
        </VisualizerWrapper>
      </TopBar>

      <Waveform />

      <TimeControlsBar>
        <ControlGroup>
          <AudioPosition />
        </ControlGroup>

        <Separator />

        <SelectionTimeInputs />
      </TimeControlsBar>
    </Container>
  );
};

export function EffectsExample() {
  const theme = useDocusaurusTheme();

  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/Guitar30.mp3',
      name: 'Guitar',
    },
    {
      src: '/waveform-playlist/media/audio/PianoSynth30.mp3',
      name: 'Piano',
    },
  ], []);

  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio tracks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        Error loading audio: {error}
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
      theme={theme}
    >
      <EffectsControls />
    </WaveformPlaylistProvider>
  );
}
