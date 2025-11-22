import React, { useRef, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  useWaveformPlaylist,
} from './WaveformPlaylistContext';
import {
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  MasterVolumeControl,
  TimeFormatSelect,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  AudioPosition,
} from './components';
import { useMasterAnalyser, useTrackAutoWah, useTrackReverb } from './hooks/useAudioEffects';
import { useAudioTracks } from './hooks';

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
  background: #f5f5f5;
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
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  background: white;
`;

const TimeControlsBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #f5f5f5;
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
  background: #ddd;
`;

// Frequency visualizer component that polls for analyser
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

const EffectsApp: React.FC = () => {
  // Use custom hooks for effects
  const { analyserRef, masterEffects } = useMasterAnalyser(256);
  const autoWahEffect = useTrackAutoWah({ baseFrequency: 50, octaves: 6, sensitivity: -30 });
  const guitarReverbEffect = useTrackReverb(1.2);
  const drumsReverbEffect = useTrackReverb(5);

  // To chain multiple effects together, use useEffectsChain:
  // const reverbEffect = useTrackReverb(2.0);
  // const autoWahEffect2 = useTrackAutoWah({ baseFrequency: 100 });
  // const chainedEffect = useEffectsChain([reverbEffect, autoWahEffect2]);

  // Track configurations with effects - useMemo to prevent re-creating on every render
  const audioConfigs = React.useMemo(() => [
    {
      src: 'media/audio/Vocals30.mp3',
      name: 'Vocals',
      effects: autoWahEffect,
    },
    {
      src: 'media/audio/Guitar30.mp3',
      name: 'Guitar',
      effects: guitarReverbEffect,
    },
    {
      src: 'media/audio/PianoSynth30.mp3',
      name: 'Pianos & Synth',
    },
    {
      src: 'media/audio/BassDrums30.mp3',
      name: 'Drums',
      effects: drumsReverbEffect,
    },
  ], [autoWahEffect, guitarReverbEffect, drumsReverbEffect]);

  // Load audio tracks and convert to ClipTrack format
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return <Container><div style={{ padding: '2rem', textAlign: 'center' }}>Loading audio tracks...</div></Container>;
  }

  if (error) {
    return <Container><div style={{ padding: '2rem', color: 'red' }}>Error loading audio: {error}</div></Container>;
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      colors={{
        waveOutlineColor: '#005BBB',
        waveFillColor: '#FFD500',
      }}
      controls={{ show: true, width: 150 }}
      isAutomaticScroll={true}
      timescale={true}
      zoomLevels={[500, 1000, 3000, 5000]}
      effects={masterEffects}
    >
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
    </WaveformPlaylistProvider>
  );
};

// Initialize the app
const container = document.getElementById('effects-app');
if (container) {
  const root = createRoot(container);
  root.render(<EffectsApp />);
}
