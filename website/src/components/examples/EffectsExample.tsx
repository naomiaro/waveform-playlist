import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { XIcon } from '@phosphor-icons/react';
import JSZip from 'jszip';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';
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
  ZoomInButton,
  ZoomOutButton,
  ExportWavButton,
  useDynamicEffects,
  useTrackDynamicEffects,
  useAudioTracks,
  usePlaylistData,
  usePlaylistControls,
  useExportWav,
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
  BaseControlButton,
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
  border-radius: 2px;
  background: linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
  border: 1px solid #2a2a2a;
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

const ExportOptionsWrapper = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
`;

const ExportSelect = styled.select`
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  background: var(--ifm-background-color, #fff);
  color: var(--ifm-color-content, #333);
  font-size: 0.875rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--ifm-color-primary, #3578e5);
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--ifm-color-content, #333);
  cursor: pointer;
  white-space: nowrap;
`;

const Separator = styled.div`
  width: 1px;
  height: 2rem;
  background: var(--ifm-color-emphasis-300, #ddd);
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 2rem;
  border: 2px dashed ${props => props.$isDragging ? 'var(--ifm-color-primary, #3578e5)' : 'var(--ifm-color-emphasis-300, #ddd)'};
  border-radius: 0.5rem;
  background: ${props => props.$isDragging ? 'var(--ifm-color-primary-lightest, #e6f0ff)' : 'var(--ifm-background-surface-color, #f5f5f5)'};
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  margin-top: 1rem;

  &:hover {
    border-color: var(--ifm-color-primary, #3578e5);
    background: var(--ifm-color-emphasis-100, #f0f0f0);
  }
`;

const DropZoneText = styled.span`
  font-size: 1rem;
  font-weight: 500;
  color: var(--ifm-color-content, #333);
`;

const DropZoneHint = styled.span`
  font-size: 0.875rem;
  color: var(--ifm-color-content-secondary, #666);
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const DeleteButton = styled.button`
  position: absolute;
  top: 4px;
  left: 4px;
  background: var(--ifm-color-danger, #dc3545);
  color: white;
  border: none;
  border-radius: 3px;
  padding: 0;
  width: 16px;
  height: 16px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s;

  &:hover {
    opacity: 1;
    background: var(--ifm-color-danger-dark, #c82333);
  }
`;

const ControlsWrapper = styled.div`
  position: relative;
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
    // Berlin underground / Ampelmännchen color palette
    const barGradient = canvasCtx.createLinearGradient(0, scaledHeight, 0, 0);
    if (isDarkMode) {
      // Industrial Berlin palette - green to amber to red
      barGradient.addColorStop(0, '#2d4a2d');    // Dark green at bottom (quiet)
      barGradient.addColorStop(0.3, '#63C75F');  // Ampelmännchen green
      barGradient.addColorStop(0.5, '#8fa563');  // Olive transition
      barGradient.addColorStop(0.7, '#c49a6c');  // Warm amber
      barGradient.addColorStop(0.85, '#d08070'); // Muted red
      barGradient.addColorStop(1, '#a85050');    // Deep red at top (loud/clipping)
    } else {
      // Light mode - similar palette, slightly muted
      barGradient.addColorStop(0, '#4a6b4a');    // Muted green at bottom
      barGradient.addColorStop(0.3, '#5ab354');  // Green
      barGradient.addColorStop(0.5, '#7a9a5a');  // Olive
      barGradient.addColorStop(0.7, '#b08860');  // Amber
      barGradient.addColorStop(0.85, '#c07060'); // Coral
      barGradient.addColorStop(1, '#a05050');    // Deep red at top
    }
    gradientRef.current = barGradient;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (!analyserRef.current) return;

      // Tone.js Analyser uses getValue() which returns Float32Array of dB values
      const dataArray = analyserRef.current.getValue();
      const bufferLength = dataArray.length;

      // Clear with theme-aware background - industrial dark aesthetic
      if (isDarkMode) {
        // Dark industrial gradient
        const bgGradient = canvasCtx.createLinearGradient(0, 0, 0, scaledHeight);
        bgGradient.addColorStop(0, '#0d0d0d');
        bgGradient.addColorStop(1, '#1a1a1a');
        canvasCtx.fillStyle = bgGradient;
      } else {
        // Light mode - still dark for the visualizer
        const bgGradient = canvasCtx.createLinearGradient(0, 0, 0, scaledHeight);
        bgGradient.addColorStop(0, '#1a1a1a');
        bgGradient.addColorStop(1, '#252525');
        canvasCtx.fillStyle = bgGradient;
      }
      canvasCtx.fillRect(0, 0, scaledWidth, scaledHeight);

      // Draw subtle horizontal grid lines (industrial look)
      canvasCtx.strokeStyle = 'rgba(99, 199, 95, 0.08)'; // Subtle green tint
      canvasCtx.lineWidth = 1;
      for (let y = 0; y < scaledHeight; y += 20) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, y);
        canvasCtx.lineTo(scaledWidth, y);
        canvasCtx.stroke();
      }

      // Draw vertical grid lines for frequency bands
      canvasCtx.strokeStyle = 'rgba(99, 199, 95, 0.05)';
      for (let x = 0; x < scaledWidth; x += 50) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(x, 0);
        canvasCtx.lineTo(x, scaledHeight);
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

          // Add slight glow effect in dark mode - green tint for Berlin vibe
          if (isDarkMode && barHeight > 20) {
            canvasCtx.shadowColor = 'rgba(99, 199, 95, 0.4)';
            canvasCtx.shadowBlur = 6;
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

      // Add floor reflection effect - industrial look
      const reflectionGradient = canvasCtx.createLinearGradient(0, scaledHeight - 8, 0, scaledHeight);
      reflectionGradient.addColorStop(0, 'transparent');
      reflectionGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      canvasCtx.fillStyle = reflectionGradient;
      canvasCtx.fillRect(0, scaledHeight - 8, scaledWidth, 8);

      // Add subtle top edge highlight
      canvasCtx.strokeStyle = 'rgba(99, 199, 95, 0.15)';
      canvasCtx.lineWidth = 1;
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, 0.5);
      canvasCtx.lineTo(scaledWidth, 0.5);
      canvasCtx.stroke();
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
  onDeleteTrack: (trackIndex: number) => void;
}

const CustomTrackControls: React.FC<CustomTrackControlsProps> = ({
  trackIndex,
  trackEffectsManager,
  onDeleteTrack,
}) => {
  const { tracks, trackStates } = usePlaylistData();
  const { setTrackMute, setTrackSolo, setTrackVolume } = usePlaylistControls();

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
    <ControlsWrapper>
      <DeleteButton onClick={() => onDeleteTrack(trackIndex)} title="Delete track">
        <XIcon size={10} weight="bold" />
      </DeleteButton>
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
        <TrackEffectControls
          trackId={trackId}
          trackName={trackState.name || `Track ${trackIndex + 1}`}
          effectsManager={trackEffectsManager}
        />
      </Controls>
    </ControlsWrapper>
  );
};

// Inner component that renders controls and waveform
interface EffectsControlsProps {
  analyserRef: React.RefObject<any>;
  trackEffectsManager: UseTrackDynamicEffectsReturn;
  isDarkMode: boolean;
  onDeleteTrack: (trackIndex: number) => void;
  onAddTracks: (newTracks: ClipTrack[]) => void;
  masterEffectsFunction: any;
  trackCount: number;
  createOfflineMasterEffects: () => any;
  tracks: ClipTrack[];
}

const EffectsControls: React.FC<EffectsControlsProps> = ({
  analyserRef,
  trackEffectsManager,
  isDarkMode,
  onDeleteTrack,
  onAddTracks,
  masterEffectsFunction,
  trackCount,
  createOfflineMasterEffects,
  tracks,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export options state
  const [exportMode, setExportMode] = useState<'master' | 'individual' | 'all'>('master');
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);
  const [applyEffectsToExport, setApplyEffectsToExport] = useState(true);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const { tracks: contextTracks, trackStates } = usePlaylistData();
  const { exportWav } = useExportWav();

  // Get the offline effects functions when needed
  const offlineEffectsFunction = applyEffectsToExport ? createOfflineMasterEffects() : undefined;
  const createOfflineTrackEffects = applyEffectsToExport
    ? trackEffectsManager.createOfflineTrackEffectsFunction
    : undefined;

  // Export all tracks as ZIP
  const handleExportAllAsZip = useCallback(async () => {
    if (contextTracks.length === 0) return;

    setIsExportingZip(true);
    setZipProgress(0);

    try {
      const zip = new JSZip();
      const totalTracks = contextTracks.length;

      for (let i = 0; i < totalTracks; i++) {
        const trackName = trackStates[i]?.name || `track-${i + 1}`;
        // Sanitize filename
        const safeFilename = trackName.replace(/[^a-z0-9_-]/gi, '_');

        const result = await exportWav(contextTracks, trackStates, {
          mode: 'individual',
          trackIndex: i,
          applyEffects: applyEffectsToExport,
          effectsFunction: offlineEffectsFunction,
          createOfflineTrackEffects,
          autoDownload: false,
        });

        zip.file(`${safeFilename}.wav`, result.blob);
        setZipProgress((i + 1) / totalTracks);
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tracks.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting tracks as ZIP:', error);
    } finally {
      setIsExportingZip(false);
      setZipProgress(0);
    }
  }, [contextTracks, trackStates, exportWav, applyEffectsToExport, offlineEffectsFunction, createOfflineTrackEffects]);

  // Render custom track controls using the track effects manager
  const renderTrackControls = (trackIndex: number) => (
    <CustomTrackControls
      trackIndex={trackIndex}
      trackEffectsManager={trackEffectsManager}
      onDeleteTrack={onDeleteTrack}
    />
  );

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files) as File[];
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    if (audioFiles.length === 0) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const newTracks: ClipTrack[] = [];

    for (const file of audioFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const newTrack = createTrack({
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          clips: [{
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            audioBuffer,
            startSample: 0,
            durationSamples: audioBuffer.length,
            offsetSamples: 0,
            gain: 1.0,
            name: file.name,
          }],
          muted: false,
          soloed: false,
          volume: 1.0,
          pan: 0,
        });

        newTracks.push(newTrack);
      } catch (error) {
        console.error('Error loading audio file:', file.name, error);
      }
    }

    if (newTracks.length > 0) {
      onAddTracks(newTracks);
    }
  }, [onAddTracks]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Handle file input change
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioFiles = (Array.from(files) as File[]).filter(file => file.type.startsWith('audio/'));
    const newTracks: ClipTrack[] = [];

    for (const file of audioFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const newTrack = createTrack({
          name: file.name.replace(/\.[^/.]+$/, ''),
          clips: [{
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            audioBuffer,
            startSample: 0,
            durationSamples: audioBuffer.length,
            offsetSamples: 0,
            gain: 1.0,
            name: file.name,
          }],
          muted: false,
          soloed: false,
          volume: 1.0,
          pan: 0,
        });

        newTracks.push(newTrack);
      } catch (error) {
        console.error('Error loading audio file:', file.name, error);
      }
    }

    if (newTracks.length > 0) {
      onAddTracks(newTracks);
    }

    // Reset input
    e.target.value = '';
  }, [onAddTracks]);

  return (
    <>
      <TopBar>
        <ControlsRow>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <ZoomInButton />
          <ZoomOutButton />
          <MasterVolumeControl />
          <AutomaticScrollCheckbox />
        </ControlsRow>
        <VisualizerWrapper>
          <FrequencyVisualizer analyserRef={analyserRef} isDarkMode={isDarkMode} />
        </VisualizerWrapper>
      </TopBar>

      <Waveform renderTrackControls={renderTrackControls} />

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

        <Separator />

        <ExportOptionsWrapper>
          <ExportSelect
            value={exportMode}
            onChange={(e) => setExportMode(e.target.value as 'master' | 'individual' | 'all')}
          >
            <option value="master">Full Mix</option>
            <option value="individual">Individual Track</option>
            <option value="all">All Tracks (ZIP)</option>
          </ExportSelect>

          {exportMode === 'individual' && (
            <ExportSelect
              value={selectedTrackIndex}
              onChange={(e) => setSelectedTrackIndex(parseInt(e.target.value, 10))}
            >
              {trackStates.map((state, index) => (
                <option key={index} value={index}>
                  {state.name || `Track ${index + 1}`}
                </option>
              ))}
            </ExportSelect>
          )}

          <CheckboxLabel>
            <input
              type="checkbox"
              checked={applyEffectsToExport}
              onChange={(e) => setApplyEffectsToExport(e.target.checked)}
            />
            Apply Effects
          </CheckboxLabel>

          {exportMode === 'all' ? (
            <BaseControlButton
              onClick={handleExportAllAsZip}
              disabled={isExportingZip || contextTracks.length === 0}
            >
              {isExportingZip ? `Exporting ${Math.round(zipProgress * 100)}%` : 'Export ZIP'}
            </BaseControlButton>
          ) : (
            <ExportWavButton
              label={exportMode === 'master' ? 'Export Mix' : 'Export Track'}
              filename={exportMode === 'master' ? 'mix' : `${trackStates[selectedTrackIndex]?.name || `track-${selectedTrackIndex + 1}`}`}
              mode={exportMode}
              trackIndex={exportMode === 'individual' ? selectedTrackIndex : undefined}
              applyEffects={applyEffectsToExport}
              effectsFunction={offlineEffectsFunction}
              createOfflineTrackEffects={createOfflineTrackEffects}
            />
          )}
        </ExportOptionsWrapper>
      </TimeControlsBar>

      <DropZone
        $isDragging={isDragging}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <DropZoneText>
          {isDragging ? 'Drop audio files here' : 'Drop audio files or click to browse'}
        </DropZoneText>
        <DropZoneHint>
          Add your own music to try out the effects! Supports MP3, WAV, OGG, and more.
        </DropZoneHint>
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
      />
    </>
  );
};

export function EffectsExample() {
  const { theme, isDarkMode } = useDocusaurusTheme();
  const defaultsAddedRef = useRef(false);

  // Mutable tracks state
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create dynamic effects manager for master effects
  const effectsManager = useDynamicEffects(256);
  const { analyserRef, masterEffects, addEffect: addMasterEffect, createOfflineEffectsFunction } = effectsManager;

  // Create track effects manager
  const trackEffectsManager = useTrackDynamicEffects();
  const { addEffectToTrack, clearTrackEffects, getTrackEffectsFunction, trackEffectsState } = trackEffectsManager;

  // Track configurations - Albert Kader "Ubiquitous" minimal techno
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus',
      name: 'Kick',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
      name: 'Bass',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/02_HiHat1.opus',
      name: 'HiHat',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus',
      name: 'Synth',
    },
  ], []);

  // Load initial audio tracks
  const { tracks: loadedTracks, loading, error } = useAudioTracks(audioConfigs);

  // Update local state when initial tracks load
  useEffect(() => {
    if (!loading && loadedTracks.length > 0) {
      setTracks(loadedTracks);
      setIsLoading(false);
    }
    if (error) {
      setLoadError(error);
      setIsLoading(false);
    }
  }, [loadedTracks, loading, error]);

  // Add default effects on mount (only once)
  useEffect(() => {
    if (!isLoading && tracks.length > 0 && !defaultsAddedRef.current) {
      defaultsAddedRef.current = true;

      // Add a reverb to the master effects chain
      addMasterEffect('reverb');

      // Add effects to individual tracks for demonstration
      // Kick: Compressor for punch
      if (tracks[0]) addEffectToTrack(tracks[0].id, 'compressor');

      // Bass: Distortion for grit
      if (tracks[1]) addEffectToTrack(tracks[1].id, 'distortion');

      // HiHat: Reverb for space
      if (tracks[2]) addEffectToTrack(tracks[2].id, 'reverb');

      // Synth: Ping Pong Delay
      if (tracks[3]) addEffectToTrack(tracks[3].id, 'pingPongDelay');
    }
  }, [isLoading, tracks, addMasterEffect, addEffectToTrack]);

  // Handle delete track
  const handleDeleteTrack = useCallback((trackIndex: number) => {
    const trackToDelete = tracks[trackIndex];
    if (trackToDelete) {
      // Clear effects for this track
      clearTrackEffects(trackToDelete.id);
    }
    setTracks(prevTracks => prevTracks.filter((_, index) => index !== trackIndex));
  }, [tracks, clearTrackEffects]);

  // Handle add tracks
  const handleAddTracks = useCallback((newTracks: ClipTrack[]) => {
    setTracks(prevTracks => [...prevTracks, ...newTracks]);
  }, []);

  // Create tracks with effects functions attached
  // Always attach effects function to allow dynamic effect addition during playback
  const tracksWithEffects = React.useMemo(() => {
    return tracks.map(track => ({
      ...track,
      effects: getTrackEffectsFunction(track.id),
    }));
  }, [tracks, getTrackEffectsFunction]);

  if (isLoading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading audio tracks...
        </div>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {loadError}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <EffectRack effectsManager={effectsManager} />

      <WaveformPlaylistProvider
        tracks={tracksWithEffects}
        samplesPerPixel={512}
        zoomLevels={[256, 512, 1024, 2048, 4096]}
        waveHeight={100}
        theme={theme}
        controls={{ show: true, width: 150 }}
        automaticScroll={true}
        effects={masterEffects}
        timescale={true}
        barWidth={2}
        barGap={0}
      >
        <EffectsControls
          analyserRef={analyserRef}
          trackEffectsManager={trackEffectsManager}
          isDarkMode={isDarkMode}
          onDeleteTrack={handleDeleteTrack}
          onAddTracks={handleAddTracks}
          masterEffectsFunction={masterEffects}
          trackCount={tracks.length}
          createOfflineMasterEffects={createOfflineEffectsFunction}
          tracks={tracks}
        />
      </WaveformPlaylistProvider>
    </Container>
  );
}
