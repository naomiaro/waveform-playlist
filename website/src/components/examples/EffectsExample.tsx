import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
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

// Frequency visualizer component that polls for Tone.js analyser
const FrequencyVisualizer: React.FC<{ analyserRef: React.RefObject<any> }> = ({ analyserRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasAnalyser, setHasAnalyser] = useState(false);

  // Poll for analyser availability
  useEffect(() => {
    const checkAnalyser = setInterval(() => {
      if (analyserRef.current && !hasAnalyser) {
        setHasAnalyser(true);
      }
    }, 100);

    return () => clearInterval(checkAnalyser);
  }, [analyserRef, hasAnalyser]);

  useEffect(() => {
    if (!canvasRef.current || !hasAnalyser || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const scale = Math.floor(window.devicePixelRatio);

    canvasCtx.scale(scale, scale);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (!analyserRef.current) return;

      // Tone.js Analyser uses getValue() which returns Float32Array of dB values
      const dataArray = analyserRef.current.getValue();
      const bufferLength = dataArray.length;

      canvasCtx.fillStyle = 'rgb(255, 255, 255)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = WIDTH / scale / bufferLength - 1;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Tone.Analyser FFT mode returns dB values (typically -100 to 0)
        // Normalize to 0-255 range
        const dbValue = dataArray[i];
        const normalized = Math.max(0, Math.min(255, (dbValue + 100) * 2.55));
        const barHeight = normalized / 2 / scale;

        canvasCtx.fillStyle = `rgb(${barHeight + 100},50,50)`;
        canvasCtx.fillRect(x, HEIGHT / scale - barHeight / 2, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [analyserRef, hasAnalyser]);

  return <VisualizerCanvas ref={canvasRef} width={1000} height={100} />;
};

// Inner component that renders controls and waveform
const EffectsControls: React.FC<{ analyserRef: React.RefObject<any> }> = ({ analyserRef }) => {
  return (
    <Container>
      <TopBar>
        <ControlsRow>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <MasterVolumeControl />
          <AutomaticScrollCheckbox />
        </ControlsRow>
        <VisualizerWrapper>
          <FrequencyVisualizer analyserRef={analyserRef} />
        </VisualizerWrapper>
      </TopBar>

      <Waveform />

      <TimeControlsBar>
        <ControlGroup>
          <TimeFormatSelect />
        </ControlGroup>

        <Separator />

        <ControlGroup>
          <SelectionTimeInputs />
        </ControlGroup>

        <Separator />

        <ControlGroup>
          <AudioPosition />
        </ControlGroup>
      </TimeControlsBar>
    </Container>
  );
};

export function EffectsExample() {
  const theme = useDocusaurusTheme();

  // Create master effects with frequency analyzer
  const { analyserRef, masterEffects } = useMasterAnalyser(256);

  // Create per-track effects
  const autoWahEffect = useTrackAutoWah({ baseFrequency: 50, octaves: 6, sensitivity: -30 });
  const guitarReverbEffect = useTrackReverb(1.2);
  const drumsReverbEffect = useTrackReverb(5);

  // Track configurations with effects
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/Vocals30.mp3',
      name: 'Vocals',
      effects: autoWahEffect,
    },
    {
      src: '/waveform-playlist/media/audio/Guitar30.mp3',
      name: 'Guitar',
      effects: guitarReverbEffect,
    },
    {
      src: '/waveform-playlist/media/audio/PianoSynth30.mp3',
      name: 'Pianos & Synth',
    },
    {
      src: '/waveform-playlist/media/audio/BassDrums30.mp3',
      name: 'Drums',
      effects: drumsReverbEffect,
    },
  ], [autoWahEffect, guitarReverbEffect, drumsReverbEffect]);

  // Load audio tracks
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading audio tracks...
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {error}
        </div>
      </Container>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      theme={theme}
      controls={{ show: true, width: 150 }}
      automaticScroll={true}
      timescale={true}
      effects={masterEffects}
    >
      <EffectsControls analyserRef={analyserRef} />
    </WaveformPlaylistProvider>
  );
}
