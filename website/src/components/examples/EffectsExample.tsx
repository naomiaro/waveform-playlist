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
  useDynamicEffects,
  useTrackDynamicEffects,
  useAudioTracks,
  usePlaylistData,
  usePlaylistControls,
} from '@waveform-playlist/browser';
import {
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
} from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { EffectRack, TrackEffectControls } from '../effects';
import type { UseTrackDynamicEffectsReturn } from '@waveform-playlist/browser';

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
  height: 120px;
  border-radius: 0.5rem;
  background: linear-gradient(180deg,
    var(--ifm-background-color, #1a1a2e) 0%,
    var(--ifm-background-surface-color, #16213e) 100%);
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.3);
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
interface FrequencyVisualizerProps {
  analyserRef: React.RefObject<any>;
  isDarkMode?: boolean;
}

const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({ analyserRef, isDarkMode = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasAnalyser, setHasAnalyser] = useState(false);
  const gradientRef = useRef<CanvasGradient | null>(null);

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
    const scaledWidth = WIDTH / scale;
    const scaledHeight = HEIGHT / scale;

    // Reset transform and scale
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.scale(scale, scale);

    // Create gradient for bars (vertical gradient from bottom to top)
    const barGradient = canvasCtx.createLinearGradient(0, scaledHeight, 0, 0);
    if (isDarkMode) {
      // Vibrant colors for dark mode
      barGradient.addColorStop(0, '#00d4ff');    // Cyan at bottom
      barGradient.addColorStop(0.3, '#00ff88');  // Green
      barGradient.addColorStop(0.5, '#ffff00');  // Yellow
      barGradient.addColorStop(0.7, '#ff8800');  // Orange
      barGradient.addColorStop(1, '#ff0066');    // Pink/Red at top
    } else {
      // Softer colors for light mode
      barGradient.addColorStop(0, '#0088cc');    // Blue at bottom
      barGradient.addColorStop(0.3, '#00aa66');  // Green
      barGradient.addColorStop(0.5, '#ccaa00');  // Yellow/Gold
      barGradient.addColorStop(0.7, '#cc6600');  // Orange
      barGradient.addColorStop(1, '#cc0044');    // Red at top
    }
    gradientRef.current = barGradient;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (!analyserRef.current) return;

      // Tone.js Analyser uses getValue() which returns Float32Array of dB values
      const dataArray = analyserRef.current.getValue();
      const bufferLength = dataArray.length;

      // Clear with theme-aware background
      if (isDarkMode) {
        // Dark gradient background
        const bgGradient = canvasCtx.createLinearGradient(0, 0, 0, scaledHeight);
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(1, '#16213e');
        canvasCtx.fillStyle = bgGradient;
      } else {
        // Light gradient background
        const bgGradient = canvasCtx.createLinearGradient(0, 0, 0, scaledHeight);
        bgGradient.addColorStop(0, '#f8f9fa');
        bgGradient.addColorStop(1, '#e9ecef');
        canvasCtx.fillStyle = bgGradient;
      }
      canvasCtx.fillRect(0, 0, scaledWidth, scaledHeight);

      // Draw subtle grid lines
      canvasCtx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
      canvasCtx.lineWidth = 1;
      for (let y = 0; y < scaledHeight; y += 20) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, y);
        canvasCtx.lineTo(scaledWidth, y);
        canvasCtx.stroke();
      }

      const barWidth = (scaledWidth / bufferLength) * 2.5;
      const gap = 1;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Tone.Analyser FFT mode returns dB values (typically -100 to 0)
        // Normalize to 0-1 range
        const dbValue = dataArray[i];
        const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
        const barHeight = normalized * scaledHeight * 0.9;

        if (barHeight > 1) {
          // Draw bar with gradient
          canvasCtx.fillStyle = gradientRef.current!;

          // Add slight glow effect in dark mode
          if (isDarkMode && barHeight > 20) {
            canvasCtx.shadowColor = 'rgba(0, 212, 255, 0.5)';
            canvasCtx.shadowBlur = 8;
          } else {
            canvasCtx.shadowBlur = 0;
          }

          // Draw rounded bar
          const barX = x;
          const barY = scaledHeight - barHeight;
          const radius = Math.min(barWidth / 2, 3);

          canvasCtx.beginPath();
          canvasCtx.moveTo(barX + radius, barY);
          canvasCtx.lineTo(barX + barWidth - radius, barY);
          canvasCtx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
          canvasCtx.lineTo(barX + barWidth, scaledHeight);
          canvasCtx.lineTo(barX, scaledHeight);
          canvasCtx.lineTo(barX, barY + radius);
          canvasCtx.quadraticCurveTo(barX, barY, barX + radius, barY);
          canvasCtx.fill();

          // Reset shadow
          canvasCtx.shadowBlur = 0;
        }

        x += barWidth + gap;
        if (x > scaledWidth) break;
      }

      // Add reflection effect at bottom
      const reflectionGradient = canvasCtx.createLinearGradient(0, scaledHeight - 10, 0, scaledHeight);
      reflectionGradient.addColorStop(0, 'transparent');
      reflectionGradient.addColorStop(1, isDarkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)');
      canvasCtx.fillStyle = reflectionGradient;
      canvasCtx.fillRect(0, scaledHeight - 10, scaledWidth, 10);
    };

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [analyserRef, hasAnalyser, isDarkMode]);

  return <VisualizerCanvas ref={canvasRef} width={1000} height={120} />;
};

// Custom track controls component that includes effects
interface CustomTrackControlsProps {
  trackIndex: number;
  trackEffectsManager: UseTrackDynamicEffectsReturn;
}

const CustomTrackControls: React.FC<CustomTrackControlsProps> = ({
  trackIndex,
  trackEffectsManager,
}) => {
  const { tracks, trackStates } = usePlaylistData();
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan } = usePlaylistControls();

  const trackState = trackStates[trackIndex] || {
    name: `Track ${trackIndex + 1}`,
    muted: false,
    soloed: false,
    volume: 1.0,
    pan: 0,
  };

  const track = tracks[trackIndex];
  const trackId = track?.id || `track-${trackIndex}`;

  return (
    <Controls>
      <Header style={{ justifyContent: 'center' }}>
        {trackState.name || `Track ${trackIndex + 1}`}
      </Header>
      <ButtonGroup>
        <Button
          $variant={trackState.muted ? 'danger' : 'outline'}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
        >
          Mute
        </Button>
        <Button
          $variant={trackState.soloed ? 'info' : 'outline'}
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
        >
          Solo
        </Button>
      </ButtonGroup>
      <SliderWrapper>
        <VolumeDownIcon />
        <Slider
          min="0"
          max="1"
          step="0.01"
          value={trackState.volume}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
        />
        <VolumeUpIcon />
      </SliderWrapper>
      <SliderWrapper>
        <span>L</span>
        <Slider
          min="-1"
          max="1"
          step="0.01"
          value={trackState.pan}
          onChange={(e) => setTrackPan(trackIndex, parseFloat(e.target.value))}
        />
        <span>R</span>
      </SliderWrapper>
      <TrackEffectControls
        trackId={trackId}
        trackName={trackState.name || `Track ${trackIndex + 1}`}
        effectsManager={trackEffectsManager}
      />
    </Controls>
  );
};

// Inner component that renders controls and waveform
interface EffectsControlsProps {
  analyserRef: React.RefObject<any>;
  trackEffectsManager: UseTrackDynamicEffectsReturn;
  isDarkMode: boolean;
}

const EffectsControls: React.FC<EffectsControlsProps> = ({ analyserRef, trackEffectsManager, isDarkMode }) => {
  // Render custom track controls using the track effects manager
  const renderTrackControls = (trackIndex: number) => (
    <CustomTrackControls
      trackIndex={trackIndex}
      trackEffectsManager={trackEffectsManager}
    />
  );

  return (
    <>
      <TopBar>
        <ControlsRow>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <MasterVolumeControl />
          <AutomaticScrollCheckbox />
        </ControlsRow>
        <VisualizerWrapper>
          <FrequencyVisualizer analyserRef={analyserRef} isDarkMode={isDarkMode} />
        </VisualizerWrapper>
      </TopBar>

      <Waveform timescale renderTrackControls={renderTrackControls} />

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
    </>
  );
};

export function EffectsExample() {
  const { theme, isDarkMode } = useDocusaurusTheme();
  const defaultsAddedRef = useRef(false);

  // Create dynamic effects manager for master effects
  const effectsManager = useDynamicEffects(256);
  const { analyserRef, masterEffects, addEffect: addMasterEffect } = effectsManager;

  // Create track effects manager
  const trackEffectsManager = useTrackDynamicEffects();
  const { addEffectToTrack } = trackEffectsManager;

  // Track configurations
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/Vocals30.mp3',
      name: 'Vocals',
    },
    {
      src: '/waveform-playlist/media/audio/Guitar30.mp3',
      name: 'Guitar',
    },
    {
      src: '/waveform-playlist/media/audio/PianoSynth30.mp3',
      name: 'Pianos & Synth',
    },
    {
      src: '/waveform-playlist/media/audio/BassDrums30.mp3',
      name: 'Drums',
    },
  ], []);

  // Load audio tracks
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  // Add default effects on mount (only once)
  useEffect(() => {
    if (!loading && tracks.length > 0 && !defaultsAddedRef.current) {
      defaultsAddedRef.current = true;

      // Add a reverb to the master effects chain
      addMasterEffect('reverb');

      // Add effects to individual tracks for demonstration
      // Vocals: Reverb for spaciousness
      addEffectToTrack(tracks[0].id, 'reverb');

      // Guitar: Chorus for richness
      addEffectToTrack(tracks[1].id, 'chorus');

      // Pianos & Synth: Ping Pong Delay
      addEffectToTrack(tracks[2].id, 'pingPongDelay');

      // Drums: Compressor for punch
      addEffectToTrack(tracks[3].id, 'compressor');
    }
  }, [loading, tracks, addMasterEffect, addEffectToTrack]);

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
    <Container>
      <EffectRack effectsManager={effectsManager} />

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        waveHeight={100}
        theme={theme}
        controls={{ show: true, width: 150 }}
        automaticScroll={true}
        effects={masterEffects}
      >
        <EffectsControls
          analyserRef={analyserRef}
          trackEffectsManager={trackEffectsManager}
          isDarkMode={isDarkMode}
        />
      </WaveformPlaylistProvider>
    </Container>
  );
}
